---
title: Eval Lab & AI Guardrails
description: Built-in Eval Lab regression and red-team harness, 9 Vietnamese PII and secret redaction rules, atomic daily quotas, and latticeAiAuditLogs.
---

# Eval Lab & AI Guardrails

Every tool invocation, A2A task, and agent workflow step in `@latticedx/plugin-dxos-ai` passes through runtime governance checks (`ai-governance.js`) before and after interacting with an LLM or database repository. The subsystem combines a 9-rule Vietnamese PII and secret redaction pipeline, PostgreSQL-backed daily quota enforcement, structured audit logging in `latticeAiAuditLogs`, and the built-in Eval Lab (`ai-eval-lab.js`).

All governance collections (`latticeAiAuditLogs`, `latticeAiQuotaPolicies`, `latticeAiQuotaUsage`, `latticeAiTraces`) enforce tenant isolation via PostgreSQL `FORCE ROW LEVEL SECURITY` and reject unmediated client writes.

## Eval Lab and Waterfall Trace Inspector

Eval Lab lets administrators benchmark the deterministic Vietnamese natural-language intent router or a configured live LLM against capability and security suites, while the trace inspector merges OpenTelemetry GenAI spans with audit records into per-`traceId` waterfall trees.

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listEvalSuites"
  auth="Bearer JWT"
  scope="Admin"
  summary="Lists available evaluation suites with case counts and preview samples."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:runEvalBenchmark"
  auth="Bearer JWT"
  scope="Admin"
  summary="Executes an evaluation suite in deterministic or llm mode and computes passRate, avgLatencyMs, and p95LatencyMs."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listAgentTraces"
  auth="Bearer JWT"
  scope="Admin"
  summary="Lists tenant-scoped agent execution traces aggregated from latticeAiTraces, OTel buffers, and latticeAiAuditLogs."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:getAgentTraceDetail"
  auth="Bearer JWT"
  scope="Admin"
  summary="Returns an ordered waterfall span tree for a traceId including token totals and redacted PII counts."
/>

### Built-in Evaluation Suites (`listEvalSuites`)

| Suite ID | Scope | Supported Modes |
| :--- | :--- | :--- |
| `vietnamese-nl-agent` | Full Vietnamese natural-language routing suite spanning RAG, task inbox, radar, GraphRAG, workflow architect, App Builder, BI charts, memory, A2A, approvals, omnichannel notifications, public forms, and security refusals. | `deterministic`, `llm` |
| `wave1-3-capabilities` | Focused capability suite covering App Builder plan/patch/rollback, `DxosBiChartBlockModel`, ReAct loops and agent memory, A2A delegation, workflow publishing, multi-level approvals, and notification channel testing. | `deterministic`, `llm` |
| `security-red-team` | `SECURITY_RED_TEAM_CASES` testing prompt injection refusal, `.env`/`AGENT_API_KEY` exfiltration, `root` privilege escalation, SSRF to `169.254.169.254`, unauthenticated public-form credential leaks, and `M-of-N` self-approval bypasses. | `deterministic`, `llm` |
| `custom` | Evaluates administrator-supplied `customCases` payloads (up to `200` cases per run). | `deterministic`, `llm` |

<ParamGrid
  title="Parameters for POST /api/dxosAi:runEvalBenchmark"
  :items="[
    { name: 'suiteId', type: 'string', required: false, default: 'vietnamese-nl-agent', description: 'Target suite: vietnamese-nl-agent, wave1-3-capabilities, security-red-team, or custom.' },
    { name: 'mode', type: 'string', required: false, default: 'deterministic', description: 'Either deterministic (local parseVietnameseNaturalIntent router) or llm (live configured LLM).' },
    { name: 'modelName', type: 'string', required: false, description: 'Optional model override when executing in llm mode.' },
    { name: 'limit', type: 'integer', required: false, description: 'Caps total executed test cases between 1 and 500.' },
    { name: 'customCases', type: 'EvalCase[]', required: false, description: 'Array of up to 200 custom cases with prompt, isAdmin, portalSlug, expectedTool, expectedIntent, refused, and expectedKeywords.' }
  ]"
/>

### Waterfall Trace Aggregation (`latticeAiTraces`)

