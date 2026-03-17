import { createHash } from "crypto";
import type { GuardResult, ToolCallContext } from "../types.js";

const SECRET_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  // Cloud provider keys
  {
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    type: "SSH/TLS private key",
  },
  { pattern: /AKIA[0-9A-Z]{16}/, type: "AWS access key" },
  {
    pattern: /"type"\s*:\s*"service_account"/,
    type: "GCP service account JSON",
  },

  // AI/API provider tokens
  { pattern: /ghp_[a-zA-Z0-9]{36}/, type: "GitHub personal access token" },
  { pattern: /sk-[a-zA-Z0-9]{48}/, type: "OpenAI API key" },
  { pattern: /sk-ant-[a-zA-Z0-9-]{90,}/, type: "Anthropic API key" },
  { pattern: /xox[bps]-[0-9a-zA-Z-]+/, type: "Slack token" },

  // Database and infrastructure
  {
    pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/,
    type: "Database connection string with credentials",
  },
  {
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/,
    type: "JWT token",
  },
];

// For .env files: flag values over 32 chars that look like secrets
// Accepts lowercase var names (e.g., api_key=...) not just UPPER_CASE
const ENV_HIGH_ENTROPY = /^[A-Za-z_][A-Za-z0-9_]*=.{32,}$/m;

// Bash commands that read sensitive file types
const SENSITIVE_FILE_PATTERNS = [
  /\bcat\b.*\.(pem|key|p12|pfx)\b/,
  /\bcat\b.*\.env\b/,
  /\bcat\b.*credentials\b/,
  /\becho\b.*\$\{?[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/,
];

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function checkContent(content: string): GuardResult | null {
  for (const { pattern, type } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return {
        verdict: "block",
        rule_matched: type,
        feedback_given: `Blocked: content contains what appears to be a ${type}. Never write secrets to files tracked by version control.`,
        content_hash: contentHash(content),
      };
    }
  }
  return null;
}

function isEnvFile(path: string | undefined): boolean {
  if (!path) return false;
  const basename = path.split("/").pop() ?? "";
  return basename.startsWith(".env") || basename === "credentials";
}

export function matchSecrets(
  ctx: ToolCallContext,
  _config: unknown
): GuardResult {
  // Check bash commands for sensitive file reads
  if (ctx.tool_call === "bash" && ctx.command) {
    for (const pattern of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(ctx.command)) {
        return {
          verdict: "block",
          rule_matched: "sensitive-file-read",
          feedback_given:
            `Blocked: command reads a sensitive file. ` +
            `Avoid reading private keys, .env files, or credentials directly.`,
          command: ctx.command,
        };
      }
    }
  }

  // Check content in write/edit operations
  if ((ctx.tool_call === "write" || ctx.tool_call === "edit") && ctx.content) {
    const contentResult = checkContent(ctx.content);
    if (contentResult) {
      return { ...contentResult, path: ctx.path };
    }

    // High-entropy check for .env files
    if (isEnvFile(ctx.path) && ENV_HIGH_ENTROPY.test(ctx.content)) {
      return {
        verdict: "block",
        rule_matched: "high-entropy-env-value",
        feedback_given:
          "Blocked: .env file contains high-entropy values that may be secrets. Use environment variables or a secrets manager instead.",
        content_hash: contentHash(ctx.content),
        path: ctx.path,
      };
    }
  }

  return { verdict: "pass" };
}
