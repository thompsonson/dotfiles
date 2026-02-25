# System Health Monitor (sysmon)

`sysmon` is a cross-platform, non-interactive system health dashboard. It provides instant, glanceable summaries of CPU load, memory, disk usage, processes, services, and network state across macOS, Linux, and WSL.

**Source:** `~/.local/bin/sysmon` (`dot_local/bin/executable_sysmon` in chezmoi)

## Synopsis

```bash
sysmon                  # One-screen health dashboard (same as sysmon status)
sysmon status           # System overview: load, memory, disk, processes
sysmon disk             # Detailed disk usage breakdown
sysmon mem              # Memory usage and top consumers
sysmon proc             # Process summary and top consumers
sysmon net              # Network interfaces, ports, connections
sysmon warn             # Warnings only (exit 0=ok, 1=warn, 2=critical)
sysmon version          # Show sysmon version
sysmon help             # Show built-in help
```

## Commands

| Command | Description |
|---------|-------------|
| `sysmon` / `sysmon status` | One-screen dashboard with system info, memory, disk, top processes, services, and warnings |
| `sysmon disk` | Filesystem usage with bars, home directory breakdown by size |
| `sysmon mem` | RAM/swap usage with bars, top memory-consuming processes |
| `sysmon proc` | Process counts by state, top CPU and memory consumers |
| `sysmon net` | Network interfaces with IPs, DNS, listening ports, connection counts |
| `sysmon warn` | Print only warnings/alerts. Exit code: 0=healthy, 1=warnings, 2=critical |
| `sysmon version` | Print the sysmon version |
| `sysmon help` | Show the built-in help text |

## Status Dashboard

The default `sysmon` / `sysmon status` command shows a single-screen overview:

- **System** — hostname, platform, uptime, load average with core count
- **Memory** — RAM and swap usage with color-coded percentage bars
- **Disk** — mount points with usage bars (WSL filters out `/mnt/*` Windows mounts)
- **Top Processes** — top 5 processes by CPU usage
- **Services** — Docker status, tmux session count, SSH listener status
- **Warnings** — health alerts or "No warnings"

Percentage bars are color-coded: green (<60%), yellow (60-85%), red (>85%).

## Health Checks (warn)

`sysmon warn` is designed for scripting. It outputs only warnings and uses exit codes:

| Check | Warning | Critical |
|-------|---------|----------|
| Disk usage | >85% | >95% |
| RAM usage | >80% | >95% |
| Swap usage | >50% | >80% |
| Load average | > core count | > 2× core count |
| Zombie processes | > 0 | > 5 |

Exit codes: `0` = all healthy, `1` = warnings present, `2` = critical issues.

### Welcome message integration

When `sysmon` is installed, the shell welcome message automatically displays any health warnings on login. This surfaces disk-full or high-memory situations immediately on SSH connection.

## Cross-Platform Support

| Data | macOS | Linux/WSL |
|------|-------|-----------|
| Memory | `vm_stat` + `sysctl hw.memsize` | `/proc/meminfo` |
| CPU cores | `sysctl -n hw.ncpu` | `nproc` |
| Load average | `sysctl -n vm.loadavg` | `/proc/loadavg` |
| Uptime | `sysctl -n kern.boottime` | `/proc/uptime` |
| Disk | `df -k` (device-based) | `df -k` (filters virtual FS) |
| Processes | `ps -eo` (BSD) | `ps -eo` (GNU) |
| Interfaces | `ifconfig` | `ip addr` |
| Listening ports | `lsof -i -P -n` | `ss -tlnp` |

WSL-specific: the `disk` subcommand shows Windows mounts (`/mnt/c`, `/mnt/d`) in a separate section. The default `status` view filters them out.

## Typical Workflow

```bash
sysmon              # Quick health check
sysmon disk         # Disk filling up? See what's using space
sysmon mem          # High memory? Find the culprit
sysmon net          # Check what's listening on this machine
sysmon warn         # Scriptable health check (exit code)
```

## How It Differs from btop/duf/procs

`sysmon` is **non-interactive** and **instant**. The installed TUI tools (`btop`, `duf`, `ncdu`, `procs`) are great for deep interactive exploration, but `sysmon` gives a one-command, one-screen summary:

| Need | Without sysmon | With sysmon |
|------|----------------|-------------|
| Quick health check | Run 4-5 commands, parse mentally | `sysmon` — one screen |
| Disk filling up? | Launch `ncdu`, navigate, exit | `sysmon disk` — 3 seconds |
| What's eating RAM? | Launch `btop`, sort, exit | `sysmon mem` — instant |
| Health check in scripts | Write custom checks | `sysmon warn` — exit code |
| Same command everywhere | Different tools per platform | Same output on macOS/Linux/WSL |
