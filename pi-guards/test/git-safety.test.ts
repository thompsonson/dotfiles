import { describe, it, expect } from "vitest";
import { matchGitSafety } from "../lib/matchers/git-safety.js";
import type { GitSafetyConfig, ToolCallContext } from "../lib/types.js";

const config: GitSafetyConfig = {
  force_push: "block",
  main_branch_commit: "warn",
  rebase_published: "warn",
};

function bashCtx(command: string): ToolCallContext {
  return {
    session_id: "test",
    tool_call: "bash",
    attempt_number: 1,
    command,
  };
}

describe("git-safety guard", () => {
  it("blocks force push", () => {
    const result = matchGitSafety(bashCtx("git push --force origin main"), config);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("force-push");
  });

  it("blocks force push with -f flag", () => {
    const result = matchGitSafety(bashCtx("git push -f origin main"), config);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("force-push");
  });

  it("warns on force-with-lease", () => {
    const result = matchGitSafety(
      bashCtx("git push --force-with-lease origin feature"),
      config
    );
    expect(result.verdict).toBe("block"); // configured as block
    expect(result.rule_matched).toBe("force-push");
  });

  it("allows normal push", () => {
    const result = matchGitSafety(bashCtx("git push origin feature"), config);
    expect(result.verdict).toBe("pass");
  });

  it("warns on rebase of published commits", () => {
    const result = matchGitSafety(
      bashCtx("git rebase origin/main"),
      config
    );
    expect(result.verdict).toBe("warn");
    expect(result.rule_matched).toBe("rebase-published");
  });

  it("passes non-bash tool calls", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "write",
      attempt_number: 1,
      command: "git push --force",
    };
    const result = matchGitSafety(ctx, config);
    expect(result.verdict).toBe("pass");
  });

  it("passes non-git commands", () => {
    const result = matchGitSafety(bashCtx("npm install"), config);
    expect(result.verdict).toBe("pass");
  });

  it("documents known false positive: commit message mentioning 'main'", () => {
    // This is a known heuristic limitation — the guard triggers on
    // "main" in the commit message, not on the actual branch name
    const result = matchGitSafety(
      bashCtx('git commit -m "fix main function"'),
      config
    );
    expect(result.verdict).toBe("warn");
    expect(result.rule_matched).toBe("main-branch-commit");
  });

  it("verifies force-push feedback text", () => {
    const result = matchGitSafety(
      bashCtx("git push --force origin main"),
      config
    );
    expect(result.feedback_given).toContain("force push");
    expect(result.feedback_given).toContain("overwrite");
  });

  it("verifies rebase feedback text", () => {
    const result = matchGitSafety(
      bashCtx("git rebase origin/main"),
      config
    );
    expect(result.feedback_given).toContain("rebasing");
    expect(result.feedback_given).toContain("collaborators");
  });
});
