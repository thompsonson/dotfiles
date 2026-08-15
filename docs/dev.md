# Dev Session Manager

`dev` is a persistent tmux session manager for multi-device development. It provides a single entry point for creating, attaching to, and managing tmux sessions with automatic project discovery, remote-host routing, and inter-agent messaging.

Sessions survive disconnects, reboots (via tmux-resurrect), and can be accessed from any device via SSH. A background daemon (`dev --daemon`) backs session state over a Unix socket, so most commands are fast, scriptable, and work the same locally or against a remote host.

**Source:** `~/.local/bin/dev` — a standalone Rust binary (maintained in its own `dev` project repo, not chezmoi-managed). Installed/updated via `dev --update`; chezmoi only sets up its config directory and PATH.

> **Note:** `dev` moved from subcommands (`dev status`, `dev kill <name>`, ...) to `--flag` commands (`dev --status`, `dev --kill <name>`, ...). The old subcommand forms still work but are deprecated — run `dev --help` for the authoritative, current list.

## Synopsis

```bash
dev                          # Interactive picker (fzf or numbered fallback)
dev <project>                # Create or attach to session for <project>
dev <project> --agent opencode  # Override the session's agent
dev --start <project>        # Start a session without attaching
dev --stop <session>         # Stop (kill) a session
dev --status                 # Session status table
dev --list                   # JSON: sessions + discovered projects
dev --kill <name>            # Kill a session
dev --kill-all               # Kill all sessions (prompts for confirmation)
dev --detach                 # Detach from current tmux session
dev --doctor                 # Check environment and config
dev --help                   # Full, current command reference
```

## Commands

| Command | Description |
|---------|-------------|
| `dev` | Open the interactive picker to select a session or project |
| `dev <project>` | Create a new session (or attach if it exists) for `<project>` |
| `dev --start <project> [--agent <profile>]` | Start a session without attaching |
| `dev --stop <session>` | Stop (kill) a session |
| `dev --status [--json]` | Session status table (git branch, dirty flag, last activity) |
| `dev --list [--agent claude\|opencode]` | JSON: sessions + discovered/custom-path projects |
| `dev --detach` | Detach from the current tmux session (must be inside tmux) |
| `dev --kill <session>` | Kill the named session |
| `dev --kill-all` | Kill all tmux sessions (prompts for confirmation; `--force`/`-y` skips it) |
| `dev --layout [name]` | Show or change the pane arrangement for the current session |
| `dev --doctor [<host>] [--config F]` | Check environment and config; with `<host>`, checks that machine |
| `dev --daemon` | Run the Unix-socket API server (usually managed for you) |
| `dev --daemon restart [<host>]` | Restart the daemon (local, or the given/configured host) |
| `dev --update [--check]` | Check for and apply updates |
| `dev --sandbox show\|generate <project>` | Show or generate the nono sandbox profile for a project |
| `dev --help` / `dev --version` | Full help / version |

### Inter-agent messaging

`dev` also doubles as the transport for talking to agents (Claude Code, opencode, Codex, ...) running in other sessions on this or another machine — see `~/.config/dev/agents-env.md` for the full pattern.

| Command | Description |
|---------|-------------|
| `dev --run-in <session>[:<window>.<pane>] <command...> [--timeout N] [--json]` | Run a background command from the pane's cwd and capture output |
| `dev --peek <session> [--pane 1.1] [--lines N] [--json]` | Print the latest pane content without interacting |
| `dev --inspect <session> [--lines N] [--full]` | JSON session metadata, git state, and pane content |
| `dev --send <session>[:<window>.<pane>] <message...>` | Send a message into a pane, prefixed with sender identity so the receiver can reply (`dev --host <host> --send <session>:1.1 "..."`) |

## Layouts

| Layout | Panes | Description |
|--------|-------|-------------|
| `default` | 1 | Single shell pane in the project directory |
| `claude` | 2 | Vertical split — Claude Code (left) + shell (right) |
| `opencode` | 2 | Vertical split — opencode (left) + shell (right) |

The layout is a legacy concept superseded by `agent` (see Configuration below) but is still honored for backward compatibility. Priority order:
1. `--agent claude|opencode` on the command line
2. The project's `agent` or `layout` field in `~/.config/dev/config.toml`
3. `defaults.layout` in the config file
4. Falls back to `default`

## Project Discovery

Projects are auto-discovered from `~/Projects/` by scanning up to 3 levels deep for directories containing a `.git` folder.

If two projects share the same basename (e.g. `work/api` and `personal/api`), `dev` uses the `category/project` form to disambiguate them in the picker and tab completion.

