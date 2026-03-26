# LiteLLM Crash Triage — pop-mini (2026-03-25)

**Date of incident:** 2026-03-25 ~11:45–11:58 UTC+1
**Date of triage:** 2026-03-26
**Machine:** pop-mini (System76, Pop!_OS 22.04, 29.1G RAM, 16 cores)
**Uptime at crash:** 11d 13h

## Summary

Running `litellm` on pop-mini caused a cascading OOM that hard-crashed the machine.
Post-crash triage found **no evidence of the supply chain attack** (litellm 1.82.7/1.82.8).
The crash was caused by starting a heavy Python process on an already memory-saturated system.

## Crash timeline (from journalctl and sysmon output)

### Pre-existing load

| Resource | Value | Notes |
|----------|-------|-------|
| RAM | 22G / 29.1G (75%) | 3 Claude Code sessions, Docker, LeStash server |
| Swap | 9.2G / 20G (46%) | |
| Uptime | 11d 13h | Accumulated process sprawl |
| Tmux sessions | 3 | chops, lestash, manta-deploy |
| Docker containers | 1 | |
| CPU temp | 77°C | Already above 75°C warning threshold |
| Zombies | 3 | |

### Event sequence

| Time | Source | Event |
|------|--------|-------|
| ~11:45 | user action | `litellm` run (likely `! litellm` in Claude Code) — started the proxy server |
| 11:51:51 | sysmon | RAM 76%, Swap 46%, load 2.36, CPU 77°C. LiteLLM shown as "stopped" (service check, not process check). |
| 11:52:01 | sysmon | Swap **jumped to 82%** (+7.4GB in 10s), load 3.20, CPU 76°C. Docker killed by pressure. kworker/kcryptd threads thrashing on encrypted disk I/O. |
| 11:52:37 | kernel | `cgroup: fork rejected by pids controller in /user.slice/user-1000.slice/session-90.scope` |
| 11:52:38 | kernel | `cgroup: fork rejected by pids controller in /user.slice/user-1000.slice/session-1005.scope` |
| 11:52:41 | sysmon | RAM 77%, Swap 87%. sysmon itself hits fork failures, cannot complete. Docker now stopped. |
| 11:55:01 | cron | Last successful cron job (debian-sa1). System still partially functional. |
| 11:56:18 | sysmon warn | **RAM at 98%**, CPU 84°C. Only warning output; sysmon too degraded for full dashboard. |
| 11:56:37+ | shell | Every command: `fork failed: resource temporarily unavailable`. Doubled keystrokes from extreme lag. |
| 11:57:18 | journalctl | **Last log entry.** No graceful shutdown, no OOM killer messages. |
| 11:58:22 | kernel (next boot) | System rebooted. FAT-fs: "Volume was not properly unmounted" on both EFI partitions. |

### Key observations from logs

- **session-90** (where fork was rejected) was a tmux session created Mar 16 — the long-running dev session
- **session-1005** was the SSH session opened at 11:51:44
- **uv PID 818565** was the LeStash API server, not LiteLLM — confirmed by request paths (`/api/health`, `/api/items`, `/api/sources`)
- **No LiteLLM entries in journald** — it was run manually, not as a service
- **No OOM killer messages** — kernel became too memory-starved to invoke OOM killer before hard crash
- **Swappiness at 180** (Pop!_OS zswap default) — system aggressively swapped instead of killing processes, prolonging the death spiral
- **LUKS encryption** added overhead: kworker/kcryptd threads dominated CPU during swap thrashing

## Triage checks (2026-03-26)

All supply chain attack indicators checked **negative**:

| Check | Command | Result |
|-------|---------|--------|
| Backdoor persistence | `ls ~/.config/sysmon/sysmon.py` | **Not found** |
| Malicious systemd service | `systemctl --user status sysmon` | **Unit not found** |
| Fork bomb `.pth` file | `find ~/.cache/uv ~/.local/lib -name "litellm_init.pth"` | **Not found** |
| Installed litellm version | `uv tool list \| grep litellm` | **Not installed** (completely absent) |
| Malicious domain references | `grep -r "models.litellm.cloud" ~/.local ~/.config /tmp` | **None** |
| Suspicious containers | `docker ps -a \| grep "node-setup"` | **None** |
| SSH authorized_keys | `cat ~/.ssh/authorized_keys` | **3 keys, all recognized** (2x ed25519 thompsonson@gmail.com, 1x rsa localhost) |

## Root cause determination

**The crash was a plain OOM, not a supply chain attack.**

LiteLLM is not even installed on pop-mini — the `litellm` command in the dotfiles wrapper script would have failed at the `has litellm` check. The most likely scenario is that `litellm` was invoked via `uv run` or a similar one-shot mechanism that downloaded and ran it without persistent installation.

### Why it crashed

1. System already at 75% RAM with 3 Claude Code sessions (~300MB+ each), Docker, and LeStash
2. Starting a Python process that loads litellm + all proxy dependencies consumed several GB
3. With only ~7GB free RAM, the system began aggressive swapping
4. Encrypted disk I/O (LUKS/kcryptd) made swap thrashing extremely slow
5. High swappiness (180) meant the kernel kept swapping instead of killing processes
6. Total memory demand exceeded RAM + swap → fork failures → system lockup → hard crash

### Why it was NOT the supply chain attack

- No malicious artifacts found (no `.pth`, no backdoor, no systemd service)
- No references to `models.litellm.cloud`
- LiteLLM is not installed via `uv tool` — the compromised package scenario requires an installed version
- The memory exhaustion pattern (gradual swap climb over minutes) is inconsistent with a fork bomb (which would exhaust PIDs in seconds)
- SSH authorized_keys contains only recognized keys

## Recommendations

These are tracked in [issue #24](https://github.com/thompsonson/dotfiles/issues/24):

1. **Default `litellm` (no args) to `status`** — align with `sysup`, `sysmon`, `sysbak`
2. **Add memory limits to `litellm start`** — use `systemd-run --scope -p MemoryMax=4G` or similar
3. **Pre-flight memory check** — refuse to start if available RAM is below a threshold
4. **Run as a systemd user service** with `MemoryMax=4G` and `OOMPolicy=stop`

## Relationship to supply chain branch

The `claude/check-litellm-version-62ZM5` branch added version pinning and compromised-version detection. These are **still valuable as defense-in-depth** even though the supply chain attack was not the cause of this specific crash:

- Version pinning prevents accidentally pulling a compromised future release
- The blocked version check provides an early warning if a bad version is ever installed
- The incident response document serves as a reference for future supply chain events

However, the incident doc (`litellm-supply-chain-incident.md`) should be updated to note that the pop-mini crash was **not** caused by the supply chain attack.
