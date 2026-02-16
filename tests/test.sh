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

    # Zsh syntax check
    if has_cmd zsh; then
        if [[ -f "$REPO_DIR/dot_zshrc" ]]; then
            if zsh -n "$REPO_DIR/dot_zshrc" 2>/dev/null; then
                pass "dot_zshrc (zsh -n)"
            else
                fail "dot_zshrc (zsh -n)"
                syntax_failed=1
            fi
        fi
    else
        skip "zsh not installed"
    fi

    # Bash syntax check on shell scripts
    local scripts=(
        "$REPO_DIR/dot_local/bin/executable_sysup"
        "$REPO_DIR/dot_local/bin/executable_dev"
        "$REPO_DIR/dot_local/bin/executable_sysmon"
    )

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

    return $smoke_failed
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
