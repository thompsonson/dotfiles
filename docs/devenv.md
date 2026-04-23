# devenv

Per-project reproducible development environments on top of Nix. Bootstrapped
by `run_once_after_install-nix.sh.tmpl` on Linux when `install_nix=true` (the
default); opt-in on macOS by flipping the flag in `~/.config/chezmoi/chezmoi.toml`.

## Bootstrap

1. `chezmoi apply` — installs Nix via the Determinate Systems installer and
   `nix profile install nixpkgs#devenv`. Idempotent; safe to re-run.
2. Open a new shell. The `nix` and `direnv` hooks are wired up in `dot_zshrc`.
3. Verify: `sysup doctor` reports `nix`, `devenv`, `direnv` with versions.

## Usage

```bash
cd my-project
devenv init                    # scaffolds devenv.nix + devenv.yaml + .envrc
direnv allow                   # one-time per project — lets direnv auto-activate
```

Subsequent `cd` into the project auto-loads the environment via direnv. Edit
`devenv.nix` to add packages, services, scripts, processes. See the
[devenv documentation](https://devenv.sh/) for the full schema.

## Why this channel (not apt/brew)

- Reproducibility: `devenv.lock` pins the exact Nix store paths, so every
  machine that applies the same flake gets byte-identical tooling.
- Isolation: project-scoped tools don't leak into `$PATH` globally.
- Composition: mix language toolchains, databases, and services per-project
  without cluttering the host.

## Gotchas

- First `devenv shell` after cloning a project can take minutes while Nix
  realizes the closure. Subsequent activations are fast (store hit).
- If the DetSys installer doesn't automatically configure your shell,
  `dot_zshrc` sources `/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh`
  as a fallback.
- `direnv allow` is per-directory trust. Re-run after cloning a new repo.

## Related

- [Upstream devenv docs](https://devenv.sh/)
- [Determinate Nix Installer](https://install.determinate.systems/)
- [thompsonson/dev#9](https://github.com/thompsonson/dev/issues/9) — devenv feature survey
- [thompsonson/dev#10](https://github.com/thompsonson/dev/issues/10) — `dev` session integration plan