Custom-path projects defined in the config file (anything with an explicit `path`) are appended to the discovery list and also appear in the interactive picker and tab completion.

## Configuration

Per-project settings are stored in **`~/.config/dev/config.toml`** (TOML — this replaced the old `~/.config/dev/config` INI format; that file is no longer read).

```toml
[defaults]
layout = "default"
host = "myserver"          # optional: default remote host for all projects

[sandbox]
backend = "nono"
base_profile = "nolabs-ai/pi"
sockets = ["/run/user/1000/dev.sock"]

[project.atomicguard]
path = "~/Projects/thompsonson/atomicguard"     # omit for projects under ~/Projects
repository = "https://github.com/thompsonson/atomicguard"
responsibility = "Maintain the AtomicGuard project"

[project.atomicguard.sandbox]
write = [".", "~/.config/gh"]
read = ["~/.gitconfig", "~/.ssh"]
allow = ["/tmp", "~/.omp"]

[project.dotfiles]
path = "~/.local/share/chezmoi"                 # custom path: outside ~/Projects
repository = "https://github.com/thompsonson/dotfiles"
responsibility = "Maintain the chezmoi-managed dotfiles repository"
layout = "claude"

[project.dotfiles.sandbox]
write = ["."]
read = ["~/.gitconfig", "~/.ssh"]
allow = ["/tmp"]
```

### Fields (per `[project.<name>]`)

| Field | Required | Description |
|-------|----------|--------------|
| `path` | no | Custom directory (expands `~`). Omit for projects under `~/Projects`. |
| `host` | no | SSH hostname; omit for local projects. |
| `layout` | no | Legacy pane arrangement: `default`, `claude`, or `opencode`. |
| `agent` | no | Default agent (`claude` or `opencode`) for new sessions — preferred over `layout`. |
| `repository` | no | Informational — shown in `dev --status`/`--list`. |
| `responsibility` | no | Informational — one-line description shown in `dev --status`/`--list`. |
| `sandbox` | no | `[project.<name>.sandbox]` table: `write`, `read`, `allow` path lists for the nono sandbox. See `dev --sandbox show <project>`. |

After editing `config.toml`, run **`dev --daemon restart`** — the daemon caches config in memory and does not hot-reload on file changes. Confirm with `dev --doctor` (checks the config parses) and `dev --list` (confirms the project is registered).

### Adding a Custom-Path Project

1. Open `~/.config/dev/config.toml` (create it if it doesn't exist)
2. Add a `[project.myproject]` block with `path = "/path/to/project"` and any other fields
3. Run `dev --daemon restart` to pick up the change
4. Run `dev myproject` — a session will be created in `/path/to/project`
5. Tab completion picks up the new name after the daemon restart

## Remote Projects

If a project has `host` set (directly, or inherited from `defaults.host`) and it doesn't match the local hostname, `dev` transparently routes to that machine over SSH. This works for opening sessions, killing sessions, status/list, and more. Use `--host <machine>` to target an explicit machine regardless of config, `--local` to force local operation even when a remote host is configured, or `--all` to aggregate `--list`/`--status` across every host in the config.

## Interactive Picker

Running `dev` with no arguments opens the interactive picker.

### fzf mode (if fzf is installed)

A fuzzy-searchable list with two sections:
- **[session]** entries for active tmux sessions (with layout/agent type and last-activity time)
- **[project]** entries for discovered + custom-path projects not yet open

### Fallback mode (no fzf)

A numbered list with a `Select [1-N]:` prompt, grouped into:
1. **Active Sessions** — existing tmux sessions
2. **Available Projects** — projects without an active session

## Tab Completion

Tab completion is configured in `dot_zshrc.tmpl`. `dev <TAB>` completes:
- Active tmux session names
- Discovered projects from `~/Projects`
- Custom-path project names from `config.toml`

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

# Open atomicguard with its configured agent/layout
dev atomicguard

# Open dotfiles in the chezmoi source directory (custom path from config)
dev dotfiles

# Force the opencode agent for a session, regardless of config
dev myproject --agent opencode

# Start a session without attaching, then check status
dev --start myproject
dev --status

# Kill a session / kill everything
dev --kill myproject
dev --kill-all

# Detach from current session (inside tmux)
dev --detach

# Peek at another session's pane without attaching
dev --peek intelligent_agents

# Send a message to an agent in another session
dev --send atomicguard "heads up: config.toml changed, restart when convenient"

# After editing config.toml
dev --daemon restart
dev --doctor
```
