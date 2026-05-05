#!/usr/bin/env python3
"""
Extract tool-call sequences from Claude Code session JSONL files.

Discovers ~/.claude/projects/**/*.jsonl, parses assistant turns, and emits
per-session JSONL with ordered tool sequences. Prints a top-20 n-gram summary.

Usage:
    python3 scripts/claude-chains.py
    python3 scripts/claude-chains.py --since 30
    python3 scripts/claude-chains.py --project atomicguard --since 7
    python3 scripts/claude-chains.py --output /tmp/chains-7d.jsonl
    python3 scripts/claude-chains.py --summary-only
"""

import argparse
import json
import sys
import time
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

CLAUDE_DIR = Path.home() / ".claude" / "projects"
OUTPUT_DIR = Path("output")

_BASH_WRAPPERS = {"sudo", "env", "time", "nice", "nohup", "watch"}


def bash_label(command: str) -> str:
    """Return the effective command name from a Bash input.command string."""
    if not command:
        return "_shell"
    words = command.split()
    for word in words:
        if word in _BASH_WRAPPERS:
            continue
        # Skip env VAR=value tokens
        if "=" in word and not word.startswith("-"):
            continue
        if word.startswith("$") or word.startswith("{"):
            return "_shell"
        # Strip path prefix: /usr/bin/git -> git
        return Path(word).name or "_shell"
    return "_shell"


def extract_tool_label(block: dict) -> str:
    """Return a label for a tool_use block."""
    name = block.get("name", "")
    if name == "Bash":
        cmd = block.get("input", {}).get("command", "")
        return bash_label(cmd)
    return name


def parse_session(path: Path) -> dict | None:
    """Parse a session JSONL file into a sequence record. Returns None on error."""
    turns: list[dict] = []
    session_id = path.stem  # filename without .jsonl

    try:
        with open(path) as f:
            for raw in f:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    obj = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                if obj.get("type") != "assistant":
                    continue

                # Timestamp is top-level on the record
                ts = obj.get("timestamp", "")
                uuid = obj.get("uuid", "")
                content = obj.get("message", {}).get("content", [])

                if not isinstance(content, list):
                    continue

                tool_labels = [
                    extract_tool_label(b)
                    for b in content
                    if isinstance(b, dict) and b.get("type") == "tool_use"
                ]

                if not tool_labels:
                    continue

                turns.append({"ts": ts, "uuid": uuid[:8], "tools": tool_labels})

    except OSError:
        return None

    if not turns:
        return None

    turns.sort(key=lambda t: t["ts"])
    project_key = path.parent.name

    return {
        "session_id": session_id,
        "project_key": project_key,
        "first_ts": turns[0]["ts"],
        "last_ts": turns[-1]["ts"],
        "turns": len(turns),
        "sequence": turns,
    }


def discover_sessions(since_days: int, project: str | None) -> list[Path]:
    """Return .jsonl session files modified within since_days, optionally filtered by project."""
    if not CLAUDE_DIR.exists():
        return []

    cutoff = time.time() - since_days * 86400
    paths = []

    for project_dir in CLAUDE_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        if project and project not in project_dir.name:
            continue
        for f in project_dir.glob("*.jsonl"):
            if f.stat().st_mtime >= cutoff:
                paths.append(f)

    return sorted(paths)


def ngrams(stream: list[str], n: int) -> list[tuple[str, ...]]:
    return [tuple(stream[i : i + n]) for i in range(len(stream) - n + 1)]


def summarise(records: list[dict], top_n: int = 20) -> None:
    counts: Counter = Counter()
    for rec in records:
        flat = [t for turn in rec["sequence"] for t in turn["tools"]]
        for n in (2, 3, 4):
            counts.update(ngrams(flat, n))

    print(f"\nTop {top_n} tool n-grams (size 2–4) across {len(records)} sessions:\n")
    print(f"  {'Count':>6}  Pattern")
    print(f"  {'------':>6}  -------")
    for pattern, count in counts.most_common(top_n):
        print(f"  {count:>6}  {' → '.join(pattern)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Claude Code tool-call sequences")
    parser.add_argument("--since", type=int, default=7, metavar="DAYS",
                        help="Include sessions modified within N days (default: 7)")
    parser.add_argument("--project", metavar="SUBSTR",
                        help="Filter by substring of encoded project dir name")
    parser.add_argument("--output", metavar="FILE",
                        help="Write per-session JSONL to this path")
    parser.add_argument("--summary-only", action="store_true",
                        help="Print n-gram summary only (ignores --output)")
    args = parser.parse_args()

    paths = discover_sessions(args.since, args.project)
    if not paths:
        print("No session files found.", file=sys.stderr)
        sys.exit(1)

    records = []
    for p in paths:
        rec = parse_session(p)
        if rec:
            records.append(rec)

    if not records:
        print("No tool-call sequences found in selected sessions.", file=sys.stderr)
        sys.exit(1)

    if not args.summary_only and args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            for rec in records:
                f.write(json.dumps(rec) + "\n")
        print(f"Wrote {len(records)} session records to {out_path}")

    summarise(records)


if __name__ == "__main__":
    main()
