# Issue #352 — Working Document

**GitHub:** https://github.com/tetsuo-ai/agenc-core/issues/352
**Filed:** 2026-04-14
**Status:** In progress
**Branch:** feature/openai-compat-provider (to be created off upstream/main)

---

## GitHub Issue (as filed)

### feat(llm): add openai-compat provider for locally-hosted LLMs (LM Studio, Ollama, llama.cpp)

## Summary

Add an `openai-compat` LLM provider to the runtime that enables agents to run against locally-hosted models via any OpenAI-compatible `/v1/chat/completions` endpoint — LM Studio, Ollama (OpenAI-compat mode), llama.cpp server, vLLM — without requiring xAI credentials and without patching `xai-strict-filter.ts` to allowlist non-xAI model IDs.

## Problem

Currently the only way to run an agent against a local LLM on Apple Silicon is to add the model ID to `DOCUMENTED_XAI_MODEL_IDS` in `xai-strict-filter.ts` and route it through the Grok adapter. This:

- Corrupts the xAI strict filter, which exists specifically to enforce the documented xAI catalog
- Ties a local-model config to `apiKey` semantics that do not apply
- Breaks silently if the model ID is later removed from the allowlist patch
- Offers no startup validation that the local server is actually reachable

The `ollama` provider uses the `ollama` SDK, which works against Ollama's native API but not against LM Studio or llama.cpp, which expose only the OpenAI-compatible `/v1/chat/completions` interface.

## Current State

- `runtime/src/llm/grok/adapter.ts` — GrokProvider, xAI-specific, not appropriate for local models
- `runtime/src/llm/ollama/adapter.ts` — OllamaProvider, uses `ollama` SDK, does not work against LM Studio or OpenAI-compat endpoints
- `runtime/src/gateway/llm-provider-manager.ts` — `createSingleLLMProvider()` switch currently handles only `"grok"` and `"ollama"`; unknown providers return `null` with a warning
- `runtime/src/gateway/types.ts` — `GatewayLLMConfig["provider"]` union must be extended to include the new provider string

## Proposed Config Shape

```json
{
  "llm": {
    "provider": "openai-compat",
    "model": "google_gemma-4-26b-a4b-it",
    "baseUrl": "http://127.0.0.1:1234/v1",
    "apiKey": "local",
    "contextWindowTokens": 32768,
    "maxTokens": 4096
  }
}
```

- `baseUrl` — required; validated on startup to resolve to a local or LAN address (blocks accidental routing to external services)
- `apiKey` — required by the OpenAI SDK but not validated by local servers; any non-empty string works
- `contextWindowTokens` — required for prompt budget; local servers do not expose context window via a standard API field
- Model presence is confirmed at startup via `GET /v1/models` — the server response is the source of truth, no config field needed

## Implementation Plan

### Files to create

| File | Purpose |
|---|---|
| `runtime/src/llm/openai-compat/adapter.ts` | `OpenAICompatProvider` class implementing `LLMProvider`; uses `openai` npm SDK pointed at `baseUrl`; no xAI catalog validation; full `chat()`, `chatStream()`, `healthCheck()`, `getCapabilities()`, `getExecutionProfile()` |
| `runtime/src/llm/openai-compat/openai-compat-filter.ts` | Startup validation: `baseUrl` resolves to local/LAN, `GET /v1/models` reachable, configured model must be present in response |
| `runtime/src/llm/openai-compat/types.ts` | `OpenAICompatProviderConfig` interface |
| `runtime/src/llm/openai-compat/adapter.test.ts` | Unit tests (fully mocked via `vi.mock("openai", ...)`) covering message format, tool calling, streaming, error mapping, health check, tool routing |
| `runtime/src/llm/openai-compat/openai-compat-filter.test.ts` | Unit tests for filter: baseUrl local/LAN validation, model list parsing, model presence check |

### Files to modify

| File | Change |
|---|---|
| `runtime/src/gateway/types.ts` | Add `"openai-compat"` to `GatewayLLMConfig["provider"]` union |
| `runtime/src/gateway/llm-provider-manager.ts` | Add `case "openai-compat":` branch in `createSingleLLMProvider()`; add `"openai-compat"` to the provider name guard in `findConfiguredLlmConfigForProvider()` |
| `runtime/src/llm/grok/xai-strict-filter.ts` | Remove `"google_gemma-4-26b-a4b-it"` from `DOCUMENTED_XAI_MODEL_IDS` (added as a temporary workaround; superseded by this provider) |

### Adapter structure

`OpenAICompatProvider` follows the `OllamaProvider` pattern:

