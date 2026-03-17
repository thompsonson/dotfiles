import { minimatch } from "minimatch";
import type { GuardResult, ToolCallContext, ProtectedPathsConfig } from "../types.js";

export function matchProtectedPaths(
  ctx: ToolCallContext,
  config: ProtectedPathsConfig
): GuardResult {
  if (!ctx.path) return { verdict: "pass" };

  if (ctx.tool_call !== "write" && ctx.tool_call !== "edit") {
    return { verdict: "pass" };
  }

  // Normalize path: expand ~ and collapse double slashes
  let normalizedPath = ctx.path;
  if (normalizedPath.startsWith("~/")) {
    normalizedPath = (process.env.HOME ?? "") + normalizedPath.slice(1);
  }
  normalizedPath = normalizedPath.replace(/\/\/+/g, "/");

  for (const rule of config.rules) {
    // Expand ~ in glob for matching
    const glob = rule.glob.startsWith("~/")
      ? rule.glob.replace("~", process.env.HOME ?? "")
      : rule.glob;

    if (minimatch(normalizedPath, glob)) {
      const reason = rule.reason ? ` ${rule.reason}` : "";
      return {
        verdict: "block",
        rule_matched: rule.glob,
        feedback_given:
          `Blocked: '${ctx.path}' is a protected path. ` +
          `Edit the source instead: ${rule.source}.${reason}`,
        path: ctx.path,
      };
    }
  }

  return { verdict: "pass" };
}
