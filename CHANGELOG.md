# Changelog

## [1.2.0](https://github.com/thompsonson/dotfiles/compare/v1.1.0...v1.2.0) (2026-04-29)


### Features

* add Claude Code statusline with context and rate limit display ([bcc9a71](https://github.com/thompsonson/dotfiles/commit/bcc9a713db6bafe5911014e6d375f5bc0106d10f))
* add commonly-used base packages to install script ([#39](https://github.com/thompsonson/dotfiles/issues/39)) ([640588c](https://github.com/thompsonson/dotfiles/commit/640588cc898b5aeea3a1615f5054e1b1536ae0a1)), closes [#35](https://github.com/thompsonson/dotfiles/issues/35)
* add LiteLLM proxy as a managed service ([#21](https://github.com/thompsonson/dotfiles/issues/21)) ([#23](https://github.com/thompsonson/dotfiles/issues/23)) ([a3ccae7](https://github.com/thompsonson/dotfiles/commit/a3ccae7530ef8982c7cda0da9fb114e0ed8f08e2))
* add sysmon, sysbak, and sysup repair ([#14](https://github.com/thompsonson/dotfiles/issues/14)) ([3cd8df3](https://github.com/thompsonson/dotfiles/commit/3cd8df3db6d3c7950dff23743912eaceeb44fbd0))
* CPU temperature, CPU hog, and pop-upgrade monitoring ([#17](https://github.com/thompsonson/dotfiles/issues/17)) ([#18](https://github.com/thompsonson/dotfiles/issues/18)) ([dac4a5a](https://github.com/thompsonson/dotfiles/commit/dac4a5ac5143761413d6103b1af9d42a1c81d94a))
* **nix:** Nix + devenv bootstrap (Linux-first, opt-in on macOS) ([#40](https://github.com/thompsonson/dotfiles/issues/40)) ([0cc8653](https://github.com/thompsonson/dotfiles/commit/0cc8653d0e3f6015c3692c0aa4e9a80e65546811))
* **sysbak:** add --yes flag for non-interactive setup ([#51](https://github.com/thompsonson/dotfiles/issues/51)) ([1ef48c8](https://github.com/thompsonson/dotfiles/commit/1ef48c80e52d5f6c83bff8a863996032e65a246b))
* **sysbak:** auto-exclude /nix/store from backups when Nix is present ([#43](https://github.com/thompsonson/dotfiles/issues/43)) ([5b75139](https://github.com/thompsonson/dotfiles/commit/5b7513941c8fa37d63b16c1a26cc2da79fa7224c))
* **sysup:** add clean subcommand to free disk space from caches ([760d594](https://github.com/thompsonson/dotfiles/commit/760d594e5504dd55a68ff2ec35e884e7047b4dda))


### Bug Fixes

* **codeburn:** bump to v0.9.1-thompsonson.3; add to sysup doctor ([#55](https://github.com/thompsonson/dotfiles/issues/55)) ([a53592d](https://github.com/thompsonson/dotfiles/commit/a53592dc1fd965975b79afe7d9050826893825ad))
* **codeburn:** install from release tarball URL (v0.9.1-thompsonson.4) ([#56](https://github.com/thompsonson/dotfiles/issues/56)) ([982a195](https://github.com/thompsonson/dotfiles/commit/982a195d70d7894f43dbb52ee481eaa1ceef4a42))
* **codeburn:** install v0.9.1-thompsonson.2 (ships pre-built dist) ([#54](https://github.com/thompsonson/dotfiles/issues/54)) ([e4ee122](https://github.com/thompsonson/dotfiles/commit/e4ee122ff14372e7cdefeb89236051abe9c61ad5))
* **doctor:** repair two version-capture bugs in sysbak + sysup ([#48](https://github.com/thompsonson/dotfiles/issues/48)) ([40b243f](https://github.com/thompsonson/dotfiles/commit/40b243fac84abc86197307ca4956933ab3630aba))
* **nix:** install devenv direnvrc so `use devenv` in .envrc works ([#46](https://github.com/thompsonson/dotfiles/issues/46)) ([f727494](https://github.com/thompsonson/dotfiles/commit/f727494c042a5a4234bd6171d8f2614d41c7f62b))
* **sysbak:** add one_fs to rsnapshot.conf default ([#50](https://github.com/thompsonson/dotfiles/issues/50)) ([a46409b](https://github.com/thompsonson/dotfiles/commit/a46409bb90f02caa6a02fe48ec2e39bf2f88d768))
* **sysbak:** preserve config customizations when re-running setup ([#49](https://github.com/thompsonson/dotfiles/issues/49)) ([81d2e41](https://github.com/thompsonson/dotfiles/commit/81d2e4178f799b15192af07fb05c7184a026bca5))
* **sysbak:** use create_ prefix for machine-specific config ([aae8f2e](https://github.com/thompsonson/dotfiles/commit/aae8f2efde59cb011e096ba575acddc3344fddf7))
* **sysbak:** write config after sudo, not before ([#52](https://github.com/thompsonson/dotfiles/issues/52)) ([249aa22](https://github.com/thompsonson/dotfiles/commit/249aa223ef1777d6310b27f456aa53b56a1ebe55))


### Documentation

* add pi-agent-policy.md — workflow and trust model definition for pi-guards ([cd75c10](https://github.com/thompsonson/dotfiles/commit/cd75c10b92b7b78892d402ecd2c8262dfbcb4b43))
* Claude session analysis and telemetry planning ([#53](https://github.com/thompsonson/dotfiles/issues/53)) ([bcb2406](https://github.com/thompsonson/dotfiles/commit/bcb24066d49ff03e9545f970bdbcf5e7ae049cfa))
* update sysmon and sysup docs for temperature, CPU hog, and doctor changes ([c5a54b4](https://github.com/thompsonson/dotfiles/commit/c5a54b4bf7d92f5d8a9185b71377db5c572f11fa))

## [1.1.0](https://github.com/thompsonson/dotfiles/compare/v1.0.1...v1.1.0) (2026-02-25)


### Features

* add sysmon cross-platform system health monitor ([#11](https://github.com/thompsonson/dotfiles/issues/11)) ([c2e5b9d](https://github.com/thompsonson/dotfiles/commit/c2e5b9d1e2fffca783f5752443ecbd03d9ed3169))

## [1.0.1](https://github.com/thompsonson/dotfiles/compare/v1.0.0...v1.0.1) (2026-02-05)


### Refactoring

* **dev:** add layout command to transform existing sessions ([#8](https://github.com/thompsonson/dotfiles/issues/8)) ([056833c](https://github.com/thompsonson/dotfiles/commit/056833c72ccace68fe13ff060a80bfe25c0a10a4))


### Documentation

* add Claude Code workflow guide ([391ede8](https://github.com/thompsonson/dotfiles/commit/391ede872d230a1ab3ab347649fb1785a97af8a0))
* add Claude Code workflow guide ([2672823](https://github.com/thompsonson/dotfiles/commit/2672823fdae1425cd494e6d3944ec611152ce3eb))

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