- Lazy client init via `ensureLazyImport("openai", ...)` — `openai` is already a declared runtime dependency (used by `GrokProvider`)
- `chat()` calls `/v1/chat/completions` (non-streaming)
- `chatStream()` calls `/v1/chat/completions` with `stream: true`
- Tool calls mapped through the OpenAI `tool_calls[]` response format
- Error mapping: `ECONNREFUSED` → descriptive message; 401 → `LLMAuthenticationError`; 500 → `LLMServerError`; `AbortError` → `LLMTimeoutError`
- `getCapabilities()` reports stateful: all false (local servers have no stateful response support)
- `getExecutionProfile()` returns `contextWindowTokens` from config (no runtime API available for local servers)

## Validation Approach

On provider construction, `openai-compat-filter.ts` runs three checks in order before the provider is returned to the daemon:

1. **baseUrl local check** — parse `baseUrl`, confirm hostname resolves to `127.x`, `192.168.x`, `10.x`, `172.16-31.x`, or `localhost`; throw on any public IP or domain
2. **Server reachability** — `GET {baseUrl}/models` with short timeout (5s); throw `OpenAICompatServerUnreachableError` on connection failure or timeout
3. **Model presence check** — confirm configured `model` appears in the `/models` response; throw `OpenAICompatUnknownModelError` if absent

All three checks are mandatory. There is no config flag to skip them. The server's `/v1/models` response is the authoritative source of truth for which models are available — no separate config field is used.

## Test Plan

### Unit tests (no network required)

`adapter.test.ts` — `vi.mock("openai", ...)` pattern identical to `grok/adapter.test.ts`:

- [ ] Messages sent in OpenAI chat format (`role`, `content`)
- [ ] Tool calls in request (`tools[]`) and response (`tool_calls[]`) mapped correctly
- [ ] `finishReason` is `"tool_calls"` when tool calls present, `"stop"` otherwise
- [ ] Streaming accumulates chunks and calls `onChunk` correctly
- [ ] `ECONNREFUSED` → descriptive error message
- [ ] 401 → `LLMAuthenticationError`
- [ ] 500 → `LLMServerError`
- [ ] `AbortError` → `LLMTimeoutError`
- [ ] `healthCheck()` returns `true` on successful `/models` call, `false` on failure
- [ ] `getCapabilities()` reports all stateful capabilities as `false`
- [ ] Tool routing: `all_tools_no_filter`, `all_tools_empty_filter`, `subset_exact`, `subset_no_resolved_matches`
- [ ] Per-call timeout override honored

`openai-compat-filter.test.ts`:

- [ ] Accepts `127.0.0.1`, `localhost`, `192.168.x.x`, `10.x.x.x`
- [ ] Rejects public IP addresses and external hostnames
- [ ] Throws `OpenAICompatServerUnreachableError` when `/models` is unreachable
- [ ] Throws `OpenAICompatServerUnreachableError` when `/models` call times out
- [ ] Passes when `/models` response includes configured model
- [ ] Throws `OpenAICompatUnknownModelError` when configured model is absent from `/models` response

### Live server functional tests (env-gated)

In `adapter.test.ts`, at the bottom of the describe block:

```ts
const hasLiveServer = !!process.env.OPENAI_COMPAT_BASE_URL;

it.skipIf(!hasLiveServer)("live: connects to server and returns a response", async () => {
  // ...
});
```

These run only when `OPENAI_COMPAT_BASE_URL` is set; they are skipped in CI. Covers: basic round-trip, tool call round-trip, streaming.

### Full test suite

All existing tests must continue to pass after this change:

```bash
# Fast path — run per commit
npm run typecheck --workspace=@tetsuo-ai/runtime
npm run test --workspace=@tetsuo-ai/runtime

# Pre-merge gate — run before opening PR
npm run validate:required --workspace=@tetsuo-ai/runtime
```

No regressions permitted in GrokProvider, OllamaProvider, or any existing LLM adapter behavior.

## Validated Against

- Hardware: Apple Silicon M2 32GB
- Local server: LM Studio 0.4.9
- Model: Gemma 4 26B (`google_gemma-4-26b-a4b-it`)
- Validated: full `system.bash` tool loop (write → gcc compile → execute) confirmed working end-to-end via the Grok adapter + xAI strict filter patch that this provider supersedes

## Notes

- **Context window requirement:** Gemma 4 26B requires ≥32K context (`contextWindowTokens: 32768`); LM Studio defaults to 4096 which is too small for the system prompt. Must be set explicitly in config.
- **workspace.hostPath:** Set to a neutral directory when running local models to prevent autonomous probe execution of workspace files during initial context loading.
- **openai npm package:** Already a declared runtime dependency (used by `GrokProvider`). No new package required.
- The `ollama` provider remains the recommended choice for Ollama users who prefer the native SDK; `openai-compat` is the right choice for LM Studio and any server that exposes only the OpenAI HTTP API.

## Acceptance Criteria

