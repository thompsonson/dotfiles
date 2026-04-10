#!/bin/sh
# Claude Code status line — mirrors powerlevel10k style (context | dir | git | model)
input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
used=$(echo "$input" | jq -r '(.context_window.used_percentage // empty) | floor')
five_hour=$(echo "$input" | jq -r '(.rate_limits.five_hour.used_percentage // empty) | floor')
seven_day=$(echo "$input" | jq -r '(.rate_limits.seven_day.used_percentage // empty) | floor')

# ANSI color helpers (reset at end of each segment)
RESET='\033[0m'
BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
CYAN='\033[36m'

# Shorten home directory to ~
short_dir=$(echo "$cwd" | sed "s|^$HOME|~|")

# Git branch (skip lock to avoid blocking)
git_branch=""
if [ -n "$cwd" ] && git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null \
    || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
fi

# Pick color for a used-percentage value: green < 50%, yellow 50-79%, red >= 80%
usage_color() {
  _pct="$1"
  if [ "$_pct" -ge 80 ]; then
    printf '%s' "$RED"
  elif [ "$_pct" -ge 50 ]; then
    printf '%s' "$YELLOW"
  else
    printf '%s' "$GREEN"
  fi
}

# Build the line left-to-right: ctx% | 5h% | 7d% | dir | branch | model
# Helper to append a segment with | separator
append() {
  if [ -n "$parts" ]; then
    parts="${parts}  |  ${1}"
  else
    parts="$1"
  fi
}

parts=""

if [ -n "$used" ]; then
  color=$(usage_color "$used")
  append "$(printf "${color}%s%%${RESET} ctx" "$used")"
fi

if [ -n "$five_hour" ]; then
  color=$(usage_color "$five_hour")
  append "$(printf "${color}%s%%${RESET} 5h" "$five_hour")"
fi

if [ -n "$seven_day" ]; then
  color=$(usage_color "$seven_day")
  append "$(printf "${color}%s%%${RESET} 7d" "$seven_day")"
fi

if [ -n "$short_dir" ]; then
  append "$(printf "${BLUE}%s${RESET}" "$short_dir")"
fi

if [ -n "$git_branch" ]; then
  append "$(printf "${GREEN}%s${RESET}" "$git_branch")"
fi

if [ -n "$model" ]; then
  append "$(printf "${CYAN}%s${RESET}" "$model")"
fi

printf '%b' "$parts"
