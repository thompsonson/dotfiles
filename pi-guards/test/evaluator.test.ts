import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateGuards, GUARD_CHAIN } from "../lib/evaluator.js";
import type { GuardResult, GuardConfig, ToolCallContext, GuardMatcher } from "../lib/types.js";

// Mock instrumentation to avoid SQLite in tests
vi.mock("../lib/instrumentation.js", () => ({
  emitGuardEvent: vi.fn(),
  incrementToolCalls: vi.fn(),
}));

import { emitGuardEvent, incrementToolCalls } from "../lib/instrumentation.js";

const baseCtx: ToolCallContext = {
  session_id: "test-session",
  tool_call: "bash",
  attempt_number: 1,
  command: "echo hello",
};

const baseConfig: GuardConfig = {
  "destructive-op": true,
  secrets: true,
  "scope-containment": null,
  "command-policy": null,
  "protected-paths": null,
  "git-safety": null,
};

describe("evaluateGuards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pass when all guards pass", async () => {
    const matchers: Record<string, GuardMatcher> = {};
    for (const id of GUARD_CHAIN) {
      matchers[id] = () => ({ verdict: "pass" });
    }
    const result = await evaluateGuards(baseCtx, baseConfig, matchers);
    expect(result.verdict).toBe("pass");
  });

  it("increments tool calls on every invocation", async () => {
    const matchers: Record<string, GuardMatcher> = {
      "destructive-op": () => ({ verdict: "pass" }),
      secrets: () => ({ verdict: "pass" }),
    };
    await evaluateGuards(baseCtx, baseConfig, matchers);
    expect(incrementToolCalls).toHaveBeenCalledWith("test-session");
  });

  it("short-circuits on first block", async () => {
    const secretsMatcher = vi.fn(() => ({
      verdict: "block" as const,
      rule_matched: "test-secret",
      feedback_given: "blocked by secrets",
    }));
    const scopeMatcher = vi.fn(() => ({ verdict: "pass" as const }));

    const matchers: Record<string, GuardMatcher> = {
      "destructive-op": () => ({ verdict: "pass" }),
      secrets: secretsMatcher,
      "scope-containment": scopeMatcher,
    };

    const config: GuardConfig = {
      ...baseConfig,
      "scope-containment": { allowed_roots: ["/tmp"] },
    };

    const result = await evaluateGuards(baseCtx, config, matchers);
    expect(result.verdict).toBe("block");
    expect(secretsMatcher).toHaveBeenCalled();
    // Scope-containment should NOT have been called (short-circuit)
    expect(scopeMatcher).not.toHaveBeenCalled();
  });

  it("respects priority order — destructive-op before secrets", async () => {
    const callOrder: string[] = [];

    const matchers: Record<string, GuardMatcher> = {
      "destructive-op": () => {
        callOrder.push("destructive-op");
        return {
          verdict: "block",
          rule_matched: "test",
          feedback_given: "blocked",
        };
      },
      secrets: () => {
        callOrder.push("secrets");
        return {
          verdict: "block",
          rule_matched: "test",
          feedback_given: "blocked",
        };
      },
    };

    await evaluateGuards(baseCtx, baseConfig, matchers);
    // Only destructive-op should run (first block wins)
    expect(callOrder).toEqual(["destructive-op"]);
  });

  it("skips disabled guards (null config)", async () => {
    const matcher = vi.fn(() => ({ verdict: "pass" as const }));
    const matchers: Record<string, GuardMatcher> = {
      "scope-containment": matcher,
    };

    const config: GuardConfig = {
      ...baseConfig,
      "scope-containment": null, // disabled
    };

    await evaluateGuards(baseCtx, config, matchers);
    expect(matcher).not.toHaveBeenCalled();
  });

  it("fail-open: crashed guard does not block the chain", async () => {
    const matchers: Record<string, GuardMatcher> = {
      "destructive-op": () => {
        throw new Error("WASM load failure");
      },
      secrets: () => ({
        verdict: "block",
        rule_matched: "test-secret",
        feedback_given: "blocked by secrets",
      }),
    };

    const result = await evaluateGuards(baseCtx, baseConfig, matchers);
    // Should reach secrets guard despite destructive-op crash
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("test-secret");
  });

  it("emits diagnostic warning when guard crashes", async () => {
    const matchers: Record<string, GuardMatcher> = {
      "destructive-op": () => {
        throw new Error("WASM load failure");
      },
      secrets: () => ({ verdict: "pass" }),
    };

    await evaluateGuards(baseCtx, baseConfig, matchers);

    // Should have emitted a warn event for the crashed guard
    expect(emitGuardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: "warn",
        guard_id: "destructive-op",
        rule_matched: "guard-error:destructive-op",
      })
    );
  });

  it("emits pass event in verbose mode", async () => {
    const matchers: Record<string, GuardMatcher> = {
      "destructive-op": () => ({ verdict: "pass" }),
      secrets: () => ({ verdict: "pass" }),
    };

    const config: GuardConfig = { ...baseConfig, verbose: true };
    await evaluateGuards(baseCtx, config, matchers);

    expect(emitGuardEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: "pass",
        guard_id: "all",
      })
    );
  });

  it("does not emit pass event when not verbose", async () => {
    const matchers: Record<string, GuardMatcher> = {
      "destructive-op": () => ({ verdict: "pass" }),
      secrets: () => ({ verdict: "pass" }),
    };

    await evaluateGuards(baseCtx, baseConfig, matchers);
    expect(emitGuardEvent).not.toHaveBeenCalled();
  });
});
