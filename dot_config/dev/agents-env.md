# Agents Environment

This file describes how to discover and communicate with other AI coding agents
running on this machine. Each project runs in a persistent tmux session managed
by the `dev` CLI, with an agent in one pane and a shell in the other.

Any agent (OpenCode, Claude Code, Codex, etc.) can use this to find peers and
send them work.

## Prerequisites

- `dev` on PATH (installed via `~/.local/bin/dev`)
- `jq` on PATH for parsing `dev list` output (recipes below use it)

## Discovery — finding active sessions

```
dev list | jq '.sessions[] | {name, layout, pane_count}'
```

### All sessions as a table (most recent first)

```bash
dev list | jq -r '
  def ago: if . < 60 then "\(.)s"
           elif . < 3600 then "\(./60|floor)m"
           elif . < 86400 then "\(./3600|floor)h"
           else "\(./86400|floor)d" end;
  ["SESSION","LAYOUT","PANES","LAST ACTIVE"],
  (.sessions | sort_by(.last_activity) | reverse | .[] |
    [.name, .layout, (.pane_count|tostring), (now - .last_activity | floor | ago)])
  | @tsv
' | column -t -s $'\t' | awk 'NR==1{print; gsub(/[^ ]/,"-"); print} NR>1'
```

### Sessions with agent layout (e.g. "claude")

```bash
dev list | jq '
  .sessions | map(select(.layout == "claude")) | .[]
'
```

### Get target strings for messaging

Each pane is addressable as `<session-name>:<pane-id>`. In the standard
`claude` layout the agent is pane `1.1`:

```bash
dev list | jq -r '
  .sessions[] | select(.layout == "claude") | "\(.name):1.1"
'
```

### Count running agent sessions

```bash
dev list | jq '[.sessions[] | select(.layout == "claude")] | length'
```

## Target format

Sessions and panes are addressed as:

```
<session-name>:<pane-id>
```

Examples:
- `dotfiles:1.1` — left pane (agent) of the `dotfiles` session
- `atomicguard:1.2` — right pane (shell) of the `atomicguard` session

Get pane IDs from `dev list` — each session object includes the pane count.

## Sending messages (`dev send`)

Send a message to another agent's pane. The message appears as if typed into
that pane — the receiving agent sees it in its terminal output.

```bash
dev send dotfiles:1.1 "Can you check the template syntax in run_once_install-packages.sh.tmpl?"
```

Multiple words are joined with spaces:

```bash
dev send atomicguard:1.1 "Run cargo test and report the result"
```

The receiving agent must be configured to watch its pane for incoming messages
(or the user delegates them explicitly). `dev send` is fire-and-forget — there
is no built-in reply channel. To get a result back, use `dev run-in` instead.

## Running commands (`dev run-in`)

Run a command in a target pane and capture its output:

```bash
dev run-in dotfiles:1.1 "chezmoi apply --dry-run"
```

For machine-parseable output:

```bash
dev run-in --json dotfiles:1.1 "chezmoi apply --dry-run"
```

Returns a JSON object with:
- `stdout` — pane capture text (includes shell prompts, command echo)
- `exit_code` — shell exit status (`$?`)
- `duration_ms` — wall-clock time in milliseconds

This is synchronous — the command blocks until the output is captured or a
timeout (default 30s) is reached.

## Agent identity conventions

In the standard `claude` layout the tmux window has two panes:

```
┌──────────────────────┬──────┐
│  Agent (1.1)         │  1.2 │
│                      │      │
│  Claude Code /       │ shell│
│  OpenCode / etc.     │      │
└──────────────────────┴──────┘
```

- **Pane `1.1`** — the AI coding agent (Claude Code, OpenCode, Codex, etc.)
- **Pane `1.2`** — a shell for running commands

Agents should assume they are in pane `1.1` of their session (the left split).
When sending work to another agent, target `session-name:1.1`.

The `default` layout is a single pane — no agent split.

## How agents consume this file

- **OpenCode** — add to `instructions` array in `opencode.jsonc`:
  ```jsonc
  "instructions": [
    "~/.config/dev/agents-env.md"
  ]
  ```
- **Claude Code** — referenced from `CLAUDE.md` in each project
- **Other agents** — configure via their own instruction injection mechanism
