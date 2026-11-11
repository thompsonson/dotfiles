#!/usr/bin/env bash
#
# Local test runner for dotfiles repository
#
# Usage:
#   ./tests/test.sh           # Run all tests
#   ./tests/test.sh quick     # Lint + syntax only (no template rendering)
#   ./tests/test.sh lint      # Shellcheck only
#   ./tests/test.sh templates # Template tests only
#   ./tests/test.sh syntax    # Syntax checks only
#   ./tests/test.sh smoke     # Smoke tests only (execute scripts)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0
skip_count=0

print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}\n"
}

pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((pass_count++))
}

fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((fail_count++))
}

skip() {
    echo -e "  ${YELLOW}○${NC} $1 (skipped)"
    ((skip_count++))
}

info() {
    echo -e "  ${BLUE}→${NC} $1"
}

# Check if a command exists
has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Run shellcheck on shell scripts
run_lint() {
    print_header "Shellcheck Lint"

    if ! has_cmd shellcheck; then
        skip "shellcheck not installed"
        return 0
    fi

    local scripts=(
        "$REPO_DIR/dot_local/bin/executable_sysup"
        "$REPO_DIR/dot_local/bin/executable_dev"
        "$REPO_DIR/dot_local/bin/executable_sysmon"
        "$REPO_DIR/dot_local/bin/executable_sysbak"
        "$REPO_DIR/dot_local/bin/executable_claude-tmp-clean"
    )

    # Add run_once scripts (only pure shell, not .tmpl - Go templates confuse shellcheck)
    while IFS= read -r -d '' script; do
        scripts+=("$script")
    done < <(find "$REPO_DIR" -maxdepth 1 -name "run_once_*.sh" ! -name "*.tmpl" -print0 2>/dev/null || true)

    local lint_failed=0
    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            local name
            name=$(basename "$script")
            if shellcheck -x -s bash "$script" 2>/dev/null; then
                pass "$name"
            else
                fail "$name"
                lint_failed=1
            fi
        fi
    done

    return $lint_failed
}

# Run syntax checks
run_syntax() {
    print_header "Syntax Checks"

    local syntax_failed=0

    # Zsh syntax check (render the template first, chezmoi falls back to
    # blank defaults for prompted values when non-interactive)
    if has_cmd zsh && has_cmd chezmoi; then
        if [[ -f "$REPO_DIR/dot_zshrc.tmpl" ]]; then
            rendered_zshrc="$(mktemp)"
            if chezmoi execute-template < "$REPO_DIR/dot_zshrc.tmpl" > "$rendered_zshrc" 2>/dev/null \
                && zsh -n "$rendered_zshrc" 2>/dev/null; then
                pass "dot_zshrc.tmpl (rendered, zsh -n)"
            else
                fail "dot_zshrc.tmpl (rendered, zsh -n)"
                syntax_failed=1
            fi
            rm -f "$rendered_zshrc"
        fi
    else
        skip "zsh or chezmoi not installed"
    fi

    # Bash syntax check on shell scripts
    local scripts=(
        "$REPO_DIR/dot_local/bin/executable_sysup"
        "$REPO_DIR/dot_local/bin/executable_dev"
        "$REPO_DIR/dot_local/bin/executable_sysmon"
        "$REPO_DIR/dot_local/bin/executable_sysbak"
        "$REPO_DIR/dot_local/bin/executable_claude-tmp-clean"
    )

    if has_cmd python3; then
        # compile() checks syntax without writing a .pyc next to the script
        if python3 -c 'import sys; compile(open(sys.argv[1]).read(), sys.argv[1], "exec")' \
            "$REPO_DIR/dot_local/bin/executable_review-round" 2>/dev/null; then
            pass "executable_review-round (python syntax)"
        else
            fail "executable_review-round (python syntax)"
            syntax_failed=1
        fi
    fi

    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            local name
            name=$(basename "$script")
            if bash -n "$script" 2>/dev/null; then
                pass "$name (bash -n)"
            else
                fail "$name (bash -n)"
                syntax_failed=1
            fi
        fi
    done

    return $syntax_failed
}

