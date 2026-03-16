# Backup Manager (sysbak)

`sysbak` is a cross-platform USB rsnapshot backup manager with file-history browsing. It wraps rsnapshot to manage USB drive backups, and provides inode-deduplicated file version listing, diffing, and restoring across snapshots.

**Source:** `~/.local/bin/sysbak` (`dot_local/bin/executable_sysbak` in chezmoi)

## Synopsis

```bash
sysbak                          # Backup dashboard (same as sysbak status)
sysbak status                   # Drive state, snapshot counts, last backup time
sysbak run [alpha|beta|gamma]   # Trigger rsnapshot at given level
sysbak list <file>              # Show unique file versions across snapshots
sysbak diff <file> [version]    # Diff current file vs snapshot version
sysbak restore <file> [version] # Restore file from a snapshot version
sysbak warn                     # Staleness check (exit 0=ok, 1=warn, 2=critical)
sysbak setup                    # One-time setup: install rsnapshot, configure cron
sysbak doctor                   # Diagnose configuration and dependencies
sysbak git-bundle               # Bundle all git repos to USB drive
sysbak config [--edit]          # Show config or open in $EDITOR
sysbak version                  # Show sysbak version
sysbak help                     # Show built-in help
```

## Commands

| Command | Description |
|---------|-------------|
| `sysbak` / `sysbak status` | Dashboard: drive state, snapshot counts, disk usage, staleness |
| `sysbak run [level]` | Trigger rsnapshot (alpha/beta/gamma). Supports `--dry-run` |
| `sysbak list <file>` | Show unique file versions across snapshots (inode-deduplicated) |
| `sysbak diff <file> [ver]` | Diff current file vs snapshot version (uses `delta` if available) |
| `sysbak restore <file> [ver]` | Restore a file from a snapshot version (with confirmation) |
| `sysbak warn` | Print staleness warning. Exit code: 0=ok, 1=warn, 2=critical |
| `sysbak setup` | One-time: install rsnapshot, write config/fstab/cron |
| `sysbak doctor` | Diagnose: config, device, dependencies, schedule, snapshots |
| `sysbak git-bundle` | Bundle all git repos from ~/Projects to USB drive |
| `sysbak config [--edit]` | Show config file or open in `$EDITOR` |
| `sysbak version` | Print the sysbak version |
| `sysbak help` | Show built-in help text |

## Status Dashboard

The default `sysbak` / `sysbak status` command shows:

- **Drive** — device, mount point, label, mount status, disk usage with bar
- **Snapshots** — count and latest age for alpha/beta/gamma levels
- **Schedule** — cron frequencies for each level
- **Warnings** — staleness alerts or "Backups current"

## File History Browsing

The primary feature. rsnapshot uses hardlinks for unchanged files, so multiple snapshots may point to the same inode. `sysbak list` deduplicates by inode to show only truly different versions.

### Example workflow

```bash
# See all unique versions of a file
sysbak list ~/Projects/myapp/src/main.py

# Output:
#   VERSION    MODIFIED              SIZE       SNAPSHOT
#   v0         2026-03-16 14:00      4.2K       alpha.0
#   v1         2026-03-16 10:00      4.0K       alpha.4
#   v2         2026-03-15 00:00      3.8K       beta.1
#
#   3 unique version(s) found (12 snapshots total, deduplicated by inode)

# Diff current file against the latest snapshot version
sysbak diff ~/Projects/myapp/src/main.py 0

# Diff against an older version
sysbak diff ~/Projects/myapp/src/main.py 2

# Restore from a specific version
sysbak restore ~/Projects/myapp/src/main.py 1
```

## Git Bundle

`sysbak git-bundle` creates portable git bundles for all repositories under `~/Projects/`. This complements rsnapshot (which excludes `.git/objects/`) by preserving full git history on the USB drive.

```bash
sysbak git-bundle

# Bundles are written to: <mount_point>/git-bundles/<repo>.bundle
# Restore with: git clone /mnt/backup/git-bundles/myproject.bundle
```

## Health Checks (warn)

`sysbak warn` is designed for scripting and integration with `sysmon`. It uses exit codes:

| Condition | Exit Code | Output |
|-----------|-----------|--------|
| Not configured | 0 | (silent) |
| Drive not mounted | 0 | (silent) |
| Last backup < 25h | 0 | (silent) |
| Last backup ≥ 25h | 1 | Warning message |
| Last backup ≥ 48h | 2 | Critical message |

### sysmon integration

When `sysbak` is installed and configured, `sysmon warn` and `sysmon status` automatically include backup staleness warnings. The shell welcome message surfaces these via the existing `sysmon warn` integration.

## Snapshot Schedule

After `sysbak setup`, cron jobs run backups on this schedule (Linux only):

| Level | Frequency | Retained | Cron |
|-------|-----------|----------|------|
| alpha | Every 4 hours | 6 | `0 */4 * * *` |
| beta  | Daily 03:30   | 7 | `30 3 * * *`  |
| gamma | Weekly Sun 03:00 | 4 | `0 3 * * 0` |

Each job gates on `mountpoint -q` — silently skipped if the drive is disconnected.

## Cross-Platform Support

| Feature | macOS | Linux/WSL |
|---------|-------|-----------|
| Mount check | `mount \| grep` | `mountpoint -q` |
| File metadata | BSD `stat -f` | GNU `stat -c` |
| Block devices | `diskutil list` | `lsblk` |
| Scheduling | Manual / launchd | cron (`/etc/cron.d/sysbak`) |
| fstab | Not used | Auto-configured |

## Configuration

Config file: `~/.config/sysbak/config`

```ini
# Device and mount
device=/dev/sda1
mount_point=/mnt/backup
label=BACKUP

# Backup directories
backup_dirs=(
    ~/Projects
    ~/.local/share/chezmoi
)

# Staleness thresholds (hours)
stale_warn_hours=25
stale_crit_hours=48
```

## Typical Workflow

```bash
# Initial setup (once per machine)
sysbak setup                    # Install rsnapshot, configure device

# Daily use
sysbak                          # Quick status check
sysbak run                      # Manual alpha backup
sysbak run --dry-run            # Preview what rsnapshot would do

# File recovery
sysbak list src/main.py         # Find versions
sysbak diff src/main.py 0       # See what changed
sysbak restore src/main.py 1    # Restore older version

# Git history backup
sysbak git-bundle               # Bundle all repos to USB

# Diagnostics
sysbak doctor                   # Check everything is configured
sysbak warn                     # Scriptable staleness check
```
