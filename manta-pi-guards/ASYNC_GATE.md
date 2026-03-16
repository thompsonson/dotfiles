# Step 1 Gate: Pi Async Handler Validation

## Finding: Pi supports async tool_call handlers

Pi's `ExtensionHandler` type signature:

```typescript
type ExtensionHandler<E, R> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void
```

For `tool_call` events:
- Handlers can return `Promise<ToolCallEventResult | void>`
- The framework automatically resolves promises before proceeding
- Registration: `pi.on("tool_call", async (event, ctx) => { ... })`

**Source**: pi-mono/coding-agent extensions documentation and types.

## sh-syntax finding: AST does not expose command arguments

The sh-syntax WASM port of mvdan/sh was evaluated but its AST serialization
only provides `Pos`/`End` offset positions — the `Cmd` nodes do not expose
`Args`, `Word`, or `CallExpr` structures needed for command-position matching.

**Decision**: Implemented a quote-aware shell command splitter as the spec's
documented fallback ("state-machine approach scoped to pipes + semicolons + && + ||").

This handles:
- Single/double quoted strings (no false positives on quoted operators)
- Pipes, &&, ||, ; as command separators
- Basic argument tokenization

Does NOT handle (acceptable for PoC):
- Heredocs, process substitution, brace expansion
- Nested subshells beyond basic detection

**sh-syntax synckit**: Confirmed available but unnecessary since Pi supports async
and we don't use sh-syntax's parse() in production code.

## Impact on architecture

- `lib/shell-ast.ts` uses the quote-aware splitter (no WASM dependency)
- `sh-syntax` removed from `dependencies` (no runtime WASM overhead)
- `extractCommands()` remains async for API compatibility (evaluator awaits it)
- All guards function correctly with the splitter approach
