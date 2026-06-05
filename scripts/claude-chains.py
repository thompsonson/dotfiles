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
    python3 scripts/claude-chains.py --html /tmp/chains.html
    python3 scripts/claude-chains.py --markdown /tmp/chains.md
    python3 scripts/claude-chains.py --summary-only
    python3 scripts/claude-chains.py --subcommands --summary-only
"""

import argparse
import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

CLAUDE_DIR = Path.home() / ".claude" / "projects"

_BASH_WRAPPERS = {"sudo", "env", "time", "nice", "nohup", "watch"}

# CLIs where subcommands carry workflow signal.
# Value = number of words to keep (including the CLI name itself).
# gh needs 3: `gh run watch`, `gh pr create`, `gh issue list`
_SUBCOMMAND_DEPTH: dict[str, int] = {
    "gh": 3,
    "git": 2,
    "uv": 2,       # uv sync, uv add, uv lock — uv run handled by _TRANSPARENT_RUNNERS
    "docker": 2,
    "just": 2,
    "chezmoi": 2,
    "systemctl": 2,
    "kubectl": 2,
    "cargo": 2,
    "npm": 2,
}

# CLIs that act as transparent runners: `uv run python` → label is `python`.
# The word after the subcommand becomes the effective label.
_TRANSPARENT_RUNNERS: dict[str, str] = {
    "uv": "run",    # uv run <cmd> → <cmd>
}

# Normalise variant spellings to a canonical label.
_LABEL_ALIASES: dict[str, str] = {
    "python3": "python",
    "python3.10": "python",
    "python3.11": "python",
    "python3.12": "python",
    "python3.13": "python",
}


def bash_label(command: str, subcommands: bool = False) -> str:
    if not command:
        return "_shell"
    words = command.split()
    effective: list[str] = []
    for word in words:
        if word in _BASH_WRAPPERS:
            continue
        if "=" in word and not word.startswith("-"):
            continue
        if word.startswith("$") or word.startswith("{"):
            return "_shell"
        if word.startswith("#"):
            return "_shell"
        effective.append(Path(word).name if not effective else word)
        break
    if not effective:
        return "_shell"

    cli = effective[0]

    if not subcommands:
        return _LABEL_ALIASES.get(cli, cli)

    # Transparent runners: `uv run python` → `python`
    if cli in _TRANSPARENT_RUNNERS:
        trigger = _TRANSPARENT_RUNNERS[cli]
        raw_words = command.split()
        idx = next(
            (i for i, w in enumerate(raw_words) if w not in _BASH_WRAPPERS and "=" not in w),
            0,
        )
        tail = [w for w in raw_words[idx + 1:] if not w.startswith("-") and "=" not in w]
        if tail and tail[0] == trigger and len(tail) > 1:
            inner = Path(tail[1]).name
            return _LABEL_ALIASES.get(inner, inner)
        # Fall through to depth-based logic (uv sync, uv add, etc.)

    if cli not in _SUBCOMMAND_DEPTH:
        return _LABEL_ALIASES.get(cli, cli)

    # Collect up to depth words, stopping at flags
    depth = _SUBCOMMAND_DEPTH[cli]
    parts = [cli]
    raw_words = command.split()
    idx = next(
        (i for i, w in enumerate(raw_words) if w not in _BASH_WRAPPERS and "=" not in w),
        0,
    )
    for w in raw_words[idx + 1:]:
        if len(parts) >= depth:
            break
        if w.startswith("-") or ("=" in w and not w.startswith("-")):
            break
        parts.append(w)

    return " ".join(parts)


def extract_tool_label(block: dict, subcommands: bool = False) -> str:
    name = block.get("name", "")
    if name == "Bash":
        cmd = block.get("input", {}).get("command", "")
        return bash_label(cmd, subcommands)
    return name


def parse_session(path: Path, subcommands: bool = False) -> dict | None:
    turns: list[dict] = []
    session_id = path.stem

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

                ts = obj.get("timestamp", "")
                uuid = obj.get("uuid", "")
                content = obj.get("message", {}).get("content", [])

                if not isinstance(content, list):
                    continue

                tool_labels = [
                    label
                    for b in content
                    if isinstance(b, dict) and b.get("type") == "tool_use"
                    and (label := extract_tool_label(b, subcommands)) != "_shell"
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


def compute_ngrams(records: list[dict], top_n: int = 50) -> list[tuple[tuple, int]]:
    counts: Counter = Counter()
    for rec in records:
        flat = [t for turn in rec["sequence"] for t in turn["tools"]]
        for n in (2, 3, 4):
            counts.update(ngrams(flat, n))
    return counts.most_common(top_n)


def project_stats(records: list[dict]) -> list[tuple[str, int, int]]:
    """Return (project_key, session_count, turn_count) sorted by sessions desc."""
    by_project: dict[str, list[int]] = {}
    for rec in records:
        pk = rec["project_key"]
        by_project.setdefault(pk, []).append(rec["turns"])
    return sorted(
        [(pk, len(turns), sum(turns)) for pk, turns in by_project.items()],
        key=lambda x: x[1],
        reverse=True,
    )


def summarise(records: list[dict], top_n: int = 50) -> None:
    top = compute_ngrams(records, top_n)
    print(f"\nTop {top_n} tool n-grams (size 2–4) across {len(records)} sessions:\n")
    print(f"  {'Count':>6}  Pattern")
    print(f"  {'------':>6}  -------")
    for pattern, count in top:
        print(f"  {count:>6}  {' → '.join(pattern)}")


def write_html(records: list[dict], path: Path, since_days: int) -> None:
    top = compute_ngrams(records, 20)
    stats = project_stats(records)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    labels_js = json.dumps([" → ".join(p) for p, _ in top])
    counts_js = json.dumps([c for _, c in top])
    proj_labels_js = json.dumps([pk.replace("-home-mt-Projects-", "").replace("-home-mt-", "") for pk, _, _ in stats])
    proj_sessions_js = json.dumps([s for _, s, _ in stats])
    proj_turns_js = json.dumps([t for _, _, t in stats])

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Claude Code Tool Chains</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  body {{ font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; margin: 0; padding: 24px; }}
  h1 {{ font-size: 1.4rem; margin-bottom: 4px; }}
  .meta {{ color: #8b949e; font-size: 0.85rem; margin-bottom: 32px; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }}
  .card {{ background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }}
  .card h2 {{ font-size: 1rem; margin: 0 0 16px; color: #e6edf3; }}
  canvas {{ max-height: 420px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 12px; }}
  th {{ text-align: left; color: #8b949e; border-bottom: 1px solid #30363d; padding: 6px 8px; }}
  td {{ padding: 5px 8px; border-bottom: 1px solid #21262d; }}
  .num {{ text-align: right; font-variant-numeric: tabular-nums; }}
</style>
</head>
<body>
<h1>Claude Code Tool Chains</h1>
<p class="meta">Last {since_days} days &middot; {len(records)} sessions &middot; generated {generated}</p>
<div class="grid">
  <div class="card" style="grid-column: 1 / -1;">
    <h2>Top 20 Tool N-grams (size 2–4)</h2>
    <canvas id="ngram"></canvas>
  </div>
  <div class="card">
    <h2>Sessions by Project</h2>
    <canvas id="proj"></canvas>
  </div>
  <div class="card">
    <h2>N-gram Table</h2>
    <table>
      <tr><th>Pattern</th><th class="num">Count</th></tr>
      {''.join(f'<tr><td>{" → ".join(p)}</td><td class="num">{c}</td></tr>' for p, c in top)}
    </table>
  </div>
</div>
<script>
const ngLabels = {labels_js};
const ngCounts = {counts_js};
const projLabels = {proj_labels_js};
const projSessions = {proj_sessions_js};
const projTurns = {proj_turns_js};

new Chart(document.getElementById('ngram'), {{
  type: 'bar',
  data: {{
    labels: ngLabels,
    datasets: [{{ label: 'Occurrences', data: ngCounts,
      backgroundColor: 'rgba(88,166,255,0.7)', borderRadius: 4 }}]
  }},
  options: {{
    indexAxis: 'y',
    plugins: {{ legend: {{ display: false }} }},
    scales: {{
      x: {{ grid: {{ color: '#21262d' }}, ticks: {{ color: '#8b949e' }} }},
      y: {{ grid: {{ display: false }}, ticks: {{ color: '#e6edf3', font: {{ family: 'monospace' }} }} }}
    }}
  }}
}});

new Chart(document.getElementById('proj'), {{
  type: 'bar',
  data: {{
    labels: projLabels,
    datasets: [
      {{ label: 'Sessions', data: projSessions, backgroundColor: 'rgba(63,185,80,0.7)', borderRadius: 4 }},
      {{ label: 'Turns', data: projTurns, backgroundColor: 'rgba(210,153,34,0.5)', borderRadius: 4 }}
    ]
  }},
  options: {{
    plugins: {{ legend: {{ labels: {{ color: '#8b949e' }} }} }},
    scales: {{
      x: {{ grid: {{ color: '#21262d' }}, ticks: {{ color: '#8b949e', font: {{ family: 'monospace', size: 11 }} }}, maxRotation: 45 }},
      y: {{ grid: {{ color: '#21262d' }}, ticks: {{ color: '#8b949e' }} }}
    }}
  }}
}});
</script>
</body>
</html>"""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html + "\n")
    print(f"HTML:     {path}")


