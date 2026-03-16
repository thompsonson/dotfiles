/**
 * Single Pi extension handler for guard evaluation.
 *
 * This is the only file with a Pi dependency. All guard logic lives
 * in lib/matchers/ as pure functions, testable without Pi.
 *
 * Pi's ExtensionHandler type:
 *   (event: ToolCallEvent, ctx: ExtensionContext) => Promise<ToolCallEventResult | void> | void
 *
 * Async is fully supported — we await sh-syntax WASM in destructive-op.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { evaluateGuards } from "../lib/evaluator.js";
import { startSession, endSession } from "../lib/instrumentation.js";
import type { GuardConfig, ToolCallContext } from "../lib/types.js";

// Pi extension types (minimal — avoids hard dependency on Pi package)
interface ToolCallEvent {
  toolName: string;
  input: Record<string, unknown>;
}

interface ToolCallEventResult {
  preventDefault?: boolean;
}

interface ExtensionContext {
  sessionId: string;
  repo?: string;
  model?: string;
}

interface PiExtension {
  on(
    event: "tool_call",
    handler: (
      event: ToolCallEvent,
      ctx: ExtensionContext
    ) => Promise<ToolCallEventResult | void>
  ): void;
  on(event: "session_start", handler: (ctx: ExtensionContext) => void): void;
  on(event: "session_end", handler: (ctx: ExtensionContext) => void): void;
}

function loadGuardConfig(repoRoot?: string): GuardConfig | null {
  const searchPaths = [
    repoRoot ? join(repoRoot, ".pi", "guard-config.json") : null,
    join(process.cwd(), ".pi", "guard-config.json"),
  ].filter(Boolean) as string[];

  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      try {
        return JSON.parse(readFileSync(configPath, "utf-8")) as GuardConfig;
      } catch {
        console.warn(`[pi-guards] Failed to parse ${configPath}`);
      }
    }
  }
  return null;
}

function extractPath(input: Record<string, unknown>): string | undefined {
  // Pi tool calls may use "file_path", "path", or "file"
  return (input.file_path ?? input.path ?? input.file) as string | undefined;
}

function extractCommand(input: Record<string, unknown>): string | undefined {
  return (input.command ?? input.cmd) as string | undefined;
}

function extractContent(input: Record<string, unknown>): string | undefined {
  return (input.content ?? input.new_string) as string | undefined;
}

// Track attempt numbers per session+tool combination
const attemptCounters = new Map<string, number>();

function getAttemptNumber(sessionId: string, toolCall: string, key: string): number {
  const mapKey = `${sessionId}:${toolCall}:${key}`;
  const current = (attemptCounters.get(mapKey) ?? 0) + 1;
  attemptCounters.set(mapKey, current);
  return current;
}

/**
 * Register the guard handler with a Pi extension instance.
 */
export function registerGuardHandler(pi: PiExtension): void {
  let config: GuardConfig | null = null;

  pi.on("session_start", (ctx: ExtensionContext) => {
    config = loadGuardConfig(ctx.repo);
    if (config) {
      startSession(ctx.sessionId, ctx.repo, ctx.model);
    }
  });

  pi.on("session_end", (ctx: ExtensionContext) => {
    endSession(ctx.sessionId);
    attemptCounters.clear();
  });

  pi.on(
    "tool_call",
    async (
      event: ToolCallEvent,
      ctx: ExtensionContext
    ): Promise<ToolCallEventResult | void> => {
      if (!config) return; // No guard config for this repo

      const command = extractCommand(event.input);
      const path = extractPath(event.input);
      const content = extractContent(event.input);
      const attemptKey = command ?? path ?? JSON.stringify(event.input).slice(0, 100);

      const toolCtx: ToolCallContext = {
        session_id: ctx.sessionId,
        repo: ctx.repo,
        tool_call: event.toolName,
        attempt_number: getAttemptNumber(ctx.sessionId, event.toolName, attemptKey),
        command,
        path,
        content,
      };

      const result = await evaluateGuards(toolCtx, config);

      if (result.verdict === "block") {
        // Return feedback to the LLM and prevent the tool call
        console.log(`[pi-guards] BLOCKED: ${result.feedback_given}`);
        return { preventDefault: true };
      }

      if (result.verdict === "warn") {
        console.warn(`[pi-guards] WARNING: ${result.feedback_given}`);
        // Warn does not block — tool call proceeds
      }
    }
  );
}
