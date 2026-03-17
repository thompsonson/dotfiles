import { extractCommands } from "../shell-ast.js";
import type { GuardResult, ToolCallContext } from "../types.js";
import { realpathSync, existsSync } from "fs";
import { resolve } from "path";

// Safe directories where rm -rf is allowed.
// realpathSync() handles macOS /var/tmp → /private/var/tmp symlink resolution.
const SAFE_DIRS = ["/tmp", "/var/tmp"];

// Shells that can execute commands via -c flag
const SHELL_EXECUTORS = new Set(["bash", "sh", "zsh", "ksh", "dash"]);

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

/**
 * Check a list of parsed commands for destructive operations.
 * Returns a block/warn GuardResult if found, null if all safe.
 */
function checkDestructiveCommands(
  commands: Array<{ executable: string; args: string[]; raw: string }>,
  rawCommand: string
): GuardResult | null {
  for (const cmd of commands) {
    // Normalize executable path (e.g. /bin/rm → rm, /usr/bin/chmod → chmod)
    const execBasename = cmd.executable.split("/").pop() ?? cmd.executable;

    // rm -rf outside of safe directories
    if (execBasename === "rm" && hasFlag(cmd.args, "-rf", "-r")) {
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
            command: rawCommand,
          };
        }
      }
    }

    // chmod 777
    if (execBasename === "chmod" && cmd.args.includes("777")) {
      return {
        verdict: "block",
        rule_matched: "chmod-777",
        feedback_given:
          "Blocked: chmod 777 sets world-writable permissions. Use specific permissions (e.g., 755, 644).",
        command: rawCommand,
      };
    }

    // Raw device writes via dd
    if (
      execBasename === "dd" &&
      cmd.args.some((a) => a.startsWith("of=/dev/"))
    ) {
      return {
        verdict: "block",
        rule_matched: "dd-raw-device",
        feedback_given: "Blocked: direct device write via dd.",
        command: rawCommand,
      };
    }

    // Filesystem format
    if (execBasename.startsWith("mkfs")) {
      return {
        verdict: "block",
        rule_matched: "mkfs",
        feedback_given: "Blocked: filesystem format command.",
        command: rawCommand,
      };
    }

    // Direct disk write via redirect
    if (cmd.raw.match(/>\s*\/dev\/sd[a-z]/)) {
      return {
        verdict: "block",
        rule_matched: "redirect-to-device",
        feedback_given: "Blocked: redirect to raw block device.",
        command: rawCommand,
      };
    }

    // Detect indirect execution via shell -c
    if (SHELL_EXECUTORS.has(execBasename) && hasFlag(cmd.args, "-c")) {
      const cIdx = cmd.args.indexOf("-c");
      const innerCmd = cIdx >= 0 && cIdx + 1 < cmd.args.length
        ? cmd.args[cIdx + 1]
        : null;
      if (innerCmd) {
        // Recursively parse and check the inner command
        // extractCommands is async but we pre-parse synchronously here
        // by calling checkDestructiveCommands on the inner parse
        const innerSegments = innerCmd.split(/[|;&]+/).map((s) => s.trim()).filter(Boolean);
        const innerCommands = innerSegments.map((seg) => {
          const tokens = seg.split(/\s+/);
          return {
            executable: tokens[0],
            args: tokens.slice(1),
            raw: seg,
          };
        });
        const innerResult = checkDestructiveCommands(innerCommands, rawCommand);
        if (innerResult) return innerResult;
      }
    }

    // Detect eval with dynamic content — can't reliably parse, so warn
    if (execBasename === "eval") {
      return {
        verdict: "warn",
        rule_matched: "indirect-execution",
        feedback_given:
          "Warning: 'eval' executes dynamically constructed commands that cannot be statically analyzed. " +
          "Verify this is safe before proceeding.",
        command: rawCommand,
      };
    }
  }
  return null;
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

  const result = checkDestructiveCommands(commands, ctx.command);
  if (result) return result;

  return { verdict: "pass" };
}
