# Dotfiles

Cross-platform dotfiles managed with [chezmoi](https://www.chezmoi.io/) for macOS, Linux, and WSL.

## Features

- **Cross-platform support**: Works on macOS, Linux, and WSL
- **Modern CLI tools**: bat, eza, fd, delta, ncdu, httpie, tmux
- **Shell configuration**: Zsh with oh-my-zsh, antigen, and powerlevel10k
- **Node.js management**: fnm for version management
- **Package management**: Homebrew integration across platforms
- **Docker support**: Platform-specific Docker configuration
- **Git configuration**: GPG signing and delta diff viewer
- **VS Code configuration**: Settings, keybindings, and extensions

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
├── dot_claude/                        # Claude Code configuration
│   └── settings.json
├── dot_config/Code/User/               # VS Code configuration
│   ├── settings.json.tmpl             # VS Code settings
│   ├── keybindings.json               # Custom keybindings
│   └── extensions.json                # Recommended extensions
├── run_once_install-packages.sh.tmpl  # Package installation script
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

### VS Code Configuration

The VS Code setup includes:
- **Settings**: Cross-platform editor preferences with font ligatures, formatting, and productivity features
- **Keybindings**: Custom shortcuts for enhanced productivity
- **Extensions**: Curated list of recommended extensions for development
- **Database support**: SQLite viewer and SQLTools integration
- **Language support**: Python, JavaScript, TypeScript, Rust, Go, and more

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
2. Test on your platform
3. Commit changes with descriptive messages
4. Ensure cross-platform compatibility

## License

MIT License - feel free to use and modify as needed.