# Run template tests
run_templates() {
    print_header "Template Validation"

    if [[ -x "$SCRIPT_DIR/test-templates.sh" ]]; then
        if "$SCRIPT_DIR/test-templates.sh"; then
            pass "All templates validated"
        else
            fail "Template validation failed"
            return 1
        fi
    else
        skip "test-templates.sh not found or not executable"
    fi

    return 0
}

# Run smoke tests (actually execute scripts)
run_smoke() {
    print_header "Smoke Tests"

    local sysmon="$REPO_DIR/dot_local/bin/executable_sysmon"
    local smoke_failed=0

    if [[ ! -f "$sysmon" ]]; then
        skip "executable_sysmon not found"
        return 0
    fi

    # help: exit 0, output contains USAGE
    local output
    if output=$(bash "$sysmon" help 2>&1); then
        if echo "$output" | grep -q "USAGE"; then
            pass "sysmon help"
        else
            fail "sysmon help (missing USAGE in output)"
            smoke_failed=1
        fi
    else
        fail "sysmon help (non-zero exit)"
        smoke_failed=1
    fi

    # version: exit 0, output matches sysmon [0-9]
    if output=$(bash "$sysmon" version 2>&1); then
        if echo "$output" | grep -q "sysmon [0-9]"; then
            pass "sysmon version"
        else
            fail "sysmon version (unexpected output: $output)"
            smoke_failed=1
        fi
    else
        fail "sysmon version (non-zero exit)"
        smoke_failed=1
    fi

    # Subcommands that should exit 0
    local cmd
    for cmd in status disk mem proc net; do
        if bash "$sysmon" "$cmd" >/dev/null 2>&1; then
            pass "sysmon $cmd"
        else
            fail "sysmon $cmd (exit $?)"
            smoke_failed=1
        fi
    done

    # warn: exit 0 (healthy), 1 (warnings), or 2 (critical) are all valid health statuses
    local rc
    bash "$sysmon" warn >/dev/null 2>&1
    rc=$?
    if [[ $rc -le 2 ]]; then
        pass "sysmon warn (exit $rc)"
    else
        fail "sysmon warn (exit $rc)"
        smoke_failed=1
    fi

    # Invalid subcommand should exit non-zero
    if bash "$sysmon" bogus >/dev/null 2>&1; then
        fail "sysmon bogus (expected non-zero exit)"
        smoke_failed=1
    else
        pass "sysmon bogus (rejected invalid subcommand)"
    fi

    smoke_claude_tmp_clean || smoke_failed=1
    smoke_review_round || smoke_failed=1

    return $smoke_failed
}

