import { describe, it, expect } from "vitest";
import {
  matchBannedCommand,
  matchCommandPolicy,
} from "../lib/matchers/command-policy.js";
import type { CommandPolicyConfig, ToolCallContext } from "../lib/types.js";

const config: CommandPolicyConfig = {
  rules: [
    {
      pattern: "docker compose up",
      replacement: "scripts/platform/install_manta_platform.sh",
      reason: "Handles submodule sync and Docker layer caching",
    },
    {
      pattern: "docker build",
      replacement: "scripts/platform/update_manta_platform.sh",
      reason: "Handles build context and layer caching",
    },
  ],
};

describe("matchBannedCommand", () => {
  it("blocks a matching command", () => {
    const result = matchBannedCommand("docker compose up -d", config);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("docker compose up");
    expect(result.feedback_given).toContain("install_manta_platform.sh");
  });

  it("blocks another matching command", () => {
    const result = matchBannedCommand("docker build -t myimage .", config);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("docker build");
  });

  it("passes non-matching commands", () => {
    const result = matchBannedCommand("npm install", config);
    expect(result.verdict).toBe("pass");
  });

  it("does not match partial command names", () => {
    // "my-docker-compose-helper" should not match "docker compose"
    // because word boundaries prevent partial matches
    const result = matchBannedCommand("my-docker-compose-helper up", config);
    expect(result.verdict).toBe("pass");
  });

  it("verifies feedback text contains replacement", () => {
    const result = matchBannedCommand("docker compose up -d", config);
    expect(result.verdict).toBe("block");
    expect(result.feedback_given).toContain("install_manta_platform.sh");
    expect(result.feedback_given).toContain("instead");
  });

  it("does not match embedded patterns", () => {
    // "docker builder prune" contains "docker build" as a substring
    // but with word boundaries, "docker build" won't match "docker builder"
    const result = matchBannedCommand("docker builder prune", config);
    expect(result.verdict).toBe("pass");
  });
});

describe("matchCommandPolicy", () => {
  it("only intercepts bash tool calls", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "write",
      attempt_number: 1,
      command: "docker compose up",
    };
    const result = matchCommandPolicy(ctx, config);
    expect(result.verdict).toBe("pass");
  });

  it("passes bash calls without command", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "bash",
      attempt_number: 1,
    };
    const result = matchCommandPolicy(ctx, config);
    expect(result.verdict).toBe("pass");
  });

  it("blocks matching bash commands", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "bash",
      attempt_number: 1,
      command: "docker compose up --build",
    };
    const result = matchCommandPolicy(ctx, config);
    expect(result.verdict).toBe("block");
  });
});
