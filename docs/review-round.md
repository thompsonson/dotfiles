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

## The pull request comment

With `--pr N`, each round comments on the pull request, refusals and errors included:

- the summary line;
- one table row per finding: severity, origin, file and line, summary;
- the run id, head commit, agent, reviewer, time and cost.

The comment's address goes in the run's log line (`posted`), or the failure (`post_error`).
`--no-post` skips the comment.

Exit codes: 0 no high findings, 1 high findings, 2 error, 3 refused (over the limit).

## Repeats

- Each finding gets an id, `r<round>.<n>`, shown in the output and the PR comment.
- The reviewer sees the branch's earlier findings by id.
- When a finding is the same defect as an earlier one, or what an incomplete fix left, it sets `repeat_of`.
- So a high in every round shows whether it is one defect not yet fixed, or a new one each time.
- `stats` counts repeats, and how many are high.

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
- Only rounds that reviewed count; a refusal or an error uses none up.
- The next round is the highest round recorded plus one, so imported rounds count.
- `record --round N` can't use a number already recorded.
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
- A run logs a `running` line when it starts, which holds its round number, and its result when done. Readers keep the last line per run. A run killed mid-review stays `running` and keeps its round.

## The review

- `run` gives `claude -p` the `pr-review` skill as its method when one exists: `.claude/skills/pr-review/SKILL.md` on the base branch, then in `~/.claude`.
- The repo's copy is read from the base branch, so a branch can't rewrite its own review rules.
- Otherwise it uses a short built-in method. `--method FILE` names another.
- The script puts the commits and the diff in the prompt (past 200,000 characters, the `--stat` and a note to read the files).
- The reviewer is read-only, whatever the user's settings: `--tools Read,Grep,Glob`, `--permission-mode dontAsk` and `--strict-mcp-config`. It has no shell, since git's own options can read and write any file.
- It loads no settings files (`--setting-sources ""`). A branch's own `.claude/settings.json` could hold hooks, and hooks run commands; tested: a branch hook runs with the default sources and not with none. This also keeps the user's CLAUDE.md out of its context.
- Claude Code still gives it the account's email address from the sign-in, so a branch could get that quoted into a PR comment.
- The prompt goes on stdin, since one argument is capped at 128 KiB on Linux.
- The reviewer works in a copy of the branch's tracked files at HEAD (`git archive`), in a temporary folder removed afterwards. The copy has no `.git` and no untracked or ignored files, and each symlink is a note of where it pointed.
- Reads stay inside that copy: only `Read(/<copy>/**)` is allowed, and in `dontAsk` mode a Read or Grep anywhere else is refused. So a branch's text can't get the reviewer to quote anything but the reviewed files into the PR comment.
- A comment that can't be posted (no `gh`, a timeout) is logged as `post_error`; the run is still logged.
- Findings come back as structured JSON (`--json-schema`). A reply without them is an error, not a clean round.
- A severity other than high, medium or low counts as low; the raw value is kept as `raw_severity`.

## Environment

| Variable | Default |
|---|---|
| `REVIEW_ROUND_HOME` | `~/.local/share/review-round` |
| `REVIEW_ROUND_CLAUDE` | `claude` |
| `REVIEW_ROUND_LIMIT` | `3` |
| `REVIEW_ROUND_AGENT` | `$USER@host` |
| `REVIEW_ROUND_MAX_MB` | `5` |
| `REVIEW_ROUND_GH` | `gh` |

## Tests

`./tests/test.sh smoke` runs it against a throwaway repo and a fake `claude`.
The test checks origins, the limit, `allow`, rotation, and totals after pruning.
