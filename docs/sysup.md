# System Update Utility (sysup)

`sysup` is a cross-platform system update utility that manages all package managers and tools from a single entry point. It works on macOS, Linux, and WSL.

**Source:** `~/.local/bin/sysup` (`dot_local/bin/executable_sysup` in chezmoi)

## Synopsis

```bash
sysup                   # Show what's outdated (same as sysup status)
sysup status            # Read-only: check each package manager for updates
sysup upgrade           # Apply all updates
sysup doctor            # Check which tools are installed + versions
sysup version           # Show sysup version
sysup help              # Show built-in help
```

## Commands

| Command | Description |
|---------|-------------|
| `sysup` / `sysup status` | Check each package manager for available updates (read-only) |
| `sysup upgrade` | Apply all updates across every installed package manager |
| `sysup doctor` | Report installed tools, versions, and key filesystem paths |
| `sysup version` | Print the sysup version |
| `sysup help` | Show the built-in help text |

## Modules

Modules are checked in the order listed below. Each module is **skipped** if its tool isn't installed.

| Module | What it does | Platform |
|--------|-------------|----------|
| `brew` | Updates Homebrew formulae. On macOS, also upgrades casks. Runs `brew cleanup --prune=30` after upgrading. | All |
| `apt` | Updates and upgrades system packages via `apt-get`. Requires `sudo`. Runs `autoremove` and `autoclean` after upgrading. | Linux/WSL |
| `fnm` | Checks the current Node.js version against the latest LTS. Installs and sets LTS as default on upgrade. | All |
| `uv` | Runs `uv self update` (skipped if uv is brew-managed) and `uv tool upgrade --all`. | All |
| `pipx` | Runs `pipx upgrade-all` to update all pipx-managed Python packages. | All |
| `tpm` | Checks if TPM is installed. On upgrade, runs the TPM updater (`~/.tmux/plugins/tpm/bin/update_plugins all`). | All |
| `vscode` | Counts installed VS Code extensions. On upgrade, re-installs each extension with `--force` to trigger updates. | All |
| `chezmoi` | Checks for pending dotfile changes. On upgrade, runs `chezmoi update --force` to pull and apply from the repo. | All |

### Module behavior

- **status**: Each module checks for available updates and reports them. No changes are made.
- **upgrade**: Each module applies its updates. A summary at the end shows which modules succeeded, failed, or were skipped.

## Doctor

`sysup doctor` reports system information, installed tools with versions, and key filesystem paths.

### Tool groups

| Group | Tools checked |
|-------|--------------|
| Package Managers | brew, apt-get, chezmoi, fnm, node, npm, uv, pipx |
| Development Tools | git, zsh, tmux, fzf, docker, python3, poetry, just, gh, curl |
| Modern CLI Replacements | eza, bat, fd, rg, delta, btop, zoxide, jq |

### Key paths

| Path | Description |
|------|-------------|
| `~/.tmux/plugins/tpm` | Tmux Plugin Manager |
| `~/.oh-my-zsh` | Oh My Zsh framework |
| `~/.config/dev/config` | Dev session manager config |
| `~/Projects` | Project discovery directory |

Each tool and path is shown with a green check or red cross indicating presence.

## Typical Workflow

```bash
sysup              # What needs updating?
sysup upgrade      # Update everything
sysup doctor       # Verify all tools are present
```

## Adding a New Module (for contributors)

Each module follows the same pattern:

1. Create two functions: `<name>_status()` and `<name>_upgrade()`
2. Gate both functions with `if ! has <tool>; then summary_skip "<name>"; return; fi`
3. Use `summary_ok`, `summary_skip`, or `summary_fail` to report results
4. Add calls to both functions in `cmd_status()` and `cmd_upgrade()`
5. Add the tool to the appropriate `tools_*` array in `cmd_doctor()` so it appears in doctor output
6. If the tool has a non-standard version flag, add a case to `get_version()`

### Version detection

The `get_version()` function handles tools with non-standard `--version` output. For most tools, it extracts just the version number. Add a new `case` entry if your tool's output format differs from `<tool> --version` printing a parseable version string.