def write_markdown(records: list[dict], path: Path, since_days: int) -> None:
    top = compute_ngrams(records, 20)
    stats = project_stats(records)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Mermaid xychart-beta supports up to ~10 bars cleanly
    top10 = top[:10]
    mermaid_labels = [f'"{" → ".join(p)}"' for p, _ in top10]
    mermaid_counts = [str(c) for _, c in top10]

    lines = [
        "# Claude Code Tool Chains",
        "",
        f"_Last {since_days} days · {len(records)} sessions · generated {generated}_",
        "",
        "## Top 10 N-grams",
        "",
        "```mermaid",
        "xychart-beta horizontal",
        f'    x-axis [{", ".join(mermaid_labels)}]',
        f'    bar [{", ".join(mermaid_counts)}]',
        "```",
        "",
        "## Full Top 20 N-gram Table",
        "",
        "| Pattern | Count |",
        "|---------|------:|",
    ]
    for pattern, count in top:
        lines.append(f"| `{' → '.join(pattern)}` | {count} |")

    lines += [
        "",
        "## Sessions by Project",
        "",
        "| Project | Sessions | Turns |",
        "|---------|--------:|------:|",
    ]
    for pk, sessions, turns in stats:
        short = pk.replace("-home-mt-Projects-", "").replace("-home-mt-", "")
        lines.append(f"| `{short}` | {sessions} | {turns} |")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n")
    print(f"Markdown: {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Claude Code tool-call sequences")
    parser.add_argument("--since", type=int, default=7, metavar="DAYS",
                        help="Include sessions modified within N days (default: 7)")
    parser.add_argument("--project", metavar="SUBSTR",
                        help="Filter by substring of encoded project dir name")
    parser.add_argument("--output", metavar="FILE",
                        help="Write per-session JSONL to this path")
    parser.add_argument("--html", metavar="FILE",
                        help="Write self-contained HTML visualisation to this path")
    parser.add_argument("--markdown", metavar="FILE",
                        help="Write GitHub-renderable Mermaid markdown to this path")
    parser.add_argument("--summary-only", action="store_true",
                        help="Print n-gram summary only (ignores --output/--html/--markdown)")
    parser.add_argument("--subcommands", action="store_true",
                        help="Expand Bash labels to include subcommands (e.g. 'git commit', 'gh run watch')")
    args = parser.parse_args()

    paths = discover_sessions(args.since, args.project)
    if not paths:
        print("No session files found.", file=sys.stderr)
        sys.exit(1)

    records = []
    for p in paths:
        rec = parse_session(p, subcommands=args.subcommands)
        if rec:
            records.append(rec)

    if not records:
        print("No tool-call sequences found in selected sessions.", file=sys.stderr)
        sys.exit(1)

    if not args.summary_only:
        if args.output:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w") as f:
                for rec in records:
                    f.write(json.dumps(rec) + "\n")
            print(f"JSONL:    {out_path}")
        if args.html:
            write_html(records, Path(args.html), args.since)
        if args.markdown:
            write_markdown(records, Path(args.markdown), args.since)

    summarise(records)


if __name__ == "__main__":
    main()
