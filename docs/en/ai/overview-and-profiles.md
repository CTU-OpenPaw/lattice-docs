---
title: AI Studio Overview & 7 Agent Profiles
description: Architecture of DX-OS AI Studio, LLM provider abstraction, profile role-locking security controls, and complete reference for all 7 starter agent profiles.
---

<script setup>
const aiProfilesTabs = [
  {
    label: 'Quick-Connect LLM (cURL)',
    lang: 'bash',
    code: `curl -X POST "https://app.example.com/api/dxosAi:quickConnectLlm" \\
  -H "Authorization: Bearer <ADMIN_JWT_OR_PAT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "google-genai",
    "modelName": "gemini-2.5-flash",
    "apiKey": "AIza...",
    "testConnection": true,
    "verifyCompletion": true
  }'`,
  },
  {
    label: 'List Portal Agents',
    lang: 'bash',
    code: `curl -s "https://app.example.com/api/dxosAi:portalAgents?portalSlug=incidents" \\
  -H "Authorization: Bearer <USER_JWT>"`,
  },
  {
    label: 'Custom Profile Payload',
    lang: 'json',
    code: `{
  "username": "dxos-qa-inspector",
  "nickname": "Cold-Chain QA Inspector AI",
  "position": "QA Compliance Specialist",
  "departmentScope": "qa-coldchain",
  "allowedRoles": ["ldx_warehouse", "ldx_manager"],
  "portalBindings": ["logistics", "incidents"],
  "toolPermissions": {
    "dxos_search_enterprise_context": "ALLOW",
    "dxos_graph_impact_analysis": "ALLOW",
    "dxos_execute_record_action": "ASK"
  }
}`,
  },
];
</script>

# AI Studio Overview & 7 Agent Profiles

DX-OS AI Studio (`@latticedx/plugin-dxos-ai`) operates at **Plane #5** of the LatticeDX 6-Plane architecture. It coordinates multi-role enterprise agents, enforces audited tool execution, and exposes standardized Model Context Protocol (MCP) and Agent-to-Agent (A2A) gateways. Rather than running as a separate service detached from authorization rules, AI Studio inherits caller identity from Keycloak OIDC, enforces `ldx_*` role policies, and executes queries inside PostgreSQL `FORCE ROW LEVEL SECURITY` transactions (`app.current_org`).

Each AI agent is stored in the `latticeAiProfiles` collection, synchronized bidirectionally with the NocoBase `2.2.50` host runtime (`aiEmployees` and `rolesAiEmployees`), and scoped to explicit tool modes, portal bindings (`/p/*`), and internal MCP servers.

## DX-OS AI Studio Runtime Architecture

The interactive diagram below traces how user prompts and automation triggers route through the 7 starter profiles, the ReAct reasoning loop, the 20 Unified Tools, App Builder 2.0, and external MCP/A2A consumers.

<AiStudioLifecycleDiagram />

Runtime privileges are split across two distinct security tiers:

- **Operational agents (6 profiles):** Operate within business role boundaries (`ldx_*`), read and write only RBAC-permitted collections, and pause behind Human-in-the-Loop (HITL) approval gates for record mutations or IIoT alarm actions.
- **Platform architect (`dxos-architect`):** The sole administrative builder profile allowed to invoke the 11 `ADMIN_BUILDER_TOOL_NAMES`, strictly locked to `root` and `admin` callers.

## LLM Provider Abstraction & Quick-Connect

All agent profiles route inference through NocoBase `llmServices` records managed by `ai-llm-health.js`. During initial bootstrap (`ensureDefaultAiWorkforce`), all 7 starter profiles bind to `local-9router` (an OpenAI-compatible router at `AGENT_BASE_URL`, defaulting to `http://host.docker.internal:20128/v1`) using `ag/gemini-3.8-flash` or `combo`.

Administrators can connect and rebind the entire starter workforce to external or local providers using 7 built-in presets (`QUICK_CONNECT_PROVIDER_PRESETS`):

| Preset Key | Stored Provider | Default Service Name | Default Base URL | Default Model | API Key Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `9router` | `openai-completions` | `local-9router` | `http://127.0.0.1:20128/v1` | `ag/gemini-3.8-flash` | Yes |
| `openai` | `openai` | `quick-openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | Yes |
| `openai-completions` | `openai-completions` | `quick-openai-completions` | `http://127.0.0.1:20128/v1` | `ag/gemini-3.8-flash` | Yes |
| `google-genai` | `google-genai` | `quick-google-genai` | `https://generativelanguage.googleapis.com` | `gemini-2.5-flash` | Yes |
| `anthropic` | `anthropic` | `quick-anthropic` | `https://api.anthropic.com/v1` | `claude-3-5-sonnet-latest` | Yes |
| `deepseek` | `deepseek` | `quick-deepseek` | `https://api.deepseek.com/v1` | `deepseek-chat` | Yes |
| `ollama` | `ollama` | `quick-ollama` | `http://127.0.0.1:11434` | `llama3.1` | No |

