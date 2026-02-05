#!/usr/bin/env bash
#
# Template validation for chezmoi dotfiles
#
# Usage:
#   ./tests/test-templates.sh           # Test with current platform
#   ./tests/test-templates.sh darwin    # (informational only, uses actual OS)
#   ./tests/test-templates.sh linux     # (informational only, uses actual OS)
#
# Note: Platform argument is informational only. Templates are rendered using
# the actual system's chezmoi data. For cross-platform testing, use CI.

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

pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((pass_count++))
}

fail() {
    echo -e "  ${RED}✗${NC} $1"
    if [[ -n "${2:-}" ]]; then
        echo -e "    ${RED}Error: $2${NC}"
    fi
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

# Get current platform for display
get_platform() {
    case "$(uname -s)" in
        Darwin) echo "darwin" ;;
        Linux) echo "linux" ;;
        *) echo "unknown" ;;
    esac
}

# Test a single template file
test_template() {
    local template="$1"
    local name
    name=$(basename "$template")
    local relative_path="${template#"$REPO_DIR/"}"

    # Check if chezmoi is available
    if ! has_cmd chezmoi; then
        skip "$relative_path (chezmoi not installed)"
        return 0
    fi

    # Create temp file for output
    local output_file
    output_file=$(mktemp)
    local error_file
    error_file=$(mktemp)

    # Try to render the template using chezmoi execute-template
    # Use --init to provide minimal chezmoi data for .chezmoi.toml.tmpl
    local render_success=0
    if chezmoi execute-template --init < "$template" > "$output_file" 2> "$error_file"; then
        render_success=1
    fi

    if [[ $render_success -eq 0 ]]; then
        local error_msg
        error_msg=$(head -1 "$error_file")
        fail "$relative_path (render failed)" "$error_msg"
        rm -f "$output_file" "$error_file"
        return 1
    fi

    # Additional validation based on file type
    local validation_failed=0

    # JSON validation
    # Note: VS Code settings use JSONC (JSON with Comments), which jq can't parse.
    # We skip JSON validation for VS Code settings files.
    if [[ "$name" == *.json.tmpl && "$relative_path" != *"Code/User"* ]]; then
        if has_cmd jq; then
            if ! jq empty < "$output_file" 2>/dev/null; then
                fail "$relative_path (invalid JSON)"
                validation_failed=1
            fi
        else
            info "$relative_path (jq not available for JSON validation)"
        fi
    fi

    # SSH config validation
    if [[ "$relative_path" == *"ssh/config"* ]]; then
        if has_cmd ssh; then
            # Create a temp SSH config and test it
            local temp_ssh_config
            temp_ssh_config=$(mktemp)
            cat "$output_file" > "$temp_ssh_config"
            if ! ssh -G -F "$temp_ssh_config" localhost >/dev/null 2>&1; then
                fail "$relative_path (invalid SSH config)"
                validation_failed=1
            fi
            rm -f "$temp_ssh_config"
        else
            info "$relative_path (ssh not available for config validation)"
        fi
    fi

    # Shell script validation (rendered output)
    if [[ "$name" == *.sh.tmpl ]]; then
        if ! bash -n "$output_file" 2>/dev/null; then
            fail "$relative_path (bash syntax error in rendered output)"
            validation_failed=1
        fi
    fi

    # Clean up
    rm -f "$output_file" "$error_file"

    if [[ $validation_failed -eq 0 ]]; then
        pass "$relative_path"
        return 0
    else
        return 1
    fi
}

# Find and test all templates
test_all_templates() {
    local failed=0

    # Find all .tmpl files, excluding .git directory
    local templates=()
    while IFS= read -r -d '' template; do
        templates+=("$template")
    done < <(find "$REPO_DIR" -name "*.tmpl" -type f ! -path "*/.git/*" -print0 2>/dev/null)

    if [[ ${#templates[@]} -eq 0 ]]; then
        echo "No template files found"
        return 0
    fi

    info "Found ${#templates[@]} template files"
    echo ""

    for template in "${templates[@]}"; do
        if ! test_template "$template"; then
            failed=1
        fi
    done

    return $failed
}

# Print summary
print_summary() {
    echo -e "\n${BLUE}────────────────────────────────────────${NC}"
    echo -e "  Passed:  ${GREEN}$pass_count${NC}"
    if [[ $fail_count -gt 0 ]]; then
        echo -e "  Failed:  ${RED}$fail_count${NC}"
    else
        echo -e "  Failed:  $fail_count"
    fi
    if [[ $skip_count -gt 0 ]]; then
        echo -e "  Skipped: ${YELLOW}$skip_count${NC}"
    else
        echo -e "  Skipped: $skip_count"
    fi
    echo -e "${BLUE}────────────────────────────────────────${NC}\n"

    if [[ $fail_count -gt 0 ]]; then
        return 1
    fi
    return 0
}

# Main
main() {
    local platform
    platform=$(get_platform)

    echo -e "${BLUE}Template Validation${NC}"
    echo -e "Platform: $platform"
    echo ""

    cd "$REPO_DIR"

    local exit_code=0

    if ! test_all_templates; then
        exit_code=1
    fi

    print_summary || exit_code=1

    exit $exit_code
}

main "$@"
