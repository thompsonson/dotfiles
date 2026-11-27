# review-round

Runs one review round on a branch, of its code or of a model, and keeps a record of every run.

## Why

- Review rounds find bugs, and the fixes for them bring new ones.
- Without a record, nobody can tell how often that happens, or how many rounds an agent ran.
- Every run leaves a line in a log, so a person can see what ran, on what, and what it found.
- After a set number of rounds on one branch, it stops until a person allows more.

## Commands

| Command | What it does |
|---|---|
| `review-round run [--review code\|model] [--pr N]` | Reviews this branch's diff against its base with `claude -p`; `--review model` reviews a model |
| `review-round record --findings FILE [--review code\|model] [--round N]` | Records findings from a review done elsewhere, such as a subagent |
| `review-round status [--all]` | Rounds per branch, newest first, with the last round's findings |
| `review-round stats [--repo owner/name]` | Running totals by severity and origin |
| `review-round allow BRANCH N [--by NAME]` | Lets a branch run N more rounds |
| `review-round rotate [--force] [--keep N]` | Archives the logs, gzipped; `--keep` prunes old archives |

`run` and `record` work in the current git checkout.
Both print each finding and a one-line summary; agents relay that line to the person in charge.

## The pull request comment

Each round comments on the branch's open pull request, refusals and errors included.
It asks `gh pr list --repo <origin's repo> --head <branch> --state open`; `--pr N` names one instead.
- Only one into the base this round reviews against counts, since the comment describes that diff. One into another base is named, with `--base` or `--pr N` as the way to post on it.
- Only one opened from that repository counts. A fork's may be a stranger's with the same branch name, so a fork's pull request is named with `--pr N`.
- With no open pull request, it says so and posts nothing. A failed lookup says why, and is logged as `post_error`.
- When `origin` is not on GitHub, it looks for none and says nothing. An ssh host alias counts as GitHub when `ssh -G <alias>` names `github.com` as its host name.

The comment holds:

- the summary line;
- one table row per finding: severity, kind, origin, file and line, summary;
- the run id, head commit, agent, reviewer, time and cost.

The comment's address goes in the run's log line (`posted`), or the failure (`post_error`).
`--no-post` skips the comment.

Exit codes: 0 no bugs and no high findings, 1 a bug or a high finding, 2 error, 3 refused (over the limit), 4 a decision is needed (a model round's design or unclassed finding).

## Bugs and polish

- Each finding has a kind as well as a severity.
- **bug**: some input or state gives a wrong result — a crash, a hang, a wrong answer, lost data, a leak, a security hole.
- **polish**: nothing behaves wrongly — wording, naming, docs, a weak test, style.
- Severity says how much harm; kind says whether there is any. An unlikely bug is a low bug, not polish.
- A round is `clean` only when it has no bugs and no high or medium findings.
- The summary line counts the bugs: `clean — 0 high, 0 medium, 1 low` is polish only.
- A finding recorded without a kind counts as a bug.

Why: severity alone let "low" mean both "rare bug" and "polish".
A rule of "fix highs and mediums" then merged real bugs, such as a search that hangs on a FIFO.

## Model rounds

- `--review model` reviews a model: a formal specification, its check script and records, its modelling choices and diagrams.
- A model often changes how things work, so the reference is the model's own intent and sources, never today's code.
- Each finding also has a class:
  - **text**: the files misstate what the model does, or leave something out. The author fixes it in the pull request.
  - **design**: the model shows the mechanism fails a claim, or leaves a case undecided. It goes to the person in charge. Once they decide, the author fixes it on the branch.
- A finding with no class is logged `unclassed`, for someone to class.
- Every class counts towards the result, as in a code round: a design bug, or a high or medium design finding, makes the round `findings`.
- The reviewer sees earlier model findings with their class. A design finding still open is reported again in each round, and marked as a repeat.
- A design finding is closed by the decision, recorded in the model's own documents: what was decided, by whom, and where. The method treats a recorded decision as part of the intent, so later rounds don't report it again.
- A round with any design or unclassed finding exits 4, after it logs the run and posts the comment.
  - It prints a block for the person in charge: each such finding's summary, scenario and open question.
  - It ends by telling the agent to stop, take the whole round to the person in charge, and fix nothing until they decide.
  - Why: review-round runs inside an interactive session, and only the person in charge can decide a design question.
- The summary line counts design and unclassed findings: `N design for the person in charge`, `N unclassed`.
- The comment gains a class column, and the run's log line records `"review": "model"`.
- Code rounds and model rounds on one branch share its round limit.
- Each round's prompt lists only earlier findings of the same review.
- `record` refuses findings that carry a class unless it is given `--review model`.

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
- A model round looks for the `review-model` skill in the same two places: `.claude/skills/review-model/SKILL.md`.
- The repo's copy is read from the base branch, so a branch can't rewrite its own review rules.
- Otherwise it uses a built-in method, one for code and one for models. `--method FILE` names another.
- The script puts the commits and the diff in the prompt (past 200,000 characters, the `--stat` and a note to read the files).
- The reviewer is read-only, whatever the user's settings: `--tools Read,Grep,Glob`, `--permission-mode dontAsk` and `--strict-mcp-config`. It has no shell, since git's own options can read and write any file.
- It loads no settings files (`--setting-sources ""`). A branch's own `.claude/settings.json` could hold hooks, and hooks run commands; tested: a branch hook runs with the default sources and not with none. This also keeps the user's CLAUDE.md out of its context.
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
