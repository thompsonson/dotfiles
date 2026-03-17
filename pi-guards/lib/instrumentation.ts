import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import type { GuardEvent } from "./types.js";

const DB_DIR = join(process.env.HOME ?? "~", ".pi");
const DB_PATH = join(DB_DIR, "guard-audit.db");

let db: Database.Database | null = null;
let droppedEventCount = 0;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS guard_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    session_id     TEXT NOT NULL,
    repo           TEXT,
    guard_id       TEXT NOT NULL,
    tool_call      TEXT NOT NULL,
    verdict        TEXT NOT NULL CHECK (verdict IN ('pass', 'block', 'warn')),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    rule_matched   TEXT,
    feedback_given TEXT,
    command        TEXT,
    path           TEXT,
    content_hash   TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id       TEXT PRIMARY KEY,
    started_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    repo             TEXT,
    model            TEXT,
    total_tool_calls INTEGER NOT NULL DEFAULT 0,
    ended_at         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_events_session ON guard_events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_guard   ON guard_events(guard_id, verdict);
  CREATE INDEX IF NOT EXISTS idx_events_time    ON guard_events(timestamp);
`;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA);
  }
  return db;
}

/** Override the DB path — used for testing. */
export function setDb(newDb: Database.Database): void {
  db = newDb;
}

export function resetDb(): void {
  db = null;
  droppedEventCount = 0;
}

export function getDroppedEventCount(): number {
  return droppedEventCount;
}

export function emitGuardEvent(event: Partial<GuardEvent> & { guard_id: string; session_id: string; tool_call: string; verdict: "pass" | "block" | "warn" }): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO guard_events
          (session_id, repo, guard_id, tool_call, verdict, attempt_number,
           rule_matched, feedback_given, command, path, content_hash)
        VALUES
          (@session_id, @repo, @guard_id, @tool_call, @verdict, @attempt_number,
           @rule_matched, @feedback_given, @command, @path, @content_hash)`
      )
      .run({
        session_id: event.session_id,
        repo: event.repo ?? null,
        guard_id: event.guard_id,
        tool_call: event.tool_call,
        verdict: event.verdict,
        attempt_number: event.attempt_number ?? 1,
        rule_matched: event.rule_matched ?? null,
        feedback_given: event.feedback_given ?? null,
        command: event.command ?? null,
        path: event.path ?? null,
        content_hash: event.content_hash ?? null,
      });
  } catch (err) {
    droppedEventCount++;
    if (process.env.DEBUG) console.error("[pi-guards] emitGuardEvent failed:", err);
  }
}

/**
 * Increment the tool call counter for a session.
 *
 * Concurrency safety: SQLite serializes all writes, even in WAL mode.
 * If Pi fires multiple tool calls concurrently, each UPDATE acquires
 * an exclusive write lock, so `total_tool_calls = total_tool_calls + 1`
 * is atomic. No application-level locking required.
 */
export function incrementToolCalls(session_id: string): void {
  try {
    getDb()
      .prepare(
        `UPDATE sessions SET total_tool_calls = total_tool_calls + 1 WHERE session_id = ?`
      )
      .run(session_id);
  } catch (err) {
    droppedEventCount++;
    if (process.env.DEBUG) console.error("[pi-guards] incrementToolCalls failed:", err);
  }
}

export function startSession(
  session_id: string,
  repo?: string,
  model?: string
): void {
  try {
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO sessions (session_id, repo, model) VALUES (?, ?, ?)`
      )
      .run(session_id, repo ?? null, model ?? null);
  } catch (err) {
    droppedEventCount++;
    if (process.env.DEBUG) console.error("[pi-guards] startSession failed:", err);
  }
}

export function endSession(session_id: string): void {
  try {
    getDb()
      .prepare(
        `UPDATE sessions SET ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE session_id = ?`
      )
      .run(session_id);
  } catch (err) {
    droppedEventCount++;
    if (process.env.DEBUG) console.error("[pi-guards] endSession failed:", err);
  }
}
