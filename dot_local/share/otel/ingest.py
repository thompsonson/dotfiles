#!/usr/bin/env python3
"""Ingest OTel collector file-exporter JSONL into SQLite (forward stream).

Idempotent via byte-offset tracking; handles rotation by detecting inode changes.
Runs from systemd-user timer every 5 min.

Inputs:  $HOME/.local/share/otel/data/{metrics,logs,traces}.jsonl[.N]
Output:  $HOME/.local/share/otel/data/claude.db -> table `events`
"""
from __future__ import annotations
import json
import os
import sqlite3
import sys
from pathlib import Path

DATA_DIR    = Path(os.environ.get("OTEL_DATA_DIR", str(Path.home() / ".local/share/otel/data")))
DB_PATH     = DATA_DIR / "claude.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"
SOURCES     = ["metrics", "logs", "traces"]


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    if SCHEMA_PATH.exists():
        conn.executescript(SCHEMA_PATH.read_text())
    return conn


def find_files(source: str) -> list[Path]:
    return sorted(DATA_DIR.glob(f"{source}.jsonl*"))


def get_state(conn, path: Path) -> tuple[int, int | None]:
    row = conn.execute(
        "SELECT byte_offset, inode FROM ingest_state WHERE source_file=?",
        (str(path),),
    ).fetchone()
    return (row[0], row[1]) if row else (0, None)


def save_state(conn, path: Path, offset: int, inode: int) -> None:
    conn.execute(
        """INSERT INTO ingest_state(source_file, byte_offset, inode, last_run)
           VALUES(?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
           ON CONFLICT(source_file) DO UPDATE SET
             byte_offset=excluded.byte_offset,
             inode=excluded.inode,
             last_run=excluded.last_run""",
        (str(path), offset, inode),
    )


def _resource_attrs(resource: dict) -> tuple[str | None, str | None, str]:
    attrs = {a["key"]: next(iter(a.get("value", {}).values()), None)
             for a in resource.get("attributes", [])}
    return attrs.get("service.name"), attrs.get("host.name"), json.dumps(attrs)


def _flatten(attrs: list | None) -> str:
    out = {}
    for a in attrs or []:
        v = a.get("value", {})
        out[a["key"]] = next(iter(v.values()), None) if v else None
    return json.dumps(out)


def _ns_to_iso(ns) -> str:
    if ns is None:
        return ""
    import datetime as _dt
    return _dt.datetime.fromtimestamp(int(ns) / 1e9, tz=_dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_metrics(line: str) -> list[tuple]:
    rows, obj = [], json.loads(line)
    for rm in obj.get("resourceMetrics", []):
        svc, host, res = _resource_attrs(rm.get("resource", {}))
        for sm in rm.get("scopeMetrics", []):
            scope = sm.get("scope", {}).get("name")
            for m in sm.get("metrics", []):
                name, unit = m.get("name"), m.get("unit")
                points = (m.get("sum") or m.get("gauge") or m.get("histogram") or {}).get("dataPoints", [])
                for p in points:
                    ts  = _ns_to_iso(p.get("timeUnixNano"))
                    val = p.get("asDouble") or p.get("asInt") or p.get("count")
                    rows.append(("metrics", ts, svc, host, scope, name, val, unit,
                                 None, None, _flatten(p.get("attributes")), res))
    return rows


def parse_logs(line: str) -> list[tuple]:
    rows, obj = [], json.loads(line)
    for rl in obj.get("resourceLogs", []):
        svc, host, res = _resource_attrs(rl.get("resource", {}))
        for sl in rl.get("scopeLogs", []):
            scope = sl.get("scope", {}).get("name")
            for r in sl.get("logRecords", []):
                ts   = _ns_to_iso(r.get("timeUnixNano") or r.get("observedTimeUnixNano"))
                name = r.get("severityText") or "log"
                body = r.get("body", {})
                body_val = next(iter(body.values()), None) if body else None
                attrs = json.loads(_flatten(r.get("attributes")))
                attrs["body"] = body_val
                rows.append(("logs", ts, svc, host, scope, name, None, None,
                             r.get("traceId"), r.get("spanId"), json.dumps(attrs), res))
    return rows


def parse_traces(line: str) -> list[tuple]:
    rows, obj = [], json.loads(line)
    for rs in obj.get("resourceSpans", []):
        svc, host, res = _resource_attrs(rs.get("resource", {}))
        for ss in rs.get("scopeSpans", []):
            scope = ss.get("scope", {}).get("name")
            for sp in ss.get("spans", []):
                ts = _ns_to_iso(sp.get("startTimeUnixNano"))
                rows.append(("traces", ts, svc, host, scope, sp.get("name"), None, None,
                             sp.get("traceId"), sp.get("spanId"),
                             _flatten(sp.get("attributes")), res))
    return rows


PARSERS = {"metrics": parse_metrics, "logs": parse_logs, "traces": parse_traces}


def ingest_file(conn, source: str, path: Path) -> int:
    try:
        st = path.stat()
    except FileNotFoundError:
        return 0
    offset, prev_inode = get_state(conn, path)
    if prev_inode is not None and prev_inode != st.st_ino:
        offset = 0  # rotated
    if offset >= st.st_size:
        return 0
    parser, inserted, batch = PARSERS[source], 0, []
    with path.open("rb") as f:
        f.seek(offset)
        for raw in f:
            try:
                line = raw.decode("utf-8").strip()
                if not line:
                    continue
                batch.extend(parser(line))
                if len(batch) >= 1000:
                    conn.executemany(
                        "INSERT INTO events(source,ts,service_name,host_name,scope_name,name,value,unit,trace_id,span_id,attributes,resource) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                        batch,
                    )
                    inserted += len(batch); batch.clear()
            except Exception as e:
                print(f"parse error {path.name}: {e}", file=sys.stderr)
        new_offset = f.tell()
    if batch:
        conn.executemany(
            "INSERT INTO events(source,ts,service_name,host_name,scope_name,name,value,unit,trace_id,span_id,attributes,resource) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            batch,
        )
        inserted += len(batch)
    save_state(conn, path, new_offset, st.st_ino)
    conn.commit()
    return inserted


def main() -> int:
    conn = connect()
    total = 0
    for source in SOURCES:
        for path in find_files(source):
            n = ingest_file(conn, source, path)
            if n:
                print(f"ingested {n} rows from {path.name}")
            total += n
    if total or "--verbose" in sys.argv:
        print(f"total ingested: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
