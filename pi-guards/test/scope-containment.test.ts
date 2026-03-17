import { describe, it, expect } from "vitest";
import {
  isWithinScope,
  matchScopeContainment,
} from "../lib/matchers/scope-containment.js";
import type { ToolCallContext, ScopeContainmentConfig } from "../lib/types.js";

describe("isWithinScope", () => {
  it("allows paths within allowed roots", () => {
    const result = isWithinScope("/tmp/test/file.txt", ["/tmp"]);
    expect(result.verdict).toBe("pass");
  });

  it("allows exact root match", () => {
    const result = isWithinScope("/tmp", ["/tmp"]);
    expect(result.verdict).toBe("pass");
  });

  it("blocks paths outside allowed roots", () => {
    const result = isWithinScope("/etc/passwd", ["/tmp", "/home/user/project"]);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("scope-boundary");
  });

  it("allows exception paths even outside roots", () => {
    const result = isWithinScope("/etc/special", ["/tmp"], ["/etc/special"]);
    expect(result.verdict).toBe("pass");
  });

  it("does not allow partial prefix matches", () => {
    // /tmp-evil should not match /tmp
    const result = isWithinScope("/tmp-evil/file.txt", ["/tmp"]);
    expect(result.verdict).toBe("block");
  });
});

describe("matchScopeContainment", () => {
  const config: ScopeContainmentConfig = {
    allowed_roots: ["/home/user/project", "/tmp"],
    exceptions: ["/home/user/.zshrc"],
  };

  it("passes write within scope", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "write",
      attempt_number: 1,
      path: "/home/user/project/src/index.ts",
    };
    const result = matchScopeContainment(ctx, config);
    expect(result.verdict).toBe("pass");
  });

  it("blocks write outside scope", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "write",
      attempt_number: 1,
      path: "/etc/shadow",
    };
    const result = matchScopeContainment(ctx, config);
    expect(result.verdict).toBe("block");
  });

  it("allows exception paths", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "edit",
      attempt_number: 1,
      path: "/home/user/.zshrc",
    };
    const result = matchScopeContainment(ctx, config);
    expect(result.verdict).toBe("pass");
  });

  it("passes when no path provided", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "bash",
      attempt_number: 1,
      command: "echo hello",
    };
    const result = matchScopeContainment(ctx, config);
    expect(result.verdict).toBe("pass");
  });
});
