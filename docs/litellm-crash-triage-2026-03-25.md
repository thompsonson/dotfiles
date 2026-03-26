# LiteLLM Crash Triage — pop-mini (2026-03-25)

**Date of incident:** 2026-03-25 ~11:45–11:58 UTC+1
**Date of triage:** 2026-03-26
**Machine:** pop-mini (System76, Pop!_OS 22.04, 29.1G RAM, 16 cores)
**Uptime at crash:** 11d 13h
**Verdict:** OOM was the proximate cause; supply chain attack **not confirmed but cannot be excluded**

## Summary

Running `litellm` on pop-mini caused a cascading failure that hard-crashed the machine.
Post-crash triage found **no persistent artifacts** from the supply chain attack (litellm 1.82.7/1.82.8), but several signals remain ambiguous and the triage has inherent blind spots. Credential rotation should be treated as necessary regardless of root cause attribution.

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

All persistent supply chain attack indicators checked **negative**:

| Check | Command | Result |
|-------|---------|--------|
| Backdoor persistence | `ls ~/.config/sysmon/sysmon.py` | **Not found** |
| Malicious systemd service | `systemctl --user status sysmon` | **Unit not found** |
| Fork bomb `.pth` file | `find ~/.cache/uv ~/.local/lib -name "litellm_init.pth"` | **Not found** |
| Installed litellm version | `uv tool list \| grep litellm` | **Not installed** (completely absent) |
| Malicious domain references | `grep -r "models.litellm.cloud" ~/.local ~/.config /tmp` | **None** |
| Suspicious containers | `docker ps -a \| grep "node-setup"` | **None** |
| SSH authorized_keys | `cat ~/.ssh/authorized_keys` | **3 keys, all recognized** (2x ed25519 thompsonson@gmail.com, 1x rsa localhost) |
| uv cache (all subdirs) | `find ~/.cache/uv -path "*litellm*"` | **Completely empty** — no wheels, sdists, builds, envs, or metadata. Cache was either purged or litellm was never run via uv. |

## Analysis

### What supports the OOM theory

The system was genuinely overloaded: 75% RAM, 3 Claude sessions, Docker, LeStash, 11 days uptime. Starting a heavy Python process (litellm + FastAPI + provider SDKs) on a system with ~7GB free RAM could plausibly tip it into swap thrashing, especially with LUKS encryption overhead and swappiness at 180.

### What doesn't fit a simple OOM

1. **The PID controller rejections are suspicious.** `cgroup: fork rejected by pids controller` means the cgroup hit its **process count limit**, not its memory limit. A normal OOM triggers the OOM killer (which selects and kills processes). PID exhaustion is a different failure mode — and it's exactly what a fork bomb produces. The triage found no OOM killer messages but didn't adequately explain why the PID controller fired instead. This is the more interesting signal.

2. **7.4GB swap jump in 10 seconds is extreme for one process.** Even a heavy Python process loading litellm + all dependencies might consume 1–2GB. A 7.4GB spike in a 10-second window is more consistent with **many processes spawning simultaneously**. The initial draft claimed "gradual swap climb over minutes" but the actual data shows a massive spike in one 10-second window followed by cascading failure — that pattern is not inconsistent with a fork bomb.

3. **How was litellm actually invoked?** LiteLLM is not installed via `uv tool`, and the wrapper script would fail at the `has litellm` check. It was most likely invoked via `uv run` or similar one-shot mechanism. But `uv run` caches downloaded packages in a **different location** than `uv tool`. If litellm was first `uv run`'d on March 24 (during the 3-hour attack window), a cached compromised version could have been reused on March 25.

### Triage gaps

- **`uv` cache is empty — inconclusive.** A full search of all `~/.cache/uv` subdirectories (wheels-v5, wheels-v6, archive-v0, builds-v0, environments-v2, simple-v17–v20, sdists-v9) found **zero litellm artifacts**. This means either (a) the cache was purged (manually or by hard-reboot corruption), or (b) litellm was never run via `uv` on this machine. Either way, we cannot determine which version was used. The evidence gap remains open.
- **Post-reboot evidence is inherently incomplete.** The malware's credential harvest (stage 1) and exfiltration (stage 2) are designed to complete quickly and leave minimal persistent traces. A hard crash destroys volatile evidence (process memory, open network connections, /proc state). The absence of stage 3 persistence files only means stage 3 didn't complete — it does not mean stages 1–2 didn't execute.
- **No network logs.** We have no packet captures or firewall logs to confirm or deny connections to `models.litellm.cloud`. The `grep` search only covers files on disk, not historical network activity.
- **How was litellm invoked?** With no `uv tool` installation and an empty `uv` cache, the invocation method is unknown. Possibilities: `uv run` (cache since cleared), `pip run`, direct `python -m litellm`, or Docker. Without knowing the invocation method, we cannot determine which version was used.

## Verdict

**OOM was the proximate cause of the crash** — the system was genuinely overloaded and the memory exhaustion narrative is plausible.

**The supply chain attack cannot be ruled out.** The PID controller rejections and the 7.4GB/10s swap spike are signals that are more consistent with process proliferation (fork bomb) than a single heavy process. The `uv run` cache was not inspected for a cached compromised version. Stages 1–2 of the malware (credential harvest and exfiltration) leave no persistent artifacts by design.

**Credential rotation should be treated as necessary, not optional.** This is the safe call regardless of root cause attribution. See the rotation checklist in [`litellm-supply-chain-incident.md`](litellm-supply-chain-incident.md#credential-rotation-required).

## Outstanding actions

### Immediate (do now)

- [x] **Check the `uv run` cache** — entire `~/.cache/uv` is clean of litellm artifacts. Inconclusive: cache was either purged or litellm was never run via uv. Version used cannot be determined.
- [ ] **Rotate all credentials** per the checklist in the incident doc — treat as required, not precautionary
- [ ] **Check Anthropic/OpenAI billing dashboards** for unauthorized usage since March 24

### Tracked in [issue #24](https://github.com/thompsonson/dotfiles/issues/24)

- [ ] Default `litellm` (no args) to `status` — align with `sysup`, `sysmon`, `sysbak`
- [ ] Add memory limits to `litellm start` — use `systemd-run --scope -p MemoryMax=4G`
- [ ] Pre-flight memory check — refuse to start if available RAM is below a threshold
- [ ] Run as a systemd user service with `MemoryMax=4G` and `OOMPolicy=stop`

## Relationship to supply chain branch

The `claude/check-litellm-version-62ZM5` branch added version pinning and compromised-version detection. These remain valuable as defense-in-depth:

- Version pinning prevents accidentally pulling a compromised future release
- The blocked version check provides an early warning if a bad version is ever installed
- The incident response document and credential rotation checklist are **actionable now**
