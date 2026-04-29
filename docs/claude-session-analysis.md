# Claude Session Data — Storage, Retention & Style Analysis

Analysis run on popmini, 2026-04-28.

---

## 1. What Claude stores on disk

Session transcripts live at `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`.
Each JSONL file is a full bidirectional transcript: user prompts, assistant
responses (including extended thinking), tool calls and results, file-history
snapshots (pre-edit copies of every file Claude touched), permission events,
PR links, and session metadata.

**It is not metadata-only.** A typical day's sessions contain the complete
text of every response Claude generated.

### Inventory (popmini, 2026-04-28)

```
1871 session files across 20 project dirs
522 MB total

Age distribution (by mtime):
   7 days:  1779 files
  30 days:  1405 files
  60 days:   899 files
  90 days:    35 files
 180 days:     0 files

Oldest file:  2026-01-13
Newest file:  2026-04-27
```

Data goes back to 2026-01-13 (~104 days). Nothing older exists — likely a
reinstall or cleanup around that date.

### What `codeburn` shows vs what's on disk

codeburn was showing ~1 month of data. The disk has ~3 months. The difference
is a display-windowing issue in codeburn, not data loss.

### Backup status before this session

`~/.claude/projects/` was **not** included in `sysbak`. Fixed — see PRs #49 and #50.

---

## 2. Phrase frequency analysis

### Setup

```bash
# Extract all assistant text+thinking blocks with date and model
find ~/.claude/projects -name '*.jsonl' -print0 | xargs -0 cat | \
  jq -r 'select(.type=="assistant") |
    .timestamp[:10] as $d |
    (.message.model // "unknown") as $m |
    .message.content[]? |
    (.text // .thinking // empty) |
    select(. != "") |
    [$d, $m, (gsub("\n"; " "))] | @tsv' \
  > /tmp/assistant_text_model.tsv
```

Result: **16,161 text/thinking blocks** from 72 active days (Feb–Apr 2026).

### "load bearing" and "push back" — totals by model

| Model | Blocks | "load bearing" | per 1k | "push back" | per 1k |
|---|---:|---:|---:|---:|---:|
| **claude-opus-4-7** | 1,275 | 26 | **20.4** | 16 | **12.6** |
| claude-opus-4-6 | 8,197 | 17 | 2.1 | 8 | 1.0 |
| claude-haiku-4-5 | 5,922 | 3 | 0.5 | 0 | 0 |
| claude-sonnet-4-5/4-6, opus-4-5 | <300 each | 0 | 0 | 0 | 0 |

**Opus 4-7 uses "load bearing" ~10× more per block than 4-6, and "push back" ~13× more.**

### "load bearing" and "push back" — per day (all active days)

```
date          load-bearing   push-back
--------------------------------------
2026-02-02               0           0
2026-02-03               0           0
...
2026-03-25               3           0   ← first appearance of either phrase
2026-03-26               0           0
2026-03-27               2           0
2026-03-28               0           0
2026-03-29               0           0
2026-03-30               0           0
2026-03-31               1           0
2026-04-01               0           0
2026-04-02               0           0
2026-04-03               1           0
2026-04-04               0           0
...
2026-04-12               0           1
2026-04-13               0           0
2026-04-14               0           0
2026-04-15               9           6   ← single-day peak
2026-04-16               2           0
2026-04-17               0           0
2026-04-18               0           0
2026-04-19               1           0
2026-04-20               0           0
2026-04-21               6           2   ← opus 4-7 takes over from here
2026-04-22               2           0
2026-04-23               1           1
2026-04-24               5           2
2026-04-25               1           0
2026-04-26               7           3
2026-04-27               1           5
2026-04-28               1           1
--------------------------------------
TOTAL                   43          21
```

Neither phrase appears in Feb or most of March. "Load bearing" first shows up
on 2026-03-25; "push back" not until 2026-04-12.

The visible uptick from 2026-04-21 is mostly the model switch: opus 4-7 went
into use around that date.