### SSRF Protection on LLM Endpoints

Every `baseURL` submitted to `quickConnectLlm` or probed by `checkLlmHealth` is validated by `validateQuickConnectBaseUrl` and `assertSafeLlmProbeUrl`:

- Only `http://` and `https://` schemes are accepted; embedded `username:password@` credentials are rejected.
- Private RFC1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`), IPv6 link-local/ULA ranges (`fe80::/10`, `fc00::/7`), and cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `metadata.azure.com`) are blocked, including DNS resolution checks to prevent DNS rebinding.
- Plain `http://` is permitted only for `QUICK_CONNECT_LOCAL_HOSTS` (`127.0.0.1`, `localhost`, `::1`, `host.docker.internal`) with local-capable providers (`ollama`, `9router`, `openai-completions`) on ports `11434`, `20128`, `1234`, `8000` (extendable via `DXOS_LOCAL_LLM_PORTS`).

## Profile Schema & Security Controls

The `latticeAiProfiles` collection stores per-agent definitions under tenant RLS (`organizationId`) and enforces three server-side safety invariants before persistence or host synchronization.

<ParamGrid
  title="latticeAiProfiles Schema Fields"
  :items="[
    { name: 'username', type: 'string', required: true, description: 'Unique agent identifier matching ^[a-z0-9][a-z0-9_-]{1,62}$.' },
    { name: 'nickname', type: 'string', required: true, description: 'Display name shown in portal chat drawers (max 120 chars).' },
    { name: 'position', type: 'string', description: 'Operational role title presented to end users.' },
    { name: 'departmentScope', type: 'string', default: 'general', description: 'Logical department or domain boundary.' },
    { name: 'organizationId', type: 'string', required: true, description: 'Owning tenant identifier enforced by FORCE RLS.' },
    { name: 'llmService', type: 'string', default: 'local-9router', description: 'Target service name in llmServices.' },
    { name: 'modelName', type: 'string', default: 'ag/gemini-3.8-flash', description: 'Model identifier routed through the selected LLM service.' },
    { name: 'isAdminBuilder', type: 'boolean', default: 'false', description: 'Automatically forced to true if any ADMIN_BUILDER_TOOL_NAMES entry is enabled.' },
    { name: 'allowSubAgentDispatch', type: 'boolean', default: 'false', description: 'Enables sub-agent delegation tools (enabled only on dxos-coordinator).' },
    { name: 'allowedRoles', type: 'jsonb', default: '[ldx_employee, ldx_manager]', description: 'Business roles permitted to invoke this profile; locked to [root, admin] when isAdminBuilder=true.' },
    { name: 'toolPermissions', type: 'jsonb', default: '{}', description: 'Map of toolName to ALLOW, ASK (HITL), or OFF.' },
    { name: 'mcpServers', type: 'jsonb', default: '[]', description: 'Attached MCP server descriptors validated against SSRF via validateMcpServerUrl.' },
    { name: 'portalBindings', type: 'jsonb', default: '[]', description: 'Portal slugs (/p/<slug>) or [\'*\'] where this agent appears.' }
  ]"
/>

### Fail-Closed Role and Access Guards

| Guard Layer | Enforcement Behavior |
| :--- | :--- |
| Builder privilege lock (`enforceProfileRoleLock`) | Whenever `isAdminBuilder` is `true` or any of the 11 administrative builder tools is enabled in `toolPermissions`, `ai-sync.js` and the `latticeAiProfiles.beforeValidate` hook force `allowedRoles` to `['root', 'admin']`. |
| New-role isolation (`roles.afterCreate`) | When a new business role is created, `plugin-dxos-ai` immediately removes any auto-generated `rolesAiEmployees` bindings targeting profiles where `isAdminBuilder` is `true`. |
| Direct REST protection | Middleware `dxosAiProfileScope` blocks direct non-admin queries on `latticeAiProfiles` (including chart aggregation queries via `charts:queryData`) and scopes admin reads to `actor.organizationId`. |

## Complete Catalog of the 7 Agent Profiles

All 7 starter profiles (`STARTER_AI_BLUEPRINTS` in `ai-schemas.js`) are seeded and kept synchronized by `dxosAi:bootstrapDefaults`.

