import type { GuardResult, ToolCallContext, CommandPolicyConfig } from "../types.js";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchBannedCommand(
  command: string,
  config: CommandPolicyConfig
): GuardResult {
  for (const rule of config.rules) {
    const regex = new RegExp("\\b" + escapeRegex(rule.pattern) + "\\b");

    if (regex.test(command)) {
      return {
        verdict: "block",
        rule_matched: rule.pattern,
        feedback_given: `Blocked: use \`${rule.replacement}\` instead. ${rule.reason}`,
      };
    }
  }
  return { verdict: "pass" };
}

export function matchCommandPolicy(
  ctx: ToolCallContext,
  config: CommandPolicyConfig
): GuardResult {
  if (ctx.tool_call !== "bash" || !ctx.command) {
    return { verdict: "pass" };
  }

  const result = matchBannedCommand(ctx.command, config);
  if (result.verdict !== "pass") {
    return { ...result, command: ctx.command };
  }
  return result;
}
