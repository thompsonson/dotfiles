// === Guard Results ===

export interface GuardResult {
  verdict: "pass" | "block" | "warn";
  guard_id?: string;
  rule_matched?: string;
  feedback_given?: string;
  command?: string;
  path?: string;
  content_hash?: string;
}

// === Tool Call Context ===

export interface ToolCallContext {
  session_id: string;
  repo?: string;
  tool_call: string; // "bash", "write", "edit"
  attempt_number: number;
  command?: string; // for bash tool calls
  path?: string; // for file tool calls
  content?: string; // for write/edit tool calls
}

// === Guard Event (for instrumentation) ===

export interface GuardEvent {
  timestamp?: string;
  session_id: string;
  repo?: string;
  guard_id: string;
  tool_call: string;
  verdict: "pass" | "block" | "warn";
  attempt_number: number;
  rule_matched?: string;
  feedback_given?: string;
  command?: string;
  path?: string;
  content_hash?: string;
}

// === Guard Configuration ===

export interface CommandPolicyRule {
  pattern: string;
  replacement: string;
  reason: string;
  category?: string;
}

export interface CommandPolicyConfig {
  rules: CommandPolicyRule[];
}

export interface ProtectedPathRule {
  glob: string;
  source: string;
  reason?: string;
}

export interface ProtectedPathsConfig {
  rules: ProtectedPathRule[];
}

export interface ScopeContainmentConfig {
  allowed_roots: string[];
  exceptions?: string[];
}

export interface GitSafetyConfig {
  force_push?: "block" | "warn";
  main_branch_commit?: "block" | "warn";
  submodule_branch_divergence?: "warn";
  rebase_published?: "warn";
}

export interface GuardConfig {
  verbose?: boolean;
  "destructive-op"?: true | null;
  secrets?: true | null;
  "scope-containment"?: ScopeContainmentConfig | null;
  "command-policy"?: CommandPolicyConfig | null;
  "protected-paths"?: ProtectedPathsConfig | null;
  "git-safety"?: GitSafetyConfig | null;
}

// === Matcher function signature ===

export type GuardMatcher = (
  ctx: ToolCallContext,
  config: unknown
) => Promise<GuardResult> | GuardResult;
