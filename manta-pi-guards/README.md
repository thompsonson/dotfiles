# @manta/pi-guards

Generic guard library for [Pi](https://github.com/badlogic/pi-mono) extensions — deterministic tool-call interception with audit logging.

Guards enforce workflow and safety rules by intercepting Pi tool calls before execution. Blocked calls return feedback to the LLM, enabling self-correction (Atomic Action Pairs: generate → verify → feedback).

## Installation

```bash
npm install github:mantatech/pi-guards
```

Add to your repo's `.pi/settings.json`:

```json
{
  "packages": ["@manta/pi-guards"]
}
```

## Architecture

Two layers:

1. **Guard Library** (`@manta/pi-guards`) — ships 6 guards as pure matching functions, an evaluator chain, instrumentation, and an audit CLI.
2. **Per-Repo Config** (`.pi/guard-config.json`) — each repo owns its policy. The library ships no repo-specific config.

### Guard Evaluation Order

Guards run in priority order. First block wins — lower-priority guards are skipped.

| Priority | Guard | Category | Configurable? |
|----------|-------|----------|---------------|
| 1 | `destructive-op` | Safety floor | No (built-in) |
| 2 | `secrets` | Security floor | No (built-in) |
| 3 | `scope-containment` | Boundary | Yes |
| 4 | `command-policy` | Workflow | Yes |
| 5 | `protected-paths` | Workflow | Yes |
| 6 | `git-safety` | Workflow | Yes |

```
Tool call arrives
  ├─ 1. destructive-op   → BLOCK? → stop, return feedback
  ├─ 2. secrets           → BLOCK? → stop, return feedback
  ├─ 3. scope-containment → BLOCK? → stop, return feedback
  ├─ 4. command-policy    → BLOCK? → stop, return feedback
  ├─ 5. protected-paths   → BLOCK? → stop, return feedback
  ├─ 6. git-safety        → BLOCK/WARN? → return feedback
  └─ All passed → proceed
```

### Error Handling

Fail-open per guard, not per chain. If a guard crashes, the remaining guards still run. The user sees a warning with actionable diagnostic information.

## Configuration

Create `.pi/guard-config.json` in your repo root.

### Example: manta-deploy

```json
{
  "verbose": false,
  "command-policy": {
    "rules": [
      {
        "pattern": "docker compose up",
        "replacement": "scripts/platform/install_manta_platform.sh",
        "reason": "Handles submodule sync and Docker layer caching"
      },
      {
        "pattern": "docker build",
        "replacement": "scripts/platform/update_manta_platform.sh",
        "reason": "Handles build context and layer caching"
      }
    ]
  },
  "protected-paths": {
    "rules": [
      { "glob": "**/dist/**", "source": "source files + rebuild" },
      { "glob": "**/*_pb2*", "source": ".proto files + regenerate_protobufs.sh" }
    ]
  },
  "git-safety": {
    "force_push": "block",
    "main_branch_commit": "warn"
  },
  "scope-containment": null,
  "secrets": true,
  "destructive-op": true
}
```

### Example: dotfiles

```json
{
  "verbose": false,
  "scope-containment": {
    "allowed_roots": ["~/.local/share/chezmoi", "~/.config", "~/.local"],
    "exceptions": ["~/.zshrc", "~/.tmux.conf", "~/.p10k.zsh", "~/.gitconfig"]
  },
  "command-policy": {
    "rules": [
      {
        "pattern": "cp.*dot_",
        "replacement": "chezmoi add <file>",
        "reason": "Use chezmoi to track new files"
      }
    ]
  },
  "protected-paths": {
    "rules": [
      {
        "glob": "~/.zshrc",
        "source": "dot_zshrc in chezmoi source",
        "reason": "Managed by chezmoi — edit the source"
      }
    ]
  },
  "git-safety": {
    "force_push": "block",
    "main_branch_commit": "warn"
  },
  "secrets": true,
  "destructive-op": true
}
```

### Config Reference

| Key | Type | Description |
|-----|------|-------------|
| `verbose` | `boolean` | Log pass events (for ε measurement). Default: `false` |
| `destructive-op` | `true \| null` | Enable/disable. Non-configurable guard. |
| `secrets` | `true \| null` | Enable/disable. Non-configurable guard. |
| `scope-containment` | `object \| null` | `allowed_roots`: path prefixes. `exceptions`: exact paths. |
| `command-policy` | `object \| null` | `rules[]`: `{pattern, replacement, reason}` |
| `protected-paths` | `object \| null` | `rules[]`: `{glob, source, reason?}` |
| `git-safety` | `object \| null` | Per-operation `"block"` or `"warn"` |

Set any guard to `null` to disable it for your repo.

## Guards

### 1. Destructive Operation (Priority 1)

Hard blocks dangerous shell commands:

- `rm -rf` outside `/tmp` and `/var/tmp`
- `chmod 777`
- `dd` to raw devices (`of=/dev/...`)
- `mkfs.*` filesystem format commands
- Redirects to block devices (`> /dev/sd*`)

Uses a quote-aware shell command splitter — `echo "don't rm -rf /"` does **not** trigger a false positive.

### 2. Secrets (Priority 2)

Hard blocks secrets in content and commands:

| Pattern | Type |
|---------|------|
| `-----BEGIN ... PRIVATE KEY-----` | SSH/TLS private key |
| `AKIA[0-9A-Z]{16}` | AWS access key |
| `"type": "service_account"` | GCP service account |
| `ghp_[a-zA-Z0-9]{36}` | GitHub PAT |
| `sk-[a-zA-Z0-9]{48}` | OpenAI API key |
| `sk-ant-[a-zA-Z0-9-]{90,}` | Anthropic API key |
| `xox[bps]-...` | Slack token |
| `postgres://...:...@` | DB connection string |
| `eyJ...eyJ...` | JWT token |

Also intercepts `cat .pem`, `cat .env`, `cat credentials`, and `echo $SECRET_*` in bash.

**Content safety**: Never logs matched content — only `content_hash` (SHA-256) and `rule_matched`.

### 3. Scope Containment (Priority 3)

Restricts file operations to allowed directory trees. Uses `safeResolve()` with ancestor walk for path canonicalization — prevents escape via symlinks or non-existent intermediate directories.

### 4. Command Policy (Priority 4)

Blocks banned shell commands and provides the correct alternative. Example: `docker compose up` → `scripts/platform/install_manta_platform.sh`.

### 5. Protected Paths (Priority 5)

Blocks writes to generated/managed files. Example: `**/dist/**` → "edit source files + rebuild".

### 6. Git Safety (Priority 6)

Configurable per operation — `"block"` or `"warn"`:

- `force_push`: `git push --force`, `-f`, `--force-with-lease`
- `main_branch_commit`: `git commit` mentioning main/master
- `rebase_published`: `git rebase` on origin/main
- `submodule_branch_divergence`: submodule branch checks

## Instrumentation

All block/warn events are logged to `~/.pi/guard-audit.db` (SQLite, WAL mode). Pass events are logged only in verbose mode.

### Event Schema

```
guard_events: id, timestamp, session_id, repo, guard_id, tool_call,
              verdict, attempt_number, rule_matched, feedback_given,
              command, path, content_hash

sessions:     session_id, started_at, repo, model, total_tool_calls, ended_at
```

### Audit CLI

```bash
# Summary of last session
pi-audit last

# ε report across all guards (per-session average)
pi-audit epsilon

# Most violated rules (last 30 days)
pi-audit rules --days=30

# Full event log for a session
pi-audit session <session_id>

# Cross-repo comparison
pi-audit compare

# Export (CSV with RFC 4180 quoting, or JSON)
pi-audit export --format=csv --output=guard-data.csv
pi-audit export --format=json --output=guard-data.json
```

### Key Metrics

| Metric | Query | Paper Connection |
|--------|-------|-----------------|
| ε̂(guard, attempt=1) | First-attempt compliance rate | Promise fulfillment rate |
| ε̂(guard, attempt=2) | Self-correction rate after block | Retry-with-refinement convergence |
| Convergence curve | Attempts-to-pass distribution | Retry budget calibration |
| Rule frequency | Most-violated rules | Weakest prompt instructions |

## File Structure

```
@manta/pi-guards/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── ASYNC_GATE.md              # Step 1 gate validation findings
├── bin/
│   └── pi-audit.ts            # Audit CLI
├── lib/
│   ├── types.ts               # Shared types
│   ├── shell-ast.ts           # Quote-aware shell command splitter
│   ├── evaluator.ts           # Guard chain (priority order, short-circuit)
│   ├── instrumentation.ts     # SQLite audit DB
│   └── matchers/
│       ├── destructive-op.ts  # Priority 1 — safety floor
│       ├── secrets.ts         # Priority 2 — security floor
│       ├── scope-containment.ts # Priority 3 — boundary
│       ├── command-policy.ts  # Priority 4 — workflow
│       ├── protected-paths.ts # Priority 5 — workflow
│       └── git-safety.ts      # Priority 6 — workflow
├── extensions/
│   └── guard-handler.ts       # Single Pi handler → evaluator
└── test/
    ├── shell-ast.test.ts
    ├── destructive-op.test.ts
    ├── secrets.test.ts
    ├── scope-containment.test.ts
    ├── command-policy.test.ts
    ├── protected-paths.test.ts
    ├── git-safety.test.ts
    ├── evaluator.test.ts
    └── instrumentation.test.ts
```

## Development

```bash
npm install
npm test          # Run all 73 tests
npm run lint      # Type-check
npm run build     # Compile to dist/
```

## Design Decisions

### Shell Parsing

sh-syntax (WASM port of mvdan/sh) was evaluated but its AST only exposes position offsets — `Cmd` nodes lack `Args`, `Word`, and `CallExpr` structures. The library uses a quote-aware command splitter that handles pipes, `&&`, `||`, `;` with correct quoting. See `ASYNC_GATE.md` for details.

### Pi Async Support

Pi's `ExtensionHandler` supports async: `(event, ctx) => Promise<R|void> | R | void`. The evaluator is async to support future guard implementations that may need async I/O.

### Fail-Open vs Fail-Closed

PoC uses fail-open per guard. A crashed guard is skipped with a user warning; remaining guards still run. Post-PoC: add `"fail_policy": "open" | "closed"` config option.
