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
- `dot_zshrc`: Main shell configuration with tmux aliases
- `dot_p10k.zsh`: Powerlevel10k theme configuration
- `run_once_install-packages.sh.tmpl`: Package installation script

### Tmux Configuration (Remote Development)
- `dot_tmux.conf`: Tmux configuration with vi-style keybindings and modern features
- `executable_dot_local/bin/tmux-session`: Helper script for session management
- `dot_local/share/start-service.sh.example`: Template for project service management

### Editor Configuration
- `dot_claude/settings.json`: Claude Code configuration
- `dot_config/Code/User/settings.json.tmpl`: VS Code settings with cross-platform templates
- `dot_config/Code/User/keybindings.json`: VS Code custom keybindings
- `dot_config/Code/User/extensions.json`: VS Code recommended extensions

## Tmux for Remote Development

This dotfiles repository includes a complete tmux setup for remote development and service management:

### Features
- **Modern keybindings**: Prefix changed to `C-a`, vim-style navigation (`h/j/k/l`)
- **Mouse support**: Toggle with `prefix + m`
- **Session management**: Helper scripts for creating/attaching to sessions
- **Service templates**: Example script for managing project services in tmux

### Quick Reference
```bash
# Session management
tms myproject          # Create or attach to 'myproject' session
tml                    # List all sessions
tma myproject          # Attach to session
tmk myproject          # Kill session

# Within tmux (prefix = C-a)
C-a |                  # Split horizontally
C-a -                  # Split vertically
C-a h/j/k/l            # Navigate panes (vim-style)
C-a r                  # Reload config
C-a d                  # Detach from session
```

### Using in Projects
Copy `~/.local/share/start-service.sh.example` to your project and customize it to:
1. Start multiple services in different windows
2. Split panes for monitoring
3. Set up project-specific environments
4. Enable remote access to running services

Example workflow:
```bash
# In your project directory
cp ~/.local/share/start-service.sh.example ./start-service.sh
chmod +x start-service.sh
./start-service.sh              # Start services
./start-service.sh --attach     # Start and attach
./start-service.sh --status     # Check status
```

## Recent Changes

1. **Tmux configuration**: Added comprehensive tmux setup for remote development
2. **Helper scripts**: Added `tmux-session` for easy session management
3. **Service templates**: Added example script for managing project services
4. **Shell aliases**: Added tmux convenience aliases to zshrc
5. **PATH syntax error**: Fixed semicolon separator in PATH export
6. **Antigen cache directory**: Moved creation outside WSL-specific block
7. **Cross-platform compatibility**: Ensured all platforms can create necessary directories
8. **VS Code configuration**: Added comprehensive settings, keybindings, and extensions
9. **TTY warning**: Known issue with antigen during `chezmoi apply` (cosmetic only)

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