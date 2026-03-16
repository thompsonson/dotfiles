# Backup Integration Plan

> **Superseded by `sysbak` implementation.** See [`docs/sysbak.md`](sysbak.md) for the current reference.

This document describes a proposal to integrate a USB rsnapshot backup manager
into the dotfiles repository, with an extension for git-history-aware project
backups.

**Source material:** `~/Projects/local_popmini_backup/`
- `backup` — 867-line bash script (the tool itself)
- `docs/backup.md` — full command reference
- `docs/portability.md` — catalogue of hardcoded values and how to fix each one

---

## What the `backup` script does

`backup` wraps [rsnapshot](https://rsnapshot.org/) to manage a USB drive
(currently `/dev/sda1`, mounted at `/media/passport`). It follows the same
subcommand pattern as `sysup` and `sysmon`:

| Subcommand | Description |
|------------|-------------|
| `backup` / `backup status` | Dashboard: drive state, snapshot counts, last backup, schedule |
| `backup setup` | One-time: format ext4, install rsnapshot, write `/etc/rsnapshot.conf`, fstab, cron |
| `backup doctor` | Diagnose device, mount, fstab, rsnapshot, cron, staleness |
| `backup run [level]` | Trigger rsnapshot (alpha/beta/gamma, default alpha). Supports `--dry-run` |
| `backup list` | List all snapshots grouped by level with timestamps and sizes |
| `backup diff [s1] [s2]` | Compare two snapshots (default: alpha.0 vs alpha.1) |
| `backup find <pattern>` | Search for files across snapshots |
| `backup du` | Disk usage via `rsnapshot du` |
| `backup log [n]` | Tail `/var/log/rsnapshot.log` |

### Snapshot schedule (after `backup setup`)

| Level | Frequency | Retained | Cron |
|-------|-----------|----------|------|
| alpha | Every 4 hours | 6 | `0 */4 * * *` |
| beta  | Daily 03:30   | 7 | `30 3 * * *`  |
| gamma | Weekly Sun 03:00 | 4 | `0 3 * * 0` |

Each cron job gates on `mountpoint -q /media/passport` — silently skipped if
the drive is disconnected.

### Backup targets

```
~/Projects/
~/.config/
~/.local/
~/.ssh/
~/.gnupg/
~/.password-store/
```

**Exclusions:** `node_modules/`, `.cache/`, `__pycache__/`, `.venv/`, `*.pyc`,
`.git/objects/`

> **Key gap:** `.git/objects/` is excluded, so rsnapshot captures working-tree
> snapshots but **not git history**. `backup diff` shows which files changed
> between two snapshots but cannot produce line-level diffs within a file over
> time. See Suggestion 2 below for the fix.

---

## Current portability issues

`docs/portability.md` catalogues every hardcoded value. Summary:

| Item | Current value | Fix |
|------|--------------|-----|
| `DEVICE` | `/dev/sda1` | Read from `~/.config/backup/config` |
| `MOUNT_POINT` | `/media/passport` | Read from config file |
| `BACKUP_USER` | `mt` (hardcoded) | Replace with `$USER` / `$HOME` |
| `BACKUP_DIRS` | `/home/mt/...` paths | Use `$HOME` |
| Cron heredoc | `<<'EOF'` (literal) | Change to `<<EOF` so `$MOUNT_POINT` expands |
| `apt-get install rsnapshot` | apt only | Add `brew install rsnapshot` path |
| `lsblk`, `blkid` | Linux only | Wrap in helpers with macOS (`diskutil`) fallbacks |
| `mountpoint -q` | Linux only | Fallback: `mount \| grep` |
| `stat -c '%y'` | GNU stat | Fallback: `stat -f '%Sm'` for macOS |
| `/etc/cron.d/` | Linux only | macOS would need launchd `.plist` (or skip scheduled backups on macOS) |

---

## Suggestion 1 — Port `backup` into dotfiles

Apply the fixes from `portability.md` and move the script to
`dot_local/bin/executable_backup`.

### Files to create / modify

| File | Action |
|------|--------|
| `dot_local/bin/executable_backup` | New — the ported script |
| `dot_config/backup/config` | New — default config (device, mount point, label) |
| `dot_local/bin/executable_sysup` | Modify — add `backup` to `tools_dev` in `cmd_doctor` |
| `dot_zshrc` | Modify — add zsh completion for `backup` subcommands |
| `CLAUDE.md` | Modify — document new tool |
| `docs/backup.md` | Move from `local_popmini_backup/docs/backup.md` |

### Changes to the script

**1. Config file loader** (follow `~/.config/dev/config` pattern):

```bash
CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/backup/config"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi
DEVICE="${device:-/dev/sda1}"
MOUNT_POINT="${mount_point:-/media/passport}"
BACKUP_LABEL="${label:-passport}"
```

Default config template (`dot_config/backup/config`):
```ini
# backup configuration — override per machine
# device=/dev/sda1
# mount_point=/media/passport
# label=passport
```

**2. Replace hardcoded user/home:**
```bash
# Before
BACKUP_USER="mt"
BACKUP_DIRS=("/home/${BACKUP_USER}/Projects/" ...)

# After
BACKUP_DIRS=("${HOME}/Projects/" "${HOME}/.config/" ...)
```

**3. Fix cron heredoc interpolation:**
```bash
# Before (literal — $MOUNT_POINT not expanded)
cat > "$CRON_FILE" <<'EOF'
0 */4 * * *  root  mountpoint -q /media/passport && rsnapshot alpha
EOF

# After (interpolated)
cat > "$CRON_FILE" <<EOF
0 */4 * * *  root  mountpoint -q ${MOUNT_POINT} && rsnapshot alpha
30 3 * * *   root  mountpoint -q ${MOUNT_POINT} && rsnapshot beta
0 3 * * 0    root  mountpoint -q ${MOUNT_POINT} && rsnapshot gamma
EOF
```

**4. Cross-platform package install:**
```bash
install_rsnapshot() {
  if has rsnapshot; then return; fi
  if has apt-get; then
    apt-get update -qq && apt-get install -y rsnapshot
  elif has brew; then
    brew install rsnapshot
  else
    die "Install rsnapshot manually: https://rsnapshot.org"
  fi
}
```

**5. Cross-platform utility wrappers:**
```bash
check_mounted() {
  if has mountpoint; then
    mountpoint -q "$1" 2>/dev/null
  else
    mount | grep -q " on $1 "
  fi
}

get_file_mtime() {
  if stat -c '%y' "$1" &>/dev/null 2>&1; then
    stat -c '%y' "$1" | cut -d'.' -f1        # GNU/Linux
  else
    stat -f '%Sm' -t '%Y-%m-%d %H:%M:%S' "$1" # macOS/BSD
  fi
}

list_block_device() {
  if has lsblk; then
    lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINT "$@"
  elif has diskutil; then
    diskutil list "$@"
  fi
}
```

**Note on macOS scheduled backups:** macOS does not have `/etc/cron.d/`.
`backup setup` on macOS should skip the cron phase and print instructions for
creating a launchd plist manually, or just note that scheduled backups are
Linux-only and the drive must be run manually (`sudo backup run`).

### sysup doctor integration

In `executable_sysup`, add to `tools_dev`:
```bash
tools_dev=(git tmux docker backup rsnapshot)
```

Add a version case for rsnapshot (uses `--version`):
```bash
rsnapshot) rsnapshot --version 2>&1 | head -1 ;;
```

### zsh completion

```zsh
_backup_completion() {
  local -a subcmds
  subcmds=(status setup doctor run list diff du find log version help)
  _arguments '1:command:->cmd'
  case $state in
    cmd) _describe 'command' subcmds ;;
  esac
}
compdef _backup_completion backup 2>/dev/null
```

---

## Suggestion 2 — Add a git-bundle layer for project history

This fills the critical gap: rsnapshot excludes `.git/objects/`, so project
git history is not backed up. A `backup git-bundle` subcommand iterates all
git repos under `~/Projects/` and writes a portable bundle file per repo onto
the USB drive.

A git bundle contains the full object graph — all commits, trees, blobs,
branches. You can clone or fetch from it later and run `git log`, `git diff`,
`git show`, `git blame` on any file at any point in history.

### New subcommand: `backup git-bundle`

```bash
GIT_BUNDLE_ROOT="${MOUNT_POINT}/git-bundles"

cmd_git_bundle() {
  require_mounted
  mkdir -p "$GIT_BUNDLE_ROOT"
  info "Bundling git repositories from $HOME/Projects/ ..."
  local count=0 failed=0

  while IFS= read -r git_dir; do
    local repo_dir
    repo_dir="$(dirname "$git_dir")"
    local name
    name="$(basename "$repo_dir")"
    local bundle_path="${GIT_BUNDLE_ROOT}/${name}.bundle"

    if git -C "$repo_dir" bundle create "$bundle_path" --all 2>/dev/null; then
      printf "  ${GREEN}✓${NC} %s\n" "$name"
      count=$((count + 1))
    else
      printf "  ${RED}✗${NC} %s (skipped — possibly empty repo)\n" "$name"
      failed=$((failed + 1))
    fi
  done < <(find "$HOME/Projects" -maxdepth 4 -name ".git" -type d 2>/dev/null | sort)

  echo ""
  info "Bundled $count repo(s) to $GIT_BUNDLE_ROOT"
  [[ $failed -gt 0 ]] && warn "$failed repo(s) skipped"
}
```

### Bundle layout on the USB drive

```
/media/passport/
  snapshots/          ← rsnapshot working-tree snapshots
    alpha.0/
    alpha.1/
    beta.0/
    ...
  git-bundles/        ← full git history per project
    atomicguard.bundle
    manta-deploy.bundle
    dotfiles.bundle
    ...
```

### Retrieving history from a bundle

```bash
# Browse history without cloning
git clone /media/passport/git-bundles/myproject.bundle /tmp/myproject-review
cd /tmp/myproject-review

# File-level diff over time
git log --oneline -- src/main.py
git diff HEAD~5 HEAD -- src/main.py

# Find when a line was introduced
git log -S "search string" -- src/main.py

# Full blame at any commit
git blame abc1234 -- src/main.py
```

### Scheduling

Hook `cmd_git_bundle` into `backup run` so bundles update on every alpha:

```bash
cmd_run() {
  ...
  rsnapshot "$level"
  cmd_git_bundle   # append to run
}
```

Or add it as a separate cron entry (runs after alpha):

```
15 */4 * * *  mt  mountpoint -q /media/passport && backup git-bundle
```

---

## Suggestion 3 — Welcome message and `sysup` ecosystem integration

Independent of whichever approach is implemented — integrate `backup` into the
existing tooling so staleness is visible without running a separate command.

### Welcome message (`dot_zshrc`)

Add a `backup warn` subcommand (like `sysmon warn`) that exits non-zero and
prints a message when the last backup is stale:

```bash
cmd_warn() {
  if ! is_mounted; then
    echo "WARN  Backup drive not mounted"
    exit 1
  fi
  local last_backup_age_h
  last_backup_age_h=$(...)  # hours since last successful rsnapshot run
  if [[ "$last_backup_age_h" -ge 48 ]]; then
    echo "CRIT  Last backup ${last_backup_age_h}h ago"
    exit 2
  elif [[ "$last_backup_age_h" -ge 25 ]]; then
    echo "WARN  Last backup ${last_backup_age_h}h ago"
    exit 1
  fi
}
```

Then in `dot_zshrc`, alongside the existing `sysmon warn` block:

```bash
if command -v backup >/dev/null 2>&1; then
  _bwarn=$(backup warn 2>/dev/null)
  _bwarn_exit=$?
  if [ "$_bwarn_exit" -ne 0 ] && [ -n "$_bwarn" ]; then
    echo ""
    echo "  \033[1;33mbackup warnings:\033[0m"
    echo "$_bwarn" | while read -r line; do
      echo "    $line"
    done
  fi
  unset _bwarn _bwarn_exit
fi
```

### `sysup upgrade` hook

Optionally trigger an alpha backup at the end of `sysup upgrade`, so every
system upgrade is captured as a snapshot:

```bash
cmd_upgrade() {
  ...existing upgrade logic...
  if has backup && backup doctor --quiet 2>/dev/null; then
    info "Running backup after upgrade..."
    sudo backup run alpha
  fi
}
```

---

## Suggested implementation order

1. **Suggestion 1** — port the script with portability fixes. The `portability.md`
   doc has already done the analysis; this is mechanical work. Gives a working
   `backup` command in the dotfiles.

2. **Suggestion 2** — add `backup git-bundle`. ~50 lines. Directly delivers
   "backup history and diffs on specific files" at the git level.

3. **Suggestion 3** — wire into welcome message and `sysup`. Small add-on once
   the script exists.

---

## Files to read before implementing

| File | Why |
|------|-----|
| `~/Projects/local_popmini_backup/backup` | The script to port (867 lines) |
| `~/Projects/local_popmini_backup/docs/portability.md` | Per-item fix catalogue |
| `~/Projects/local_popmini_backup/docs/backup.md` | Command reference (move to `docs/`) |
| `dot_local/bin/executable_sysup` | Pattern for doctor, upgrade hooks |
| `dot_local/bin/executable_sysmon` | Pattern for warn subcommand |
| `dot_zshrc` | Where to add completion and welcome message block |

## Verification checklist (post-implementation)

- [ ] `shellcheck -x -s bash dot_local/bin/executable_backup` — no warnings
- [ ] `bash -n dot_local/bin/executable_backup` — syntax ok
- [ ] `./tests/test.sh quick` — all pass
- [ ] `chezmoi apply --dry-run` — deploys cleanly
- [ ] `sysup doctor` — `backup` and `rsnapshot` appear in output
- [ ] `backup doctor` — all checks pass on the target machine
- [ ] `backup run --dry-run` — rsnapshot dry run succeeds
- [ ] `backup git-bundle` — bundles written to USB drive
- [ ] Clone a bundle and run `git log` — history visible
- [ ] New shell shows backup staleness warning when drive is stale
