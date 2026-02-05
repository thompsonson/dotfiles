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
        *)
            echo "Unknown mode: $mode"
            echo "Usage: $0 [all|quick|lint|syntax|templates]"
            exit 1
            ;;
    esac

    print_summary || exit_code=1

    exit $exit_code
}

main "$@"
