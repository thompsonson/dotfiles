#!/usr/bin/env python3
"""Backfill ~/.claude/projects/ JSONL transcripts into SQLite legacy_events.

Sources, both walked recursively:
  ~/.claude/projects/<project>/*.jsonl                      (top-level sessions)
  ~/.claude/projects/<project>/<uuid>/subagents/*.jsonl     (sub-agent traces)

Idempotent via ingest_state byte-offset tracking. Safe to re-run; updates rows
appended to growing files. Re-parses fully if a file's inode changes (rotation).

Run: python3 backfill.py [--verbose]
"""
from __future__ import annotations
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

CLAUDE_DIR  = Path(os.environ.get("CLAUDE_DIR", str(Path.home() / ".claude/projects")))
DATA_DIR    = Path(os.environ.get("OTEL_DATA_DIR", str(Path.home() / ".local/share/otel/data")))
DB_PATH     = DATA_DIR / "claude.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"
VERBOSE     = "--verbose" in sys.argv

# Project slug → strip the encoded home-dir prefix from the Claude project dir name
# to leave the meaningful part (e.g. `manta-manta-deploy`).
# Derived from Path.home() so it works on any machine/username.
PROJECT_PREFIX = re.sub(r"[/._]", "-", str(Path.home()))


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    if SCHEMA_PATH.exists():
        conn.executescript(SCHEMA_PATH.read_text())
    return conn


def project_slug(project_dir: Path) -> str:
    name = project_dir.name
    if name.startswith(PROJECT_PREFIX):
        name = name[len(PROJECT_PREFIX):]
    return name


def parent_session_from_path(path: Path) -> str | None:
    # subagent path: .../<project>/<session_uuid>/subagents/agent-<id>.jsonl
    if path.parent.name == "subagents":
        return path.parent.parent.name
    return None


def get_state(conn, key: str) -> tuple[int, int | None]:
    row = conn.execute(
        "SELECT byte_offset, inode FROM ingest_state WHERE source_file=?", (key,)
    ).fetchone()
    return (row[0], row[1]) if row else (0, None)


def save_state(conn, key: str, offset: int, inode: int) -> None:
    conn.execute(
        """INSERT INTO ingest_state(source_file, byte_offset, inode, last_run)
           VALUES(?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           ON CONFLICT(source_file) DO UPDATE SET
             byte_offset=excluded.byte_offset,
             inode=excluded.inode,
             last_run=excluded.last_run""",
        (key, offset, inode),
    )


def extract_event(record: dict) -> dict:
    """Pull the fields we want from a Claude jsonl record.

    Claude records vary by type: 'user', 'assistant', 'tool_use', 'tool_result',
    'summary', 'system', etc. We normalize what's present and store the raw JSON.
    """
    out = {
        "ts": record.get("timestamp"),
        "session_id": record.get("sessionId") or record.get("session_id"),
        "git_branch": record.get("gitBranch") or record.get("git_branch"),
        "model": None,
        "event_type": record.get("type") or record.get("event_type"),
        "message_id": None,
        "tool_use_id": None,
        "tool_name": record.get("toolName") or record.get("tool_name"),
        "input_tokens": None,
        "output_tokens": None,
        "cache_read_tokens": None,
        "cache_write_tokens": None,
    }

    # Some records nest message: {id, role, model, usage, content}
    msg = record.get("message") or {}
    if isinstance(msg, dict):
        out["message_id"] = msg.get("id") or out["message_id"]
        out["model"]      = msg.get("model") or out["model"]
        usage = msg.get("usage") or {}
        out["input_tokens"]       = usage.get("input_tokens")
        out["output_tokens"]      = usage.get("output_tokens")
        out["cache_read_tokens"]  = usage.get("cache_read_input_tokens")
        out["cache_write_tokens"] = usage.get("cache_creation_input_tokens")
        # Tool use lives in content as a block with type='tool_use'
        content = msg.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "tool_use":
                        out["tool_use_id"] = block.get("id") or out["tool_use_id"]
                        out["tool_name"]   = block.get("name") or out["tool_name"]

    # Top-level fallbacks (codeburn-export format uses these)
    out["model"]       = record.get("model") or out["model"]
    out["message_id"]  = record.get("message_id") or out["message_id"]
    out["tool_use_id"] = record.get("tool_use_id") or out["tool_use_id"]

    return out


