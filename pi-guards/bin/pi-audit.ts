#!/usr/bin/env node
import Database from "better-sqlite3";
import { join } from "path";
import { writeFileSync } from "fs";

const DB_PATH = join(process.env.HOME ?? "~", ".pi", "guard-audit.db");

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

const commands: Record<
  string,
  (db: Database.Database, args: string[]) => void
> = {
  last: (db) => {
    const session = db
      .prepare(
        `SELECT s.session_id, s.repo, s.model, s.started_at, s.total_tool_calls,
              SUM(CASE WHEN e.verdict='block' THEN 1 ELSE 0 END) as blocks,
              SUM(CASE WHEN e.verdict='warn' THEN 1 ELSE 0 END) as warns
       FROM sessions s LEFT JOIN guard_events e ON s.session_id = e.session_id
       GROUP BY s.session_id ORDER BY s.started_at DESC LIMIT 1`
      )
      .get();
    console.table(session ? [session] : []);
  },

  epsilon: (db) => {
    // Compute ε per session first, then average across sessions.
    // This avoids mixing total_tool_calls from multiple sessions
    // into a single denominator.
    const rows = db
      .prepare(
        `SELECT
          guard_id,
          ROUND(AVG(session_epsilon), 3) AS avg_epsilon,
          ROUND(MIN(session_epsilon), 3) AS min_epsilon,
          ROUND(MAX(session_epsilon), 3) AS max_epsilon,
          COUNT(*) AS sessions
        FROM (
          SELECT
            e.guard_id,
            e.session_id,
            1.0 - (CAST(COUNT(e.id) AS FLOAT) / MAX(s.total_tool_calls, 1)) AS session_epsilon
          FROM guard_events e
          JOIN sessions s ON e.session_id = s.session_id
          WHERE e.verdict IN ('block', 'warn')
          GROUP BY e.guard_id, e.session_id
        ) sub
        GROUP BY guard_id
        ORDER BY avg_epsilon ASC`
      )
      .all();
    console.table(rows);
  },

  rules: (db, args) => {
    const days = parseInt(
      args.find((a) => a.startsWith("--days="))?.split("=")[1] ?? "30"
    );
    const rows = db
      .prepare(
        `SELECT guard_id, rule_matched, COUNT(*) as violations,
              COUNT(DISTINCT session_id) as sessions
       FROM guard_events
       WHERE verdict = 'block'
         AND timestamp > datetime('now', '-' || ? || ' days')
       GROUP BY guard_id, rule_matched
       ORDER BY violations DESC LIMIT 20`
      )
      .all(days);
    console.table(rows);
  },

  session: (db, args) => {
    const sessionId = args[0];
    if (!sessionId) {
      console.error("Usage: pi-audit session <session_id>");
      return;
    }
    const rows = db
      .prepare(
        `SELECT timestamp, guard_id, tool_call, verdict, rule_matched, feedback_given, command, path
       FROM guard_events WHERE session_id = ? ORDER BY timestamp`
      )
      .all(sessionId);
    console.table(rows);
  },

  compare: (db) => {
    const rows = db
      .prepare(
        `SELECT repo, guard_id, COUNT(*) AS blocks
       FROM guard_events WHERE verdict = 'block'
       GROUP BY repo, guard_id ORDER BY blocks DESC`
      )
      .all();
    console.table(rows);
  },

  export: (db, args) => {
    const format =
      args.find((a) => a.startsWith("--format="))?.split("=")[1] ?? "csv";
    const output = args.find((a) => a.startsWith("--output="))?.split("=")[1];
    const rows = db
      .prepare(`SELECT * FROM guard_events ORDER BY timestamp`)
      .all() as Record<string, unknown>[];

    const content =
      format === "json" ? JSON.stringify(rows, null, 2) : toCsv(rows);

    if (output) {
      writeFileSync(output, content);
      console.log(`Exported ${rows.length} events to ${output}`);
    } else {
      console.log(content);
    }
  },
};

// Entry point
const [cmd, ...args] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.log(
    "Usage: pi-audit <last|epsilon|rules|session|compare|export> [options]"
  );
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
commands[cmd](db, args);
