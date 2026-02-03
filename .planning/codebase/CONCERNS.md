# Codebase Concerns

**Analysis Date:** 2026-02-03

## Tech Debt

**Tool Call Integration in Agent Executor:**
- Issue: Tool call parsing is not implemented in the agent loop. Currently returns immediately after first LLM response without handling tool calls.
- Files: `tui-agent/src/services/agent-executor.ts` (line 117)
- Impact: Multi-step agent workflows with tool calling cannot function. The agent loop breaks after first response instead of continuing when tool calls are present.
- Fix approach: Implement tool call extraction from LLM response, add tool execution step, and loop until stop condition. Currently stubbed with TODO comment.

**Incomplete Integration Tests:**
- Issue: Embedding and reranking model integration tests contain only mock tests, missing actual API calls.
- Files:
  - `oci-genai-provider/src/__tests__/integration/embedding-models.integration.test.ts` (lines 19, 33)
  - `oci-genai-provider/src/__tests__/integration/reranking-models.integration.test.ts` (lines 12, 17)
- Impact: No verification that actual OCI API calls work for embedding batching (96 item limits), truncation options, or reranking with topN/returnDocuments parameters. Bugs in API integration would not be caught.
- Fix approach: Implement actual integration tests calling OCIEmbeddingModel.embed() and OCIRerankingModel.rerank() with real OCI credentials in CI pipeline.

**Tool Category Hardcoding:**
- Issue: Agent loop assigns tool category as hardcoded 'compute' instead of looking up from tool registry.
- Files: `tui-agent/src/hooks/useAgentLoop.ts` (line 93)
- Impact: UI displays incorrect tool category information. Prevents proper approval workflows that depend on tool categories (compute vs networking vs dangerous operations).
- Fix approach: Look up actual tool category from tool registry when tool is executed.

## Security Considerations

**Child Process Execution for OCI CLI:**
- Risk: Multiple locations execute OCI CLI commands via child_process. While using execFileSync (safer than execSync), command arguments could be unsanitized.
- Files:
  - `oci-ai-chat/src/lib/tools/registry.ts` (lines 16-28)
  - `cli-tool/src/cli.ts` (line 11, execSync usage)
  - `oci-ai-chat/src/routes/api/models/+server.ts`
- Current mitigation: Uses execFileSync which prevents shell injection. Arguments passed as array not string.
- Recommendations:
  - Add input validation/sanitization for all arguments passed to OCI CLI
  - Document that this approach requires OCI CLI to be installed and in PATH
  - Consider using OCI SDK directly instead of shelling out to CLI (oci-genai-provider already does this for most operations)

**Secrets in Configuration Files:**
- Risk: MCP configuration loaded from ~/.oci-tui/mcp.json could contain plaintext credentials in env vars.
- Files: `tui-agent/src/services/mcp-service.ts` (line 14, reads config from home directory)
- Current mitigation: Uses standard home directory location. User responsible for file permissions.
- Recommendations:
  - Document that env vars in MCP config should never contain secrets
  - Consider reading sensitive values from OS environment or secure credential store instead
  - Validate that key_file paths in OCI config exist and are readable (already done in oci-genai-provider)

**Format String Vulnerability Prevention:**
- Status: Safe - already prevented in logging
- Files: `tui-agent/src/services/mcp-service.ts` (lines 56)
- Implementation correctly uses format specifiers with separate arguments instead of string interpolation to prevent format string injection.

## Performance Bottlenecks

**Large Test Files:**
- Problem: Several test files exceed 600 lines, making them difficult to maintain and slow to run.
- Files:
  - `tui-agent/src/tools/__tests__/tool-schemas.test.ts` (1035 lines)
  - `oci-genai-provider/src/__tests__/integration/v3-specification-alignment.integration.test.ts` (1021 lines)
  - `oci-genai-provider/src/__tests__/e2e-workflows.test.ts` (792 lines)
- Cause: Large test suites not split by concern. Single files test many scenarios.
- Improvement path: Break large test files into multiple focused files by functionality or module.

**Streaming Response Buffering:**
- Problem: SSE parser accumulates all stream parts in memory before yielding. Large responses could consume significant RAM.
- Files: `oci-genai-provider/src/shared/streaming/sse-parser.ts` (lines 80-81, parts array)
- Cause: Design maintains array of all parts for potential backtracking, yields only after collecting.
- Improvement path: Yield parts immediately as they arrive instead of buffering. Document any limitations this creates for client code.

**Message History in Agent Loop:**
- Problem: Agent executor keeps full conversation history in memory without limits. Long sessions accumulate token usage.
- Files: `tui-agent/src/services/agent-executor.ts` (line 47, messages array grows indefinitely)
- Cause: No conversation pruning or sliding window mechanism.
- Improvement path: Implement conversation summarization or sliding window (keep last N messages) when history exceeds threshold.

## Fragile Areas

**WebSocket Realtime Transcription State Management:**
- Files: `oci-genai-provider/src/realtime/OCIRealtimeTranscription.ts`
- Why fragile: Complex state machine with multiple queues and async resolver arrays. Race conditions possible between:
  - Concurrent async iterator consumption
  - Connection state changes
  - Result queue processing
  - Error state handling
- Safe modification: Add mutex/lock for result queue operations. Document that iterator is not thread-safe. Add state validation before operations.
- Test coverage: Gaps in concurrent consumer handling and reconnection edge cases.

**OCI Config Parser Error Handling:**
- Files: `oci-genai-provider/src/config/oci-config.ts` (lines 189-196)
- Why fragile: Broad catch-all error handling with generic messages. Silent failures when config is malformed. INI parser doesn't validate profile structure.
- Safe modification: Add specific error types for different parse failures. Validate required fields (region, user, tenancy, fingerprint) are present.
- Test coverage: Missing tests for malformed INI files, missing required fields, invalid file paths.

