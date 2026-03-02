#!/usr/bin/env bash
#
# Agent shim tests for dotfiles repository
#
# Usage:
#   ./tests/test-agent-shims.sh
#
# Tests that each agent command shim:
#   1. Exists and is executable (in chezmoi source)
#   2. Passes ShellCheck
#   3. Blocks execution when CLAUDECODE=1 (exit 1, stderr contains guidance)
#   4. Passes through to real binary when CLAUDECODE is unset
#   5. Real binary lookup does not resolve back to the shim itself

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHIM_DIR="$REPO_DIR/dot_local/bin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass_count=0
fail_count=0
skip_count=0

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

print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}\n"
}

has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Shim definitions: chezmoi_filename:command_name
SHIMS=(
    "executable_python:python"
    "executable_python3:python3"
    "executable_pip:pip"
    "executable_pip3:pip3"
    "executable_docker:docker"
    "executable_docker-compose:docker-compose"
)

# Create a temp directory with symlinks using the real command names.
# This simulates how chezmoi deploys shims to ~/.local/bin/.
TMPDIR_SHIMS=""
setup_shim_symlinks() {
    TMPDIR_SHIMS=$(mktemp -d)
    for entry in "${SHIMS[@]}"; do
        local file="${entry%%:*}"
        local cmd="${entry##*:}"
        local shim_path="$SHIM_DIR/$file"
        if [[ -f "$shim_path" ]]; then
            ln -sf "$shim_path" "$TMPDIR_SHIMS/$cmd"
        fi
    done
}

cleanup_shim_symlinks() {
    if [[ -n "$TMPDIR_SHIMS" && -d "$TMPDIR_SHIMS" ]]; then
        rm -rf "$TMPDIR_SHIMS"
    fi
}
trap cleanup_shim_symlinks EXIT

# --- Test: Existence and syntax ---
test_existence() {
    print_header "Shim Existence & Syntax"

    local failed=0
    for entry in "${SHIMS[@]}"; do
        local file="${entry%%:*}"
        local shim_path="$SHIM_DIR/$file"

        if [[ -f "$shim_path" ]]; then
            pass "$file exists"
        else
            fail "$file not found at $shim_path"
            failed=1
            continue
        fi

        # Check bash syntax
        if bash -n "$shim_path" 2>/dev/null; then
            pass "$file syntax (bash -n)"
        else
            fail "$file syntax (bash -n)"
            failed=1
        fi
    done

    return $failed
}

# --- Test: ShellCheck ---
test_shellcheck() {
    print_header "ShellCheck"

    if ! has_cmd shellcheck; then
        skip "shellcheck not installed"
        return 0
    fi

    local failed=0
    for entry in "${SHIMS[@]}"; do
        local file="${entry%%:*}"
        local shim_path="$SHIM_DIR/$file"

        if [[ ! -f "$shim_path" ]]; then
            skip "$file (not found)"
            continue
        fi

        if shellcheck -x -s bash "$shim_path" 2>/dev/null; then
            pass "$file"
        else
            fail "$file"
            failed=1
        fi
    done

    return $failed
}

# --- Test: CLAUDECODE=1 blocks execution ---
# Uses symlinks so SHIM_NAME resolves to the real command name.
test_agent_block() {
    print_header "Agent Block (CLAUDECODE=1)"

    local failed=0
    for entry in "${SHIMS[@]}"; do
        local file="${entry%%:*}"
        local cmd="${entry##*:}"
        local symlink="$TMPDIR_SHIMS/$cmd"

        if [[ ! -L "$symlink" ]]; then
            skip "$file (symlink not created)"
            continue
        fi

        local stderr_output
        local stdout_output
        local rc=0
        stderr_output=$(CLAUDECODE=1 bash "$symlink" --version 2>&1 1>/dev/null) || rc=$?
        stdout_output=$(CLAUDECODE=1 bash "$symlink" --version 2>/dev/null) || true

        # Should exit 1
        if [[ $rc -ne 1 ]]; then
            fail "$cmd exit code: expected 1, got $rc"
            failed=1
            continue
        fi

        # stderr should contain "Agent guard"
        if echo "$stderr_output" | grep -q "Agent guard"; then
            pass "$cmd blocks with guidance (exit 1)"
        else
            fail "$cmd stderr missing 'Agent guard' message"
            failed=1
        fi

        # stdout should contain fallback message
        if echo "$stdout_output" | grep -q "Agent guard"; then
            pass "$cmd stdout fallback message"
        else
            fail "$cmd stdout missing fallback message"
            failed=1
        fi
    done

    return $failed
}

