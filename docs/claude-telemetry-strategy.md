# Claude Code Telemetry — Why and What Good Looks Like

## Purpose

This telemetry pipeline serves two connected goals:

**1. Personal development analytics**
As the sole developer and CTO of Manta Technologies, understand where Claude Code time is actually spent — across Manta repos, AtomicGuard, and personal tooling. Weekly and monthly retros, not live dashboards.

**2. Empirical input to workflow-service**
Claude Code's tool chains are real-world evidence of recurring workflows. A session that consistently runs `git commit → gh pr create → gh run watch` is a workflow that exists in practice. The telemetry pipeline captures these patterns so they can be registered in `workflow-service` — grounding its intent registry in observed behaviour rather than guesswork.

The connection: **Claude Code produces tool chains → telemetry captures them → analysis reveals patterns → patterns become registered workflows → workflow-service routes voice/agent inputs to those workflows → atomicguard validates execution.**

---

## What this is not

- Not an enterprise observability system
- Not real-time dashboards or alerting
- Not a replacement for Anthropic Console billing data
- Not multi-user or shared infrastructure

This is a lightweight personal tool: one Docker container, one SQLite file, a few Python scripts.

---

## The pipeline

```
Claude Code (any machine)
  │  CLAUDE_CODE_ENABLE_TELEMETRY=1
  │  OTEL_EXPORTER_OTLP_ENDPOINT → pop-mini:4318
  ▼
otelcol-contrib (Docker, pop-mini)
  │  file exporter → JSONL rotation
  ▼
ingest.py (systemd timer, every 5 min)
  │  byte-offset tracking, idempotent
  ▼
claude.db → table: events          ← live OTel forward stream

~/.claude/projects/**/*.jsonl      ← existing transcripts
  │  backfill.py (one-shot, idempotent)
  ▼
claude.db → table: legacy_events   ← historical data (back to Jan 2026)

claude-chains.py                   ← tool-sequence n-gram analysis (standalone)
otel-stats                         ← SQL presets for retros
```

---

## What good looks like

### Personal analytics (done when...)
- `otel-stats hours-per-week --since=2026-01-01` gives a reliable weekly active-time view across all projects
- `otel-stats by-project` shows where effort is concentrated across Manta vs AtomicGuard vs tooling
- Token totals per day are queryable — giving a cost-proxy without hitting the Anthropic Console

### Workflow-service input (done when...)
- `claude-chains.py --summary-only --since 30` reliably surfaces the top 20 tool n-grams
- At least 3 recurring patterns are clearly identifiable (e.g. `git → gh pr create`, `Read → Edit → Bash`, `Agent → git → gh`)
- Those patterns are written up as candidate workflow registrations in `workflow-service`
- The connection between "observed in telemetry" and "registered in workflow-service" is documented in that repo

### Ongoing health (done when...)
- `otel-ingest.timer` runs reliably on pop-mini with no manual intervention
- New machines can opt in by touching `~/.config/claude-telemetry/enabled`
- `sysbak` covers `~/.local/share/otel/data/` so the SQLite store is backed up

---

## Key questions this should answer

| Question | Source |
|---|---|
| How many hours per week am I using Claude Code? | `otel-stats hours-per-week` |
| Which projects take the most time? | `otel-stats by-project` |
| What are the most common tool sequences? | `claude-chains.py --summary-only` |
| Which tools fail most often? | `otel-stats by-tool` + error analysis |
| Which workflows recur enough to register? | n-gram analysis → workflow-service |
| How does usage split across Manta vs AtomicGuard? | `--project` filter on any preset |

---

## Related docs

- [`claude-telemetry.md`](claude-telemetry.md) — ops reference: setup, activation, network, operations
- [`claude-session-analysis.md`](claude-session-analysis.md) — historical analysis (Apr 2026 baseline)
- [`workflow-service`](https://github.com/thompsonson/workflow-service) — the downstream consumer of workflow patterns