`gatherTenantSpans` merges spans from `latticeAiTraces`, the in-process `otel-exporter` buffer (strictly filtering `norm.organizationId === organizationId`), and `latticeAiAuditLogs` fallback entries. Direct REST or Chart access to `latticeAiTraces` is rejected with `DXOS_TRACES_DIRECT_CRUD_FORBIDDEN` so all trace queries pass through `sanitizeTraceAttributes` and tenant RLS checks.

## Vietnamese PII and Secret Redaction (9 Rules)

Before payloads leave to an external LLM (`redactPiiForLlm`), an A2A peer (`redactPiiDeep`), or audit log storage, `ai-governance.js` runs three layers of scrubbing:

1. Key-name masking (`SENSITIVE_KEY_RE`): replaces values with `[REDACTED]` for 17 sensitive key patterns (`token`, `secret`, `password`, `apikey`, `api_key`, `authorization`, `cookie`, `credential`, `jwt`, `bearer`, `privatekey`, `private_key`, `sessionid`, `session_id`, `passphrase`, `access_key`, `client_secret`).
2. Inline key-value scrubbing (`SECRET_KV_RE`): redacts inline `key=value` and `key: value` secret assignments inside strings to `[REDACTED]`.
3. Nine ordered regex rules inside `redactPiiText`: masks international credentials and Vietnamese personal/tax identifiers.

| # | Detected Pattern | Matching Scope | Replacement Marker |
| :--- | :--- | :--- | :--- |
| 1 | JSON Web Token | Three-segment Base64URL string prefixed with `eyJ...` | `[REDACTED_JWT]` |
| 2 | Bearer Token | `Bearer ` prefix followed by an 8+ character token | `Bearer [REDACTED]` |
| 3 | `sk-` API Key | Prefix `sk-` followed by 6 or more alphanumeric/`_`/`-` characters | `[REDACTED_KEY]` |
| 4 | Email Address | Standard `<local>@<domain>.<tld>` pattern | `[REDACTED_EMAIL]` |
| 5 | Bank Account / IBAN | Keywords `stk`, `số tài khoản`, `tài khoản ngân hàng`, `iban` followed by account digits or IBAN | `$1[REDACTED_BANK]` |
| 6 | Labeled CCCD / CMND | Keywords `cccd`, `cmnd`, `căn cước công dân` followed by 9 to 12 digits | `$1[REDACTED_CCCD]` |
| 7 | Unlabeled 12-Digit CCCD | Standalone 12-digit identifier starting with `0` (`0\d{11}`) | `[REDACTED_CCCD]` |
| 8 | Vietnamese Mobile Phone | `(+84|0)` prefix followed by carrier prefixes `3`, `5`, `7`, `8`, `9` and 8 digits | `[REDACTED_PHONE]` |
| 9 | Vietnamese Tax ID (MST) | Keywords `mst`, `mã số thuế` followed by 10 digits and optional `-3` branch suffix | `$1[REDACTED_MST]` |

## Token/Cost Quotas and Audit Logging

Every tool or model call executes `checkAndConsumeAiQuotaPersistent` prior to dispatch. On PostgreSQL, the check runs inside `withTenantRlsContext` using `SELECT ... FOR UPDATE` against `latticeAiQuotaUsage` to enforce four daily thresholds (keyed by UTC `YYYY-MM-DD`). Exceeding any threshold returns HTTP `429` (`AI_QUOTA_EXCEEDED`).

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:quotaSummary"
  auth="Bearer JWT"
  scope="Admin"
  summary="Returns active daily quota limits, current day usage metrics, and all-time audit totals."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:saveQuotaPolicy"
  auth="Bearer JWT"
  scope="Admin"
  summary="Persists per-organization daily call, token, and USD cost limits in latticeAiQuotaPolicies."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:auditLogs"
  auth="Bearer JWT"
  scope="Admin"
  summary="Queries paginated latticeAiAuditLogs records filtered by channel, status, toolName, aiEmployee, or search term q."
/>

### Default Daily Quotas and Model Pricing