---

## 3. N-gram style analysis

### Methodology

Extract all bigrams and trigrams from assistant blocks, compute occurrence
rate per 1000 blocks per model, rank by opus-4-7 / opus-4-6 ratio. Two passes:

- **All n-grams** (including those appearing in only one model) — surfaces
  topic differences, mostly project-specific terms.
- **N-grams present in both models** — surfaces style/vocabulary differences
  that are model-characteristic rather than project-characteristic.

### Key finding: 4-6 narrates, 4-7 acts

The phrases most over-represented in **4-6 vs 4-7** are all narration phrases:

| Phrase | 4-6 rate/1k | 4-7 rate/1k | 4-6 / 4-7 ratio |
|---|---:|---:|---:|
| "now let me" | 93.3 | 9.4 | **10×** |
| "now let" | 93.3 | 10.2 | 9× |
| "let me update" | 16.1 | 3.1 | 5× |
| "let me fix" | 16.8 | 3.9 | 4× |
| "let me also" | 28.7 | 6.3 | 5× |
| "let me check the" | 38.1 | 7.8 | 5× |
| "to understand" | 26.5 | 3.1 | 8× |
| "now have" | 33.1 | 7.1 | 5× |

4-6 externalises its reasoning step-by-step ("Now let me check…", "Let me
also look at…", "Now I have…"). 4-7 drops this narration and just acts —
but compensates with evaluative commentary ("load bearing", "push back",
"worth noting").

### Limitation

The n-gram comparison is confounded by project: 4-6 was used Feb–Apr 19
mainly on chezmoi/dotfiles and atomicguard work; 4-7 was used Apr 21–28
on additional projects (Next.js, Playwright CI, manta-deploy). Phrases unique
to 4-7 are mostly project-specific tech terms, not style markers. Only phrases
appearing in **both** models are clean signals for style comparison.

---

## 4. Thinking blocks — what's stored and what isn't

### Thinking content is redacted on disk

Extended thinking blocks (`type: "thinking"`) are stored as placeholders: only
a `signature` hash is written, the actual reasoning text is wiped before saving.

```json
{ "type": "thinking", "signature": "ErUv...", "thinking": "" }
```

This means the JSONL files record *that* thinking happened and *how often*, but
not *what* was thought. You can count invocations; you cannot read the reasoning.

### Thinking invocation rate by model

| Model | Text blocks | Text median (words) | Think blocks | Think % |
|---|---:|---:|---:|---:|
| opus-4-5 | 189 | 12 | 9 | 4.5% |
| haiku-4-5 | 4,959 | 13 | 0 | 0% |
| sonnet-4-5 | 216 | 16 | 0 | 0% |
| sonnet-4-6 | 197 | 17 | 8 | 3.9% |
| **opus-4-6** | 8,112 | **21** | 1,049 | **11.5%** |
| **opus-4-7** | 1,283 | **51** | 1,762 | **57.9%** |

Thinking switched on from 2026-03-25 when opus-4-6 became the primary model.
Invocation volume spiked on 2026-04-12 (228 in one day, still opus-4-6) then
jumped again from 2026-04-21 when opus-4-7 took over.

### Internalising reasoning made visible output longer, not shorter

The intuition "hidden thinking = more concise visible replies" is wrong in
practice. Opus 4-7 writes **51-word median visible responses** vs 4-6's **21
words** — 2.4× longer — while also invoking thinking nearly 6× more often.

The thinking is additive, not a replacement for visible explanation. 4-7 both
thinks more (hidden) and says more (visible). What it drops is the *narration*
("Now let me check…", "Let me also look at…") — style, not volume.

---

## 5. Privacy note

Session JSONL files contain the full text of every prompt you sent and every
response Claude generated, including file contents pasted as context and
pre-edit file snapshots. Back up to trusted storage only.

Files are not rotated by Claude Code — they accumulate indefinitely.
522 MB for ~3.5 months of use (~150 MB/month at current pace).
