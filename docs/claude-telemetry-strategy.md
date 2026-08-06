# Claude Code Telemetry — Why and What Good Looks Like

## Purpose

Telemetry serves two connected goals:

**1. Personal development analytics**
As the sole developer and CTO of Manta Technologies, understand where Claude Code time is actually spent — across Manta repos, AtomicGuard, and personal tooling. Weekly and monthly retros, not live dashboards.

**2. Empirical input to workflow-service**
Claude Code's tool chains are real-world evidence of recurring workflows. A session that consistently runs `git commit → gh pr create → gh run watch` is a workflow that exists in practice. The telemetry captures these patterns so they can be registered in `workflow-service` — grounding its intent registry in observed behaviour rather than guesswork.

The connection: **Claude Code produces tool chains → telemetry captures them → analysis reveals patterns → patterns become registered workflows → workflow-service routes voice/agent inputs to those workflows → atomicguard validates execution.**

---

## What this is not

- Not an enterprise observability system
- Not real-time dashboards or alerting
- Not a replacement for Anthropic Console billing data
- Not multi-user or shared infrastructure

---

## The pipeline (current)

Engine-neutral devmon ledger in Rust (formerly the OTel stack, now retired):

```
omp session jsonl (~/.omp/agent/sessions)
opencode.db (~/.local/share/opencode)
claude transcripts (~/.claude/projects/**/*.jsonl)
  │  devmon collect — byte-offset watermarks, idempotent (I11)
  ▼
~/.local/share/devmon/devmon.db
  ├── agent_turn        token usage per model turn
  ├── agent_tool_call   tool chains (workflow-service input)
  ├── agent_compaction  context resets
  ├── agent_session     sessions + project slug (extra)
  └── inference/serving  lemond telemetry, /metrics
```

Historical `~/.claude/projects` transcripts from the retired otel backfill are
ingested by `devmon otel-migrate` (same ingest path, guard bypassed).

---

## What good looks like

### Personal analytics (done when...)
- `devmon retro token_ledger` gives daily input/output/cache totals per model and engine
- Weekly active-time view across all projects, per project via `agent_session.extra.project`
- Cost-proxy token totals per day are queryable — without hitting the Anthropic Console

### Workflow-service input (done when...)
- `agent_tool_call` rows reliably surface the top tool chains (`Read → Edit → Bash`, `git → gh pr create`)
- At least 3 recurring patterns are clearly identifiable and written up as candidate workflow registrations in `workflow-service`
- The connection between "observed in telemetry" and "registered in workflow-service" is documented in that repo

### Ongoing health (done when...)
- The collector runs as a systemd-user unit (`devmon-collect.service`)
- Presence-based mutual exclusion keeps omp and claude feeds from double-counting the same sessions
- `sysbak` covers `~/.local/share/devmon/` so the ledger is backed up

---

## Key questions this should answer

| Question | Source |
|---|---|
| How many hours per week am I using Claude Code? | `devmon retro token_ledger` |
| Which projects take the most time? | `agent_session.extra.project` |
| What are the most common tool sequences? | `agent_tool_call` group-by tool_name |
| Which workflows recur enough to register? | tool chains → workflow-service |
| How does usage split across Manta vs AtomicGuard? | project filter on agent_session |

---

## Retired: the OTel pipeline

The OTel collector pipeline (`otelcol-contrib` Docker on pop-mini → file exporter
→ Python ingester → `claude.db`) was replaced by devmon in Aug 2026. Superseded:

- `~/.local/share/otel/{ingest.py,backfill.py,schema.sql,config.yaml,compose.yml}`
- `~/.config/systemd/user/otel-ingest.{service,timer}`
- `run_once_after_install-otel-collector.sh.tmpl`
- `OTEL_*` / `CLAUDE_CODE_ENABLE_TELEMETRY` exports in `.zshrc`

Claude Code's OTel forward stream mapped to no devmon aggregate, so `ingest.py`
was not ported; `backfill.py` became `feed/claude.rs`. Legacy data (if any
`claude.db` survives) migrates with `devmon otel-migrate`.

---

## Related docs

- [`claude-session-analysis.md`](claude-session-analysis.md) — historical analysis (Apr 2026 baseline)
- [`claude-telemetry.md`](claude-telemetry.md) — retired ops reference
- [`workflow-service`](https://github.com/thompsonson/workflow-service) — the downstream consumer of workflow patterns
