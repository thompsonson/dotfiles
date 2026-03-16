import { extractCommands } from "../shell-ast.js";
import type { GuardResult, ToolCallContext } from "../types.js";
import { realpathSync, existsSync } from "fs";
import { resolve } from "path";

const SAFE_DIRS = ["/tmp", "/var/tmp"];

/**
 * Resolve a path safely, following symlinks for existing ancestors.
 * Prevents escape via non-existent intermediate directories.
 */
function safeResolve(targetPath: string): string {
  const expanded = targetPath.startsWith("~/")
    ? resolve(process.env.HOME ?? "", targetPath.slice(2))
    : resolve(targetPath);

  if (existsSync(expanded)) {
    return realpathSync(expanded);
  }

  const parts = expanded.split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    const ancestor = parts.slice(0, i).join("/") || "/";
    if (existsSync(ancestor)) {
      const resolved = realpathSync(ancestor);
      return resolve(resolved, ...parts.slice(i));
    }
  }
  return resolve(expanded);
}

function isWithinSafeDirs(resolvedPath: string, safeDirs: string[]): boolean {
  for (const dir of safeDirs) {
    const resolvedDir = safeResolve(dir);
    if (
      resolvedPath === resolvedDir ||
      resolvedPath.startsWith(resolvedDir + "/")
    ) {
      return true;
    }
  }
  return false;
}

function hasFlag(args: string[], ...flags: string[]): boolean {
  for (const arg of args) {
    if (arg.startsWith("-") && !arg.startsWith("--")) {
      // Combined short flags: -rf, -rfv, etc.
      for (const flag of flags) {
        if (flag.startsWith("-") && !flag.startsWith("--")) {
          const chars = flag.slice(1);
          if (chars.split("").every((c) => arg.includes(c))) {
            return true;
          }
        }
      }
    }
    if (flags.includes(arg)) return true;
  }
  return false;
}

function getPositionalArgs(args: string[]): string[] {
  return args.filter((a) => !a.startsWith("-"));
}

export async function matchDestructiveOp(
  ctx: ToolCallContext,
  _config: unknown
): Promise<GuardResult> {
  if (ctx.tool_call !== "bash" || !ctx.command) {
    return { verdict: "pass" };
  }

  const commands = await extractCommands(ctx.command);

  // Unparseable command — warn, don't silently pass
  if (commands.length === 0 && ctx.command.trim().length > 0) {
    return {
      verdict: "warn",
      rule_matched: "unparseable-command",
      feedback_given:
        `Warning: could not parse command for safety check. ` +
        `Proceeding, but verify this is safe: ${ctx.command.slice(0, 100)}`,
    };
  }

  for (const cmd of commands) {
    // rm -rf outside of safe directories
    if (cmd.executable === "rm" && hasFlag(cmd.args, "-rf", "-r")) {
      const targets = getPositionalArgs(cmd.args);
      for (const target of targets) {
        const resolved = safeResolve(target);
        if (!isWithinSafeDirs(resolved, SAFE_DIRS)) {
          return {
            verdict: "block",
            rule_matched: "rm-rf-unsafe-target",
            feedback_given:
              `Blocked: 'rm -rf ${target}' targets a path outside tmp/. ` +
              `If you need to clean up, remove specific files individually.`,
            command: ctx.command,
          };
        }
      }
    }

    // chmod 777
    if (cmd.executable === "chmod" && cmd.args.includes("777")) {
      return {
        verdict: "block",
        rule_matched: "chmod-777",
        feedback_given:
          "Blocked: chmod 777 sets world-writable permissions. Use specific permissions (e.g., 755, 644).",
        command: ctx.command,
      };
    }

    // Raw device writes via dd
    if (
      cmd.executable === "dd" &&
      cmd.args.some((a) => a.startsWith("of=/dev/"))
    ) {
      return {
        verdict: "block",
        rule_matched: "dd-raw-device",
        feedback_given: "Blocked: direct device write via dd.",
        command: ctx.command,
      };
    }

    // Filesystem format
    if (cmd.executable.startsWith("mkfs")) {
      return {
        verdict: "block",
        rule_matched: "mkfs",
        feedback_given: "Blocked: filesystem format command.",
        command: ctx.command,
      };
    }

    // Direct disk write via redirect
    if (cmd.raw.match(/>\s*\/dev\/sd[a-z]/)) {
      return {
        verdict: "block",
        rule_matched: "redirect-to-device",
        feedback_given: "Blocked: redirect to raw block device.",
        command: ctx.command,
      };
    }
  }

  return { verdict: "pass" };
}
