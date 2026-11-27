<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol } from 'vitepress';
import DiagramCanvas from './DiagramCanvas.vue';
import type {
  DiagramEdge,
  DiagramLocale,
  DiagramMode,
  DiagramNode,
  DiagramStep,
  DiagramZone,
} from './diagramTypes';

const props = defineProps<{ lang?: DiagramLocale }>();
const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const meta = computed(() =>
  resolvedLang.value === 'vi'
    ? {
        title: 'DX-OS AI Studio, Giao thức MCP/A2A & App Builder 2.0',
        caption:
          'Luồng suy luận ReAct tiếp nhận từ Chat/Flow, MCP Gateway và A2A Gateway qua cổng kiểm soát PII & Quota; nhánh ALLOW thực thi qua createAuditedTool cùng PG16 RLS và Advisory Memory, nhánh ASK đi qua hàng đợi HITL rồi đổ vào Audit & OTel (:4318). App Builder 2.0 rẽ 4 nhánh độc lập về phía phải từ Versioned App.',
      }
    : {
        title: 'DX-OS AI Studio, MCP/A2A Ingress & App Builder 2.0',
        caption:
          'Chat/LatticeFlow, MCP Gateway, and A2A Gateway converge through Profile/Quota/PII governance into the ReAct loop. ALLOW calls execute via createAuditedTool + PG16 RLS alongside Advisory Memory; ASK mutations pass through HITL approval before audited execution and OTel GenAI tracing (:4318). App Builder 2.0 branches strictly forward into 4 independent lifecycle actions.',
      },
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  // View 1: Governed Agent ReAct & MCP/A2A Ingress (Strict L->R)
  const reactZones: DiagramZone[] = [
    {
      id: 'ai-ingress',
      label: isVi ? 'Cổng Tiếp nhận (Ingress)' : 'Ingress Channels',
      x: 16,
      y: 16,
      width: 204,
      height: 384,
      kind: 'external',
    },
    {
      id: 'ai-governed',
      label: isVi
        ? 'Kiểm soát Quota/PII, Vòng lặp ReAct & Thực thi Có kiểm toán (PG16 RLS)'
        : 'Governance Gate, ReAct Loop & Audited Permission Split (PG16 RLS)',
      x: 244,
      y: 16,
      width: 908,
      height: 384,
      kind: 'admin',
    },
  ];

  const reactNodes: DiagramNode[] = [
    {
      id: 'chat_flow',
      title: isVi ? 'Chat & LatticeFlow' : 'Portal Chat & Flow',
      sub: ['SSE surfaceEvents', 'ai.agent / ai.llm'],
      icon: 'bot',
      x: 28,
      y: 56,
      width: 180,
      height: 74,
      zoneId: 'ai-ingress',
      inspector: isVi
        ? {
            role: 'Điểm vào hội thoại từ các cổng /p/* và node ai.agent / ai.llm trong LatticeFlow',
            packageOrPort: '@latticedx/plugin-dxos-ai · /api/aiConversations:sendMessages',
            protocol: 'OIDC Session / JWT · SSE surfaceEvents',
            payloadOrSchema: 'portalSlug, agentUsername (7 profiles), conversationId',
            responsibilities:
              'Ánh xạ vai trò người dùng sang 1 trong 7 hồ sơ Agent được phép hiển thị tại portal và phát luồng phản hồi SSE.',
          }
        : {
            role: 'Interactive portal chat (/p/*) and LatticeFlow ai.agent / ai.llm entrypoint',
            packageOrPort: '@latticedx/plugin-dxos-ai · /api/aiConversations:sendMessages',
            protocol: 'OIDC Session / JWT · SSE surfaceEvents',
            payloadOrSchema: 'portalSlug, agentUsername (7 profiles), conversationId',
            responsibilities:
              'Resolves caller RBAC roles against the 7 starter profiles bound to the active portal and streams ReAct turn updates over SSE.',
          },
    },
    {
      id: 'mcp_gateway',
      title: isVi ? 'Cổng MCP Gateway' : 'MCP Gateway',
      sub: ['/api/dxos-mcp', '/api/dxos-mcp/it-ot'],
      icon: 'plug',
      x: 28,
      y: 170,
      width: 180,
      height: 74,
      zoneId: 'ai-ingress',
      inspector: isVi
        ? {
            role: 'Máy chủ MCP Streamable HTTP phục vụ 20 Unified Tools và 4 IT/OT Tools',
            packageOrPort: 'mcp-gateway.js · mcp-itot-tools.js',
            protocol: 'MCP 2025-03-26 / 2024-11-05 · JSON-RPC 2.0',
            payloadOrSchema: 'initialize, tools/list, tools/call, prompts/list, resources/read',
            responsibilities:
              'Xác thực Bearer JWT hoặc ldx_pat_*, lọc bỏ công cụ adminOnly cho caller thường và định tuyến lời gọi vào lớp công cụ hợp nhất.',
          }
        : {
            role: 'Stateless Streamable HTTP MCP server for 20 Unified + 4 IT/OT tools',
            packageOrPort: 'mcp-gateway.js · mcp-itot-tools.js',
            protocol: 'MCP 2025-03-26 / 2024-11-05 · JSON-RPC 2.0',
            payloadOrSchema: 'initialize, tools/list, tools/call, prompts/list, resources/read',
            responsibilities:
              'Authenticates Bearer JWT or ldx_pat_* credentials, strips adminOnly tools for non-admin callers, and dispatches into the audited pool.',
          },
    },
    {
      id: 'a2a_gateway',
      title: isVi ? 'Cổng A2A Gateway' : 'A2A Gateway',
      sub: ['/.well-known/', 'agent-card.json'],
      icon: 'globe',
      x: 28,
      y: 284,
      width: 180,
      height: 74,
      zoneId: 'ai-ingress',
      inspector: isVi
        ? {
            role: 'Cổng Agent-to-Agent công bố Agent Card và quản lý vòng đời task JSON-RPC',
            packageOrPort: 'a2a-gateway.js · /api/dxos-a2a · latticeA2aTasks',
            protocol: 'HTTP Agent Card + JSON-RPC 2.0 (Bearer)',
            payloadOrSchema: 'GET /.well-known/agent-card.json -> tasks/send | get | cancel',
            responsibilities:
              'Cho phép tác nhân đối tác khám phá năng lực, gửi tác vụ A2A và lưu trạng thái cô lập tenant trong latticeA2aTasks (chặn CRUD trực tiếp).',
          }
        : {
            role: 'Agent-to-Agent discovery card and JSON-RPC task lifecycle gateway',
            packageOrPort: 'a2a-gateway.js · /api/dxos-a2a · latticeA2aTasks',
            protocol: 'HTTP Agent Card + JSON-RPC 2.0 (Bearer)',
            payloadOrSchema: 'GET /.well-known/agent-card.json -> tasks/send | get | cancel',
            responsibilities:
              'Serves the capability Agent Card and executes tasks/send, tasks/get, and tasks/cancel with tenant-isolated state in latticeA2aTasks.',
          },
    },
    {
      id: 'gov_gate',
      title: isVi ? 'Kiểm soát & PII' : 'Governance & PII',
      sub: ['7 Profiles · Quota', '9 PII Regex Guard'],
      icon: 'shield',
      x: 260,
      y: 170,
      width: 184,
      height: 74,
      zoneId: 'ai-governed',
      focal: true,
      inspector: isVi
        ? {
            role: 'Khóa vai trò hồ sơ, kiểm tra hạn mức bền vững và ẩn danh PII trước suy luận',
            packageOrPort: 'ai-schemas.js · ai-governance.js',
            protocol: 'enforceProfileRoleLock + checkAndConsumeAiQuotaPersistent',
            payloadOrSchema: '7 profiles | orgDailyCalls=5000 | userDailyCalls=500 | $50/d | 9 PII regex',
            responsibilities:
              'Khóa dxos-architect cho [root, admin], kiểm tra hạn mức gọi/token/chi phí theo ngày và che giấu JWT, sk-*, email, IBAN, CCCD, SĐT, MST.',
          }
        : {
            role: 'Profile RBAC lock, persistent quota enforcement, and 9-rule PII redaction gate',
            packageOrPort: 'ai-schemas.js · ai-governance.js',
            protocol: 'enforceProfileRoleLock + checkAndConsumeAiQuotaPersistent',
            payloadOrSchema: '7 profiles | orgDailyCalls=5000 | userDailyCalls=500 | $50/d | 9 PII regex',
            responsibilities:
              'Locks dxos-architect to [root, admin], enforces daily call/token/USD quotas, and masks JWTs, sk-* keys, emails, IBANs, CCCD, phone, and tax IDs.',
          },
    },
    {
      id: 'react_llm',
      title: isVi ? 'LLM & Vòng ReAct' : 'LLM & ReAct Loop',
      sub: ['ag/gemini-3.8-flash', 'maxTurns <= 12'],
      icon: 'cpu',
      x: 488,
      y: 170,
      width: 184,
      height: 74,
      zoneId: 'ai-governed',
      focal: true,
      inspector: isVi
        ? {
            role: 'Định tuyến suy luận LLM đa nhà cung cấp và vòng lặp ReAct giới hạn lượt',
            packageOrPort: 'local-9router / Quick-Connect · ai-llm-health.js',
            protocol: 'HTTPS (SSRF-checked) · OpenAI Chat Completions',
            payloadOrSchema: 'maxTurns: 5 (1..12) | 7 Quick-Connect presets',
            responsibilities:
              'Định tuyến lượt suy luận tới local-9router hoặc OpenAI/Gemini/Anthropic/DeepSeek/Ollama và phân nhánh lời gọi tool sang ALLOW hoặc ASK.',
          }
        : {
            role: 'Multi-provider LLM router and bounded Thought-Action-Observation ReAct loop',
            packageOrPort: 'local-9router / Quick-Connect · ai-llm-health.js',
            protocol: 'HTTPS (SSRF-checked) · OpenAI Chat Completions',
            payloadOrSchema: 'maxTurns: 5 (1..12) | 7 Quick-Connect presets',
            responsibilities:
              'Routes inference through configured LLM presets with SSRF protection and splits tool invocations into autonomous ALLOW vs HITL ASK paths.',
          },
    },
    {
      id: 'adv_mem',
      title: isVi ? 'Bộ nhớ Advisory' : 'Advisory Memory',
      sub: ['latticeAiMemory', 'advisory="true" · RLS'],
      icon: 'key',
      x: 724,
      y: 56,
      width: 196,
      height: 70,
      zoneId: 'ai-governed',
      inspector: isVi
        ? {
            role: 'Bộ nhớ dài hạn org/agent/user gắn rào chắn chống chèn prompt',
            packageOrPort: 'ai-memory.js · latticeAiMemory',
            protocol: 'remember / recall / forget · PG16 RLS',
            payloadOrSchema: '<dxos_memory_context advisory="true">...</dxos_memory_context>',
            responsibilities:
              'Đọc/ghi ngữ cảnh dài hạn cho nhánh công cụ ALLOW trong thẻ advisory="true" để LLM không xem ký ức lưu trữ như chỉ thị hệ thống tin cậy.',
          }
        : {
            role: 'Scoped persistent memory fenced against prompt injection',
            packageOrPort: 'ai-memory.js · latticeAiMemory',
            protocol: 'remember / recall / forget · PG16 RLS',
            payloadOrSchema: '<dxos_memory_context advisory="true">...</dxos_memory_context>',
            responsibilities:
              'Supplies recallMemories and buildMemoryContextPrompt to ALLOW tools wrapped in untrusted advisory="true" delimiters inside tenant RLS.',
          },
    },
    {
      id: 'allow_tools',
      title: isVi ? 'ALLOW: Công cụ RLS' : 'ALLOW: Audited Tools',
      sub: ['createAuditedTool', 'PG16 RLS · 20+4 Tools'],
      icon: 'box',
      x: 724,
      y: 170,
      width: 196,
      height: 74,
      zoneId: 'ai-governed',
      focal: true,
      tone: 'accent',
      inspector: isVi
        ? {
            role: 'Thực thi tức thời 20 công cụ hợp nhất + 4 công cụ IT/OT trong giao dịch PG16 RLS',
            packageOrPort: 'ai-tools-core.js · mcp-itot-tools.js',
            protocol: 'createAuditedTool() · SET LOCAL app.current_org',
            payloadOrSchema: '20 Unified Tools + 4 IT/OT MCP Tools (ALLOW tier)',
            responsibilities:
              'Kiểm tra tham số JSON Schema, thực thi truy vấn/hành động trong ngữ cảnh cô lập app.current_org, trao đổi Advisory Memory và ghi vết kiểm toán.',
          }
        : {
            role: 'Autonomous execution of 20 Unified + 4 IT/OT MCP tools inside PG16 FORCE RLS',
            packageOrPort: 'ai-tools-core.js · mcp-itot-tools.js',
            protocol: 'createAuditedTool() · SET LOCAL app.current_org',
            payloadOrSchema: '20 Unified Tools + 4 IT/OT MCP Tools (ALLOW tier)',
            responsibilities:
              'Validates JSON Schemas, executes inside app.current_org RLS transactions, exchanges context with Advisory Memory, and emits audit events.',
          },
    },
    {
      id: 'ask_queue',
      title: isVi ? 'ASK: Hàng đợi HITL' : 'ASK: Approval Queue',
      sub: ['latticeAiApprovalQueue', 'Human-in-the-Loop'],
      icon: 'lock',
      x: 724,
      y: 288,
      width: 196,
      height: 74,
      zoneId: 'ai-governed',
      inspector: isVi
        ? {
            role: 'Hàng đợi tạm giữ các thao tác thay đổi trạng thái thuộc nhóm ASK',
            packageOrPort: 'ai-hitl-executors.js · latticeAiApprovalQueue',
            protocol: 'Human-in-the-Loop · Tenant RLS',
            payloadOrSchema: 'dxos_execute_record_action | dxos_alarm_action | dxos_memory_forget',
            responsibilities:
              'Ngăn agent tự ý sửa bản ghi hoặc kích hoạt cảnh báo IIoT; tạo yêu cầu chờ người vận hành có thẩm quyền xem xét.',
          }
        : {
            role: 'Pending human-in-the-loop queue for mutating ASK-tier tool calls',
            packageOrPort: 'ai-hitl-executors.js · latticeAiApprovalQueue',
            protocol: 'Human-in-the-Loop · Tenant RLS',
            payloadOrSchema: 'dxos_execute_record_action | dxos_alarm_action | dxos_memory_forget',
            responsibilities:
              'Suspends mutating record actions, IIoT alarm overrides, and memory deletions in latticeAiApprovalQueue until an authorized operator decides.',
          },
    },
    {
      id: 'audit_otel',
      title: 'Audit & OTel GenAI',
      sub: ['latticeAiAuditLogs', 'latticeAiTraces :4318'],
      icon: 'database',
      x: 964,
      y: 170,
      width: 176,
      height: 74,
      zoneId: 'ai-governed',
      tone: 'flow',
      inspector: isVi
        ? {
            role: 'Kho nhật ký kiểm toán đã lọc PII và dấu vết OTel GenAI Waterfall',
            packageOrPort: 'PG16 · latticeAiAuditLogs / Traces · otel-collector:4318',
            protocol: 'SQL FORCE RLS · OTLP HTTP :4318',
            payloadOrSchema: 'latticeAiAuditLogs, latticeAiTraces, latticeAiQuotaUsage',
            responsibilities:
              'Ghi nhận mọi lượt gọi từ nhánh ALLOW lẫn quyết định approveAction/rejectAction sau khi redact PII, kèm chi phí token và độ trễ span.',
          }
        : {
            role: 'PII-redacted PG16 audit ledger and OTel GenAI waterfall telemetry',
            packageOrPort: 'PG16 · latticeAiAuditLogs / Traces · otel-collector:4318',
            protocol: 'SQL FORCE RLS · OTLP HTTP :4318',
            payloadOrSchema: 'latticeAiAuditLogs, latticeAiTraces, latticeAiQuotaUsage',
            responsibilities:
              'Persists PII-scrubbed audit records and OTel GenAI spans from both ALLOW executions and HITL approveAction/rejectAction decisions.',
          },
    },
    {
      id: 'hitl_decide',
      title: isVi ? 'Duyệt / Từ chối' : 'HITL Decide',
      sub: [':approveAction', ':rejectAction'],
      icon: 'check-circle',
      x: 964,
      y: 288,
      width: 176,
      height: 74,
      zoneId: 'ai-governed',
      inspector: isVi
        ? {
            role: 'Xác nhận quyết định HITL và thực thi qua createAuditedTool nếu được duyệt',
            packageOrPort: 'POST /api/dxosAi:approveAction | :rejectAction',
            protocol: 'RBAC Check -> createAuditedTool() + Audit',
            payloadOrSchema: 'Strips PROTECTED_SERVER_FIELDS · approved | rejected',
            responsibilities:
              'Khi duyệt, lọc bỏ PROTECTED_SERVER_FIELDS, chạy hành động qua createAuditedTool trong vùng RLS và ghi kết quả vào Audit & OTel.',
          }
        : {
            role: 'Commits operator decision and runs createAuditedTool on approval',
            packageOrPort: 'POST /api/dxosAi:approveAction | :rejectAction',
            protocol: 'RBAC Check -> createAuditedTool() + Audit',
            payloadOrSchema: 'Strips PROTECTED_SERVER_FIELDS · approved | rejected',
            responsibilities:
              'On approval, strips PROTECTED_SERVER_FIELDS, executes via createAuditedTool under tenant RLS, and emits Audit & OTel traces.',
          },
    },
  ];

  const reactEdges: DiagramEdge[] = [
    {
      id: 'e1',
      from: 'chat_flow',
      to: 'gov_gate',
      kind: 'flow',
      points: [
        [208, 93],
        [234, 93],
        [234, 191],
        [260, 191],
      ],
    },
    {
      id: 'e2',
      from: 'mcp_gateway',
      to: 'gov_gate',
      kind: 'primary',
      points: [
        [208, 207],
        [260, 207],
      ],
    },
    {
      id: 'e3',
      from: 'a2a_gateway',
      to: 'gov_gate',
      kind: 'flow',
      points: [
        [208, 321],
        [234, 321],
        [234, 223],
        [260, 223],
      ],
    },
    {
      id: 'e4',
      from: 'gov_gate',
      to: 'react_llm',
      kind: 'primary',
      points: [
        [444, 207],
        [488, 207],
      ],
    },
    {
      id: 'e5',
      from: 'react_llm',
      to: 'allow_tools',
      label: 'ALLOW',
      kind: 'primary',
      points: [
        [672, 207],
        [724, 207],
      ],
    },
    {
      id: 'e6a',
      from: 'allow_tools',
      to: 'adv_mem',
      label: 'Write',
      kind: 'flow',
      points: [
        [782, 170],
        [782, 126],
      ],
    },
    {
      id: 'e6b',
      from: 'adv_mem',
      to: 'allow_tools',
      label: 'Advisory',
      kind: 'dashed',
      points: [
        [862, 126],
        [862, 170],
      ],
    },
    {
      id: 'e7',
      from: 'react_llm',
      to: 'ask_queue',
      label: 'ASK',
      kind: 'primary',
      labelPosition: 0.55,
      points: [
        [672, 225],
        [696, 225],
        [696, 325],
        [724, 325],
      ],
    },
    {
      id: 'e8',
      from: 'ask_queue',
      to: 'hitl_decide',
      kind: 'primary',
      points: [
        [920, 325],
        [964, 325],
      ],
    },
    {
      id: 'e9',
      from: 'allow_tools',
      to: 'audit_otel',
      kind: 'flow',
      points: [
        [920, 207],
        [964, 207],
      ],
    },
    {
      id: 'e10',
      from: 'hitl_decide',
      to: 'audit_otel',
      label: 'Audited',
      kind: 'primary',
      points: [
        [1052, 288],
        [1052, 244],
      ],
    },
  ];

  const reactSteps: DiagramStep[] = [
    {
      id: 'react-s1',
      title: isVi ? '1. Tiếp nhận & Kiểm soát Quota/PII' : '1. Ingress & Quota/PII Gate',
      activeNodes: ['chat_flow', 'mcp_gateway', 'a2a_gateway', 'gov_gate'],
      activeEdges: ['e1', 'e2', 'e3'],
      description: isVi
        ? 'Portal Chat/Flow, MCP Gateway và A2A Gateway hội tụ vào cổng kiểm soát 7 hồ sơ, khóa quyền admin, kiểm quota và ẩn danh 9 mẫu PII.'
        : 'Portal Chat/Flow, MCP Gateway, and A2A Gateway converge through profile RBAC locking, daily quota checks, and 9-rule PII redaction.',
      route: '/api/aiConversations:sendMessages | /api/dxos-mcp | /api/dxos-a2a',
      payload: 'orgDailyCalls <= 5000 · redactPiiText()',
      chips: ['7 Profiles', '9 PII Regex'],
    },
    {
      id: 'react-s2',
      title: isVi ? '2. Suy luận LLM & Vòng ReAct' : '2. LLM Router & ReAct Loop',
      activeNodes: ['gov_gate', 'react_llm'],
      activeEdges: ['e4'],
      description: isVi
        ? 'LLM Router thực hiện suy luận trong vòng lặp ReAct (maxTurns <= 12) và phân loại lời gọi công cụ theo quyền ALLOW hoặc ASK.'
        : 'The LLM Router runs bounded Thought-Action-Observation turns (maxTurns <= 12) and classifies tool calls as ALLOW or ASK.',
      route: 'GET /api/dxosAi:surfaceEvents',
      payload: 'ag/gemini-3.8-flash · maxTurns <= 12',
      chips: ['local-9router', 'maxTurns <= 12'],
    },
    {
      id: 'react-s3',
      title: isVi ? '3. Nhánh ALLOW <-> Bộ nhớ Advisory' : '3. ALLOW Tools <-> Advisory Memory',
      activeNodes: ['react_llm', 'allow_tools', 'adv_mem', 'audit_otel'],
      activeEdges: ['e5', 'e6a', 'e6b', 'e9'],
      description: isVi
        ? 'Công cụ ALLOW chạy qua createAuditedTool trong PG16 RLS, trao đổi ngữ cảnh gắn thẻ advisory="true" với latticeAiMemory và ghi Audit/OTel.'
        : 'ALLOW tools execute via createAuditedTool inside PG16 RLS, exchange advisory-fenced context with latticeAiMemory, and emit Audit/OTel.',
      route: 'createAuditedTool() <-> latticeAiMemory',
      payload: 'SET LOCAL app.current_org · <dxos_memory_context advisory="true">',
      chips: ['20+4 Tools', 'PG16 RLS'],
    },
    {
      id: 'react-s4',
      title: isVi ? '4. Nhánh ASK -> HITL -> Audit/OTel' : '4. ASK Queue -> HITL Decide -> Audit',
      activeNodes: ['react_llm', 'ask_queue', 'hitl_decide', 'audit_otel'],
      activeEdges: ['e7', 'e8', 'e10'],
      description: isVi
        ? 'Thao tác ghi thuộc nhóm ASK chờ trong latticeAiApprovalQueue; khi được :approveAction xác nhận, lệnh chạy có kiểm toán và ghi OTel (:4318).'
        : 'ASK mutations wait in latticeAiApprovalQueue; upon :approveAction confirmation, execution runs audited under RLS and logs to OTel (:4318).',
      route: 'POST /api/dxosAi:approveAction | :rejectAction',
      payload: 'latticeAiApprovalQueue -> latticeAiAuditLogs & Traces',
      chips: ['HITL Gate', 'OTel :4318'],
    },
  ];

  // View 2: App Builder 2.0 Lifecycle (Strict L->R Tree, ZERO backwards fan-out)
  const builderZones: DiagramZone[] = [
    {
      id: 'ab-pipeline',
      label: isVi ? '1–3 · Quy trình Khởi tạo & Tự sửa Lỗi (App Builder 2.0)' : '1–3 · Provisioning & Self-Heal Pipeline (App Builder 2.0)',
      x: 16,
      y: 16,
      width: 880,
      height: 348,
      kind: 'admin',
    },
    {
      id: 'ab-branches',
      label: isVi ? '4 Nhánh Độc lập (Từ Versioned App)' : '4 Independent Branches',
      x: 920,
      y: 16,
      width: 240,
      height: 348,
      kind: 'traffic',
    },
  ];

  const builderNodes: DiagramNode[] = [
    {
      id: 'architect',
      title: 'dxos-architect',
      sub: ['Admin Lock (root|admin)', 'App Builder 2.0 Entry'],
      icon: 'bot',
      x: 28,
      y: 166,
      width: 186,
      height: 76,
      zoneId: 'ab-pipeline',
      focal: true,
      inspector: isVi
        ? {
            role: 'Hồ sơ kiến trúc sư hệ thống khóa cứng cho vai trò root và admin',
            packageOrPort: 'ai-schemas.js · ai-surface-creative-tools.js',
            protocol: 'Admin Lock · dxos_provision_role_workspace',
            payloadOrSchema: 'allowedRoles: [root, admin] · 16 ALLOW + 1 ASK tools',
            responsibilities:
              'Tiếp nhận prompt mô tả nghiệp vụ hoặc spec JSON và điều phối chu trình Plan -> Build -> Versioned App.',
          }
        : {
            role: 'Admin-locked system architect profile (root & admin only)',
            packageOrPort: 'ai-schemas.js · ai-surface-creative-tools.js',
            protocol: 'Admin Lock · dxos_provision_role_workspace',
            payloadOrSchema: 'allowedRoles: [root, admin] · 16 ALLOW + 1 ASK tools',
            responsibilities:
              'Accepts natural-language specs or structured blueprints and drives the Plan -> Build -> Versioned App workflow.',
          },
    },
    {
      id: 'plan_app',
      title: '1. Plan & ER Diff',
      sub: ['POST :planBuiltApp', 'Kahn Sort · Zero DB'],
      icon: 'git-branch',
      x: 248,
      y: 166,
      width: 186,
      height: 76,
      zoneId: 'ab-pipeline',
      focal: true,
      inspector: isVi
        ? {
            role: 'Lập kế hoạch ER theo thuật toán Kahn và xem trước Diff không ghi DB',
            packageOrPort: 'app-builder-planner.js · dxosAi:planBuiltApp',
            protocol: 'HTTPS POST · Dry-Run (Zero DB Writes)',
            payloadOrSchema: 'buildErGraph (Kahn topo sort) + computeSpecDiff',
            responsibilities:
              'Sắp xếp thứ tự phụ thuộc bảng/khóa ngoại bằng thuật toán Kahn và tính toán ER Diff trước khi cấp phát tài nguyên.',
          }
        : {
            role: 'Zero-write Kahn topological ER planner and spec diff',
            packageOrPort: 'app-builder-planner.js · dxosAi:planBuiltApp',
            protocol: 'HTTPS POST · Dry-Run (Zero DB Writes)',
            payloadOrSchema: 'buildErGraph (Kahn topo sort) + computeSpecDiff',
            responsibilities:
              'Orders table and relation dependencies via Kahn topological sort and computes ER diffs without touching the database.',
          },
    },
    {
      id: 'build_app',
      title: '2. Build & Self-Heal',
      sub: ['POST :buildBuiltApp', '<= 2 heal · 12 Blocks'],
      icon: 'layers',
      x: 468,
      y: 166,
      width: 188,
      height: 76,
      zoneId: 'ab-pipeline',
      focal: true,
      inspector: isVi
        ? {
            role: 'Dựng bảng FORCE RLS, 12 BlockModels, DMN/Flow và tự sửa tối đa 2 vòng',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:buildBuiltApp',
            protocol: 'PG Transaction · Up to 2 Self-Heal Rounds',
            payloadOrSchema: 'latticeCustom* + FORCE RLS + 12 BlockModels + Flow/DMN',
            responsibilities:
              'Chụp snapshot portal, tạo bảng tùy biến có FORCE RLS, gắn 12 Native BlockModels, triển khai DMN/Flow và tự sửa lỗi tối đa 2 vòng.',
          }
        : {
            role: 'Full-stack provisioner with up to 2 targeted self-heal rounds',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:buildBuiltApp',
            protocol: 'PG Transaction · Up to 2 Self-Heal Rounds',
            payloadOrSchema: 'latticeCustom* + FORCE RLS + 12 BlockModels + Flow/DMN',
            responsibilities:
              'Captures portal snapshots, creates FORCE RLS custom collections, mounts 12 Native BlockModels, deploys Flow/DMN, and self-heals up to 2 rounds.',
          },
    },
    {
      id: 'ver_app',
      title: 'Versioned App',
      sub: ['latticeBuiltApps', 'latticeUiSnapshots'],
      icon: 'check-circle',
      x: 690,
      y: 166,
      width: 190,
      height: 76,
      zoneId: 'ab-pipeline',
      focal: true,
      tone: 'accent',
      inspector: isVi
        ? {
            role: 'Ứng dụng đã kiểm chứng kèm lịch sử phiên bản và snapshot giao diện',
            packageOrPort: 'PG16 · latticeBuiltApps / Versions / UiSnapshots',
            protocol: 'verifyEnterpriseApp · FORCE RLS',
            payloadOrSchema: 'latticeBuiltApps + latticeBuiltAppVersions + latticeUiSnapshots',
            responsibilities:
              'Trạng thái gốc để rẽ độc lập về phía phải sang Patch Spec (v2+), Snapshot Rollback, Export Bundle v3 hoặc Safe Teardown.',
          }
        : {
            role: 'Verified application state with version ledger and UI snapshots',
            packageOrPort: 'PG16 · latticeBuiltApps / Versions / UiSnapshots',
            protocol: 'verifyEnterpriseApp · FORCE RLS',
            payloadOrSchema: 'latticeBuiltApps + latticeBuiltAppVersions + latticeUiSnapshots',
            responsibilities:
              'Verified baseline branching cleanly to Patch Spec (v2+), Snapshot Rollback, Export Bundle v3, or Safe Teardown.',
          },
    },
    {
      id: 'patch_app',
      title: 'Patch Spec (v2+)',
      sub: 'POST :patchBuiltApp',
      icon: 'terminal',
      x: 936,
      y: 52,
      width: 208,
      height: 64,
      zoneId: 'ab-branches',
      inspector: isVi
        ? {
            role: 'Cập nhật tăng dần trường, block và quy trình trên Versioned App',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:patchBuiltApp',
            protocol: 'HTTPS POST · Incremental Spec Diff',
            payloadOrSchema: 'applySpecPatch + latticeBuiltAppVersions++',
            responsibilities:
              'Áp dụng bổ sung collection, block hoặc rule mới không phá hủy dữ liệu cũ và tăng số phiên bản.',
          }
        : {
            role: 'Non-destructive incremental specification patcher',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:patchBuiltApp',
            protocol: 'HTTPS POST · Incremental Spec Diff',
            payloadOrSchema: 'applySpecPatch + latticeBuiltAppVersions++',
            responsibilities:
              'Applies incremental field, block, and workflow changes to a Versioned App while recording a new version entry.',
          },
    },
    {
      id: 'rollback_app',
      title: isVi ? 'Rollback Snapshot' : 'Snapshot Rollback',
      sub: 'POST :rollbackBuiltApp',
      icon: 'activity',
      x: 936,
      y: 130,
      width: 208,
      height: 64,
      zoneId: 'ab-branches',
      inspector: isVi
        ? {
            role: 'Khôi phục bố cục portal, block và quyền về targetVersion trong snapshot',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:rollbackBuiltApp',
            protocol: 'HTTPS POST · Snapshot Restore',
            payloadOrSchema: '{ builtAppId, targetVersion } -> latticeUiSnapshots',
            responsibilities:
              'Phục hồi toàn bộ UI portal, cấu hình FlowEngine block và gán vai trò về đúng snapshot đã lưu.',
          }
        : {
            role: 'Snapshot-backed version rollback engine',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:rollbackBuiltApp',
            protocol: 'HTTPS POST · Snapshot Restore',
            payloadOrSchema: '{ builtAppId, targetVersion } -> latticeUiSnapshots',
            responsibilities:
              'Restores portal layouts, block configurations, role bindings, and app specifications cleanly to a recorded targetVersion.',
          },
    },
    {
      id: 'bundle_export',
      title: isVi ? 'Xuất Bundle v3' : 'Export Bundle v3',
      sub: 'POST :exportBuiltAppBundle',
      icon: 'box',
      x: 936,
      y: 208,
      width: 208,
      height: 64,
      zoneId: 'ab-branches',
      inspector: isVi
        ? {
            role: 'Xuất gói Solution Bundle v3 chuẩn GitOps có kiểm tra băm SHA-256',
            packageOrPort: 'solution-bundle.js · dxosAi:exportBuiltAppBundle',
            protocol: 'JSON · SHA-256 contentSha256',
            payloadOrSchema: 'latticedx.solution-bundle/v3 (8 top-level keys)',
            responsibilities:
              'Đóng gói roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks và governance để đẩy lên Git.',
          }
        : {
            role: 'Exports provisioned apps as GitOps Solution Bundle v3',
            packageOrPort: 'solution-bundle.js · dxosAi:exportBuiltAppBundle',
            protocol: 'JSON · SHA-256 contentSha256',
            payloadOrSchema: 'latticedx.solution-bundle/v3 (8 top-level keys)',
            responsibilities:
              'Serializes roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks, and governance with SHA-256 digest.',
          },
    },
    {
      id: 'teardown_app',
      title: 'Safe Teardown',
      sub: ['POST :teardownBuiltApp', 'keepData = true'],
      icon: 'shield',
      x: 936,
      y: 286,
      width: 208,
      height: 64,
      zoneId: 'ab-branches',
      dashed: true,
      inspector: isVi
        ? {
            role: 'Tháo dỡ an toàn có bảo vệ bảng dùng chung và vai trò hệ thống',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:teardownBuiltApp',
            protocol: 'Cross-Org Audit · keepData=true default',
            payloadOrSchema: 'keepData: true | BUILTIN_PROTECTED_ROLES guard',
            responsibilities:
              'Mặc định giữ lại dữ liệu (keepData=true) và quét liên tổ chức để không bao giờ xóa bảng hoặc vai trò đang dùng chung.',
          }
        : {
            role: 'Cross-org safe teardown preserving shared data and built-in roles',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:teardownBuiltApp',
            protocol: 'Cross-Org Audit · keepData=true default',
            payloadOrSchema: 'keepData: true | BUILTIN_PROTECTED_ROLES guard',
            responsibilities:
              'Defaults keepData=true and checks cross-org dependencies so shared collections, portals, or built-in roles are never dropped.',
          },
    },
  ];

  const builderEdges: DiagramEdge[] = [
    {
      id: 'b1',
      from: 'architect',
      to: 'plan_app',
      kind: 'primary',
      points: [
        [214, 204],
        [248, 204],
      ],
    },
    {
      id: 'b2',
      from: 'plan_app',
      to: 'build_app',
      kind: 'primary',
      points: [
        [434, 204],
        [468, 204],
      ],
    },
    {
      id: 'b3',
      from: 'build_app',
      to: 'ver_app',
      kind: 'primary',
      points: [
        [656, 204],
        [690, 204],
      ],
    },
    {
      id: 'b4',
      from: 'ver_app',
      to: 'patch_app',
      kind: 'flow',
      points: [
        [880, 188],
        [908, 188],
        [908, 84],
        [936, 84],
      ],
    },
    {
      id: 'b5',
      from: 'ver_app',
      to: 'rollback_app',
      kind: 'flow',
      points: [
        [880, 198],
        [908, 198],
        [908, 162],
        [936, 162],
      ],
    },
    {
      id: 'b6',
      from: 'ver_app',
      to: 'bundle_export',
      kind: 'primary',
      points: [
        [880, 210],
        [908, 210],
        [908, 240],
        [936, 240],
      ],
    },
    {
      id: 'b7',
      from: 'ver_app',
      to: 'teardown_app',
      kind: 'dashed',
      points: [
        [880, 220],
        [908, 220],
        [908, 318],
        [936, 318],
      ],
    },
  ];

  const builderSteps: DiagramStep[] = [
    {
      id: 'ab-s1',
      title: isVi ? '1. Plan không ghi DB (ER Diff)' : '1. Plan & ER Diff (Zero DB)',
      activeNodes: ['architect', 'plan_app'],
      activeEdges: ['b1'],
      description: isVi
        ? 'dxos-architect gọi :planBuiltApp để dựng đồ thị ER bằng thuật toán Kahn và tính toán ER Diff mà chưa ghi cơ sở dữ liệu.'
        : 'dxos-architect invokes :planBuiltApp to compute a Kahn-sorted ER graph and structural diff with zero database writes.',
      route: 'POST /api/dxosAi:planBuiltApp',
      payload: 'buildErGraph() + computeSpecDiff()',
      chips: ['Admin Lock', 'Kahn Sort'],
    },
    {
      id: 'ab-s2',
      title: isVi ? '2. Build, Self-Heal & Versioned App' : '2. Build, Self-Heal & Versioned App',
      activeNodes: ['plan_app', 'build_app', 'ver_app'],
      activeEdges: ['b2', 'b3'],
      description: isVi
        ? ':buildBuiltApp tạo bảng FORCE RLS, 12 BlockModels, DMN/Flow, tự sửa tối đa 2 vòng và lưu Versioned App kèm UI snapshot.'
        : ':buildBuiltApp provisions FORCE RLS collections, 12 BlockModels, and DMN/Flow, runs <= 2 self-heal rounds, and commits Versioned App + snapshots.',
      route: 'POST /api/dxosAi:buildBuiltApp',
      payload: 'DEFAULT_SELF_HEAL_MAX_ROUNDS = 2 -> latticeBuiltApps',
      chips: ['<= 2 Self-Heal', 'FORCE RLS'],
    },
    {
      id: 'ab-s3',
      title: isVi ? '3. 4 Nhánh Độc lập về Phía Phải' : '3. 4 Independent Rightward Branches',
      activeNodes: ['ver_app', 'patch_app', 'rollback_app', 'bundle_export', 'teardown_app'],
      activeEdges: ['b4', 'b5', 'b6', 'b7'],
      description: isVi
        ? 'Từ Versioned App, quản trị viên rẽ độc lập sang Patch Spec (v2+), Snapshot Rollback, Export Bundle v3 hoặc Safe Teardown (keepData=true).'
        : 'From Versioned App, operators independently branch forward to Patch Spec (v2+), Snapshot Rollback, Export Bundle v3, or Safe Teardown (keepData=true).',
      route: 'POST :patchBuiltApp | :rollbackBuiltApp | :exportBuiltAppBundle | :teardownBuiltApp',
      payload: 'latticeBuiltAppVersions | latticeUiSnapshots | keepData: true',
      chips: ['Bundle v3', 'keepData=true'],
    },
  ];

  return [
    {
      id: 'react-mcp-a2a',
      label: isVi ? 'ReAct & MCP/A2A' : 'ReAct & MCP/A2A',
      viewBox: '0 0 1168 416',
      zones: reactZones,
      nodes: reactNodes,
      edges: reactEdges,
      steps: reactSteps,
    },
    {
      id: 'app-builder',
      label: 'App Builder 2.0',
      viewBox: '0 0 1176 380',
      zones: builderZones,
      nodes: builderNodes,
      edges: builderEdges,
      steps: builderSteps,
    },
  ];
});
</script>

<template>
  <DiagramCanvas
    :title="meta.title"
    :caption="meta.caption"
    viewBox="0 0 1168 416"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