<ParamGrid
  title="Environment Variables for Daily AI Quotas and Pricing"
  :items="[
    { name: 'DXOS_AI_DAILY_ORG_CALL_LIMIT', type: 'integer', required: false, default: '5000', description: 'Daily organization-wide AI invocation limit (orgDailyCalls).' },
    { name: 'DXOS_AI_DAILY_USER_CALL_LIMIT', type: 'integer', required: false, default: '500', description: 'Daily per-user AI invocation limit (userDailyCalls).' },
    { name: 'DXOS_AI_DAILY_ORG_TOKEN_LIMIT', type: 'bigInt', required: false, default: '5000000', description: 'Daily organization total token ceiling (orgDailyTokens).' },
    { name: 'DXOS_AI_DAILY_ORG_USD_LIMIT', type: 'double', required: false, default: '50', description: 'Daily organization estimated cost ceiling in USD (orgDailyUsd).' },
    { name: 'DXOS_AI_USD_PER_1M_INPUT / OUTPUT', type: 'number', required: false, description: 'Overrides built-in per-1M token input and output pricing.' }
  ]"
/>

Built-in `MODEL_PRICING_USD_PER_1M` rates (USD per 1 million tokens) used to compute `estimatedCostUsd` when environment overrides are unset:

| Model Family | Input ($ / 1M tokens) | Output ($ / 1M tokens) |
| :--- | :---: | :---: |
| `ag/gemini-3.8-flash`, `gemini-2.5-flash`, `gpt-4o-mini` | `0.15` | `0.60` |
| `gemini-2.0-flash` | `0.10` | `0.40` |
| `gemini-2.5-pro` | `1.25` | `10.00` |
| `gpt-4o` | `2.50` | `10.00` |
| `claude-sonnet-4`, `claude-3-5-sonnet`, `claude-sonnet` | `3.00` | `15.00` |
| `ollama` / `local/*` | `0.00` | `0.00` |
| `combo` (fallback pricing) | `0.35` | `1.05` |

### `latticeAiAuditLogs` Record Schema

All tool executions across chat, workflows, MCP Gateway, A2A Gateway, and Eval Lab emit an audit entry in `latticeAiAuditLogs`. Key columns include `actorUserId`, `actorUsername`, `organizationId`, `channel`, `aiEmployee`, `toolName`, `argsSummary` (scrubbed via `sanitizeAuditSummary`), `status` (`allowed` | `degraded` | `denied` | `error`), `durationMs`, `promptTokens`, `completionTokens`, `totalTokens`, `tokenSource` (`provider` | `estimated`), `estimatedCostUsd`, `piiRedactedCount`, `errorCode`, and `resultSummary`.

<CodeTabs
  :tabs="[
    {
      label: 'Run Red-Team Eval',
      lang: 'bash',
      code: 'curl -s -X POST https://lattice.example.com/api/dxosAi:runEvalBenchmark \\\n  -H \x22Authorization: Bearer $ADMIN_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22suiteId\x22: \x22security-red-team\x22,\n    \x22mode\x22: \x22deterministic\x22\n  }\x27'
    },
    {
      label: 'Save Quota Policy',
      lang: 'bash',
      code: 'curl -s -X POST https://lattice.example.com/api/dxosAi:saveQuotaPolicy \\\n  -H \x22Authorization: Bearer $ADMIN_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22orgDailyCalls\x22: 8000,\n    \x22userDailyCalls\x22: 600,\n    \x22orgDailyTokens\x22: 10000000,\n    \x22orgDailyUsd\x22: 75\n  }\x27'
    },
    {
      label: 'Query Audit Logs',
      lang: 'bash',
      code: 'curl -s \x22https://lattice.example.com/api/dxosAi:auditLogs?channel=a2a&status=denied&page=1&pageSize=20\x22 \\\n  -H \x22Authorization: Bearer $ADMIN_JWT\x22'
    }
  ]"
/>

## Related

- [AI Overview & Profiles](/en/ai/overview-and-profiles): Role locking and LLM service routing.
- [20 Unified Tools](/en/ai/unified-tools): `createAuditedTool` wrapper enforcing quotas and emitting `latticeAiAuditLogs`.
- [A2A Protocol](/en/ai/a2a-protocol): Outbound PII redaction prior to external peer delegation.
- [Observability](/en/operations/observability): OTLP span export and Prometheus metrics.
- [Multi-Tenancy & PostgreSQL RLS](/en/architecture/multi-tenancy-rls): `FORCE ROW LEVEL SECURITY` enforcement on AI governance tables.
