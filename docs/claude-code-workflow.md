# Claude Code Workflow Guide

This document describes the Claude Code workflow from planning through PR merge, with emphasis on the permissions model that enables autonomous exploration while maintaining human oversight for write operations.

## Overview

The Claude Code workflow follows a structured path:

```
Plan → Implement → Commit → PR → Merge
```

The key principle: **read-only operations are auto-approved, write operations require human approval**. This allows Claude to explore freely while ensuring humans remain in control of changes.

## Permissions Model

Claude Code uses a two-tier permissions system:

### Auto-Approved (Read-Only)

These operations run without prompting:

| Category | Examples |
|----------|----------|
| File reading | `Read`, `Glob`, `Grep`, `cat`, `head`, `tail` |
| Directory listing | `ls`, `tree`, `fd`, `find` |
| Search | `rg`, `grep`, `bat` (for viewing) |
| Git inspection | `git status`, `git log`, `git diff`, `git branch` |
| GitHub viewing | `gh pr view`, `gh pr list`, `gh issue view`, `gh run view` |

### Requires Approval

These operations prompt for confirmation:

| Category | Examples |
|----------|----------|
| File modification | `Edit`, `Write`, file creation |
| Git writes | `git add`, `git commit`, `git push` |
| GitHub actions | `gh pr create`, `gh pr merge` |
| Package installation | `brew install`, `npm install` |
| Destructive operations | `rm`, `git reset`, `git checkout .` |

## Configuration

Permissions are configured in `.claude/settings.json` at the project root. The settings file uses glob patterns to auto-approve specific commands:

```json
{
  "permissions": {
    "allow": [
      "Bash(gh pr view*)",
      "Bash(gh pr list*)",
      "Bash(gh run view*)",
      "Bash(git log*)",
      "Glob(*)",
      "Grep(*)",
      "Read(*)"
    ]
  }
}
```

**Source:** `~/.claude/settings.json` (user) or `.claude/settings.json` (project)

### Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `Bash(gh pr view*)` | Any `gh pr view` command with any arguments |
| `Bash(rg:*)` | The `rg` command with colon-delimited args |
| `Glob(*)` | All Glob tool invocations |
| `Read(*)` | All file reads |

## Workflow Phases

### Phase 1: Plan Mode (Read-Only)

When Claude enters plan mode (via `EnterPlanMode` tool or user request), it can autonomously:

- Explore the codebase with `Glob`, `Grep`, `Read`
- Inspect git history with `git log`, `git diff`
- Check PR/issue context with `gh pr view`, `gh issue view`
- Research and design an approach

All of these operations are auto-approved. Claude presents a plan for user review before making any changes.

**Example session:**
```
User: Add a new layout option to the dev command

Claude: [Enters plan mode]
        [Reads dot_local/bin/executable_dev]
        [Reads docs/dev.md]
        [Searches for layout-related code]
        [Presents plan with specific files to modify]

User: [Approves plan]
```

### Phase 2: Implementation (Approval Required)

After plan approval, Claude makes edits. Each edit is shown for approval unless auto-approved via settings:

```
Claude: I'll add the new layout option to the dev script.

        [Edit tool] dot_local/bin/executable_dev
        Adding case for 'split' layout...

        [User sees diff and approves]
```

During implementation, Claude can still read files and run tests freely. Only writes require approval.

### Phase 3: Commit & PR (Approval Required)

Commits and PRs happen only when explicitly requested:

```
User: commit these changes

Claude: [Runs git status - auto-approved]
        [Runs git diff - auto-approved]
        [Runs git log for commit style - auto-approved]

        I'll commit with: "feat(dev): add split layout for side-by-side panes"

        [Runs git add - requires approval]
        [Runs git commit - requires approval]

User: create a PR

Claude: [Runs git push - requires approval]
        [Runs gh pr create - requires approval]

        PR created: https://github.com/user/repo/pull/42
```

### Phase 4: Merge (Approval Required)

Merging requires explicit user request after CI passes:

```
User: the PR looks good, merge it

Claude: [Runs gh pr checks - auto-approved]
        All checks passed.

        [Runs gh pr merge - requires approval]

        PR #42 merged successfully.
```

## Example Session

Here's a complete workflow for adding a feature:

```
User: I want to add a 'split' layout to the dev command that creates
      two equal shell panes side by side

Claude: I'll explore the codebase to understand the current layout system.

        [Reads executable_dev - auto-approved]
        [Reads docs/dev.md - auto-approved]
        [Greps for "layout" patterns - auto-approved]

        I found the layout system. Here's my plan:

        1. Add 'split' to the layouts case statement
        2. Update the help text
        3. Update docs/dev.md

        [Presents detailed plan]

User: looks good, proceed

Claude: [Edit executable_dev - user approves diff]
        [Edit docs/dev.md - user approves diff]

        Changes complete. Want me to commit?

User: yes, commit

Claude: [git status - auto-approved]
        [git diff - auto-approved]

        [git add specific files - user approves]
        [git commit - user approves]

        Committed. Create a PR?

User: yes

Claude: [git push - user approves]
        [gh pr create - user approves]

        PR created: https://github.com/user/repo/pull/43

User: [reviews PR, CI passes]
      merge it

Claude: [gh pr checks - auto-approved]
        [gh pr merge - user approves]

        Merged!
```

## Recommended Settings

For a good balance of autonomy and control, auto-approve these read-only operations:

```json
{
  "permissions": {
    "allow": [
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(ls:*)",
      "Bash(tree:*)",
      "Bash(find:*)",
      "Bash(fd:*)",
      "Bash(rg:*)",
      "Bash(grep:*)",
      "Bash(bat:*)",
      "Bash(eza:*)",
      "Bash(gh pr list*)",
      "Bash(gh pr view*)",
      "Bash(gh pr status*)",
      "Bash(gh pr checks*)",
      "Bash(gh issue list*)",
      "Bash(gh issue view*)",
      "Bash(gh run list*)",
      "Bash(gh run view*)",
      "Bash(gh run watch*)",
      "Bash(gh repo view*)",
      "Bash(gh workflow list*)",
      "Bash(gh workflow view*)",
      "Bash(gh api*)",
      "Glob(*)",
      "Grep(*)",
      "Read(*)"
    ]
  }
}
```

**Keep requiring approval for:**
- All file edits (`Edit`, `Write`)
- Git writes (`git add`, `git commit`, `git push`)
- GitHub actions (`gh pr create`, `gh pr merge`)
- Package installation
- Any destructive commands

## Tips

1. **Let Claude explore freely** - Don't interrupt read-only operations; Claude will present findings before acting

2. **Review plans before approving** - The plan phase is your chance to redirect or refine the approach

3. **Request commits explicitly** - Claude won't commit unless you ask; this keeps you in control of git history

4. **Use plan mode for complex changes** - For multi-file changes, plan mode helps ensure Claude understands the full scope

5. **Check CI before merging** - Claude can check `gh pr checks` to verify all tests pass before merge

## See Also

- [Dev Session Manager](dev.md) - Persistent tmux sessions for development
- [Dotfiles Agent Setup](dotfiles-agent.md) - Running Claude Code in agent mode
