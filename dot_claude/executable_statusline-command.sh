#!/usr/bin/env bash
# Claude Code status line — mirrors p10k classic style (dir + vcs left, context/model/time right)
# Receives JSON on stdin from Claude Code

input=$(cat)

# --- Directory (shorten home to ~) ---
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
home="$HOME"
cwd_display="${cwd/#$home/\~}"

# --- Git branch (no optional locks to avoid contention) ---
git_branch=""
if git -C "$cwd" --no-optional-locks rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null \
               || git -C "$cwd" --no-optional-locks rev-parse --short HEAD 2>/dev/null)
fi

# --- Model ---
model=$(echo "$input" | jq -r '.model.display_name // ""')

# --- Context remaining ---
remaining_pct=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# --- Vim mode ---
vim_mode=$(echo "$input" | jq -r '.vim.mode // empty')

# --- user@host ---
user_host="$(whoami)@$(hostname -s)"

# --- Colors ---
CYAN='\033[36m'
BLUE='\033[94m'
GREEN='\033[32m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
DIM='\033[2m'
RESET='\033[0m'

# --- Build left side: ctx | dir | branch ---
left=""
if [ -n "$remaining_pct" ]; then
  remaining_int=$(printf "%.0f" "$remaining_pct")
  left="${YELLOW}ctx:${remaining_int}%${RESET}"
fi
left="${left} ${DIM}|${RESET} ${BLUE}${cwd_display}${RESET}"
[ -n "$git_branch" ] && left="${left} ${DIM}|${RESET} ${GREEN}${git_branch}${RESET}"
[ -n "$vim_mode" ]   && left="${left} ${DIM}|${RESET} ${MAGENTA}[${vim_mode}]${RESET}"

# --- Build right side: model | user@host ---
right=""
[ -n "$model" ] && right="${CYAN}${model}${RESET}"
right="${right} ${DIM}|${RESET} ${DIM}${user_host}${RESET}"

printf '%b' "${left} ${DIM}|${RESET} ${right}"
