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
    expect(cmds).toHaveLength(3);
    const execs = cmds.map((c) => c.executable);
    expect(execs).toContain("cat");
    expect(execs).toContain("grep");
    expect(execs).toContain("wc");
  });

  it("splits && chained commands", async () => {
    const cmds = await extractCommands("mkdir -p /tmp/test && cd /tmp/test");
    expect(cmds).toHaveLength(2);
    expect(cmds[0].executable).toBe("mkdir");
    expect(cmds[1].executable).toBe("cd");
  });

  it("splits || chained commands", async () => {
    const cmds = await extractCommands("test -f file || touch file");
    expect(cmds).toHaveLength(2);
    expect(cmds[0].executable).toBe("test");
    expect(cmds[1].executable).toBe("touch");
  });

  it("splits semicolon-separated commands", async () => {
    const cmds = await extractCommands("echo hello; echo world");
    expect(cmds).toHaveLength(2);
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
    expect(cmds).toHaveLength(1);
    expect(cmds[0].executable).toBe("echo");
  });

  it("returns empty array for empty input", async () => {
    const cmds = await extractCommands("");
    expect(cmds).toEqual([]);
  });

  // --- Security hardening tests ---

  it("rejects null bytes", async () => {
    const cmds = await extractCommands("echo hello\0world");
    expect(cmds).toEqual([]);
  });

  it("rejects trailing backslash", async () => {
    const cmds = await extractCommands("echo hello\\");
    expect(cmds).toEqual([]);
  });

  it("rejects unclosed single quote", async () => {
    const cmds = await extractCommands("echo 'hello");
    expect(cmds).toEqual([]);
  });

  it("rejects unclosed double quote", async () => {
    const cmds = await extractCommands('echo "hello');
    expect(cmds).toEqual([]);
  });

  it("parses heredoc — extracts cat as executable (PoC limitation)", async () => {
    // Heredocs are not fully parsed, but the initial command is extracted
    const cmds = await extractCommands("cat <<EOF\nhello\nEOF");
    expect(cmds.length).toBeGreaterThanOrEqual(1);
    expect(cmds[0].executable).toBe("cat");
  });

  it("parses process substitution — extracts diff as executable", async () => {
    const cmds = await extractCommands("diff <(sort f1) <(sort f2)");
    expect(cmds.length).toBeGreaterThanOrEqual(1);
    expect(cmds[0].executable).toBe("diff");
  });

  it("parses brace expansion — extracts echo as executable", async () => {
    const cmds = await extractCommands("echo {a,b,c}");
    expect(cmds).toHaveLength(1);
    expect(cmds[0].executable).toBe("echo");
  });

  it("parses command substitution — extracts echo as executable", async () => {
    const cmds = await extractCommands("echo $(whoami)");
    expect(cmds).toHaveLength(1);
    expect(cmds[0].executable).toBe("echo");
  });

  it("parses mixed quote concatenation — extracts echo", async () => {
    const cmds = await extractCommands(`echo "hello"'world'`);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].executable).toBe("echo");
  });
});
