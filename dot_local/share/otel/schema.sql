-- Claude Code telemetry store.
-- Two tables: `events` (live OTel data, written by ingest.py) and
-- `legacy_events` (historical Claude transcripts, written by backfill.py).
-- `ingest_state` tracks per-file byte offsets so ingest.py is idempotent.

PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;

-- ---------------------------------------------------------------------------
-- Live OTel data (forward-going)
-- One row per metric data point, log record, or span.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ingested_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source       TEXT NOT NULL,           -- 'metrics' | 'logs' | 'traces'
  ts           TEXT NOT NULL,           -- ISO 8601 event time
  service_name TEXT,
  host_name    TEXT,
  scope_name   TEXT,
  name         TEXT,
  value        REAL,                    -- metrics only
  unit         TEXT,
  trace_id     TEXT,
  span_id      TEXT,
  attributes   TEXT,                    -- JSON
  resource     TEXT                     -- JSON
);
CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_name    ON events(name);
CREATE INDEX IF NOT EXISTS idx_events_source  ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_service ON events(service_name);
CREATE INDEX IF NOT EXISTS idx_events_host    ON events(host_name);

-- ---------------------------------------------------------------------------
-- Historical backfill from ~/.claude/projects (codeburn-shaped)
-- Sources: top-level session jsonls + nested subagent jsonls.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legacy_events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ingested_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source_file         TEXT NOT NULL,    -- jsonl path relative to ~/.claude/projects
  source_kind         TEXT NOT NULL,    -- 'session' | 'subagent'
  ts                  TEXT NOT NULL,    -- ISO 8601
  session_id          TEXT,
  parent_session_id   TEXT,             -- for subagent: enclosing session uuid
  project             TEXT,             -- project slug from dir name
  git_branch          TEXT,
  model               TEXT,
  event_type          TEXT,             -- 'user' | 'assistant' | 'tool_call' | 'tool_result' | ...
  message_id          TEXT,
  tool_use_id         TEXT,
  tool_name           TEXT,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  cache_read_tokens   INTEGER,
  cache_write_tokens  INTEGER,
  raw                 TEXT              -- original JSON line, for inspection
);
CREATE INDEX IF NOT EXISTS idx_legacy_ts       ON legacy_events(ts);
CREATE INDEX IF NOT EXISTS idx_legacy_project  ON legacy_events(project);
CREATE INDEX IF NOT EXISTS idx_legacy_session  ON legacy_events(session_id);
CREATE INDEX IF NOT EXISTS idx_legacy_kind     ON legacy_events(source_kind);
CREATE INDEX IF NOT EXISTS idx_legacy_tool     ON legacy_events(tool_name);

-- ---------------------------------------------------------------------------
-- Ingest state — per-file byte offsets so ingest.py / backfill.py are idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_state (
  source_file  TEXT PRIMARY KEY,
  byte_offset  INTEGER NOT NULL DEFAULT 0,
  inode        INTEGER,
  last_run     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Convenience views for retros.
-- ---------------------------------------------------------------------------

-- Unified timeline across both tables (for cross-period queries).
CREATE VIEW IF NOT EXISTS all_events AS
  SELECT ts, 'events' AS table_name, source_name AS event_source,
         service_name AS project, name AS tool_name, NULL AS session_id, NULL AS model
  FROM (SELECT ts, source AS source_name, service_name, name FROM events)
  UNION ALL
  SELECT ts, 'legacy_events' AS table_name, source_kind AS event_source,
         project, tool_name, session_id, model
  FROM legacy_events;

-- Active-time per day via 5-min bucket method on legacy_events.
-- (events table will need its own view once OTel data flows.)
CREATE VIEW IF NOT EXISTS legacy_active_buckets AS
  SELECT
    date(ts)                              AS day,
    substr(ts, 12, 2)                     AS hour,
    cast(substr(ts, 15, 2) AS INTEGER)/5  AS slot,
    project
  FROM legacy_events
  GROUP BY day, hour, slot, project;
