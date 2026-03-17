import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  emitGuardEvent,
  startSession,
  endSession,
  incrementToolCalls,
  setDb,
  resetDb,
  getDroppedEventCount,
} from "../lib/instrumentation.js";

describe("instrumentation", () => {
  let db: Database.Database;

  beforeEach(() => {
    // Use in-memory DB for tests
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.exec(`
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
    `);
    setDb(db);
  });

  afterEach(() => {
    resetDb();
    db.close();
  });

  it("creates session", () => {
    startSession("sess-1", "myrepo", "claude-3");
    const row = db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .get("sess-1") as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.repo).toBe("myrepo");
    expect(row.model).toBe("claude-3");
    expect(row.total_tool_calls).toBe(0);
  });

  it("increments tool calls", () => {
    startSession("sess-2");
    incrementToolCalls("sess-2");
    incrementToolCalls("sess-2");
    incrementToolCalls("sess-2");
    const row = db
      .prepare("SELECT total_tool_calls FROM sessions WHERE session_id = ?")
      .get("sess-2") as Record<string, unknown>;
    expect(row.total_tool_calls).toBe(3);
  });

  it("ends session with timestamp", () => {
    startSession("sess-3");
    endSession("sess-3");
    const row = db
      .prepare("SELECT ended_at FROM sessions WHERE session_id = ?")
      .get("sess-3") as Record<string, unknown>;
    expect(row.ended_at).toBeDefined();
    expect(row.ended_at).not.toBeNull();
  });

  it("emits guard event", () => {
    emitGuardEvent({
      session_id: "sess-4",
      guard_id: "destructive-op",
      tool_call: "bash",
      verdict: "block",
      attempt_number: 1,
      rule_matched: "rm-rf-unsafe-target",
      feedback_given: "Blocked: rm -rf outside tmp",
      command: "rm -rf ~/projects",
    });

    const row = db
      .prepare("SELECT * FROM guard_events WHERE session_id = ?")
      .get("sess-4") as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.guard_id).toBe("destructive-op");
    expect(row.verdict).toBe("block");
    expect(row.rule_matched).toBe("rm-rf-unsafe-target");
    expect(row.command).toBe("rm -rf ~/projects");
  });

  it("handles duplicate session start (INSERT OR IGNORE)", () => {
    startSession("sess-5", "repo1");
    startSession("sess-5", "repo2"); // should not throw
    const row = db
      .prepare("SELECT repo FROM sessions WHERE session_id = ?")
      .get("sess-5") as Record<string, unknown>;
    // First insert wins
    expect(row.repo).toBe("repo1");
  });

  it("records multiple events for a session", () => {
    emitGuardEvent({
      session_id: "sess-6",
      guard_id: "secrets",
      tool_call: "write",
      verdict: "block",
      attempt_number: 1,
    });
    emitGuardEvent({
      session_id: "sess-6",
      guard_id: "secrets",
      tool_call: "write",
      verdict: "pass",
      attempt_number: 2,
    });

    const rows = db
      .prepare("SELECT * FROM guard_events WHERE session_id = ?")
      .all("sess-6");
    expect(rows).toHaveLength(2);
  });

  it("increments droppedEventCount on DB failure", () => {
    // Close the DB to force errors
    db.close();
    const before = getDroppedEventCount();
    emitGuardEvent({
      session_id: "sess-fail",
      guard_id: "test",
      tool_call: "bash",
      verdict: "pass",
    });
    expect(getDroppedEventCount()).toBe(before + 1);

    // Re-open for cleanup
    db = new Database(":memory:");
    setDb(db);
  });
});
