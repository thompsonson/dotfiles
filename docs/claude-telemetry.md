# Claude Code Telemetry — Pop-mini OTel Pipeline (RETIRED)

> **Retired Aug 2026.** Superseded by the devmon ledger (`~/Projects/devmon`),
> which ingests Claude telemetry directly from transcripts and stores it in
> `~/.local/share/devmon/devmon.db`. See
> [claude-telemetry-strategy.md](claude-telemetry-strategy.md) for the current
> pipeline and rationale.

## What was removed

| Path | Fate |
|---|---|
| `~/.local/share/otel/config.yaml` | removed — collector retired |
| `~/.local/share/otel/compose.yml` | removed — no Docker collector |
| `~/.local/share/otel/schema.sql` | removed — schema lives in devmon (`schema.sql`) |
| `~/.local/share/otel/ingest.py` | removed — OTel events mapped to no devmon aggregate |
| `~/.local/share/otel/backfill.py` | ported to `devmon-lib/src/feed/claude.rs` |
| `~/.config/systemd/user/otel-ingest.{service,timer}` | removed — replaced by `devmon-collect.service` |
| `run_once_after_install-otel-collector.sh.tmpl` | removed |
| `OTEL_*` / `CLAUDE_CODE_ENABLE_TELEMETRY` in `.zshrc` | removed |
| `~/.local/bin/otel-stats` | kept (reads a surviving `claude.db` if present) |

## Migration

If a `~/.local/share/otel/data/claude.db` survives, its historical transcripts
(back to Jan 2026) are ingested into devmon with:

```bash
devmon otel-migrate
```

The `legacy_events` table (source_kind `session`/`subagent`, project slug,
token fields) maps onto devmon's `agent_turn` / `agent_tool_call` /
`agent_session.extra.project`.

## Historical schema (reference)

`legacy_events`:
- `source_kind`: `session` or `subagent`
- `ts, session_id, parent_session_id, project, git_branch, model`
- `event_type, tool_name, tool_use_id, message_id`
- `input_tokens, output_tokens, cache_read_tokens, cache_write_tokens`
- `raw` (full JSON for inspection)