# review-round against a throwaway repo and a fake claude.
smoke_review_round() {
    local script="$REPO_DIR/dot_local/bin/executable_review-round"
    if ! has_cmd python3; then
        skip "review-round (needs python3)"
        return 0
    fi
    local t failed=0
    t=$(mktemp -d)
    local g=(git -c user.name=t -c user.email=t@t -c init.defaultBranch=main)
    "${g[@]}" init -q "$t/origin.git" --bare
    "${g[@]}" clone -q "$t/origin.git" "$t/repo" 2>/dev/null
    printf 'a\nb\nc\n' > "$t/repo/f.txt"
    "${g[@]}" -C "$t/repo" add f.txt && "${g[@]}" -C "$t/repo" commit -q -m base
    "${g[@]}" -C "$t/repo" push -q origin main 2>/dev/null
    "${g[@]}" -C "$t/repo" checkout -q -b feat
    printf 'a\nb\nc\nd\n' > "$t/repo/f.txt"
    "${g[@]}" -C "$t/repo" commit -q -am "feat: add d"
    printf 'a\nb\nc\nd\ne\n' > "$t/repo/f.txt"
    "${g[@]}" -C "$t/repo" commit -q -am "fix: review round 1 - add e"

    # Fake claude: one finding on each of lines 1 (base), 4 (feat), 5 (round 1 fix)
    cat > "$t/claude" <<'FAKE'
#!/bin/sh
printf '%s\n' "$@" > "$(dirname "$0")/claude-args"
[ -n "$SLOW" ] && sleep 1
cat <<'JSON'
{"session_id":"s1","total_cost_usd":0.5,"usage":{"input_tokens":10,"output_tokens":5},
 "structured_output":{"findings":[
  {"severity":"low","file":"f.txt","line":1,"summary":"old","scenario":"x"},
  {"severity":"medium","file":"f.txt","line":4,"summary":"new","scenario":"x"},
  {"severity":"high","file":"f.txt","line":5,"summary":"fixbug","scenario":"x"}]}}
JSON
FAKE
    chmod +x "$t/claude"
    # Fake gh: keeps the comment body, prints a comment address
    cat > "$t/gh" <<FAKE
#!/bin/sh
cat > "$t/comment.md"
echo "https://github.com/o/r/pull/7#issuecomment-1"
FAKE
    chmod +x "$t/gh"
    local rr=(env REVIEW_ROUND_HOME="$t/log" REVIEW_ROUND_CLAUDE="$t/claude" REVIEW_ROUND_GH="$t/gh"
              REVIEW_ROUND_AGENT=smoke REVIEW_ROUND_LIMIT=2 python3 -B "$script")

    local out rc
    out=$(cd "$t/repo" && "${rr[@]}" run --pr 7 2>&1); rc=$?
    if [[ $rc -eq 1 ]] && grep -q "fix (round 1)" <<<"$out" && grep -q "round 1/2" <<<"$out" \
        && python3 - "$t/log/findings.jsonl" <<'PY'
import json, sys
o = {json.loads(l)["summary"]: json.loads(l)["origin"] for l in open(sys.argv[1])}
assert o == {"old": "pre-existing", "new": "original", "fixbug": "fix"}, o
PY
    then
        pass "review-round tags pre-existing, original and fix findings"
    else
        fail "review-round origins (rc=$rc): $out"; failed=1
    fi
    if grep -q "round 1/2" "$t/comment.md" && grep -q "| high | fix (round 1) |" "$t/comment.md" \
        && grep -q '"posted": "https://github.com/o/r/pull/7#issuecomment-1"' "$t/log/runs.jsonl"; then
        pass "review-round comments on the PR and logs the comment"
    else
        fail "review-round PR comment: $(cat "$t/comment.md" 2>/dev/null)"; failed=1
    fi
    if ! grep -q Bash "$t/claude-args" && grep -qx dontAsk "$t/claude-args" && grep -qx "Read,Grep,Glob" "$t/claude-args" \
        && grep -qx -- --strict-mcp-config "$t/claude-args"; then
        pass "review-round starts the reviewer read-only"
    else
        fail "review-round origins (rc=$rc): $out"; failed=1
    fi

    # A reply with no findings data is an error, and errors use up no rounds
    printf '#!/bin/sh\necho "{\\"result\\": \\"no data\\"}"\n' > "$t/claude-bad"
    chmod +x "$t/claude-bad"
    out=$(cd "$t/repo" && "${rr[@]/#REVIEW_ROUND_CLAUDE=*/REVIEW_ROUND_CLAUDE=$t/claude-bad}" run 2>&1); rc=$?
    if [[ $rc -eq 2 ]] && grep -q "round 2/2: error" <<<"$out"; then
        pass "review-round logs an empty reply as an error"
    else
        fail "review-round empty reply (rc=$rc): $out"; failed=1
    fi
    printf '[]' > "$t/none.json"
    out=$(cd "$t/repo" && "${rr[@]}" record --findings "$t/none.json" --round 1 2>&1); rc=$?
    if [[ $rc -eq 2 ]] && grep -q "already recorded" <<<"$out"; then
        pass "review-round won't record a round number already used"
    else
        fail "review-round record --round (rc=$rc): $out"; failed=1
    fi

    # Two runs at once take different rounds
    (cd "$t/repo" && "${rr[@]}" allow feat 2 --by person >/dev/null)
    (cd "$t/repo" && SLOW=1 "${rr[@]}" run --no-post >"$t/p1" 2>&1) &
    (cd "$t/repo" && SLOW=1 "${rr[@]}" run --no-post >"$t/p2" 2>&1) &
    wait
    if cat "$t/p1" "$t/p2" | grep -q "round 2/4" && cat "$t/p1" "$t/p2" | grep -q "round 3/4"; then
        pass "review-round gives parallel runs different rounds"
    else
        fail "review-round parallel: $(cat "$t/p1" "$t/p2")"; failed=1
    fi

    printf '[{"severity":"low","summary":"r","scenario":"x"}]' > "$t/f.json"
    (cd "$t/repo" && "${rr[@]}" record --findings "$t/f.json" --reviewer sub >/dev/null 2>&1)
    out=$(cd "$t/repo" && "${rr[@]}" run 2>&1); rc=$?
    if [[ $rc -eq 3 ]] && grep -q refused <<<"$out"; then
        pass "review-round refuses a round past the limit"
    else
        fail "review-round limit (rc=$rc): $out"; failed=1
    fi
    (cd "$t/repo" && "${rr[@]}" allow feat 1 --by person >/dev/null)
    out=$(cd "$t/repo" && "${rr[@]}" run 2>&1); rc=$?
    if [[ $rc -eq 1 ]] && grep -q "round 5/5" <<<"$out"; then
        pass "review-round runs again once a person allows it"
    else
        fail "review-round allow (rc=$rc): $out"; failed=1
    fi

    local before after
    before=$("${rr[@]}" stats 2>&1)
    "${rr[@]}" rotate --force >/dev/null
    (cd "$t/repo" && "${rr[@]}" allow feat 1 --by person >/dev/null)
    (cd "$t/repo" && "${rr[@]}" run >/dev/null 2>&1)
    "${rr[@]}" rotate --force >/dev/null
    "${rr[@]}" rotate --keep 1 >/dev/null
    (cd "$t/repo" && "${rr[@]}" allow feat 1 --by person >/dev/null)
    (cd "$t/repo" && "${rr[@]}" run >/dev/null 2>&1)
    "${rr[@]}" rotate --force >/dev/null
    "${rr[@]}" rotate --keep 1 >/dev/null
    after=$("${rr[@]}" stats 2>&1)
    if [[ ! -s "$t/log/runs.jsonl" ]] && grep -q "Runs: 5 rounds" <<<"$before" \
        && grep -q "Runs: 7 rounds" <<<"$after" && grep -q "Introduced by fixes: 6 of 19" <<<"$after"; then
        pass "review-round rotate archives and keeps running totals"
    else
        fail "review-round rotate: before=[$before] after=[$after]"; failed=1
    fi
    if "${rr[@]}" status | grep -q "feat"; then
        pass "review-round status lists the branch"
    else
        fail "review-round status"; failed=1
    fi
    rm -rf "$t"
    return $failed
}

