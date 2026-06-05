# Claude Code Telemetry — Pop-mini OTel Pipeline

Central OTel collector on pop-mini, SQLite store, ingest from any machine
running Claude Code. Codeburn-based retros are superseded by SQL against the
ingested store.

## TL;DR

- **Where:** pop-mini hosts everything. Other machines push telemetry to it via
  Tailscale MagicDNS (`pop-mini.monkey-ladon.ts.net:4318`).
- **Stack:** `otelcol-contrib` in Docker → JSONL file exporter → Python
  ingester on a systemd-user timer → SQLite at
  `~/.local/share/otel/data/claude.db`.
- **Backfill:** one-shot import of `~/.claude/projects/*/*.jsonl` and
  `*/subagents/*.jsonl` into a separate `legacy_events` table for historical
  retros. Goes back to Jan 2026 via subagent residuals.
- **Retention:** sysbak already covers `~/.claude/projects/`. The SQLite store
  also lives there once sysbak's include list picks up
  `~/.local/share/otel/data/`.
- **Goal:** retrospective analysis (weekly / monthly / project). Not live
  dashboards.

## Why this and not codeburn

Codeburn reads top-level Claude transcripts; Claude Code auto-deletes those
after `cleanupPeriodDays` (default 30). Sub-agent jsonls survive in nested
dirs that the cleanup sweep doesn't reach. Codeburn ignores them, so its view
is permanently windowed and silently incomplete. OTel captures forward-going
data into a store we own, and the backfill rescues what's still on disk.

The Anthropic OTel surface (`CLAUDE_CODE_ENABLE_TELEMETRY=1`) is the
officially supported channel; the local `.jsonl` files are documented as an
internal "mirror destination" with no stable schema. See
[Anthropic monitoring docs](https://code.claude.com/docs/en/monitoring-usage).

## Components

| Path | Purpose |
|---|---|
| `~/.local/share/otel/config.yaml` | Collector config (OTLP HTTP/gRPC in, file exporter out) |
| `~/.local/share/otel/compose.yml` | Docker compose (pop-mini only, `network_mode: host`) |
| `~/.local/share/otel/schema.sql`  | SQLite schema — `events`, `legacy_events`, `ingest_state` |
| `~/.local/share/otel/ingest.py`   | OTel JSONL → SQLite `events` (every 5 min via systemd timer) |
| `~/.local/share/otel/backfill.py` | `~/.claude/projects/**/*.jsonl` → `legacy_events` (one-shot, idempotent) |
| `~/.local/bin/otel-stats`         | Thin SQL wrapper with retro presets |
| `~/.config/systemd/user/otel-ingest.{service,timer}` | Ingester runs every 5 min |
| `run_once_after_install-otel-collector.sh.tmpl` (chezmoi) | First-time install, pop-mini-gated |

## Activation

After `chezmoi apply` on pop-mini:

```bash
docker compose -f ~/.local/share/otel/compose.yml up -d   # if not already running
python3 ~/.local/share/otel/backfill.py                   # first-time backfill
systemctl --user enable --now otel-ingest.timer

otel-stats hours-per-week --since=2026-04-01
otel-stats by-project --since=2026-04-01
otel-stats sql "SELECT model, COUNT(*) FROM legacy_events GROUP BY model;"
```

On a non-pop-mini machine:

```bash
mkdir -p ~/.config/claude-telemetry && touch ~/.config/claude-telemetry/enabled
exec zsh -l   # pick up env vars
```

## Network

The collector uses `network_mode: host` so it listens on every interface — 127.0.0.1 for
the local Claude shell, the LAN IP for in-house machines, the Tailscale IP for remote
hosts. If you want to lock down:

```bash
sudo ufw allow in on tailscale0 to any port 4318 proto tcp
sudo ufw allow in on tailscale0 to any port 4317 proto tcp
sudo ufw deny  in to any port 4318 proto tcp
sudo ufw deny  in to any port 4317 proto tcp
```

## Schema overview

`legacy_events` (historical, codeburn-shaped):
- `source_kind`: `session` or `subagent`
- `ts, session_id, parent_session_id, project, git_branch, model`
- `event_type, tool_name, tool_use_id, message_id`
- `input_tokens, output_tokens, cache_read_tokens, cache_write_tokens`
- `raw` (full JSON for inspection)

`events` (forward OTel data):
- `source`: `metrics`, `logs`, `traces`
- `ts, service_name, host_name, scope_name, name, value, unit`
- `trace_id, span_id`
- `attributes, resource` (JSON)

## Operations

```bash
# Status
docker compose -f ~/.local/share/otel/compose.yml ps
systemctl --user status otel-ingest.timer

# Logs
docker compose -f ~/.local/share/otel/compose.yml logs -f otelcol
journalctl --user -u otel-ingest.service -f

# Re-backfill (idempotent, picks up new files)
python3 ~/.local/share/otel/backfill.py --verbose

# Reset state (re-ingest everything next run)
sqlite3 ~/.local/share/otel/data/claude.db "DELETE FROM ingest_state;"

# Wipe (nuclear)
docker compose -f ~/.local/share/otel/compose.yml down
rm -rf ~/.local/share/otel/data
```

## What we considered

- **Sync `~/.claude/projects/` to a single host with rsync** — viable but
  clunky, and inherits codeburn's blind spot (subagent jsonls don't have token
  data attached the way main sessions do, so reconstructed costs drift).
- **MQTT bus** (chops broker on `:1884` is already running on pop-mini) — would
  unify telemetry with the chops/atomicguard event stream but couples this
  pipeline to a system that's not yet stable. Deferred; revisit when
  workflow-service has shipped and there's a real holistic story.
- **lestash co-location** — single SQLite for everything personal. Rejected
  for now: telemetry and knowledge data have different query shapes and
  different retention/privacy concerns.
- **Prometheus + Loki + Grafana** (the official Anthropic monitoring stack) —
  pure dashboard play, doesn't serve retro analysis. Out of scope.

## Backup retention

`~/.claude/projects/` is already in `sysbak`'s include list. Add
`~/.local/share/otel/data/` for the SQLite + JSONL files to be backed up too:

```bash
sysbak config  # then add ~/.local/share/otel/data to includes
```
