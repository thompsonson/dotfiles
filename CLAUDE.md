# Claude Code Instructions

This file contains specific instructions for Claude Code when working with this dotfiles repository.

## Repository Context

This is a chezmoi-managed dotfiles repository that supports:
- **Platforms**: macOS, Linux, and WSL
- **Shell**: Zsh with oh-my-zsh, antigen, and powerlevel10k
- **Package Management**: Homebrew (cross-platform)
- **Node.js**: fnm for version management
- **VS Code**: Settings, keybindings, and extensions configuration
- **Remote Development**: Tmux configuration for managing services and interactive sessions

## Common Commands

### Testing and Validation
- **Run all tests**: `./tests/test.sh`
- **Quick lint check**: `./tests/test.sh quick`
- **Apply changes**: `chezmoi apply`
- **Check status**: `chezmoi status`
- **Validate templates**: `chezmoi execute-template`
- **Dry run**: `chezmoi apply --dry-run`

### System Updates
- **Check outdated**: `sysup` or `sysup status`
- **Apply all updates**: `sysup upgrade`
- **Fix broken packages**: `sysup repair`
- **Verify tools**: `sysup doctor`

### System Monitoring
- **Health dashboard**: `sysmon` or `sysmon status`
- **Disk usage**: `sysmon disk`
- **Memory usage**: `sysmon mem`
- **Processes**: `sysmon proc`
- **Network**: `sysmon net`
- **Health warnings**: `sysmon warn`

### Backup Management
- **Backup status**: `sysbak` or `sysbak status`
- **Run backup**: `sysbak run [alpha|beta|gamma]`
- **File history**: `sysbak list <file>`
- **Diff version**: `sysbak diff <file> [version]`
- **Restore**: `sysbak restore <file> [version]`
- **Health check**: `sysbak warn`
- **Diagnose**: `sysbak doctor`
- **Git bundles**: `sysbak git-bundle`

### Development Workflow
- **Edit files**: `chezmoi edit <file>`
- **Add new files**: `chezmoi add <file>`
- **Update from repo**: `chezmoi update`

## File Structure

- `dot_*` files become `.*` files in the home directory
- `run_once_*` scripts execute once during setup
- Templates use Go text/template syntax with chezmoi data

## Platform Detection

The zsh configuration uses these variables:
- `IS_WSL`: Windows Subsystem for Linux
- `IS_MACOS`: macOS
- `IS_LINUX`: Regular Linux

## Key Files

### Shell Configuration
- `dot_zshrc`: Main shell configuration with welcome message and dev completion
- `dot_p10k.zsh`: Powerlevel10k theme configuration
- `run_once_install-packages.sh.tmpl`: Package installation script

### System Maintenance
- `dot_local/bin/executable_sysup`: Cross-platform system update utility (status, upgrade, doctor)
- `dot_local/bin/executable_sysmon`: Cross-platform system health monitor (status, disk, mem, proc, net, warn)

### Backup
- `dot_local/bin/executable_sysbak`: Cross-platform USB rsnapshot backup manager (status, list, diff, restore, warn)
- `dot_config/sysbak/config`: Per-machine backup configuration

### Tmux & Dev Sessions
- `dot_tmux.conf`: Tmux configuration with vi-style keybindings, TPM, resurrect, and continuum
- `dot_local/bin/executable_dev`: Dev session manager (project discovery, fzf picker, layouts)
- `dot_config/dev/config`: Per-project layout configuration
- `run_once_after_install-tpm.sh`: Auto-installs TPM and plugins
- `dot_local/share/start-service.sh.example`: Template for multi-service orchestration

### Pi Agent Guards
- `dot_pi/settings.json`: Pi package configuration (references @manta/pi-guards)
- `dot_pi/guard-config.json`: Dotfiles-specific guard rules (scope-containment, command-policy, protected-paths, git-safety, secrets, destructive-op)

### Editor Configuration
- `dot_claude/settings.json`: Claude Code configuration
- `dot_config/Code/User/settings.json.tmpl`: VS Code settings with cross-platform templates
- `dot_config/Code/User/keybindings.json`: VS Code custom keybindings
- `dot_config/Code/User/extensions.json`: VS Code recommended extensions

### Testing
- `tests/test.sh`: Local test runner (syntax, linting, templates)
- `tests/test-templates.sh`: Template validation script
- `.github/workflows/test.yml`: CI workflow (Ubuntu + macOS)

## Dev Session Manager

The `dev` command provides persistent tmux sessions for multi-device development. Sessions survive disconnects and can be accessed from any device via SSH.