# --- Test: Passthrough when CLAUDECODE is unset ---
# Uses symlinks so SHIM_NAME resolves correctly for binary lookup.
test_passthrough() {
    print_header "Passthrough (no CLAUDECODE)"

    local failed=0
    for entry in "${SHIMS[@]}"; do
        local file="${entry%%:*}"
        local cmd="${entry##*:}"
        local symlink="$TMPDIR_SHIMS/$cmd"

        if [[ ! -L "$symlink" ]]; then
            skip "$file (symlink not created)"
            continue
        fi

        # Check if the real binary exists on this system
        if ! has_cmd "$cmd"; then
            skip "$cmd passthrough ($cmd not installed)"
            continue
        fi

        # Run the shim via symlink without CLAUDECODE — should pass through
        local rc=0
        bash "$symlink" --version >/dev/null 2>&1 || rc=$?

        if [[ $rc -eq 0 ]]; then
            pass "$cmd passthrough ($cmd --version)"
        elif [[ $rc -eq 127 ]]; then
            fail "$cmd passthrough failed (exit 127 — binary not found)"
            failed=1
        else
            # Non-zero but not 127 — the real binary ran but returned non-zero
            # (e.g., some tools use non-zero for --version)
            pass "$cmd passthrough ($cmd ran, exit $rc)"
        fi
    done

    return $failed
}

# --- Test: Self-skip (shim does not recurse to itself) ---
# Creates an isolated PATH with only the shim symlink and system utils,
# so the shim's binary lookup finds no other candidate and must exit 127.
test_self_skip() {
    print_header "Self-Skip (no infinite recursion)"

    local failed=0
    for entry in "${SHIMS[@]}"; do
        local file="${entry%%:*}"
        local cmd="${entry##*:}"
        local symlink="$TMPDIR_SHIMS/$cmd"

        if [[ ! -L "$symlink" ]]; then
            skip "$file (symlink not created)"
            continue
        fi

        # Create a PATH with the shim dir first and system utils (for basename,
        # realpath, which) but no real binary for $cmd. We remove common binary
        # dirs and only keep /usr/bin for basic utilities.
        # The shim's fallback checks /usr/bin/$cmd, /usr/local/bin/$cmd, etc.
        # If the real binary exists at those paths, the self-skip test just
        # verifies the shim doesn't hang or loop — it will find the real one.
        local rc=0
        local stderr_output
        stderr_output=$(PATH="$TMPDIR_SHIMS:/usr/bin" bash "$symlink" --version 2>&1 1>/dev/null) || rc=$?

        if [[ $rc -eq 127 ]]; then
            # Shim couldn't find the real binary — verify correct error message
            if echo "$stderr_output" | grep -q "could not find the real"; then
                pass "$cmd self-skip (exit 127, correct error)"
            else
                fail "$cmd self-skip (exit 127 but unexpected message)"
                info "stderr: $stderr_output"
                failed=1
            fi
        elif [[ $rc -eq 0 ]]; then
            # The shim found the real binary via fallback absolute paths — that's fine,
            # it means the binary is installed and the shim correctly forwarded to it
            pass "$cmd self-skip (found real binary via fallback)"
        else
            # Non-zero, non-127 — the real binary ran with an error, but didn't loop
            pass "$cmd self-skip (no recursion, exit $rc)"
        fi
    done

    return $failed
}

# --- Summary ---
print_summary() {
    print_header "Agent Shim Test Summary"

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
        echo -e "${RED}Some agent shim tests failed!${NC}"
        return 1
    else
        echo -e "${GREEN}All agent shim tests passed!${NC}"
        return 0
    fi
}

# --- Main ---
main() {
    echo -e "${BLUE}Agent Shim Test Runner${NC}"

    setup_shim_symlinks

    local exit_code=0

    test_existence || exit_code=1
    test_shellcheck || exit_code=1
    test_agent_block || exit_code=1
    test_passthrough || exit_code=1
    test_self_skip || exit_code=1

    print_summary || exit_code=1

    exit $exit_code
}

main "$@"
