import { describe, it, expect } from "vitest";
import { extractCommands } from "../lib/shell-ast.js";

describe("extractCommands", () => {
  it("parses a simple command", async () => {
    const cmds = await extractCommands("ls -la /tmp");
    expect(cmds).toHaveLength(1);
    expect(cmds[0].executable).toBe("ls");
    expect(cmds[0].args).toEqual(["-la", "/tmp"]);
  });

  it("splits piped commands", async () => {
    const cmds = await extractCommands("cat file.txt | grep error | wc -l");
    expect(cmds.length).toBeGreaterThanOrEqual(3);
    const execs = cmds.map((c) => c.executable);
    expect(execs).toContain("cat");
    expect(execs).toContain("grep");
    expect(execs).toContain("wc");
  });

  it("splits && chained commands", async () => {
    const cmds = await extractCommands("mkdir -p /tmp/test && cd /tmp/test");
    expect(cmds.length).toBeGreaterThanOrEqual(2);
    expect(cmds[0].executable).toBe("mkdir");
    expect(cmds[1].executable).toBe("cd");
  });

  it("splits || chained commands", async () => {
    const cmds = await extractCommands("test -f file || touch file");
    expect(cmds.length).toBeGreaterThanOrEqual(2);
    expect(cmds[0].executable).toBe("test");
    expect(cmds[1].executable).toBe("touch");
  });

  it("splits semicolon-separated commands", async () => {
    const cmds = await extractCommands("echo hello; echo world");
    expect(cmds.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT match quoted strings as commands", async () => {
    // "don't chmod 777" should not trigger as a chmod command
    const cmds = await extractCommands('echo "don\'t chmod 777 the server"');
    // Only the echo command should be found, not chmod
    const execs = cmds.map((c) => c.executable);
    expect(execs).not.toContain("chmod");
  });

  it("handles subshell as a token", async () => {
    // The quote-aware splitter treats $(whoami) as a single token
    const cmds = await extractCommands("echo $(whoami)");
    expect(cmds.length).toBeGreaterThanOrEqual(1);
    expect(cmds[0].executable).toBe("echo");
  });

  it("returns empty array for empty input", async () => {
    const cmds = await extractCommands("");
    expect(cmds).toEqual([]);
  });
});
