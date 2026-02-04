# Dev Session Manager

`dev` is a persistent tmux session manager for multi-device development. It provides a single entry point for creating, attaching to, and managing tmux sessions with automatic project discovery.

Sessions survive disconnects, reboots (via tmux-resurrect), and can be accessed from any device via SSH.

**Source:** `~/.local/bin/dev` (`dot_local/bin/executable_dev` in chezmoi)

## Synopsis

```bash
dev                     # Interactive picker (fzf or numbered fallback)
dev <project>           # Create or attach to session for <project>
dev claude <project>    # Force claude+shell layout (vertical split)
dev detach              # Detach from current tmux session
dev kill <name>         # Kill a session
dev kill-all            # Kill all sessions (with confirmation)
dev help                # Show built-in help
```

## Commands

| Command | Description |
|---------|-------------|
| `dev` | Open the interactive picker to select a session or project |
| `dev <project>` | Create a new session (or attach if it exists) for `<project>` |
| `dev claude <project>` | Same as above but forces the `claude` layout regardless of config |
| `dev detach` | Detach from the current tmux session (must be inside tmux) |
| `dev kill <name>` | Kill the named session |
| `dev kill-all` | Kill all tmux sessions (prompts for confirmation) |
| `dev help` | Show the built-in help text |

## Layouts

| Layout | Panes | Description |
|--------|-------|-------------|
| `default` | 1 | Single shell pane in the project directory |
| `claude` | 2 | Vertical split -- Claude Code (left) + shell (right) |

The layout for a project is determined by (in priority order):
1. The `force_layout` argument (`dev claude <project>`)
2. The per-project setting in `~/.config/dev/config`
3. The `default_layout` setting in the config file
4. Falls back to `default`

## Project Discovery

Projects are auto-discovered from `~/Projects/` by scanning up to 3 levels deep for directories containing a `.git` folder.

If two projects share the same basename (e.g. `work/api` and `personal/api`), `dev` uses the `category/project` form to disambiguate them in the picker and tab completion.

Custom-path projects defined in the config file are appended to the discovery list and also appear in the interactive picker and tab completion.

## Configuration

Per-project settings are stored in `~/.config/dev/config`:

```ini
# Default layout for all projects (optional, defaults to "default")
default_layout=default

# Per-project overrides
atomicguard=claude                           # layout only
manta-deploy=claude@myserver                 # layout + remote host
dotfiles=claude:~/.local/share/chezmoi       # layout + custom path
myproject=default:/opt/myproject@server      # all three
```

### Format

```
project=layout[:path][@host]
```

| Field | Required | Description |
|-------|----------|-------------|
| `layout` | yes | `default` or `claude` |
| `:path` | no | Custom directory (expands `~`). Omit for projects under `~/Projects`. |
| `@host` | no | SSH hostname. If set and local hostname differs, `dev` will SSH to that host. |

When a project has a custom `:path`, the config key (e.g. `dotfiles`) is used as the tmux session name instead of the directory basename.

### Adding a Custom-Path Project

1. Open `~/.config/dev/config` (create it if it doesn't exist)
2. Add a line: `myproject=claude:/path/to/project`
3. Run `dev myproject` -- a session will be created in `/path/to/project` with the `claude` layout
4. Tab completion picks up the new name immediately

## Remote Projects

If a project has `@host` in its config and the local hostname doesn't match, `dev` will SSH to the remote host and run `dev` there transparently. This works for:

- Opening sessions (`dev myproject`)
- Killing sessions (`dev kill myproject`)
- The interactive picker (remote-only projects appear in the list)

Projects that only exist on a remote host still appear in the picker with an `@host` annotation.

### How it works

1. `dev` reads the `@host` suffix from the config
2. Compares it against the local `hostname -s`
3. If they differ, runs `ssh -t <host> dev <args>` instead of acting locally

## Interactive Picker

Running `dev` with no arguments opens the interactive picker.

### fzf mode (if fzf is installed)

A fuzzy-searchable list with two sections:
- **[session]** entries for active tmux sessions (with layout type and last-activity time)
- **[project]** entries for discovered + custom-path projects not yet open

### Fallback mode (no fzf)

A numbered list with a `Select [1-N]:` prompt, grouped into:
1. **Active Sessions** -- existing tmux sessions
2. **Available Projects** -- projects without an active session

## Tab Completion

Tab completion is configured in `dot_zshrc`. `dev <TAB>` completes:
- Subcommands: `claude`, `detach`, `kill`, `kill-all`, `help`
- Active tmux session names
- Discovered projects from `~/Projects`
- Custom-path project names from the config file

## Tmux Keybindings

The tmux prefix is `C-a` (Ctrl+a). Key bindings:

| Binding | Action |
|---------|--------|
| `C-a \|` | Split horizontally |
| `C-a -` | Split vertically |
| `C-a h/j/k/l` | Navigate panes (vim-style) |
| `C-a r` | Reload tmux config |
| `C-a d` | Detach from session |

## Session Persistence

Sessions are automatically saved every 15 minutes via **tmux-continuum** and restored on tmux server start via **tmux-resurrect**.

| Action | Keybinding |
|--------|------------|
| Install/update TPM plugins | `prefix + I` |
| Manual save | `prefix + Ctrl-s` |
| Manual restore | `prefix + Ctrl-r` |

TPM is auto-installed by `run_once_after_install-tpm.sh` during chezmoi setup.

## Multi-Service Orchestration

For projects that need multiple background services, copy `~/.local/share/start-service.sh.example` to your project directory and customize it. The template provides a pattern for starting, stopping, and monitoring services within tmux panes.

## Examples

```bash
# Pick a project interactively
dev

# Open atomicguard with its configured layout
dev atomicguard

# Open dotfiles in the chezmoi source directory (custom path from config)
dev dotfiles

# Force claude+shell layout for any project
dev claude myproject

# Kill a session
dev kill myproject

# Kill all sessions (will prompt for confirmation)
dev kill-all

# Detach from current session (inside tmux)
dev detach
```