# claude-tmp-clean against a fake /tmp/claude-<uid> tree.
smoke_claude_tmp_clean() {
    local script="$REPO_DIR/dot_local/bin/executable_claude-tmp-clean"
    if [[ ! -d /proc/self/fd ]]; then
        skip "claude-tmp-clean (needs Linux /proc)"
        return 0
    fi

    local t failed=0
    t=$(mktemp -d)
    local root="$t/root" projects="$t/projects" p="-home-x-proj"
    local idle=11111111-1111-1111-1111-111111111111
    local recent=22222222-2222-2222-2222-222222222222
    local busy=33333333-3333-3333-3333-333333333333
    local keyring=44444444-4444-4444-4444-444444444444
    mkdir -p "$projects/$p" "$t/bin" "$t/sbin"
    for s in $idle $recent $busy $keyring; do
        mkdir -p "$root/$p/$s/scratchpad"
        touch -d '10 days ago' "$projects/$p/$s.jsonl"
    done
    touch "$projects/$p/$recent.jsonl"

    # Git checkouts in idle folders, made from one parent repo.
    local wt_dirty=55555555-5555-5555-5555-555555555555
    local wt_detached=66666666-6666-6666-6666-666666666666
    local wt_clean=77777777-7777-7777-7777-777777777777
    local clone=88888888-8888-8888-8888-888888888888
    local stash=99999999-9999-9999-9999-999999999999
    local g=(git -c user.name=t -c user.email=t@t -c init.defaultBranch=main)
    "${g[@]}" init -q "$t/repo" && "${g[@]}" -C "$t/repo" commit -q --allow-empty -m one
    for s in $wt_dirty $wt_detached $wt_clean $clone $stash; do
        mkdir -p "$root/$p/$s/scratchpad"
        touch -d '10 days ago' "$projects/$p/$s.jsonl"
    done
    "${g[@]}" -C "$t/repo" worktree add -q -b dirty "$root/$p/$wt_dirty/scratchpad/w"
    echo edit > "$root/$p/$wt_dirty/scratchpad/w/file"
    "${g[@]}" -C "$t/repo" worktree add -q --detach "$root/$p/$wt_detached/scratchpad/w"
    "${g[@]}" -C "$root/$p/$wt_detached/scratchpad/w" commit -q --allow-empty -m detached
    "${g[@]}" -C "$t/repo" worktree add -q -b clean "$root/$p/$wt_clean/scratchpad/w"
    "${g[@]}" clone -q "$t/repo" "$root/$p/$clone/scratchpad/c"
    "${g[@]}" -C "$root/$p/$clone/scratchpad/c" commit -q --allow-empty -m unpushed
    "${g[@]}" -C "$t/repo" commit -q --allow-empty -m two
    "${g[@]}" clone -q "$t/repo" "$root/$p/$stash/scratchpad/c"
    echo work > "$root/$p/$stash/scratchpad/c/file"
    "${g[@]}" -C "$root/$p/$stash/scratchpad/c" stash push -q -u

    # Named gpg-agent so the process name matches. The orphan needs a
    # --homedir in its command line, so it is bash; -c keeps bash from exec'ing sleep.
    cp "$(command -v sleep)" "$t/sbin/gpg-agent"
    cp "$(command -v bash)" "$t/bin/gpg-agent"
    (cd "$root/$p/$busy" && exec sleep 60) &
    local busy_pid=$!
    (cd "$root/$p/$keyring" && exec "$t/sbin/gpg-agent" 60) &
    local agent_pid=$!
    "$t/bin/gpg-agent" -c 'sleep 60; :' --homedir "$root/$p/gone/h" &
    local orphan_pid=$!
    sleep 0.5

    local run=(env CLAUDE_TMP_ROOT="$root" CLAUDE_PROJECTS_DIR="$projects" bash "$script")
    "${run[@]}" >/dev/null 2>&1
    if [[ -d "$root/$p/$idle" ]] && kill -0 "$orphan_pid" 2>/dev/null; then
        pass "claude-tmp-clean dry run changes nothing"
    else
        fail "claude-tmp-clean dry run changed something"; failed=1
    fi

    "${run[@]}" --delete >/dev/null 2>&1
    sleep 0.2
    if [[ ! -e "$root/$p/$idle" ]]; then pass "claude-tmp-clean removes an idle folder"
    else fail "claude-tmp-clean left an idle folder"; failed=1; fi
    if [[ -d "$root/$p/$recent" ]]; then pass "claude-tmp-clean keeps a recent session"
    else fail "claude-tmp-clean removed a recent session"; failed=1; fi
    if [[ -d "$root/$p/$busy" ]]; then pass "claude-tmp-clean keeps a folder in use"
    else fail "claude-tmp-clean removed a folder in use"; failed=1; fi
    if [[ ! -e "$root/$p/$keyring" ]]; then pass "claude-tmp-clean ignores gpg daemons as use"
    else fail "claude-tmp-clean kept a folder only gpg-agent used"; failed=1; fi
    if ! kill -0 "$orphan_pid" 2>/dev/null; then pass "claude-tmp-clean stops an orphaned gpg daemon"
    else fail "claude-tmp-clean left an orphaned gpg daemon"; failed=1; fi

    if [[ -d "$root/$p/$wt_dirty" ]]; then pass "claude-tmp-clean keeps a worktree with uncommitted changes"
    else fail "claude-tmp-clean removed a worktree with uncommitted changes"; failed=1; fi
    if [[ -d "$root/$p/$wt_detached" ]]; then pass "claude-tmp-clean keeps commits no branch holds"
    else fail "claude-tmp-clean removed commits no branch holds"; failed=1; fi
    if [[ -d "$root/$p/$clone" ]]; then pass "claude-tmp-clean keeps a clone with unpushed commits"
    else fail "claude-tmp-clean removed a clone with unpushed commits"; failed=1; fi
    if [[ -d "$root/$p/$stash" ]]; then pass "claude-tmp-clean keeps a clone with a stash"
    else fail "claude-tmp-clean removed a clone with a stash"; failed=1; fi
    if [[ ! -e "$root/$p/$wt_clean" ]] && ! git -C "$t/repo" worktree list | grep -qF "$wt_clean"; then
        pass "claude-tmp-clean removes a clean worktree and unregisters it"
    else
        fail "claude-tmp-clean left a clean worktree or its registration"; failed=1
    fi

    if CLAUDE_TMP_ROOT="$root" bash "$script" --days x >/dev/null 2>&1; then
        fail "claude-tmp-clean accepted --days x"; failed=1
    else
        pass "claude-tmp-clean rejects a bad --days"
    fi

    kill "$busy_pid" "$agent_pid" "$orphan_pid" 2>/dev/null || true
    wait 2>/dev/null || true
    rm -rf "$t"
    return $failed
}

