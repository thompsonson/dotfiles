# review-round

Runs one code-review round on a branch, and keeps a record of every run.

## Why

- Review rounds find bugs, and the fixes for them bring new ones.
- Without a record, nobody can tell how often that happens, or how many rounds an agent ran.
- Every run leaves a line in a log, so a person can see what ran, on what, and what it found.
- After a set number of rounds on one branch, it stops until a person allows more.

## Commands

| Command | What it does |
|---|---|
| `review-round run [--pr N]` | Reviews this branch's diff against its base with `claude -p` |
| `review-round record --findings FILE [--round N]` | Records findings from a review done elsewhere, such as a subagent |
| `review-round status [--all]` | Rounds per branch, newest first, with the last round's findings |
| `review-round stats [--repo owner/name]` | Running totals by severity and origin |
| `review-round allow BRANCH N [--by NAME]` | Lets a branch run N more rounds |
| `review-round rotate [--force] [--keep N]` | Archives the logs, gzipped; `--keep` prunes old archives |

`run` and `record` work in the current git checkout.
Both print each finding and a one-line summary; agents relay that line to the person in charge.

Exit codes: 0 no high findings, 1 high findings, 2 error, 3 refused (over the limit).

## Origins

Each finding is tagged by `git blame` on the line it names:

- **pre-existing**: the line is already on the base branch;
- **original**: the line came from the branch's own build;
- **fix**: the line came from an earlier round's fix commit, named with its round;
- **unknown**: no file or line, or the line can't be blamed.

Fix commits must name their round, for example `fix(app): review round 2 — …`.

Blame credits whoever last rewrote a line. A fix that rewrites a line keeps an older bug.
That bug is then tagged `fix`.
The reviewer's own judgement is kept beside it as `claimed_origin`.
The summary says how many origins the two disagree on.

## The limit

- A branch may run `REVIEW_ROUND_LIMIT` rounds (default 3).
- The next round is the highest round recorded plus one, so imported rounds count.
- Past the limit, `run` and `record` log a `refused` line and exit 3.
- `allow` adds rounds, and records who allowed them.
- The limit makes loops visible; it is not security. An agent could run `allow` itself, and the log would show that.

## Logs

In `~/.local/share/review-round/` (`REVIEW_ROUND_HOME`):

| File | One line per |
|---|---|
| `runs.jsonl` | run: agent, host, repo, branch, PR, base, head, round, times, result, counts by severity and origin, cost and tokens |
| `findings.jsonl` | finding: severity, file, line, origin, commit, fix round, claimed origin, summary, scenario, fix |
| `allows.jsonl` | `allow`: who, when, how many |
| `archive/*.jsonl.gz` | rotated logs |
| `carried.json` | totals of archives pruned by `rotate --keep` |

- A live log is rotated once it passes `REVIEW_ROUND_MAX_MB` (default 5), at the start of a run.
- `rotate --force` archives now.
- `status` and `stats` read the archives too, and `carried.json`, so totals stay whole after pruning.
- `allows.jsonl` archives are never pruned, since they set how many rounds a branch may run.
- Writes take a lock, so parallel runs don't interleave lines.

## The review

- `run` gives `claude -p` the `pr-review` skill as its method when one exists: `.claude/skills/pr-review/SKILL.md` in the repo, then in `~/.claude`.
- Otherwise it uses a short built-in method. `--method FILE` names another.
- The reviewer may read files and run `git diff`, `log`, `show` and `blame` only.
- Findings come back as structured JSON (`--json-schema`).

## Environment

| Variable | Default |
|---|---|
| `REVIEW_ROUND_HOME` | `~/.local/share/review-round` |
| `REVIEW_ROUND_CLAUDE` | `claude` |
| `REVIEW_ROUND_LIMIT` | `3` |
| `REVIEW_ROUND_AGENT` | `$USER@host` |
| `REVIEW_ROUND_MAX_MB` | `5` |

## Tests

`./tests/test.sh smoke` runs it against a throwaway repo and a fake `claude`.
The test checks origins, the limit, `allow`, rotation, and totals after pruning.
