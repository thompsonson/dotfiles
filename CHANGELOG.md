# Changelog

## 1.0.0 (2026-02-05)


### ⚠ BREAKING CHANGES

* **setup:** Shell configuration now managed entirely by chezmoi templates instead of direct file modifications during installation

### Features

* add dev session manager, sysup utility, and tmux configuration ([#2](https://github.com/thompsonson/dotfiles/issues/2)) ([cc564d0](https://github.com/thompsonson/dotfiles/commit/cc564d0bf65998f562031a7aedf0ec040e727618))
* add just command runner and l alias ([8e914ad](https://github.com/thompsonson/dotfiles/commit/8e914ad034e8289cf866b8786372b05eb9578fc3))
* added Nerd fonts so it's bootiful, antigen for ZSH plugin management (including a few basic plugins) and Powerlevel10k theme. ([645b379](https://github.com/thompsonson/dotfiles/commit/645b3796e6da7085f035af2c4b1b1cd97c28e548))
* **claude:** add Claude Code configuration ([d6657b8](https://github.com/thompsonson/dotfiles/commit/d6657b8df52e7221d0d64f63e726f883989457f2))
* **claude:** add tool permissions for common file/search commands ([2bba898](https://github.com/thompsonson/dotfiles/commit/2bba89880b0b25883d67d859937bcd0a74cfcf6e))
* **cli:** add modern Rust-based CLI tools for all platforms ([2d9a728](https://github.com/thompsonson/dotfiles/commit/2d9a72882dab00e2cdddaf7d9d72cd72845a6973))
* **cli:** add modern Rust-based CLI tools for all platforms  ([89d27e4](https://github.com/thompsonson/dotfiles/commit/89d27e45f58b0dfca37b2e8e79c29c58696acac5))
* enhance package installation script with cross-platform support and modern CLI tools ([d3f801e](https://github.com/thompsonson/dotfiles/commit/d3f801e0c53239cccd156f3b04f3276445f5693f))
* Initial setup, installing homebrew and apt/brew pacakages. Changes shell to Zsh, OhMyZsh+plugins is pulled in via .chezmoiexternal ([0207a57](https://github.com/thompsonson/dotfiles/commit/0207a57558917d1a631391ba5ac580dba9ee2288))
* **nodejs:** add fnm for Node.js version management ([cb25ee5](https://github.com/thompsonson/dotfiles/commit/cb25ee5932aebc9a55b2206cfca48a9a3a678c3d))
* **packages:** add GitHub CLI to cross-platform package installation ([1873ae0](https://github.com/thompsonson/dotfiles/commit/1873ae00f97e1ab1f422cc18678ce9e86d6c736d))
* **setup:** add cross-platform support for macOS, Linux, and WSL ([125fbaf](https://github.com/thompsonson/dotfiles/commit/125fbafd12c34e60db6463a4f6a45803cfb220af))
* **vscode:** add automatic VS Code extensions installation script ([cdf8375](https://github.com/thompsonson/dotfiles/commit/cdf83756cb8f1d36cc03b0c7a8c92e3c807047e9))
* **vscode:** add comprehensive VS Code configuration ([45b41a7](https://github.com/thompsonson/dotfiles/commit/45b41a73f8ac57c23e9046a910222788c8880357))
* **vscode:** remove unwanted extensions and fix terminal font config ([058f070](https://github.com/thompsonson/dotfiles/commit/058f07075e4f2dc4d4aea9ec91c13a4e8ef1eca3))
* **vscode:** remove vim extension from recommended extensions ([d635d9e](https://github.com/thompsonson/dotfiles/commit/d635d9e55e6073304098094ec734ad52446c943a))
* **vscode:** streamline extensions list ([c4d5171](https://github.com/thompsonson/dotfiles/commit/c4d51713349aa2a9d599c42ab215ddc5e3b9171d))


### Bug Fixes

* correcting the homebrew installation to NOT run with sudo ([e8b5bf9](https://github.com/thompsonson/dotfiles/commit/e8b5bf9efb86d1fb4031986c9e00bf386f7c919d))
* **dev:** use Homebrew bash for macOS compatibility ([3dea05d](https://github.com/thompsonson/dotfiles/commit/3dea05d558dc62952b8c594f3055cb6c6680f813))
* homebrew doesn't actually install on arm systems ([e8b5bf9](https://github.com/thompsonson/dotfiles/commit/e8b5bf9efb86d1fb4031986c9e00bf386f7c919d))
* installing OhMyZsh via the install script, not via .chezmoiexternal (as this does not run the install.zsh) ([e8b5bf9](https://github.com/thompsonson/dotfiles/commit/e8b5bf9efb86d1fb4031986c9e00bf386f7c919d))
* missing template variables added to the .chezmoi.toml or removed fromt he template (if not needed) ([e8b5bf9](https://github.com/thompsonson/dotfiles/commit/e8b5bf9efb86d1fb4031986c9e00bf386f7c919d))
* **path:** adding the chezmoi bin folder to the path ([0b1d4e6](https://github.com/thompsonson/dotfiles/commit/0b1d4e614a78fbe3226e847ecc6decd38d05d391))
* **ssh:** add IgnoreUnknown for Homebrew OpenSSH compatibility ([9868305](https://github.com/thompsonson/dotfiles/commit/9868305b92b3845262edebcda4ffa92772a2ba7c))
* **ssh:** manage SSH config via chezmoi template for cross-platform support ([9896eea](https://github.com/thompsonson/dotfiles/commit/9896eeaf719f71b8f68d7dfc2f8db6ed281ab98d))
* **zsh:** remove broken chezmoi/bin path from PATH ([1ddcf9f](https://github.com/thompsonson/dotfiles/commit/1ddcf9f7e120cb5efa966b9f78b4fe256c7f85cf))
* **zsh:** resolve PATH syntax error and antigen cache directory issues ([ab2c300](https://github.com/thompsonson/dotfiles/commit/ab2c300dc037bf837216f21ad42be6806dfb18fb))


### Refactoring

* improve package installation script organization ([2313fbf](https://github.com/thompsonson/dotfiles/commit/2313fbf346612650a6330eb6156a86c29c7d09a4))


### Documentation

* add comprehensive README and Claude Code instructions ([88e3302](https://github.com/thompsonson/dotfiles/commit/88e33027140119557781d8ac05435eebcccf318a))
* update README to remove bin directory reference ([097e6bb](https://github.com/thompsonson/dotfiles/commit/097e6bbf287e409259164472538b0b8362df067f))


### CI/CD

* add release-please for automated versioning ([#6](https://github.com/thompsonson/dotfiles/issues/6)) ([7d99fea](https://github.com/thompsonson/dotfiles/commit/7d99feaab4e368aa5bc3dfb3ae47eac29c77db43))
* Add testing infrastructure for dotfiles ([#4](https://github.com/thompsonson/dotfiles/issues/4)) ([df213f3](https://github.com/thompsonson/dotfiles/commit/df213f3151a315bf58ddcb9b2bfd429fa235750c))
* update testing infrastructure for dotfiles ([#5](https://github.com/thompsonson/dotfiles/issues/5)) ([ee47032](https://github.com/thompsonson/dotfiles/commit/ee4703218bd60399b3ab4ead5e512a922f0285f0))
