# Dotfiles

Cross-platform dotfiles managed with [chezmoi](https://www.chezmoi.io/) for macOS, Linux, and WSL.

## Features

- **Cross-platform support**: Works on macOS, Linux, and WSL
- **Modern CLI tools**: bat, eza, fd, delta, ncdu, httpie, tmux, and more
- **Shell configuration**: Zsh with oh-my-zsh, antigen, and powerlevel10k
- **Remote development**: Tmux configuration with session management helpers
- **Node.js management**: fnm for version management
- **Package management**: Homebrew integration across platforms
- **Docker support**: Platform-specific Docker configuration
- **Git configuration**: GPG signing and delta diff viewer
- **VS Code configuration**: Settings, keybindings, and extensions
- **Agent command shims**: Intercepts python/pip/docker in agent mode, redirecting to preferred tooling

## Quick Start

### One-line Installation

```bash
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply $GITHUB_USERNAME
```

### Manual Installation

1. Install chezmoi:
   ```bash
   # macOS
   brew install chezmoi
   
   # Linux/WSL
   curl -sfL https://git.io/chezmoi | sh
   ```

2. Initialize with this repository:
   ```bash
   chezmoi init https://github.com/yourusername/dotfiles.git
   ```

3. Apply the configuration:
   ```bash
   chezmoi apply
   ```

### Daily Usage

- **Edit dotfiles**: `chezmoi edit ~/.zshrc`
- **Apply changes**: `chezmoi apply`
- **Check status**: `chezmoi status`
- **Update from repo**: `chezmoi update`

## Structure

```
.
├── dot_zshrc                           # Zsh configuration
├── dot_p10k.zsh                       # Powerlevel10k theme config
├── dot_tmux.conf                      # Tmux configuration (TPM, resurrect, continuum)
├── dot_claude/                        # Claude Code configuration
│   └── settings.json
├── dot_config/
│   ├── Code/User/                     # VS Code configuration
│   │   ├── settings.json.tmpl         # VS Code settings
│   │   ├── keybindings.json           # Custom keybindings
│   │   └── extensions.json            # Recommended extensions
│   └── dev/config                     # Dev session manager config
├── dot_local/bin/
│   ├── executable_dev                 # Dev session manager
│   ├── executable_sysup               # System update utility
│   ├── executable_python              # Agent shim: python → uv run python
│   ├── executable_python3             # Agent shim: python3 → uv run python
│   ├── executable_pip                 # Agent shim: pip → uv pip
│   ├── executable_pip3                # Agent shim: pip3 → uv pip
│   ├── executable_docker              # Agent shim: docker → infra scripts
│   └── executable_docker-compose      # Agent shim: docker-compose → infra scripts
├── docs/                              # Detailed documentation
│   ├── dev.md                         # Dev session manager reference
│   ├── sysup.md                       # System update utility reference
│   └── dotfiles-agent.md             # Dotfiles agent guide
├── tests/                             # Testing infrastructure
│   ├── test.sh                        # Local test runner
│   ├── test-templates.sh              # Template validation
│   └── test-agent-shims.sh            # Agent shim tests
├── .github/workflows/
│   └── test.yml                       # GitHub Actions CI
├── run_once_install-packages.sh.tmpl  # Package installation script
├── run_once_after_install-tpm.sh      # TPM auto-installer
└── run_once_after_chsh.sh.tmpl       # Shell change script
```

## Platform Support

### macOS
- Homebrew package management
- macOS-specific applications (Rectangle, Alfred, VS Code)
- System preferences configuration

### Linux
- Linuxbrew package management
- Linux-specific package variants
- Cross-platform CLI tools

### WSL
- Windows Subsystem for Linux support
- WSL-specific aliases and configurations
- Docker integration handling

## Customization

### Adding New Packages

Edit `run_once_install-packages.sh.tmpl` and add packages to the appropriate arrays:
- `commonPackages`: Available on all platforms
- `macosSpecific`: macOS-only packages
- `modernCli`: Modern CLI tool replacements

### Shell Configuration

The zsh configuration includes:
- History management with optimal settings
- Auto-completion enhancements
- Modern CLI tool aliases
- Platform-specific configurations
- Tmux integration with convenient aliases

### Dev Session Manager

The `dev` command provides persistent tmux sessions for multi-device development:
- **Project discovery**: Auto-discovers projects from `~/Projects/`
- **Interactive picker**: fzf-powered (with numbered fallback) session/project selector
- **Layouts**: Single shell or Claude Code + shell split
- **Remote support**: SSH-transparent session management via `@host` config
- **Session persistence**: Auto-saved every 15 minutes via tmux-resurrect/continuum

Quick start:
```bash
dev                    # Interactive picker
dev myproject          # Create/attach to session
dev claude myproject   # Force Claude Code + shell layout
```

See [docs/dev.md](docs/dev.md) for the full reference.

### System Updates

The `sysup` command manages all package managers from a single entry point:

```bash
sysup                  # Check what's outdated
sysup upgrade          # Update everything
sysup doctor           # Verify tool installation
```

See [docs/sysup.md](docs/sysup.md) for the full reference.

## Testing

### Local Testing

Run the test suite before committing changes:

```bash
./tests/test.sh           # Run all tests
./tests/test.sh quick     # Lint + syntax only (fast)
```

The test runner validates:
- Shell script syntax (bash -n)
- ShellCheck linting
- Chezmoi template rendering
- Cross-platform compatibility

### Continuous Integration

GitHub Actions runs the full test suite on every push and pull request:
- **Ubuntu**: Full test suite with chezmoi initialization
- **macOS**: Full test suite with chezmoi initialization

CI ensures templates render correctly and scripts pass linting on both platforms.

### Platform Coverage

The CI tests on Ubuntu, which provides coverage for all supported Debian-family distributions:

- **Pop!_OS**: Built on Ubuntu LTS, uses identical package repositories
- **Debian**: Ubuntu's upstream - packages and behavior are nearly identical
- **Raspbian**: Debian-based but ARM architecture; the dotfiles handle this via architecture detection (`{{ if eq .chezmoi.arch "amd64" }}`) rather than distro detection

The install script's `{{ if eq .osid "linux-debian" "linux-raspbian" "linux-pop" "linux-ubuntu" }}` check treats all Debian-family distros identically - they all use apt and follow the same code path. Platform-specific behavior is determined by architecture (amd64 vs ARM), not distribution.

### VS Code Configuration

The VS Code setup includes:
- **Settings**: Cross-platform editor preferences with font ligatures, formatting, and productivity features
- **Keybindings**: Custom shortcuts for enhanced productivity
- **Extensions**: Curated list of recommended extensions for development
- **Database support**: SQLite viewer and SQLTools integration
- **Language support**: Python, JavaScript, TypeScript, Rust, Go, and more

## Documentation

Detailed usage guides for the custom tools in this repository:

- [Dev Session Manager](docs/dev.md) -- persistent tmux sessions for multi-device development
- [System Update Utility](docs/sysup.md) -- cross-platform package manager orchestration
- [Dotfiles Agent](docs/dotfiles-agent.md) -- Claude Code + shell session for dotfiles maintenance
- [Agent Command Shims](docs/agent-shims.md) -- intercepts commands in agent sessions, redirecting to preferred tooling

## Troubleshooting

### Common Issues

1. **Permission errors**: Ensure proper PATH configuration in `dot_zshrc`
2. **Missing directories**: The setup creates necessary directories automatically
3. **Package conflicts**: Check platform-specific package lists

### Debugging

- Check chezmoi status: `chezmoi doctor`
- Verify templates: `chezmoi execute-template`
- Dry run changes: `chezmoi apply --dry-run`

## Contributing

1. Make changes to the dotfiles
2. Run `./tests/test.sh` to validate changes
3. Test on your platform with `chezmoi apply --dry-run`
4. Commit changes with descriptive messages
5. Ensure cross-platform compatibility

## License

MIT License - feel free to use and modify as needed.