import { describe, it, expect } from "vitest";
import { matchProtectedPaths } from "../lib/matchers/protected-paths.js";
import type { ProtectedPathsConfig, ToolCallContext } from "../lib/types.js";

const config: ProtectedPathsConfig = {
  rules: [
    {
      glob: "**/dist/**",
      source: "source files + rebuild",
    },
    {
      glob: "**/*_pb2*",
      source: ".proto files + scripts/utils/regenerate_protobufs.sh",
    },
    {
      glob: "**/node_modules/**",
      source: "package.json + npm install",
    },
  ],
};

function writeCtx(path: string): ToolCallContext {
  return {
    session_id: "test",
    tool_call: "write",
    attempt_number: 1,
    path,
  };
}

describe("protected-paths guard", () => {
  it("blocks writes to dist/", () => {
    const result = matchProtectedPaths(writeCtx("project/dist/bundle.js"), config);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("**/dist/**");
    expect(result.feedback_given).toContain("source files + rebuild");
  });

  it("blocks writes to protobuf generated files", () => {
    const result = matchProtectedPaths(
      writeCtx("lib/grpc/service_pb2.py"),
      config
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("**/*_pb2*");
  });

  it("blocks writes to node_modules", () => {
    const result = matchProtectedPaths(
      writeCtx("project/node_modules/lodash/index.js"),
      config
    );
    expect(result.verdict).toBe("block");
  });

  it("allows writes to normal source files", () => {
    const result = matchProtectedPaths(writeCtx("src/index.ts"), config);
    expect(result.verdict).toBe("pass");
  });

  it("only intercepts write/edit tool calls", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "bash",
      attempt_number: 1,
      path: "project/dist/file.js",
    };
    const result = matchProtectedPaths(ctx, config);
    expect(result.verdict).toBe("pass");
  });

  it("passes when no path provided", () => {
    const ctx: ToolCallContext = {
      session_id: "test",
      tool_call: "write",
      attempt_number: 1,
    };
    const result = matchProtectedPaths(ctx, config);
    expect(result.verdict).toBe("pass");
  });

  it("blocks paths with tilde expansion", () => {
    const homeConfig: ProtectedPathsConfig = {
      rules: [
        {
          glob: process.env.HOME + "/.ssh/**",
          source: "manual SSH config",
        },
      ],
    };
    const result = matchProtectedPaths(
      writeCtx("~/.ssh/authorized_keys"),
      homeConfig
    );
    expect(result.verdict).toBe("block");
  });

  it("blocks paths with double slashes", () => {
    const result = matchProtectedPaths(
      writeCtx("project//dist//bundle.js"),
      config
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("**/dist/**");
  });

  it("normalizes tilde in path for matching", () => {
    const homeConfig: ProtectedPathsConfig = {
      rules: [
        {
          glob: process.env.HOME + "/protected/**",
          source: "protected source",
        },
      ],
    };
    const result = matchProtectedPaths(
      writeCtx("~/protected/file.txt"),
      homeConfig
    );
    expect(result.verdict).toBe("block");
  });
});
