import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateGuards } from "../lib/evaluator.js";
import type { GuardConfig, ToolCallContext } from "../lib/types.js";

// Mock instrumentation to avoid SQLite in tests
vi.mock("../lib/instrumentation.js", () => ({
  emitGuardEvent: vi.fn(),
  incrementToolCalls: vi.fn(),
}));

// Mock fs for destructive-op and scope-containment
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      if (p === "/tmp" || p.startsWith("/tmp/")) return true;
      if (p === "/var/tmp" || p.startsWith("/var/tmp/")) return true;
      if (p === "/private/var/tmp" || p.startsWith("/private/var/tmp/")) return true;
      if (p === "/" || p === "/home" || p === "/home/user" || p === "/home/user/project") return true;
      return false;
    }),
    realpathSync: vi.fn((p: string) => {
      if (typeof p === "string" && (p === "/var/tmp" || p.startsWith("/var/tmp"))) {
        return p.replace("/var/tmp", "/private/var/tmp");
      }
      return p;
    }),
  };
});

const fullConfig: GuardConfig = {
  "destructive-op": true,
  secrets: true,
  "scope-containment": {
    allowed_roots: ["/home/user/project", "/tmp"],
    exceptions: ["/home/user/.zshrc"],
  },
  "command-policy": {
    rules: [
      {
        pattern: "docker compose up",
        replacement: "scripts/start.sh",
        reason: "Use the wrapper script",
      },
    ],
  },
  "protected-paths": {
    rules: [
      {
        glob: "**/dist/**",
        source: "source files + rebuild",
      },
    ],
  },
  "git-safety": {
    force_push: "block",
    main_branch_commit: "warn",
    rebase_published: "warn",
  },
};

describe("integration: multi-guard evaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("destructive-op blocks before secrets can check", async () => {
    const ctx: ToolCallContext = {
      session_id: "int-1",
      tool_call: "bash",
      attempt_number: 1,
      command: "rm -rf ~/projects",
    };

    const result = await evaluateGuards(ctx, fullConfig);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("rm-rf-unsafe-target");
  });

  it("secrets blocks write containing API key to protected path", async () => {
    const ctx: ToolCallContext = {
      session_id: "int-2",
      tool_call: "write",
      attempt_number: 1,
      path: "/home/user/project/config.ts",
      content: "const key = 'AKIAIOSFODNN7EXAMPLE';",
    };

    const result = await evaluateGuards(ctx, fullConfig);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("AWS access key");
  });

  it("scope-containment blocks write outside allowed roots", async () => {
    const ctx: ToolCallContext = {
      session_id: "int-3",
      tool_call: "write",
      attempt_number: 1,
      path: "/etc/shadow",
      content: "safe content with no secrets",
    };

    const result = await evaluateGuards(ctx, fullConfig);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("scope-boundary");
  });

  it("all guards pass for safe operation within scope", async () => {
    const ctx: ToolCallContext = {
      session_id: "int-4",
      tool_call: "write",
      attempt_number: 1,
      path: "/home/user/project/src/index.ts",
      content: "export const hello = 'world';",
    };

    const result = await evaluateGuards(ctx, fullConfig);
    expect(result.verdict).toBe("pass");
  });
});
