import { describe, it, expect } from "vitest";
import { matchSecrets } from "../lib/matchers/secrets.js";
import type { ToolCallContext } from "../lib/types.js";

function writeCtx(content: string, path?: string): ToolCallContext {
  return {
    session_id: "test-session",
    tool_call: "write",
    attempt_number: 1,
    content,
    path: path ?? "test.txt",
  };
}

function bashCtx(command: string): ToolCallContext {
  return {
    session_id: "test-session",
    tool_call: "bash",
    attempt_number: 1,
    command,
  };
}

describe("secrets guard", () => {
  it("blocks AWS access keys in content", () => {
    const result = matchSecrets(
      writeCtx("AWS_KEY=AKIAIOSFODNN7EXAMPLE"),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("AWS access key");
    expect(result.content_hash).toBeDefined();
  });

  it("blocks private keys in content", () => {
    const result = matchSecrets(
      writeCtx("-----BEGIN RSA PRIVATE KEY-----\nMIIE..."),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("SSH/TLS private key");
  });

  it("blocks GitHub PATs", () => {
    const result = matchSecrets(
      writeCtx("token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZab01234567"),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("GitHub personal access token");
  });

  it("blocks OpenAI API keys", () => {
    const result = matchSecrets(
      writeCtx(
        "OPENAI_KEY=sk-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV"
      ),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("OpenAI API key");
  });

  it("blocks GCP service account JSON", () => {
    const result = matchSecrets(
      writeCtx('{"type": "service_account", "project_id": "my-project"}'),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("GCP service account JSON");
  });

  it("blocks database connection strings", () => {
    const result = matchSecrets(
      writeCtx("postgres://admin:secretpass@db.example.com:5432/mydb"),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe(
      "Database connection string with credentials"
    );
  });

  it("blocks JWTs", () => {
    const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const payload = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0";
    const result = matchSecrets(writeCtx(`token: ${header}.${payload}`), true);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("JWT token");
  });

  it("blocks cat of .pem files in bash", () => {
    const result = matchSecrets(bashCtx("cat server.pem"), true);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("sensitive-file-read");
  });

  it("blocks cat of .env files in bash", () => {
    const result = matchSecrets(bashCtx("cat .env"), true);
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("sensitive-file-read");
  });

  it("blocks high-entropy .env values", () => {
    const result = matchSecrets(
      writeCtx(
        "SECRET_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3",
        ".env"
      ),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("high-entropy-env-value");
  });

  it("passes normal content", () => {
    const result = matchSecrets(
      writeCtx("const x = 42; console.log(x);"),
      true
    );
    expect(result.verdict).toBe("pass");
  });

  it("blocks lowercase var names in .env files", () => {
    const result = matchSecrets(
      writeCtx(
        "api_key=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        ".env"
      ),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("high-entropy-env-value");
  });

  it("blocks 32-char values in .env files", () => {
    const result = matchSecrets(
      writeCtx(
        "TOKEN=abcdefghijklmnopqrstuvwxyz012345",
        ".env"
      ),
      true
    );
    expect(result.verdict).toBe("block");
    expect(result.rule_matched).toBe("high-entropy-env-value");
  });

  it("passes empty content in .env files", () => {
    const result = matchSecrets(
      writeCtx("", ".env"),
      true
    );
    expect(result.verdict).toBe("pass");
  });

  it("passes short values in .env files", () => {
    const result = matchSecrets(
      writeCtx("DEBUG=true", ".env"),
      true
    );
    expect(result.verdict).toBe("pass");
  });

  it("never includes raw content in result (only hash)", () => {
    const secretContent = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...";
    const result = matchSecrets(writeCtx(secretContent), true);
    expect(result.verdict).toBe("block");
    expect(result.content_hash).toBeDefined();
    // The result should not contain the raw secret
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("MIIEpAIBAAK");
  });
});