### Commands
```bash
dev                     # Interactive picker (fzf or numbered fallback)
dev <project>           # Create or attach to session for <project>
dev claude <project>    # Force claude+shell layout (vertical split)
dev pi <project>        # Force pi+shell layout (vertical split)
dev detach              # Detach from current tmux session
dev kill <name>         # Kill a session
dev kill-all            # Kill all sessions (with confirmation)
dev help                # Full help text
```

### Configuration
Per-project layouts are configured in `~/.config/dev/config`:
```ini
default_layout=default
atomicguard=claude
manta-deploy=claude
dotfiles=claude:~/.local/share/chezmoi
```

Format: `project=layout[:path][@host]` — `:path` for custom directories, `@host` for remote SSH.

### Layouts
- **default**: Single shell pane in the project directory
- **claude**: Vertical split with `claude` (left) and shell (right)
- **pi**: Vertical split with `pi` agent (left) and shell (right)

### Project Discovery
Projects are auto-discovered from `~/Projects/` (up to 3 levels deep). Any directory containing `.git` is treated as a project.

### Tmux Keybindings (prefix = C-a)
```bash
C-a |                  # Split horizontally
C-a -                  # Split vertically
C-a h/j/k/l            # Navigate panes (vim-style)
C-a r                  # Reload config
C-a d                  # Detach from session
```

### Session Persistence (TPM)
Sessions are automatically saved every 15 minutes via tmux-continuum and restored on tmux server start via tmux-resurrect. Press `prefix + I` to install/update plugins.

### Welcome Message
On new interactive shells (local terminals, SSH logins), a welcome message shows the hostname, platform, available commands (`dev`, `sysup`, `sysmon`), active tmux sessions, and any system health warnings. Suppressed inside tmux panes and VS Code terminals.

### Multi-Service Orchestration
For complex multi-service setups, copy `~/.local/share/start-service.sh.example` to your project directory and customize it.

## Documentation

Detailed usage guides are in `docs/`:
- [`docs/dev.md`](docs/dev.md) — Dev session manager reference
- [`docs/sysup.md`](docs/sysup.md) — System update utility reference
- [`docs/sysmon.md`](docs/sysmon.md) — System health monitor reference
- [`docs/sysbak.md`](docs/sysbak.md) — Backup manager reference
- [`docs/dotfiles-agent.md`](docs/dotfiles-agent.md) — Dotfiles agent setup and usage

## When Making Changes

1. Test changes with `chezmoi apply --dry-run`
2. Verify cross-platform compatibility
3. Check that templates render correctly
4. Ensure package installation works on target platforms
5. Update documentation if adding new features
6. Run `./tests/test.sh` before committing

## Troubleshooting

- Use `chezmoi doctor` for health checks
- Check template syntax with `chezmoi execute-template`
- Verify file permissions and PATH configuration
- Ensure platform-specific code is properly guarded

## Package Management Workflow

When adding a new package or CLI tool to the dotfiles, follow these steps:

### 1. Install Script (`run_once_install-packages.sh.tmpl`)

Add the package to the appropriate list:
- `$commonPackages` — core utilities available everywhere (curl, jq, ripgrep, etc.)
- `$brewPackages` — Homebrew-only tools (fnm, btop, gh, etc.)
- `$modernCli` — modern replacements for standard commands (bat, eza, fd, etc.)
- `$macosSpecific` — macOS-only packages (docker, awscli, etc.)
- `$linuxSpecific` / `$linuxWithDocker` — Linux/WSL apt packages

### 2. Doctor Check (`dot_local/bin/executable_sysup`)

Add the tool to the appropriate array in the `doctor` command:
- `tools_pm` — package managers (brew, apt-get, fnm, uv, etc.)
- `tools_dev` — development tools (git, tmux, docker, etc.)
- `tools_cli` — modern CLI replacements (eza, bat, fd, rg, etc.)

If the tool has a non-standard version flag, add a case to `get_version()`.

### 3. Shell Aliases (`dot_zshrc`)

If the new tool replaces a standard command, add a conditional alias:
```zsh
if command -v newtool >/dev/null 2>&1; then
  alias oldcmd="newtool"
fi
```

Only add aliases when the tool is a drop-in replacement. Skip this step for tools with their own unique commands.

### 4. Documentation

Update this file (CLAUDE.md) if the package changes any documented behavior.

### 5. Verification Checklist

- [ ] `chezmoi execute-template < run_once_install-packages.sh.tmpl` — template renders
- [ ] `chezmoi apply --dry-run` — all changes deploy cleanly
- [ ] `sysup doctor` — new tool appears in the correct section
- [ ] Aliases work: open a new shell and verify `command -v <tool>`