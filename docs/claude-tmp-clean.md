# claude-tmp-clean

Removes idle Claude Code session temp folders.

## Why

- Claude Code gives each session a folder under `/tmp/claude-<uid>/<project>/<session>/`.
- It holds the session's scratchpad and task output.
- Nothing removes it when the session ends.
- Builds and test keyrings inside it can reach many gigabytes.
- On Ubuntu and Pop!_OS, `systemd-tmpfiles` does not age `/tmp`.

## What counts as idle

A folder is removed only when both hold:

- its transcript, `~/.claude/projects/<project>/<session>.jsonl`, is older than `--days` (default 7);
- no process uses it, by working directory, open file or command line.
- no git checkout in it holds work found nowhere else.

Without a transcript, the newest file in the folder's top two levels stands in for it.

`gpg-agent`, `scdaemon`, `keyboxd` and `dirmngr` do not count as use.
A test keyring leaves them running long after its session ends.
They are stopped with `gpgconf --homedir <dir> --kill all` before the folder is removed.
A gpg daemon whose homedir under the root is already gone is sent `SIGTERM`.

## Git checkouts

Sessions put worktrees and clones in their scratchpad. A folder is kept when one holds:

- uncommitted changes, including untracked files;
- in a worktree, a `HEAD` that no branch, tag or remote ref contains;
- in a clone, commits on a branch or tag that no remote ref contains, or a stash.

A checkout git cannot read is kept too.
Before a folder is removed, each worktree in it is unregistered with `git worktree remove`.
The parent repo then keeps no entry for a missing folder.
Ignored files, such as build output, are not checked.

## Usage

```bash
claude-tmp-clean               # list idle folders; changes nothing
claude-tmp-clean --delete      # remove them
claude-tmp-clean --days 2      # treat two days without a transcript write as idle
```

`sysup clean` runs `claude-tmp-clean --delete` too.

## Daily timer

The systemd user units `claude-tmp-clean.service` and `claude-tmp-clean.timer` are installed but not enabled.
To enable them on a machine:

```bash
systemctl --user daemon-reload
systemctl --user enable --now claude-tmp-clean.timer
journalctl --user -u claude-tmp-clean.service    # what each run removed
```

## Limits

- Linux only: it reads `/proc` to tell which folders are in use. Elsewhere it does nothing.
- A session idle past `--days` with nothing open in its folder loses its scratchpad.
  Resuming it later works, without those files.