| # | `username` | Role & Scope | Portal Bindings | Allowed Roles (`allowedRoles`) | Sub-Agent & MCP |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `dxos-coordinator` | Central Multi-Agent Orchestrator (`enterprise-wide`) | `['*']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` | `allowSubAgentDispatch: true` · `dxos-it-ot-mcp` |
| 2 | `dxos-architect` | System & Block Architect (`platform-admin`) | `['*']` | `['root', 'admin']` (`isAdminBuilder: true`) | `dxos-it-ot-mcp` |
| 3 | `dxos-ops` | Cold-Chain & IoT Incident Engineer (`operations-itot`) | `['incidents', 'procurement']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse` | `dxos-it-ot-mcp` |
| 4 | `dxos-logistics` | 5-Step Cold-Chain Logistics Coordinator (`logistics-5step`) | `['logistics']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver` | `dxos-it-ot-mcp` |
| 5 | `dxos-workspace` | Internal Services, Procurement & P.A.R.A. Assistant (`workspace-para`) | `['services', 'procurement']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` | None |
| 6 | `dxos-operator` | IT/OT Operations Execution Specialist (`operations-execution`) | `['incidents', 'logistics', 'services']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_operator`, `ldx_dispatcher`, `ldx_warehouse` | `dxos-it-ot-mcp` |
| 7 | `dxos-analyst` | Cross-Department BI & GraphRAG Analyst (`analytics-bi`) | `['*']` | `root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_employee` | None |

### Tool Permission Matrix (`ALLOW` / `ASK`) Across All 7 Profiles

Tools marked `ALLOW` execute immediately after RBAC and tenant RLS verification. Tools marked `ASK` enqueue a human approval item in `latticeAiApprovalQueue` or require explicit user confirmation before execution.

| Profile (`username`) | `ALLOW` Tools | `ASK` Tools |
| :--- | :--- | :--- |
| `dxos-coordinator` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_graph_impact_analysis` *(plus `dispatch-sub-agent-task`, `list-ai-employees`, `get-ai-employee`)* | `dxos_execute_record_action`, `dxos_orchestrate_enterprise_case`, `dxos_alarm_action` |
| `dxos-architect` | `dxos_inspect_architecture`, `dxos_recommend_page_blueprint`, `dxos_design_creative_block`, `dxos_compose_page_blocks`, `dxos_snapshot_or_rollback_page`, `dxos_provision_role_workspace`, `dxos_manage_portal_and_acl`, `dxos_extend_collection_schema`, `dxos_manage_rbac_permissions`, `dxos_deploy_workflow`, `dxos_configure_workflow`, `dxos_search_enterprise_context`, `dxos_orchestrate_enterprise_case`, `dxos_graph_impact_analysis`, `dxos_memory_remember`, `dxos_memory_recall` | `dxos_memory_forget` |
| `dxos-ops` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_graph_impact_analysis` | `dxos_execute_record_action`, `dxos_orchestrate_enterprise_case`, `dxos_alarm_action` |
| `dxos-logistics` | `dxos_search_enterprise_context`, `dxos_orchestrate_enterprise_case`, `dxos_graph_impact_analysis` | `dxos_execute_record_action`, `dxos_my_workflow_tasks` |
| `dxos-workspace` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_graph_impact_analysis` | `dxos_execute_record_action`, `dxos_orchestrate_enterprise_case`, `dxos_alarm_action` |
| `dxos-operator` | `dxos_search_enterprise_context`, `dxos_my_workflow_tasks`, `dxos_memory_recall`, `dxos_memory_remember` | `dxos_execute_record_action`, `dxos_alarm_action` |
| `dxos-analyst` | `dxos_search_enterprise_context`, `dxos_graph_impact_analysis`, `dxos_orchestrate_enterprise_case`, `dxos_memory_recall` | — |

## Profile & LLM Management APIs

The `dxosAi` resource exposes dedicated actions for profile governance, portal discovery, and LLM health management.

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listProfiles"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Returns all tenant AI profiles, active organizations, and available tool catalog metadata."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:saveProfile"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Creates or updates an AI profile, enforces enforceProfileRoleLock, and syncs to aiEmployees."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:bootstrapDefaults"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Seeds or restores all 7 starter AI profiles and binds them to the active default LLM service."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:portalAgents"
  auth="Bearer JWT | ldx_pat_*"
  scope="loggedIn"
  summary="Lists enabled AI profiles visible to the caller's roles on the requested portalSlug."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosAi:quickConnectLlm"
  auth="Bearer JWT | ldx_pat_*"
  scope="admin"
  summary="Configures an LLM provider preset (OpenAI, Gemini, Anthropic, DeepSeek, Ollama, 9router) and rebinds starter agents."
/>

<CodeTabs :tabs="aiProfilesTabs" />

Additional LLM service actions include `GET /api/dxosAi:checkLlmHealth`, `GET /api/dxosAi:listLlmServices`, `POST /api/dxosAi:switchLlmServiceModel`, and `POST /api/dxosAi:deleteLlmService`. Deleting a bound LLM service automatically clears `llmService` and `modelName` references on affected `latticeAiProfiles` and `aiEmployees` records.

## Related

- [App Builder 2.0](/en/ai/app-builder)
- [Unified Tools Reference](/en/ai/unified-tools)
- [MCP Gateway](/en/ai/mcp-gateway)
- [Eval Lab & Guardrails](/en/ai/eval-and-guardrails)
