# Agent Command Shims

Agent command shims intercept specific commands when run by Claude Code (or other coding agents) and redirect to preferred tooling. When run by a human in a normal terminal, commands pass through to the real binary transparently.

**Source:** `dot_local/bin/executable_*` in chezmoi, deployed to `~/.local/bin/`

## Synopsis

| Command | Intercepted? | Preferred Alternative |
|---------|-------------|----------------------|
| `python` | Yes | `uv run python` |
| `python3` | Yes | `uv run python` |
| `pip` | Yes | `uv pip` |
| `pip3` | Yes | `uv pip` |
| `docker` | Yes | Infrastructure scripts |
| `docker-compose` | Yes | Infrastructure scripts |

## How It Works

### Detection Mechanism

Claude Code sets the environment variable `CLAUDECODE=1` in its bash environment. Each shim checks this variable:

```
if CLAUDECODE=1:
    print guidance message to stderr (+ stdout fallback)
    exit 1
else:
    exec the real binary with all original arguments
```

### Guidance Output

When blocked, each shim:

1. Prints a detailed guidance message to **stderr** (agents reliably see error output)
2. Prints a shorter fallback message to **stdout** (some agents read only stdout)
3. Exits with code **1** so the agent detects failure and reads the guidance

### Real Binary Lookup

When not in agent mode, the shim finds the real binary by:

1. Using `which -a` to list all candidates, skipping itself via `realpath` comparison
2. Falling back to common paths: `/usr/bin/`, `/usr/local/bin/`, `/opt/homebrew/bin/`
3. Using `exec` to replace the shim process with the real binary, forwarding all arguments

### PATH Ordering

`~/.local/bin` must appear before system binary directories in `$PATH`. The dotfiles configure this in `dot_zshrc`:

```bash
export PATH=$HOME/.local/share/chezmoi/bin:$HOME/.local/bin:$HOME/bin:$PATH
```

## Shims

### Python (`python`, `python3`)

```
→ Use 'uv run python' instead.
→ For installing packages, use 'uv add <package>' or 'uv pip install <package>'.
→ Example: uv run python script.py
```

### Pip (`pip`, `pip3`)

```
→ Use 'uv pip' instead.
→ Example: uv pip install <package>
→ For project dependencies, prefer 'uv add <package>'.
```

### Docker (`docker`)

```
→ Do not use 'docker' directly. Use the infrastructure scripts instead.
→ See: ./scripts/ or the project's Makefile/Taskfile for available commands.
→ For docker compose operations, check the project's documentation.
```

### Docker Compose (`docker-compose`)

```
→ Do not use 'docker-compose' directly. Use the infrastructure scripts instead.
→ See: ./scripts/ or the project's Makefile/Taskfile for available commands.
→ This command is deprecated upstream — prefer 'docker compose' (plugin form) via infra scripts.
```

## Adding a New Shim

1. Copy an existing shim (e.g., `dot_local/bin/executable_python`) to `dot_local/bin/executable_<command>`
2. Update the guidance messages in the `CLAUDECODE=1` block
3. Add the new file to the `SHIMS` array in `tests/test-agent-shims.sh`
4. Add the new file to the `scripts` arrays in `tests/test.sh` (`run_lint()` and `run_syntax()`)
5. Add the new file to the CI workflow loops in `.github/workflows/test.yml`
6. Update this documentation and `CLAUDE.md`

## Bypassing Shims

### Temporarily (per-command)

Override the environment variable:

```bash
CLAUDECODE=0 python script.py
```

Or use the full path to the real binary:

```bash
/usr/bin/python3 script.py
```

### Permanently (disable all shims)

Remove or rename the shim files from `~/.local/bin/`:

```bash
rm ~/.local/bin/python ~/.local/bin/python3 ~/.local/bin/pip ~/.local/bin/pip3
rm ~/.local/bin/docker ~/.local/bin/docker-compose
```

Or remove the chezmoi source files and re-apply:

```bash
rm dot_local/bin/executable_python dot_local/bin/executable_python3
rm dot_local/bin/executable_pip dot_local/bin/executable_pip3
rm dot_local/bin/executable_docker dot_local/bin/executable_docker-compose
chezmoi apply
```

## Testing

Run the agent shim tests:

```bash
./tests/test-agent-shims.sh    # Standalone
./tests/test.sh shims           # Via test runner
./tests/test.sh                 # Full suite (includes shims)
```

Tests validate:
- File existence and bash syntax
- ShellCheck linting
- Agent block behavior (CLAUDECODE=1 triggers exit 1 with guidance)
- Passthrough behavior (no CLAUDECODE passes to real binary)
- Self-skip logic (shim doesn't recurse to itself)

## Reference

- [Claude Code CLAUDECODE variable](https://github.com/anthropics/claude-code/issues/531)
- [uv documentation](https://docs.astral.sh/uv/)
