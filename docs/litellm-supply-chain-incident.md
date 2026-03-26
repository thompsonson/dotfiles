# LiteLLM Supply Chain Incident — pop-mini Response

**Date:** 2026-03-24
**Affected machine:** pop-mini
**Symptom:** Machine crash while running LiteLLM proxy
**Suspected cause:** Compromised litellm PyPI packages (versions 1.82.7 and 1.82.8)
**Triage outcome:** OOM confirmed as proximate cause; supply chain attack not confirmed but cannot be excluded (see [triage report](litellm-crash-triage-2026-03-25.md))

## What happened

On March 24, 2026 the TeamPCP threat group published two malicious versions of the `litellm` Python package to PyPI. The attack chain:

1. TeamPCP previously compromised Aqua Security's **Trivy** GitHub Action (March 19)
2. LiteLLM's CI/CD pipeline ran Trivy **without a pinned version**, pulling the compromised action
3. The compromised action exfiltrated the `PYPI_PUBLISH` token from the GitHub Actions runner
4. Using that token, the attackers published `litellm` 1.82.7 (10:39 UTC) and 1.82.8 (10:52 UTC) directly to PyPI — no corresponding GitHub release exists

The malicious versions were live for approximately **3 hours** before being yanked.

## What the malware does

### Stage 1 — Credential harvesting
A payload injected into `litellm/proxy/proxy_server.py` (12 lines of obfuscated code) activates on import and collects:

- SSH private keys and configs (`~/.ssh/`)
- `.env` files
- AWS / GCP / Azure credentials
- Kubernetes configs and service account tokens
- Database passwords, `.gitconfig`, shell history
- Crypto wallet files
- Anything matching common secret patterns

### Stage 2 — Exfiltration
Collected data is encrypted with a hardcoded 4096-bit RSA public key (AES-256-CBC), bundled into a tar archive, and POSTed to `https://models.litellm.cloud/` — a domain **not** part of legitimate litellm infrastructure.

### Stage 3 — Lateral movement and persistence
- If a Kubernetes service account token is present: reads all cluster secrets, attempts to create privileged pods on every node in `kube-system` mounting the host filesystem
- Installs a persistent backdoor at `~/.config/sysmon/sysmon.py` with a systemd user service (both on remote nodes and the local machine)

### Stage 4 — Fork bomb (bug in malware)
Version 1.82.8 added a `litellm_init.pth` file that triggers on every Python interpreter startup. The child process re-triggers the `.pth`, creating an exponential fork bomb.

> **Note (2026-03-26 triage):** Post-crash triage found no persistent artifacts from the supply chain attack on pop-mini. OOM was the proximate cause. However, the PID controller rejections and rapid swap spike are signals consistent with a fork bomb, the `uv run` cache was not inspected for a cached compromised version, and stages 1–2 of the malware leave no persistent traces by design. The supply chain attack **cannot be excluded**. Credential rotation should be treated as required. See the full [triage report](litellm-crash-triage-2026-03-25.md).

## pop-mini triage checklist

Run these checks on pop-mini:

```bash
# 1. Check for the backdoor persistence file
ls -la ~/.config/sysmon/sysmon.py
# Expected: "No such file or directory"

# 2. Check for malicious systemd service
systemctl --user status sysmon 2>/dev/null
ls ~/.config/systemd/user/sysmon.service
# Expected: not found

# 3. Check for the malicious .pth file
find ~/.cache/uv ~/.local/lib -name "litellm_init.pth" 2>/dev/null
python3 -c 'import site; print(site.getusersitepackages())' 2>/dev/null | xargs -I{} find {} -name "litellm_init.pth" 2>/dev/null
# Expected: no output

# 4. Check installed litellm version
litellm --version 2>/dev/null
uv tool list 2>/dev/null | grep litellm
# Should NOT be 1.82.7 or 1.82.8

# 5. Check for outbound connections to malicious domain
grep -r "models.litellm.cloud" ~/.local ~/.config /tmp 2>/dev/null
# Expected: no output

# 6. Check for suspicious kubernetes activity (if applicable)
kubectl get pods -n kube-system 2>/dev/null | grep "node-setup"
# Expected: no output
```

## Credential rotation required

