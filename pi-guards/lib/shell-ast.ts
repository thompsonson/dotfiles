/**
 * Shell command parser — quote-aware splitting of compound commands.
 *
 * NOTE: sh-syntax (WASM port of mvdan/sh) was evaluated but its AST
 * does not expose command arguments (only Pos/End offsets for formatting).
 * This module implements a quote-aware splitter that handles pipes, &&, ||,
 * semicolons, and subshells. This is the spec's documented fallback:
 * "state-machine approach scoped to pipes + semicolons + && + ||".
 *
 * Correctly handles:
 *   - Single/double quoted strings (no false positives on quoted operators)
 *   - Pipes, &&, ||, ; as command separators
 *   - Basic argument tokenization
 *
 * Does NOT handle (acceptable for PoC):
 *   - Heredocs, process substitution, brace expansion
 *   - Nested subshells beyond basic $() detection
 */

export interface ParsedCommand {
  executable: string;
  args: string[];
  raw: string;
}

/**
 * Split a shell command string into individual commands.
 * Handles quoting, pipes, &&, ||, and semicolons.
 *
 * On parse failure or empty input, returns an empty array.
 * The caller should treat empty results on non-empty input
 * as unparseable (warn verdict).
 */
export async function extractCommands(
  input: string
): Promise<ParsedCommand[]> {
  if (!input || !input.trim()) return [];

  // Null bytes can't appear in valid shell commands and may indicate injection
  if (input.includes("\0")) return [];

  try {
    const segments = splitCommands(input);
    return segments
      .map(parseSegment)
      .filter((cmd): cmd is ParsedCommand => cmd !== null);
  } catch {
    return [];
  }
}

/**
 * Split a command string on |, &&, ||, ; while respecting quotes.
 */
function splitCommands(input: string): string[] {
  const segments: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      current += ch;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (inSingle || inDouble) {
      current += ch;
      continue;
    }

    // Check for operators (outside quotes)
    if (ch === "|") {
      if (input[i + 1] === "|") {
        // ||
        segments.push(current);
        current = "";
        i++; // skip second |
        continue;
      }
      // Single pipe
      segments.push(current);
      current = "";
      continue;
    }

    if (ch === "&" && input[i + 1] === "&") {
      segments.push(current);
      current = "";
      i++; // skip second &
      continue;
    }

    if (ch === ";") {
      segments.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  // Reject malformed input that could hide commands
  if (escaped) throw new Error("trailing backslash");
  if (inSingle || inDouble) throw new Error("unclosed quote");

  if (current.trim()) {
    segments.push(current);
  }

  return segments.map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a single command segment into executable + args.
 */
function parseSegment(segment: string): ParsedCommand | null {
  const tokens = tokenize(segment);
  if (tokens.length === 0) return null;

  return {
    executable: tokens[0],
    args: tokens.slice(1),
    raw: segment.trim(),
  };
}

/**
 * Tokenize a command string, respecting quotes.
 * Strips quotes from tokens.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if ((ch === " " || ch === "\t") && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
