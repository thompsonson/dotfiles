# Dotfiles Agent

The dotfiles agent is a Claude Code + shell tmux session for maintaining this chezmoi repository. It is pre-configured as a custom-path project in the dev session manager.

## Quick Start

```bash
dev dotfiles
```

This creates (or reattaches to) a tmux session named `dotfiles` in `~/.local/share/chezmoi` with the `claude` layout: Claude Code on the left pane, a shell on the right.

## What Happens

1. `dev` looks up `dotfiles` in `~/.config/dev/config` and finds `claude:~/.local/share/chezmoi`
2. Extracts layout `claude` and path `~/.local/share/chezmoi`
3. Creates tmux session `dotfiles` with a vertical split
4. Left pane: runs `claude` (Claude Code CLI) in the chezmoi source directory
5. Right pane: shell in the same directory for manual commands

## Project-Level Permissions

The session uses project-level Claude Code permissions defined in `.claude/settings.json`. Read-only operations are auto-approved:

| Category | Auto-approved commands |
|----------|----------------------|
| chezmoi | `status`, `diff`, `doctor`, `managed`, `data`, `execute-template`, `apply --dry-run`, `cat-config` |
| sysup | `doctor`, `status` |
| git | `status`, `log`, `diff` |
| File browsing | `ls`, `find`, `cat`, `head`, `tail`, `rg`, `grep`, `fd`, `tree`, `bat`, `eza` |
| System info | `command -v`, `which`, `uname`, `brew list`, `brew info`, `apt list` |

**Write operations require approval:** `chezmoi apply`, `git commit`, file edits, package installation, etc.

## Example Tasks

### Check system state (auto-approved, no prompts)

In the Claude Code pane, ask:

```
"What packages are installed?"          # runs brew list, apt list
"Run sysup doctor"                      # checks all tool versions
"What chezmoi changes are pending?"     # runs chezmoi status, chezmoi diff
"Show the git log"                      # runs git log
```

### Make changes (will prompt for approval)

```
"Add ripgrep to the install script"     # edits run_once_install-packages.sh.tmpl
"Add a new alias for tldr"             # edits dot_zshrc
"Update the tmux prefix key"           # edits dot_tmux.conf
"Apply the changes"                     # runs chezmoi apply
```

## Using the Shell Pane

The right pane is a regular shell in the chezmoi source directory. Use it for:

```bash
chezmoi apply --dry-run      # Preview what chezmoi would change
chezmoi diff                 # See pending diffs
chezmoi status               # List modified files
git status                   # Check repo state
git log --oneline -10        # Recent commits
sysup doctor                 # Verify tool health
```

## Session Lifecycle

```bash
dev dotfiles        # Create or reattach
C-a d               # Detach (session stays alive in background)
dev dotfiles        # Reattach later, from any terminal or SSH session
dev kill dotfiles   # Destroy the session when done
```

Sessions persist across disconnects and are auto-saved by tmux-resurrect every 15 minutes.