**Even if no persistence is found**, the malware may have completed stages 1-2 (harvest and exfiltrate) before the fork bomb crashed the machine. Treat these credentials as compromised:

### Immediate rotation (do these first)
- [ ] `ANTHROPIC_API_KEY` — rotate in Anthropic console
- [ ] `OPENAI_API_KEY` — rotate in OpenAI dashboard
- [ ] Any other keys in `~/.config/litellm/env`
- [ ] SSH keys (`~/.ssh/id_*`) — regenerate and update authorized_keys on all hosts
- [ ] GitHub personal access tokens / SSH keys

### Check and rotate if present on pop-mini
- [ ] AWS credentials (`~/.aws/credentials`)
- [ ] GCP service account keys (`~/.config/gcloud/`)
- [ ] Azure credentials (`~/.azure/`)
- [ ] Kubernetes configs (`~/.kube/config`)
- [ ] Any `.env` files in project directories
- [ ] Docker registry credentials (`~/.docker/config.json`)

### After rotation
- [ ] Update `~/.config/litellm/env` with new keys
- [ ] Verify no unauthorized usage on Anthropic/OpenAI billing dashboards
- [ ] Check SSH `authorized_keys` on all servers pop-mini connects to for unknown entries
- [ ] Review GitHub account for unexpected PATs, SSH keys, or OAuth apps

## Remediation applied to dotfiles

The following changes have been made in this repository:

1. **Version pinning** — `run_once_install-packages.sh.tmpl` now installs `litellm[proxy]==1.82.6` instead of unpinned `litellm[proxy]`
2. **Blocked version check** — `executable_litellm` checks the installed version against a blocklist (`1.82.7|1.82.8`) on every invocation and refuses to run if compromised
3. **Malicious .pth detection** — checks for `litellm_init.pth` in the Python site-packages directory
4. **Backdoor detection** — checks for `~/.config/sysmon/sysmon.py` persistence file

## Root causes and lessons

### Why this worked
- `uv tool install 'litellm[proxy]'` without a version pin pulled whatever was latest on PyPI
- LiteLLM's own CI/CD used an unpinned Trivy action, allowing the upstream compromise to cascade
- The litellm process held real API keys in its environment — a single point of compromise

### Prevention for the future
1. **Always pin package versions** with hash verification where possible
2. **Run litellm in a container or microVM** with egress restricted to LLM API endpoints only
3. **Use a credential-injecting proxy** so API keys never enter the litellm process — see [architecture options](litellm.md) and the approaches below:
   - [Docker MCP Gateway](https://github.com/docker/mcp-gateway) — `--block-network` + `--block-secrets` flags
   - [HashiCorp Boundary](https://developer.hashicorp.com/boundary/tutorials/hcp-administration/hcp-ssh-cred-injection) — credential injection at network boundary
   - [Aembit](https://aembit.io/blog/securing-ai-agents-without-secrets/) — ephemeral identity-based credentials, no static keys
4. **Delay updates** — don't install versions less than 48 hours old
5. **Monitor egress** — firewall rules blocking unexpected outbound connections would have prevented exfiltration

## References

- [LiteLLM Security Update (official)](https://docs.litellm.ai/blog/security-update-march-2026)
- [FutureSearch — Supply Chain Attack in litellm 1.82.8](https://futuresearch.ai/blog/litellm-pypi-supply-chain-attack/)
- [ARMO — LiteLLM Backdoor Analysis](https://www.armosec.io/blog/litellm-supply-chain-attack-backdoor-analysis/)
- [BleepingComputer — LiteLLM PyPI Package Compromised](https://www.bleepingcomputer.com/news/security/popular-litellm-pypi-package-compromised-in-teampcp-supply-chain-attack/)
- [Snyk — How a Poisoned Scanner Backdoored LiteLLM](https://snyk.io/articles/poisoned-security-scanner-backdooring-litellm/)
- [ReversingLabs — TeamPCP Spreads to LiteLLM](https://www.reversinglabs.com/blog/teampcp-supply-chain-attack-spreads)
- [Wiz — TeamPCP Campaign Analysis](https://www.wiz.io/blog/threes-a-crowd-teampcp-trojanizes-litellm-in-continuation-of-campaign)
