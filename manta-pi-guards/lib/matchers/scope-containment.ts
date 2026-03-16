import { realpathSync, existsSync } from "fs";
import { resolve } from "path";
import type { GuardResult, ToolCallContext, ScopeContainmentConfig } from "../types.js";

function expandTilde(p: string): string {
  return p.startsWith("~/")
    ? resolve(process.env.HOME ?? "", p.slice(2))
    : p;
}

/**
 * Resolve path to its canonical form, following symlinks.
 * For non-existent paths, resolve the deepest existing ancestor
 * and append the remaining segments — prevents escape via
 * non-existent intermediate directories.
 */
function safeResolve(targetPath: string): string {
  const expanded = expandTilde(targetPath);
  const abs = resolve(expanded);

  if (existsSync(abs)) {
    return realpathSync(abs);
  }

  const parts = abs.split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    const ancestor = parts.slice(0, i).join("/") || "/";
    if (existsSync(ancestor)) {
      const resolved = realpathSync(ancestor);
      return resolve(resolved, ...parts.slice(i));
    }
  }
  return resolve(abs);
}

export function isWithinScope(
  targetPath: string,
  allowedRoots: string[],
  exceptions: string[] = []
): GuardResult {
  const resolved = safeResolve(targetPath);

  // Check exceptions first (exact match on resolved path)
  for (const exc of exceptions) {
    if (resolved === safeResolve(exc)) {
      return { verdict: "pass" };
    }
  }

  // Check allowed roots (prefix match on resolved path)
  for (const root of allowedRoots) {
    const resolvedRoot = safeResolve(root);
    if (
      resolved.startsWith(resolvedRoot + "/") ||
      resolved === resolvedRoot
    ) {
      return { verdict: "pass" };
    }
  }

  return {
    verdict: "block",
    rule_matched: "scope-boundary",
    feedback_given:
      `Blocked: '${targetPath}' resolves to '${resolved}', ` +
      `which is outside the allowed scope: ${allowedRoots.join(", ")}. ` +
      `Operate within the project boundary.`,
  };
}

export function matchScopeContainment(
  ctx: ToolCallContext,
  config: ScopeContainmentConfig
): GuardResult {
  // Only intercept file-targeting tool calls
  if (!ctx.path) return { verdict: "pass" };

  if (
    ctx.tool_call === "write" ||
    ctx.tool_call === "edit" ||
    ctx.tool_call === "bash"
  ) {
    return isWithinScope(
      ctx.path,
      config.allowed_roots,
      config.exceptions
    );
  }

  return { verdict: "pass" };
}
