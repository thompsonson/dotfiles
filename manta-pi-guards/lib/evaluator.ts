import type { GuardResult, GuardConfig, ToolCallContext, GuardMatcher } from "./types.js";
import { emitGuardEvent, incrementToolCalls } from "./instrumentation.js";
import { matchDestructiveOp } from "./matchers/destructive-op.js";
import { matchSecrets } from "./matchers/secrets.js";
import { matchScopeContainment } from "./matchers/scope-containment.js";
import { matchCommandPolicy } from "./matchers/command-policy.js";
import { matchProtectedPaths } from "./matchers/protected-paths.js";
import { matchGitSafety } from "./matchers/git-safety.js";

// Guards in priority order
const GUARD_CHAIN = [
  "destructive-op",
  "secrets",
  "scope-containment",
  "command-policy",
  "protected-paths",
  "git-safety",
] as const;

const DEFAULT_MATCHERS: Record<string, GuardMatcher> = {
  "destructive-op": matchDestructiveOp,
  secrets: matchSecrets,
  "scope-containment": matchScopeContainment as GuardMatcher,
  "command-policy": matchCommandPolicy as GuardMatcher,
  "protected-paths": matchProtectedPaths as GuardMatcher,
  "git-safety": matchGitSafety as GuardMatcher,
};

export async function evaluateGuards(
  ctx: ToolCallContext,
  config: GuardConfig,
  matchers: Record<string, GuardMatcher> = DEFAULT_MATCHERS
): Promise<GuardResult> {
  // Increment tool call counter for ε calculation (safe under WAL —
  // SQLite serializes writes, so concurrent tool calls don't race)
  incrementToolCalls(ctx.session_id);

  for (const guardId of GUARD_CHAIN) {
    const guardConfig = config[guardId];
    if (guardConfig === null) continue; // disabled for this repo

    const matcher = matchers[guardId];
    if (!matcher) continue;

    try {
      const result = await matcher(ctx, guardConfig);

      if (result.verdict === "block" || result.verdict === "warn") {
        emitGuardEvent({
          ...result,
          guard_id: guardId,
          session_id: ctx.session_id,
          repo: ctx.repo,
          tool_call: ctx.tool_call,
          attempt_number: ctx.attempt_number,
          verdict: result.verdict,
        });
        return result; // short-circuit
      }
    } catch (error) {
      // Guard crash: fail-open but inform the user with full diagnostic.
      const errorMessage =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);

      const diagnostic: GuardResult = {
        verdict: "warn",
        rule_matched: `guard-error:${guardId}`,
        feedback_given:
          `⚠ Guard '${guardId}' failed to execute: ${errorMessage}\n` +
          `The tool call will proceed (fail-open), but this guard is not protecting you.\n` +
          `Possible causes:\n` +
          `  - SQLite DB corrupted (~/.pi/guard-audit.db) — delete and restart\n` +
          `  - better-sqlite3 native module mismatch — run 'npm rebuild better-sqlite3'\n` +
          `  - sh-syntax WASM failed to load — check Node.js version (requires ≥18)\n` +
          `  - Permission denied on path resolution — check filesystem permissions\n` +
          `Report this if it persists: https://github.com/mantatech/pi-guards/issues`,
      };

      // Log the failure itself so it appears in audit trail
      emitGuardEvent({
        ...diagnostic,
        guard_id: guardId,
        session_id: ctx.session_id,
        repo: ctx.repo,
        tool_call: ctx.tool_call,
        attempt_number: ctx.attempt_number,
        verdict: "warn",
      });
      // Don't return — continue to next guard (fail-open per guard, not per chain)
    }
  }

  // All passed
  if (config.verbose) {
    emitGuardEvent({
      verdict: "pass",
      guard_id: "all",
      session_id: ctx.session_id,
      repo: ctx.repo,
      tool_call: ctx.tool_call,
      attempt_number: ctx.attempt_number,
    });
  }
  return { verdict: "pass" };
}

export { GUARD_CHAIN, DEFAULT_MATCHERS };
