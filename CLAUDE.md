# Claude Code Instructions

This file contains specific instructions for Claude Code when working with this dotfiles repository.

## Repository Context

This is a chezmoi-managed dotfiles repository that supports:
- **Platforms**: macOS, Linux, and WSL
- **Shell**: Zsh with oh-my-zsh, antigen, and powerlevel10k
- **Package Management**: Homebrew (cross-platform)
- **Node.js**: fnm for version management

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

- `dot_zshrc`: Main shell configuration
- `dot_p10k.zsh`: Powerlevel10k theme configuration
- `run_once_install-packages.sh.tmpl`: Package installation script
- `dot_claude/settings.json`: Claude Code configuration

## Recent Issues Fixed

1. **PATH syntax error**: Fixed semicolon separator in PATH export
2. **Antigen cache directory**: Moved creation outside WSL-specific block
3. **Cross-platform compatibility**: Ensured all platforms can create necessary directories

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