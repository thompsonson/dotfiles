# Claude Code Telemetry & Multi-Machine Aggregation — Plan

Notes from an exploration of how to track Claude Code cost / tokens / tool
usage across machines, and how that interacts with [codeburn][cb].

[cb]: https://github.com/thompsonson/codeburn

## TL;DR — do this in order

1. **Run the diagnostic in §1** before building anything. It answers whether
   "only ~1 month showing in codeburn" is data loss or display windowing —
   the answer changes what's worth doing next.
2. **Add `~/.claude/projects/` to `sysbak`** (§2). Solves retention
   independently of any tooling choice.
3. **Decide on aggregation** (§3) only if step 1 confirms multiple machines
   each hold sessions worth merging.
4. **OTel telemetry env vars** (§4) are optional and orthogonal — only
   useful if you'll actually look at dashboards.

---

## 1. Diagnostic — what's actually on disk?

Claude Code stores session transcripts as JSONL at
`~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`. There's no evidence
Claude rotates them, so files going back >1 month should be present unless
something else removed them.

Run on your laptop:

```bash
#!/usr/bin/env bash
# Inventory ~/.claude session storage.
# Distinguishes "data is gone" from "codeburn is windowing the display".

set -u
DIR="${CLAUDE_DIR:-$HOME/.claude/projects}"

if [ ! -d "$DIR" ]; then
  echo "No $DIR — Claude Code not installed or session dir is elsewhere."
  exit 1
fi

echo "=== Inventory: $DIR ==="
files=$(find "$DIR" -name '*.jsonl' 2>/dev/null | wc -l | tr -d ' ')
projects=$(find "$DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
echo "$files session files across $projects project dirs"
du -sh "$DIR" 2>/dev/null

echo
echo "=== Sessions older than... (by mtime) ==="
for d in 30 60 90 180 365 730; do
  n=$(find "$DIR" -name '*.jsonl' -mtime +$d 2>/dev/null | wc -l | tr -d ' ')
  printf "  %4d days: %5s files\n" "$d" "$n"
done

echo
echo "=== Newest / oldest by mtime ==="
find "$DIR" -name '*.jsonl' 2>/dev/null -print0 \
  | xargs -0 ls -lt 2>/dev/null \
  | awk 'NR==1 {newest=$0} {oldest=$0} END {print "newest:", newest; print "oldest:", oldest}'

echo
echo "=== Largest projects ==="
du -sh "$DIR"/*/ 2>/dev/null | sort -h | tail -10
```

### How to read the output

| What you see | What it means | Next step |
|---|---|---|
| Files >30d old exist, codeburn UI shows ~1 month | codeburn is windowing the display | Check codeburn flags / config for the lookback window |
| Few/no files >30d old, total size small | Data was removed (reinstall, cleanup, migration) | Restore from backup if you have one; treat retention as a backup problem from now on (§2) |
| Lots of files but only one or two project dirs | You changed `cwd`s a lot or only used one project — probably fine | — |

mtime is a first approximation: if you've copied files between machines it
can lie. For a deeper check, the JSONL files contain per-event timestamps
inside — parseable with `jq` if needed.

---

## 2. Backup retention — do this regardless

Whatever aggregation choice you make, the retention story should not depend
on it. Add `~/.claude/projects/` (and `~/.claude/sessions/` if you care about
metadata) to `sysbak`'s include list so the USB rsnapshot rotation owns
historical session data.

Once that's in place, "how far back can I see?" becomes "however far back
your backup chain goes," not a tooling concern.

---

## 3. Cross-machine aggregation

Only worth building if you actually run Claude on multiple machines and
want one combined view. If `pop-mini` is the only Claude host, skip this
and just `ssh pop-mini codeburn` from elsewhere.

### Recommended shape: sync-to-laptop, pull model

- **Laptop is the aggregator.** Runs codeburn against a tree containing
  its own sessions plus copies pulled from each remote host.
- **Pull, not push.** A launchd timer on the laptop rsyncs from each
  device over Tailscale/SSH on a schedule (e.g. every 15 min). Pull
  handles "remote was offline" gracefully — next tick catches up. Push
  from remotes has to deal with "laptop closed" and needs retry logic.
- **Namespace per host, do not merge.** Pull into
  `~/.claude-aggregated/<hostname>/projects/`, never into
  `~/.claude/projects/`. Reasons:
    - Keeps your live Claude Code untouched (no chance of seeing foreign
      sessions in the running client).
    - Gives you a free `(machine_id, session_id)` key via the directory
      name — handles dedup if you ever ssh into another host and run
      Claude there.
    - Easy to wipe and re-sync if anything goes wrong.
- **codeburn must support multiple roots.** Verify before designing the
  rest. If it only reads `~/.claude/projects/`, either (a) PR a
  `--scan-root` / env var, or (b) symlink children of the aggregated
  tree under a single shadow root.

### Why not "pop-mini as a server"

codeburn today is a *parser* (reads provider session files from disk),
not a *receiver*. Turning it into a server/client app means designing:
an ingest API, schema versioning, auth tokens, retry/backoff on the
client, dedup keys, a fan-out for new providers. That's weeks of work.

Sync-to-laptop reuses 100% of the existing parser and is days of work
(launchd plist + rsync wrapper + multi-root scan). You can graduate to
real client/server later if file-sync hits a wall — e.g. you want
sub-minute freshness or non-Unix clients.

### Open questions to nail down before any code

- **Menubar offline behaviour** — when the laptop is off-network, does
  the menubar show stale-cached data, blank, or fall back to a local
  parse? Decide now; affects how the read path is structured.
- **Cursor SQLite** — codeburn parses Cursor's SQLite DB. Syncing a live
  SQLite file is fine with WAL mode + rsync, but worth a sanity check
  that the parser tolerates a snapshot taken mid-write.

---

## 4. (Optional) OTel telemetry env vars

Orthogonal to all of the above. Useful if you want *live* metrics (cost,
tokens by model, tool success/failure, lines-of-code, commits, PRs) flowing
to a dashboard rather than reconstructed from JSONL after the fact.

```bash
# In ~/.zshrc, ideally guarded by a per-machine opt-in toggle:
if [ -f "$HOME/.config/claude-telemetry/enabled" ]; then
  export CLAUDE_CODE_ENABLE_TELEMETRY=1
  export OTEL_METRICS_EXPORTER=otlp
  export OTEL_LOGS_EXPORTER=otlp
  export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
  export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
fi
```

The receiver options, lightest first:

- `OTEL_METRICS_EXPORTER=console` — prints to terminal. Good for sanity
  checks, useless for trends.
- **Custom OTel→SQLite bridge** — ~100 lines of Python listening on
  `:4317`, inserting into one file. Fits the dotfiles ethos; you own
  the schema and retention.
- **Anthropic's `claude-code-monitoring-guide` Docker stack** —
  Prometheus + Loki + Grafana with pre-built dashboards. Heaviest
  option; only worth it if you'll genuinely watch dashboards.

Defaults to leave alone unless you have a reason: `OTEL_LOG_TOOL_DETAILS`
(off — fattens logs fast), `OTEL_LOG_USER_PROMPTS` (off — privacy / size),
`OTEL_LOG_RAW_API_BODIES` (off — size).

Note: Claude Code already has `/cost` for session-level spend with zero
setup, and the Anthropic Console is the source of truth for billing. If
cost is the only thing you care about, those two cover it.
