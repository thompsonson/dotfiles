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
- **Apply changes**: `chezmoi apply`
- **Check status**: `chezmoi status`
- **Validate templates**: `chezmoi execute-template`
- **Dry run**: `chezmoi apply --dry-run`

### System Updates
- **Check outdated**: `sysup` or `sysup status`
- **Apply all updates**: `sysup upgrade`
- **Verify tools**: `sysup doctor`

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
- `dot_zshrc`: Main shell configuration with SSH login reminder and dev completion
- `dot_p10k.zsh`: Powerlevel10k theme configuration
- `run_once_install-packages.sh.tmpl`: Package installation script

### System Maintenance
- `dot_local/bin/executable_sysup`: Cross-platform system update utility (status, upgrade, doctor)

### Tmux & Dev Sessions
- `dot_tmux.conf`: Tmux configuration with vi-style keybindings, TPM, resurrect, and continuum
- `dot_local/bin/executable_dev`: Dev session manager (project discovery, fzf picker, layouts)
- `dot_config/dev/config`: Per-project layout configuration
- `run_once_after_install-tpm.sh`: Auto-installs TPM and plugins
- `dot_local/share/start-service.sh.example`: Template for multi-service orchestration

### Editor Configuration
- `dot_claude/settings.json`: Claude Code configuration
- `dot_config/Code/User/settings.json.tmpl`: VS Code settings with cross-platform templates
- `dot_config/Code/User/keybindings.json`: VS Code custom keybindings
- `dot_config/Code/User/extensions.json`: VS Code recommended extensions

## Dev Session Manager

The `dev` command provides persistent tmux sessions for multi-device development. Sessions survive disconnects and can be accessed from any device via SSH.

### Commands
```bash
dev                     # Interactive picker (fzf or numbered fallback)
dev <project>           # Create or attach to session for <project>
dev claude <project>    # Force claude+shell layout (vertical split)
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
```

### Layouts
- **default**: Single shell pane in the project directory
- **claude**: Vertical split with `claude` (left) and shell (right)

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

### SSH Login Reminder
When connecting via SSH, active tmux sessions are displayed automatically with a reminder to use `dev`.

### Multi-Service Orchestration
For complex multi-service setups, copy `~/.local/share/start-service.sh.example` to your project directory and customize it.

## Recent Changes

1. **Dev session manager**: Replaced tmux-session with `dev` command (fzf picker, project discovery, layouts)
2. **TPM & session persistence**: Enabled tmux-resurrect and tmux-continuum for automatic session save/restore
3. **SSH login reminder**: Active tmux sessions shown on SSH login
4. **Service templates**: Example script for managing project services
5. **PATH syntax error**: Fixed semicolon separator in PATH export
6. **Antigen cache directory**: Moved creation outside WSL-specific block
7. **Cross-platform compatibility**: Ensured all platforms can create necessary directories
8. **VS Code configuration**: Added comprehensive settings, keybindings, and extensions
9. **TTY warning**: Known issue with antigen during `chezmoi apply` (cosmetic only)
10. **sysup utility**: Cross-platform system update command (brew, apt, fnm, uv, pipx, tpm, vscode, chezmoi)

## When Making Changes

1. Test changes with `chezmoi apply --dry-run`
2. Verify cross-platform compatibility
3. Check that templates render correctly
4. Ensure package installation works on target platforms
5. Update documentation if adding new features

## Troubleshooting

- Use `chezmoi doctor` for health checks
- Check template syntax with `chezmoi execute-template`
- Verify file permissions and PATH configuration
- Ensure platform-specific code is properly guarded