def ingest_jsonl(conn, path: Path, project: str, kind: str) -> int:
    key = str(path)
    try:
        st = path.stat()
    except FileNotFoundError:
        return 0
    offset, prev_inode = get_state(conn, key)
    if prev_inode is not None and prev_inode != st.st_ino:
        offset = 0
    if offset >= st.st_size:
        return 0
    parent = parent_session_from_path(path) if kind == "subagent" else None
    claude_parent = str(CLAUDE_DIR.parent)
    rel_path = str(path)[len(claude_parent):].lstrip("/") if str(path).startswith(claude_parent) else str(path)

    inserted, batch = 0, []
    with path.open("rb") as f:
        f.seek(offset)
        for raw in f:
            try:
                line = raw.decode("utf-8").strip()
                if not line:
                    continue
                rec = json.loads(line)
                e = extract_event(rec)
                ts = e["ts"]
                if not ts:
                    continue
                batch.append((
                    rel_path, kind, ts,
                    e["session_id"], parent, project, e["git_branch"], e["model"],
                    e["event_type"], e["message_id"], e["tool_use_id"], e["tool_name"],
                    e["input_tokens"], e["output_tokens"],
                    e["cache_read_tokens"], e["cache_write_tokens"],
                    line,
                ))
                if len(batch) >= 1000:
                    conn.executemany(
                        """INSERT INTO legacy_events(
                             source_file, source_kind, ts,
                             session_id, parent_session_id, project, git_branch, model,
                             event_type, message_id, tool_use_id, tool_name,
                             input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                             raw)
                           VALUES(?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?)""",
                        batch,
                    )
                    inserted += len(batch); batch.clear()
            except json.JSONDecodeError:
                continue
            except Exception as e:
                if VERBOSE:
                    print(f"  skip {path.name}: {e}", file=sys.stderr)
                continue
        new_offset = f.tell()
    if batch:
        conn.executemany(
            """INSERT INTO legacy_events(
                 source_file, source_kind, ts,
                 session_id, parent_session_id, project, git_branch, model,
                 event_type, message_id, tool_use_id, tool_name,
                 input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                 raw)
               VALUES(?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?)""",
            batch,
        )
        inserted += len(batch)
    save_state(conn, key, new_offset, st.st_ino)
    conn.commit()
    return inserted


def walk(conn) -> dict:
    """Walk CLAUDE_DIR and ingest all JSONLs."""
    stats = {"projects": 0, "session_files": 0, "subagent_files": 0,
             "session_rows": 0, "subagent_rows": 0}
    if not CLAUDE_DIR.exists():
        print(f"no {CLAUDE_DIR}", file=sys.stderr)
        return stats
    for project_dir in sorted(CLAUDE_DIR.iterdir()):
        if not project_dir.is_dir():
            continue
        stats["projects"] += 1
        proj = project_slug(project_dir)
        for f in sorted(project_dir.glob("*.jsonl")):
            n = ingest_jsonl(conn, f, proj, "session")
            stats["session_files"] += 1
            stats["session_rows"] += n
            if VERBOSE and n:
                print(f"  session {f.name}: {n}")
        for f in sorted(project_dir.glob("*/subagents/*.jsonl")):
            n = ingest_jsonl(conn, f, proj, "subagent")
            stats["subagent_files"] += 1
            stats["subagent_rows"] += n
            if VERBOSE and n:
                print(f"  subagent {f.name}: {n}")
    return stats


def main() -> int:
    conn = connect()
    print(f"backfill from {CLAUDE_DIR} -> {DB_PATH}")
    stats = walk(conn)
    print(f"projects: {stats['projects']}")
    print(f"session files: {stats['session_files']}  ({stats['session_rows']} rows)")
    print(f"subagent files: {stats['subagent_files']} ({stats['subagent_rows']} rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