**Tool Approval Workflow Integration:**
- Files: `tui-agent/src/tools/approval-rules.ts`, `tui-agent/src/services/agent-executor.ts`
- Why fragile: Callback-based approval mechanism. If approval callback not set or UI doesn't respond, tool execution hangs indefinitely.
- Safe modification: Add timeout for approval requests. Implement approval queue with explicit reject capability. Add logging for approval state transitions.
- Test coverage: No tests for timeout scenarios or concurrent approval requests.

**Retry Logic Edge Cases:**
- Files: `oci-genai-provider/src/shared/utils/retry.ts`
- Why fragile: Exponential backoff with jitter could theoretically exceed maxDelayMs due to floating point precision. No circuit breaker for cascading failures.
- Safe modification: Ensure delay calculation is integers. Add circuit breaker that stops retrying after repeated failures from same service.
- Test coverage: Gaps in testing exact delay bounds and jitter distribution.

## Scaling Limits

**Streaming Reader Resource Management:**
- Current capacity: Single concurrent ReadableStream per client
- Limit: Creating many concurrent streams (100+) could exhaust browser/Node memory
- Scaling path: Implement connection pooling for WebSocket realtime sessions. Add backpressure handling to slow down audio input when transcription falls behind.

**MCP Tool Registry Unbounded Growth:**
- Current capacity: All MCP tools registered in single Map, loaded into memory
- Limit: 1000+ tools would create significant memory overhead and slow tool lookup
- Scaling path: Implement lazy loading of MCP tool definitions. Add pagination for tool discovery endpoints.

**Conversation History Accumulation:**
- Current capacity: No limit on messages stored in agent executor
- Limit: 10,000+ messages per session would degrade performance and increase API costs
- Scaling path: Implement configurable message history limits with truncation or summarization strategy.

## Dependencies at Risk

**AI SDK Version Compatibility:**
- Risk: Peer dependency allows both AI v5 and v6. Code may work with both but edge cases undiscovered.
- Files: `oci-genai-provider/package.json` (line 60: "ai": "^5.0.0 || ^6.0.0")
- Impact: Breaking changes between major versions could cause runtime errors.
- Migration plan: Lock to single major version and test against both during development phase. Add integration tests that run against both versions.

**OCI SDK Version Pinning:**
- Risk: OCI SDK dependencies pinned to specific patch version (2.94.0) across multiple packages. Major version breaking changes would require coordinated updates.
- Files: Multiple package.json files
- Impact: Security patches require rebuilding all dependent packages.
- Migration plan: Establish coordinated update process. Test new OCI SDK versions in feature branch before major integration.

**eventsource-parser Maintenance:**
- Risk: Streaming parser depends on eventsource-parser v3. Limited maintenance activity.
- Impact: Bugs in SSE parsing could affect all streaming endpoints.
- Alternative: Consider native whatwg EventSource or manual parsing implementation.

## Missing Critical Features

**Tool Call Handling in Agent Loop:**
- Problem: AI SDK tool calling fully implemented in provider but agent executor doesn't use it
- Blocks: Multi-step agent workflows, tool chaining, reasoning with tools
- Priority: High - This is core agent functionality

**Integration Test Environment:**
- Problem: Embedding and reranking integration tests are placeholders
- Blocks: Verification that OCI API changes don't break provider
- Priority: High - Catches API compatibility issues early

**Conversation Context Management:**
- Problem: No mechanism to manage conversation length or summarize history
- Blocks: Long-running sessions become slow and expensive
- Priority: Medium - Affects user experience in long sessions

**Error Recovery for Realtime Sessions:**
- Problem: Realtime transcription doesn't automatically reconnect on network failures
- Blocks: Robust streaming speech interfaces
- Priority: Medium - Affects reliability

## Test Coverage Gaps

**Realtime WebSocket Edge Cases:**
- What's not tested: Connection timeouts, server-initiated closes, message reordering, backpressure handling
- Files: `oci-genai-provider/src/realtime/__tests__/OCIRealtimeClient.test.ts`, `OCIRealtimeTranscription.test.ts`
- Risk: Silent failures or hung connections in production
- Priority: High

**OCI Config Parsing Errors:**
- What's not tested: Malformed INI syntax, missing required fields, file permission errors, concurrent file reads
- Files: `oci-genai-provider/src/config/__tests__/oci-config.test.ts`
- Risk: Cryptic errors when users have invalid config
- Priority: High

**Retry Logic Boundary Conditions:**
- What's not tested: Exact delay calculations with jitter, max retries boundary, error classification edge cases
- Files: `oci-genai-provider/src/shared/utils/__tests__/retry.test.ts`
- Risk: Retries could escape intended bounds or misclassify non-retryable errors
- Priority: Medium

**Agent Approval Workflow:**
- What's not tested: Timeout scenarios, concurrent approval requests, rejection handling, approval state persistence
- Files: `tui-agent/src/tools/__tests__/tool-schemas.test.ts` (tool execution tests exist but not approval flow)
- Risk: Approval mechanism could hang or lose state
- Priority: Medium

**SSE Parser Format Variations:**
- What's not tested: Malformed JSON in stream, truncated messages, interleaved data chunks, unusual finish reasons
- Files: `oci-genai-provider/src/shared/streaming/__tests__/sse-parser.test.ts` (has good coverage but some edge cases missing)
- Risk: Streaming could fail silently on malformed API responses
- Priority: Low

---

*Concerns audit: 2026-02-03*