# Print summary
print_summary() {
    print_header "Summary"

    local total=$((pass_count + fail_count + skip_count))
    echo -e "  Total:   $total"
    echo -e "  ${GREEN}Passed:  $pass_count${NC}"
    if [[ $fail_count -gt 0 ]]; then
        echo -e "  ${RED}Failed:  $fail_count${NC}"
    else
        echo -e "  Failed:  $fail_count"
    fi
    if [[ $skip_count -gt 0 ]]; then
        echo -e "  ${YELLOW}Skipped: $skip_count${NC}"
    else
        echo -e "  Skipped: $skip_count"
    fi
    echo ""

    if [[ $fail_count -gt 0 ]]; then
        echo -e "${RED}Some tests failed!${NC}"
        return 1
    else
        echo -e "${GREEN}All tests passed!${NC}"
        return 0
    fi
}

# Main
main() {
    local mode="${1:-all}"

    echo -e "${BLUE}Dotfiles Test Runner${NC}"
    echo -e "Mode: $mode"

    cd "$REPO_DIR"

    local exit_code=0

    case "$mode" in
        all)
            run_lint || exit_code=1
            run_syntax || exit_code=1
            run_templates || exit_code=1
            run_smoke || exit_code=1
            ;;
        quick)
            run_lint || exit_code=1
            run_syntax || exit_code=1
            ;;
        lint)
            run_lint || exit_code=1
            ;;
        syntax)
            run_syntax || exit_code=1
            ;;
        templates)
            run_templates || exit_code=1
            ;;
        smoke)
            run_smoke || exit_code=1
            ;;
        *)
            echo "Unknown mode: $mode"
            echo "Usage: $0 [all|quick|lint|syntax|templates|smoke]"
            exit 1
            ;;
    esac

    print_summary || exit_code=1

    exit $exit_code
}

main "$@"
