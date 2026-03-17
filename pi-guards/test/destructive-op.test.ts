import { describe, it, expect, vi } from "vitest";
import { matchDestructiveOp } from "../lib/matchers/destructive-op.js";
import type { ToolCallContext } from "../lib/types.js";

// Mock fs for deterministic cross-platform behavior
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      // /tmp and /var/tmp always exist in our test world
      if (p === "/tmp" || p.startsWith("/tmp/")) return true;
      if (p === "/var/tmp" || p.startsWith("/var/tmp/")) return true;
      if (p === "/private/var/tmp" || p.startsWith("/private/var/tmp/")) return true;
      if (p === "/" || p === "/home" || p === "/Users") return true;
      return false;
    }),
    realpathSync: vi.fn((p: string) => {
      // Simulate macOS /var/tmp → /private/var/tmp
      if (p === "/var/tmp" || p.startsWith("/var/tmp")) {
        return p.replace("/var/tmp", "/private/var/tmp");
      }
      return p;
    }),
  };
});

function ctx(command: string): ToolCallContext {
  return {
    session_id: "test-session",
    tool_call: "bash",
    attempt_number: 1,
    command,
  };
}

describe("destructive-op guard", () => {
  it("blocks rm -rf on non-tmp paths", async () => {
    const result = await matchDestructiveOp(ctx("rm -rf ~/projects"), true);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("rm-rf-unsafe-target");
  });

  it("allows rm -rf in /tmp", async () => {
    const result = await matchDestructiveOp(ctx("rm -rf /tmp/build"), true);
    expect(result.verdict).toBe("pass");
  });

  it("allows rm -rf in /var/tmp", async () => {
    const result = await matchDestructiveOp(ctx("rm -rf /var/tmp/cache"), true);
    expect(result.verdict).toBe("pass");
  });

  it("blocks chmod 777", async () => {
    const result = await matchDestructiveOp(ctx("chmod 777 /etc/passwd"), true);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("chmod-777");
  });

  it("allows chmod 755", async () => {
    const result = await matchDestructiveOp(ctx("chmod 755 script.sh"), true);
    expect(result.verdict).toBe("pass");
  });

  it("blocks dd to raw device", async () => {
    const result = await matchDestructiveOp(
      ctx("dd if=/dev/zero of=/dev/sda bs=512 count=1"),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("dd-raw-device");
  });

  it("blocks mkfs commands", async () => {
    const result = await matchDestructiveOp(ctx("mkfs.ext4 /dev/sdb1"), true);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("mkfs");
  });

  it("passes non-bash tool calls", async () => {
    const result = await matchDestructiveOp(
      { ...ctx("rm -rf /"), tool_call: "write" },
      true
    );
    expect(result.verdict).toBe("pass");
  });

  it("passes safe but unusual commands", async () => {
    // Our quote-aware splitter is tolerant — this parses as tokens
    const result = await matchDestructiveOp(ctx("<<<{invalid{"), true);
    expect(result.verdict).toBe("pass");
  });

  it("does not false-positive on quoted rm -rf in echo", async () => {
    const result = await matchDestructiveOp(
      ctx('echo "never run rm -rf /"'),
      true
    );
    // echo is the command, not rm
    expect(result.verdict).toBe("pass");
  });

  // --- Path normalization tests ---

  it("blocks /bin/rm -rf (absolute path to rm)", async () => {
    const result = await matchDestructiveOp(
      ctx("/bin/rm -rf ~/projects"),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("rm-rf-unsafe-target");
  });

  it("blocks /usr/bin/rm -rf (absolute path to rm)", async () => {
    const result = await matchDestructiveOp(
      ctx("/usr/bin/rm -rf ~/projects"),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("rm-rf-unsafe-target");
  });

  // --- Indirect execution tests ---

  it("blocks bash -c 'rm -rf ~/projects'", async () => {
    const result = await matchDestructiveOp(
      ctx('bash -c "rm -rf ~/projects"'),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("rm-rf-unsafe-target");
  });

  it("blocks sh -c 'rm -rf ~/projects'", async () => {
    const result = await matchDestructiveOp(
      ctx('sh -c "rm -rf ~/projects"'),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("rm-rf-unsafe-target");
  });

  it("warns on eval with dynamic command", async () => {
    const result = await matchDestructiveOp(
      ctx('eval "$DYNAMIC_CMD"'),
      true
    );
    expect(result.verdict).toBe("warn");
    expect(result.rule_matched).toBe("indirect-execution");
  });

  it("blocks rm -rf /tmp/../etc (path traversal resolves outside safe dirs)", async () => {
    const result = await matchDestructiveOp(
      ctx("rm -rf /tmp/../etc"),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("rm-rf-unsafe-target");
  });
});