- [ ] `provider: "openai-compat"` is accepted in `config.json` and `GatewayLLMConfig`
- [ ] Daemon starts and connects to a local LM Studio or llama.cpp server
- [ ] `agenc shell` runs full tool loops against a locally-hosted model
- [ ] Startup validation rejects a public `baseUrl` before connecting
- [ ] Startup validation throws `OpenAICompatServerUnreachableError` when `baseUrl` is unreachable
- [ ] Startup validation throws `OpenAICompatUnknownModelError` when the configured model is not in the server's `/v1/models` response
- [ ] `xai-strict-filter.ts` no longer contains non-xAI model IDs
- [ ] `npm run typecheck --workspace=@tetsuo-ai/runtime` passes
- [ ] `npm run test --workspace=@tetsuo-ai/runtime` passes with no regressions
- [ ] `npm run validate:required --workspace=@tetsuo-ai/runtime` passes
- [ ] No regressions in `GrokProvider` or `OllamaProvider` behavior

---

## Implementation Notes

Running log of decisions made during implementation that differ from
the original proposal. Add entries here as they arise.

---

## Progress Checklist

### Files to create
- [x] runtime/src/llm/openai-compat/types.ts
- [x] runtime/src/llm/openai-compat/openai-compat-filter.ts
- [x] runtime/src/llm/openai-compat/adapter.ts
- [x] runtime/src/llm/openai-compat/adapter.test.ts
- [x] runtime/src/llm/openai-compat/openai-compat-filter.test.ts

### Files to modify
- [x] runtime/src/gateway/types.ts
- [x] runtime/src/gateway/llm-provider-manager.ts
- [x] runtime/src/llm/grok/xai-strict-filter.ts (remove Fix 6 temp entry)

### Acceptance criteria
- [ ] provider: "openai-compat" accepted in config.json and GatewayLLMConfig
- [ ] Daemon starts and connects to local LM Studio or llama.cpp server
- [ ] agenc shell runs full tool loops against locally-hosted model
- [ ] Startup validation rejects public baseUrl before connecting
- [ ] Startup validation throws OpenAICompatServerUnreachableError when baseUrl unreachable
- [ ] Startup validation throws OpenAICompatUnknownModelError when model not in /v1/models
- [ ] xai-strict-filter.ts no longer contains non-xAI model IDs
- [ ] npm run typecheck --workspace=@tetsuo-ai/runtime passes
- [ ] npm run test --workspace=@tetsuo-ai/runtime passes with no regressions
- [ ] npm run validate:required --workspace=@tetsuo-ai/runtime passes
- [ ] No regressions in GrokProvider or OllamaProvider behavior

---

## Test Results (2026-04-14)

### Baseline (pre-existing failures on upstream/main before our changes)
The following 14 failures exist on upstream/main and are not caused
by this PR:

| File | Failures | Root cause |
|---|---|---|
| src/tools/system/server.test.ts | 7 | API shape change in recent upstream commits |
| src/tools/system/process.test.ts | 1 | trusted-mode deny-prefix enforcement change |
| tests/marketplace-cli.integration.test.ts | 5 | Error message changed in PR #356 (job-spec-security) |
| src/gateway/daemon.test.ts | 1 | yolo-mode host execution deny list change |

### Our changes
- 0 new failures introduced
- 6,590 previously passing tests continue to pass
- Typecheck: 0 errors

### Note
Future sessions: always run typecheck and full test suite on a clean
branch before writing any code to establish a baseline.

### Live server test isolation (2026-04-15)
Live server tests moved from adapter.test.ts to adapter.live.test.ts.
Root cause: vi.mock("openai") is hoisted file-wide in adapter.test.ts,
replacing the real OpenAI SDK with mockCreate for all tests including
the live block. Separate file has no mock — uses the real SDK.

---

## Pre-PR Documentation Updates

Before filing the PR, update these two files in the same commit:
- [x] docs/RUNTIME_API.md — add Local Inference config profile section

## Test Commands

### Unit tests (run per commit)
npm run typecheck --workspace=@tetsuo-ai/runtime
npm run test --workspace=@tetsuo-ai/runtime

### Pre-merge gate
npm run validate:required --workspace=@tetsuo-ai/runtime

### Live server functional tests
OPENAI_COMPAT_BASE_URL=http://127.0.0.1:1234/v1 \
OPENAI_COMPAT_MODEL=google_gemma-4-26b-a4b-it \
npm run test --workspace=@tetsuo-ai/runtime

---

## Final Status

- **PR filed:** tetsuo-ai/agenc-core#402 on 2026-04-15
- **Status:** awaiting upstream review
- **Closes:** issue #352
- **Supersedes:** experiment/local-tool-fixes Fix 6 (xai-strict-filter gemma workaround) — remove that fix once PR merges
- **Live tested against:** LM Studio 0.4.9 / Gemma 4 26B (google_gemma-4-26b-a4b-it)
- **Unit tests:** 81 passing, 0 failures in new files; 19 pre-existing upstream failures (none in changed files)
