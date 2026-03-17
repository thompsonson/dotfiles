import type { GuardResult, ToolCallContext, GitSafetyConfig } from "../types.js";

function makeResult(
  verdict: "block" | "warn",
  rule: string,
  feedback: string,
  command?: string
): GuardResult {
  return {
    verdict,
    rule_matched: rule,
    feedback_given: feedback,
    command,
  };
}

export function matchGitSafety(
  ctx: ToolCallContext,
  config: GitSafetyConfig
): GuardResult {
  if (ctx.tool_call !== "bash" || !ctx.command) {
    return { verdict: "pass" };
  }

  const cmd = ctx.command.trim();

  // Force push detection
  if (
    config.force_push &&
    /\bgit\s+push\b/.test(cmd) &&
    (/--force\b/.test(cmd) || /\s-f\b/.test(cmd) || /--force-with-lease\b/.test(cmd))
  ) {
    return makeResult(
      config.force_push,
      "force-push",
      "Blocked: force push can overwrite remote history. Use regular push or --force-with-lease with caution.",
      ctx.command
    );
  }

  // Main branch direct commit detection
  if (
    config.main_branch_commit &&
    /\bgit\s+commit\b/.test(cmd)
  ) {
    // HEURISTIC LIMITATION: This only checks if the command text mentions
    // "main" or "master" (e.g., in commit messages). It cannot detect whether
    // the current git branch is actually main/master. A proper branch check
    // would require running `git branch --show-current` in the guard-handler
    // and passing it as context. Known false positive: `git commit -m "fix main function"`.
    if (/\b(main|master)\b/.test(cmd)) {
      return makeResult(
        config.main_branch_commit,
        "main-branch-commit",
        "Warning: committing directly to main/master branch. Consider using a feature branch.",
        ctx.command
      );
    }
  }

  // Rebase published commits
  if (
    config.rebase_published &&
    /\bgit\s+rebase\b/.test(cmd) &&
    /\b(main|master|origin)\b/.test(cmd)
  ) {
    return makeResult(
      config.rebase_published,
      "rebase-published",
      "Warning: rebasing published commits can cause problems for collaborators.",
      ctx.command
    );
  }

  return { verdict: "pass" };
}
