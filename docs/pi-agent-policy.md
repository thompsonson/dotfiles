# Pi Agent Policy

This document defines the intended workflows, trust model, and guard rules for the Pi AI agent when working in this dotfiles repository and on the machines it manages. It is the source of truth for `~/.pi/guard-config.json`.

> **Status: draft — fill in the sections marked TODO before implementing guard rules.**

---

## 1. Workflows Pi is used for

List the specific tasks you actually delegate to Pi in this repo. Examples to consider:

| Workflow | Used? | Notes |
|----------|-------|-------|
| Editing shell config (`dot_zshrc`, `dot_p10k.zsh`) | TODO | |
| Adding new packages to `run_once_install-packages.sh.tmpl` | TODO | |
| Writing new `sysmon`/`sysup`/`sysbak` features | TODO | |
| Updating documentation (`docs/`) | TODO | |
| Creating commits and PRs | TODO | |
| Running `chezmoi apply` to deploy changes | TODO | |
| Running tests (`./tests/test.sh`) | TODO | |
| Editing config files in `~/.config/` directly | TODO | |
| SSH / remote operations | TODO | |

The guard config should only restrict what is in scope for Pi. Rules covering workflows Pi never touches add noise and false positives.

---

## 2. Trust model

### What Pi can do without confirmation

TODO — e.g.:
- Edit files inside `~/.local/share/chezmoi/` (the chezmoi source tree)
- Run read-only commands (`sysmon`, `sysup status`, `git log`, `git diff`)
- Run `./tests/test.sh`
- Create branches and commits

### What Pi should ask before doing

TODO — e.g.:
- `chezmoi apply` (deploys to home directory)
- `git push`
- Any `sudo` command
- Installing packages

### What Pi should never do

TODO — e.g.:
- Direct edits to managed files in `~` (bypass chezmoi)
- Force push
- `rm -rf` outside `/tmp`
- Write secrets or credentials to any file

---

## 3. Incidents and near-misses

Record specific things that have gone wrong or nearly gone wrong. Rules grounded in real events are worth keeping; speculative rules tend to be wrong or noisy.

| Date | What happened | Rule it motivates |
|------|--------------|-------------------|
| TODO | | |

---

## 4. Scope containment

Which directories should Pi be allowed to write to?

**Intended allowed roots:**
- `~/.local/share/chezmoi` — the entire chezmoi source tree (Pi's main workspace)
- `~/Projects/<project>` — when working on a specific project

**Intended exceptions (writable outside allowed roots):**
- TODO — are there any? e.g. `~/.gitconfig` for git config changes?

**Files that should never be written directly (always via chezmoi source):**
- `~/.zshrc` → edit `dot_zshrc` in chezmoi
- `~/.tmux.conf` → edit `dot_tmux.conf` in chezmoi
- `~/.config/Code/User/settings.json` → edit the `.tmpl` source
- TODO — add others

---

## 5. Command policy

Commands that should be blocked with a suggested alternative:

| Pattern | Suggested alternative | Reason |
|---------|----------------------|--------|
| TODO | | |

> Note: patterns here will be treated as **regular expressions** by the guard implementation, not shell globs. Use `cp .*dot_` not `cp.*dot_`.

---

## 6. Git safety

What level of git protection is appropriate?

| Rule | Setting | Rationale |
|------|---------|-----------|
| Force push to any branch | block | TODO — is this too strict? |
| Direct commit to `main` | warn or block? | TODO |
| `git reset --hard` | warn or block? | TODO |
| Rebasing published commits | warn | TODO |

---

## 7. Fail behaviour

If a guard crashes or the config cannot be loaded, should Pi:

- **Fail open** (allow all tool calls, log the failure) — safer for productivity, weaker security
- **Fail closed** (block all tool calls until resolved) — safer for security, can be disruptive

TODO — choose one and note why.

---

## 8. Machines in scope

Are the guard rules the same on all machines, or should `pop-mini`, `pi`, and any remote machines have different policies?

TODO — if different, consider per-machine config files or chezmoi template conditions.

---

## Implementation checklist

Once this document is filled in:

- [ ] Translate section 4 into `scope-containment` rules in `guard-config.json`
- [ ] Translate section 5 into `command-policy` rules (using regex, not globs)
- [ ] Translate section 6 into `git-safety` rules
- [ ] List protected paths from section 4 in `protected-paths`
- [ ] Decide fail behaviour and configure `guard-handler.ts` accordingly
- [ ] Fix the `loadGuardConfig()` search path to include `$HOME/.pi/guard-config.json` (blocking issue B1 from PR #16 review)
- [ ] Verify all regex patterns in `command-policy` against real commands before enabling
- [ ] Add a test run against a known-safe operation to confirm fail-open works as expected
