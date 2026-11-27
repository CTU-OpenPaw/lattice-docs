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
        title: 'Vòng đời DX-OS AI Studio, App Builder 2.0 & MCP/A2A',
        caption:
          'Luồng ReAct phân nhánh ALLOW (createAuditedTool <-> Advisory Memory) và ASK (HITL Queue -> approveAction / rejectAction -> createAuditedTool) cùng đổ về Audit/OTel; App Builder 2.0 rẽ nhánh độc lập từ Versioned App.',
      }
    : {
        title: 'DX-OS AI Studio, App Builder 2.0 & MCP/A2A Lifecycle',
        caption:
          'ReAct branches into ALLOW tools (createAuditedTool <-> Advisory Memory) and ASK mutations (HITL Queue -> approveAction / rejectAction -> createAuditedTool), both emitting to Audit/OTel; App Builder 2.0 branches independently from Versioned App.',
      },
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const reactZones: DiagramZone[] = [
    {
      id: 'ai-control',
      label: isVi ? 'Điều phối Hồ sơ, Bảo vệ PII, LLM & Audit/OTel' : 'Profile Control, PII Guard, LLM & Audit/OTel',
      x: 16,
      y: 16,
      width: 1056,
      height: 120,
      kind: 'admin',
    },
    {
      id: 'ai-react',
      label: isVi ? 'Vòng lặp ReAct: Nhánh ALLOW <-> Memory & Nhánh ASK -> HITL' : 'ReAct Loop: ALLOW <-> Memory & ASK -> HITL Branches',
      x: 16,
      y: 152,
      width: 1056,
      height: 236,
      kind: 'traffic',
    },
  ];

  const reactNodes: DiagramNode[] = [
    {
      id: 'profiles',
      title: isVi ? '7 Hồ sơ Agent' : '7 Agent Profiles',
      sub: 'dxos-* · 7 profiles',
      icon: 'bot',
      x: 32,
      y: 52,
      width: 184,
      height: 60,
      zoneId: 'ai-control',
      focal: true,
      inspector: isVi
        ? {
            role: 'Danh mục 7 Agent chuyên trách theo cổng và vai trò',
            packageOrPort: '@latticedx/plugin-dxos-ai · ai-schemas.js',
            protocol: 'RBAC Portal Binding · SSE / JSON',
            payloadOrSchema: 'dxos-coordinator, dxos-architect, dxos-ops, dxos-logistics, dxos-workspace, dxos-operator, dxos-analyst',
            responsibilities:
              'Đồng bộ từ STARTER_AI_BLUEPRINTS; hàm enforceProfileRoleLock khóa cứng allowedRoles=[root, admin] khi bật bất kỳ công cụ xây dựng hệ thống nào.',
          }
        : {
            role: '7 role-bound enterprise agent profiles',
            packageOrPort: '@latticedx/plugin-dxos-ai · ai-schemas.js',
            protocol: 'RBAC Portal Binding · SSE / JSON',
            payloadOrSchema: 'dxos-coordinator, dxos-architect, dxos-ops, dxos-logistics, dxos-workspace, dxos-operator, dxos-analyst',
            responsibilities:
              'Synced from STARTER_AI_BLUEPRINTS; enforceProfileRoleLock forces allowedRoles to [root, admin] whenever any admin builder tool is enabled.',
          },
    },
    {
      id: 'guardrails',
      title: isVi ? 'Cổng PII & Quota' : 'PII & Quota Gate',
      sub: '9 regex · 5k calls/d',
      icon: 'shield',
      x: 308,
      y: 52,
      width: 196,
      height: 60,
      zoneId: 'ai-control',
      inspector: isVi
        ? {
            role: 'Kiểm soát hạn mức token/chi phí và ẩn danh PII',
            packageOrPort: '@latticedx/plugin-dxos-ai · ai-governance.js',
            protocol: 'In-process Guard · PG16 RLS',
            payloadOrSchema: 'orgDailyCalls=5000 | userDailyCalls=500 | orgDailyTokens=5M | orgDailyUsd=$50',
            responsibilities:
              'Kiểm tra hạn mức bền vững trước mỗi lượt gọi tool và áp dụng 9 quy tắc redactPiiText (JWT, sk-*, email, IBAN, CCCD, SĐT VN, MST) trước khi ghi log.',
          }
        : {
            role: 'Persistent quota enforcement and PII redaction gate',
            packageOrPort: '@latticedx/plugin-dxos-ai · ai-governance.js',
            protocol: 'In-process Guard · PG16 RLS',
            payloadOrSchema: 'orgDailyCalls=5000 | userDailyCalls=500 | orgDailyTokens=5M | orgDailyUsd=$50',
            responsibilities:
              'Enforces checkAndConsumeAiQuotaPersistent per org/user and masks secrets, JWTs, emails, IBANs, CCCD, phone numbers, and tax IDs via 9 redactPiiText rules.',
          },
    },
    {
      id: 'llm_router',
      title: isVi ? 'Định tuyến LLM' : 'LLM Router',
      sub: 'ag/gemini-3.8-flash',
      icon: 'cpu',
      x: 596,
      y: 52,
      width: 196,
      height: 60,
      zoneId: 'ai-control',
      inspector: isVi
        ? {
            role: 'Tầng trừu tượng hóa mô hình ngôn ngữ đa nhà cung cấp',
            packageOrPort: 'local-9router · OPENAI_COMPATIBLE',
            protocol: 'HTTPS · OpenAI Chat Completions',
            payloadOrSchema: 'ag/gemini-3.8-flash ($0.15/$0.60), gemini-2.5-pro, gpt-4o, claude-sonnet-4, ollama',
            responsibilities:
              'Định tuyến yêu cầu suy luận tới mô hình mặc định hoặc cấu hình theo biến môi trường, đồng thời tính chi phí đầu vào/đầu ra theo từng triệu token.',
          }
        : {
            role: 'Multi-provider LLM inference abstraction layer',
            packageOrPort: 'local-9router · OPENAI_COMPATIBLE',
            protocol: 'HTTPS · OpenAI Chat Completions',
            payloadOrSchema: 'ag/gemini-3.8-flash ($0.15/$0.60), gemini-2.5-pro, gpt-4o, claude-sonnet-4, ollama',
            responsibilities:
              'Routes reasoning turns to the configured model service and meters input/output token consumption against MODEL_PRICING_USD_PER_1M.',
          },
    },
    {
      id: 'audit_ledger',
      title: isVi ? 'Audit & OTel Traces' : 'Audit & OTel Traces',
      sub: 'latticeAiAuditLogs',
      icon: 'database',
      x: 868,
      y: 52,
      width: 188,
      height: 60,
      zoneId: 'ai-control',
      inspector: isVi
        ? {
            role: 'Lưu vết kiểm toán bất biến và OTel GenAI Waterfall',
            packageOrPort: 'PG16 · latticeAiAuditLogs / Traces',
            protocol: 'SQL Transaction · OTLP HTTP :4318',
            payloadOrSchema: 'latticeAiAuditLogs, latticeAiTraces, latticeAiQuotaUsage',
            responsibilities:
              'Nhận dấu vết từ cả hai nhánh ALLOW Tools và ASK (approveAction) sau khi ẩn danh PII, ghi chi phí token và độ trễ p95.',
          }
        : {
            role: 'Immutable AI audit log and OTel GenAI trace store',
            packageOrPort: 'PG16 · latticeAiAuditLogs / Traces',
            protocol: 'SQL Transaction · OTLP HTTP :4318',
            payloadOrSchema: 'latticeAiAuditLogs, latticeAiTraces, latticeAiQuotaUsage',
            responsibilities:
              'Receives PII-redacted audit records and OTel GenAI waterfall spans from both ALLOW tool calls and ASK (approveAction) executions.',
          },
    },
    {
      id: 'react_loop',
      title: isVi ? 'Vòng lặp ReAct' : 'ReAct Loop',
      sub: 'ALLOW | ASK · <=12',
      icon: 'workflow',
      x: 32,
      y: 224,
      width: 184,
      height: 64,
      zoneId: 'ai-react',
      focal: true,
      inspector: isVi
        ? {
            role: 'Bộ thực thi suy luận - hành động phân nhánh theo quyền công cụ',
            packageOrPort: 'plugin-dxos-ai · plugin-dxos-studio',
            protocol: 'In-process ReAct · SSE surfaceEvents',
            payloadOrSchema: 'maxTurns: 5 (1..12) | mode: single | react',
            responsibilities:
              'Điều phối chuỗi Thought-Action-Observation; phân nhánh công cụ ALLOW chạy trực tiếp qua createAuditedTool và thao tác ASK vào hàng đợi HITL.',
          }
        : {
            role: 'Bounded multi-turn loop branching by tool permission',
            packageOrPort: 'plugin-dxos-ai · plugin-dxos-studio',
            protocol: 'In-process ReAct · SSE surfaceEvents',
            payloadOrSchema: 'maxTurns: 5 (1..12) | mode: single | react',
            responsibilities:
              'Executes Thought-Action-Observation turns, branching autonomous ALLOW calls to createAuditedTool and mutating ASK calls to HITL Queue.',
          },
    },
    {
      id: 'unified_tools',
      title: isVi ? 'ALLOW Tools + RLS' : 'ALLOW Tools + RLS',
      sub: 'createAuditedTool+RLS',
      icon: 'box',
      x: 308,
      y: 184,
      width: 204,
      height: 60,
      zoneId: 'ai-react',
      focal: true,
      inspector: isVi
        ? {
            role: 'Thực thi 20 Unified Tools (+4 IT/OT MCP) trong vùng PG16 RLS',
            packageOrPort: 'ai-tools-core.js · mcp-itot-tools.js',
            protocol: 'JSON Schema · runWithTenantRls',
            payloadOrSchema: 'createAuditedTool() + SET LOCAL app.current_org',
            responsibilities:
              'Thực thi trực tiếp các công cụ ALLOW và các tác vụ ASK đã được duyệt; tương tác hai chiều với Advisory Memory và ghi Audit/OTel.',
          }
        : {
            role: 'Audited execution for ALLOW and approved ASK tools',
            packageOrPort: 'ai-tools-core.js · mcp-itot-tools.js',
            protocol: 'JSON Schema · runWithTenantRls',
            payloadOrSchema: 'createAuditedTool() + SET LOCAL app.current_org',
            responsibilities:
              'Executes ALLOW tools (and approved ASK mutations) inside app.current_org FORCE RLS, interacts with Advisory Memory, and logs Audit/OTel.',
          },
    },
    {
      id: 'memory_vault',
      title: isVi ? 'Bộ nhớ Advisory' : 'Advisory Memory',
      sub: 'latticeAiMemory · RLS',
      icon: 'key',
      x: 616,
      y: 184,
      width: 204,
      height: 60,
      zoneId: 'ai-react',
      inspector: isVi
        ? {
            role: 'Bộ nhớ dài hạn org/agent/user gắn cờ advisory chống chèn prompt',
            packageOrPort: 'ai-memory.js · latticeAiMemory',
            protocol: 'recallMemories / buildMemoryContextPrompt · RLS',
            payloadOrSchema: '<dxos_memory_context advisory="true">...</dxos_memory_context>',
            responsibilities:
              'Cung cấp remember/recall/forget trực tiếp cho luồng công cụ ALLOW; không phải đầu ra của hàng đợi phê duyệt HITL.',
          }
        : {
            role: 'Persistent scoped memory with prompt-injection fencing',
            packageOrPort: 'ai-memory.js · latticeAiMemory',
            protocol: 'recallMemories / buildMemoryContextPrompt · RLS',
            payloadOrSchema: '<dxos_memory_context advisory="true">...</dxos_memory_context>',
            responsibilities:
              'Provides remember, recall, and forget operations directly alongside ALLOW tools, wrapped in untrusted advisory delimiters.',
          },
    },
    {
      id: 'hitl_exec',
      title: isVi ? 'Hàng đợi HITL (ASK)' : 'HITL Queue (ASK)',
      sub: 'latticeAiApprovalQueue',
      icon: 'lock',
      x: 308,
      y: 300,
      width: 204,
      height: 60,
      zoneId: 'ai-react',
      inspector: isVi
        ? {
            role: 'Hàng đợi phê duyệt con người cho thao tác ghi có rủi ro',
            packageOrPort: 'ai-hitl-executors.js · latticeAiApprovalQueue',
            protocol: 'Human-in-the-Loop · RBAC',
            payloadOrSchema: 'dxos_execute_record_action | dxos_alarm_action | dxos_provision_role_workspace',
            responsibilities:
              'Giữ lại đề xuất thay đổi thuộc nhóm ASK cho tới khi quản trị viên hợp lệ xác nhận qua approveAction hoặc rejectAction.',
          }
        : {
            role: 'Human-in-the-loop queue for mutating ASK calls',
            packageOrPort: 'ai-hitl-executors.js · latticeAiApprovalQueue',
            protocol: 'Human-in-the-Loop · RBAC',
            payloadOrSchema: 'dxos_execute_record_action | dxos_alarm_action | dxos_provision_role_workspace',
            responsibilities:
              'Holds ASK-tier mutations, alarm actions, and workspace provisioning in latticeAiApprovalQueue pending operator confirmation.',
          },
    },
    {
      id: 'decide_approval',
      title: isVi ? 'Duyệt / Từ chối HITL' : 'HITL Approve / Reject',
      sub: ':approveAction | :reject',
      icon: 'check-circle',
      x: 616,
      y: 300,
      width: 204,
      height: 60,
      zoneId: 'ai-react',
      inspector: isVi
        ? {
            role: 'Xác nhận quyết định phê duyệt và chuyển vào createAuditedTool',
            packageOrPort: 'POST /api/dxosAi:approveAction | :rejectAction',
            protocol: 'RBAC Check -> createAuditedTool() + Audit',
            payloadOrSchema: 'Strips PROTECTED_SERVER_FIELDS · Decision: approved | rejected',
            responsibilities:
              'Khi người dùng chấp thuận, hệ thống lọc PROTECTED_SERVER_FIELDS, thực thi qua createAuditedTool và ghi dấu vết Audit/OTel.',
          }
        : {
            role: 'Commits operator decision and runs createAuditedTool',
            packageOrPort: 'POST /api/dxosAi:approveAction | :rejectAction',
            protocol: 'RBAC Check -> createAuditedTool() + Audit',
            payloadOrSchema: 'Strips PROTECTED_SERVER_FIELDS · Decision: approved | rejected',
            responsibilities:
              'On approval, strips PROTECTED_SERVER_FIELDS, executes via createAuditedTool inside tenant RLS, and emits Audit & OTel traces.',
          },
    },
  ];

  const reactEdges: DiagramEdge[] = [
    { id: 'r1', from: 'profiles', to: 'guardrails', label: 'RBAC', kind: 'primary' },
    { id: 'r2', from: 'guardrails', to: 'llm_router', label: 'Redacted', kind: 'primary' },
    { id: 'r3', from: 'llm_router', to: 'audit_ledger', label: 'Tokens', kind: 'flow' },
    {
      id: 'r4',
      from: 'profiles',
      to: 'react_loop',
      label: 'Session',
      kind: 'primary',
      points: [
        [124, 112],
        [124, 202],
        [184, 202],
        [184, 224],
      ],
    },
    {
      id: 'r5',
      from: 'react_loop',
      to: 'react_loop',
      label: 'Thought/Obs',
      kind: 'flow',
      selfLoop: 'bottom',
    },
    {
      id: 'r6',
      from: 'react_loop',
      to: 'unified_tools',
      label: 'ALLOW',
      kind: 'primary',
      points: [
        [216, 240],
        [262, 240],
        [262, 214],
        [308, 214],
      ],
    },
    {
      id: 'r7',
      from: 'unified_tools',
      to: 'memory_vault',
      label: 'Remember',
      kind: 'flow',
      points: [
        [512, 200],
        [616, 200],
      ],
    },
    {
      id: 'r8',
      from: 'memory_vault',
      to: 'unified_tools',
      label: 'Advisory',
      kind: 'dashed',
      points: [
        [616, 228],
        [512, 228],
      ],
    },
    {
      id: 'r9',
      from: 'unified_tools',
      to: 'audit_ledger',
      label: 'Audit & OTel',
      kind: 'flow',
      points: [
        [410, 184],
        [410, 140],
        [940, 140],
        [940, 112],
      ],
    },
    {
      id: 'r10',
      from: 'react_loop',
      to: 'hitl_exec',
      label: 'ASK',
      kind: 'primary',
      points: [
        [216, 272],
        [262, 272],
        [262, 330],
        [308, 330],
      ],
    },
    {
      id: 'r11',
      from: 'hitl_exec',
      to: 'decide_approval',
      label: 'Decide',
      kind: 'primary',
      points: [
        [512, 330],
        [616, 330],
      ],
    },
    {
      id: 'r12',
      from: 'decide_approval',
      to: 'unified_tools',
      label: 'Exec Audited',
      kind: 'flow',
      points: [
        [718, 300],
        [718, 268],
        [410, 268],
        [410, 244],
      ],
    },
    {
      id: 'r13',
      from: 'decide_approval',
      to: 'audit_ledger',
      label: 'HITL Trace',
      kind: 'flow',
      points: [
        [820, 330],
        [988, 330],
        [988, 112],
      ],
    },
  ];

  const reactSteps: DiagramStep[] = [
    {
      id: 'react-s1',
      title: isVi ? 'Khớp hồ sơ & kiểm quota' : 'Profile Bind & Quota',
      activeNodes: ['profiles', 'guardrails'],
      activeEdges: ['r1', 'r4'],
      description: isVi
        ? 'Xác thực một trong 7 hồ sơ Agent theo cổng truy cập, sau đó kiểm tra hạn mức cuộc gọi/token theo ngày và ẩn danh PII đầu vào.'
        : 'Resolves one of the 7 Agent Profiles against portal RBAC, then checks daily org/user quotas and redacts sensitive PII tokens.',
      route: 'GET /api/dxosAi:portalAgents · POST /api/aiConversations:sendMessages',
      payload: 'orgDailyCalls <= 5000 · redactPiiText()',
      chips: ['7 Profiles', '9 PII Regex'],
    },
    {
      id: 'react-s2',
      title: isVi ? 'Suy luận LLM & vòng lặp ReAct' : 'LLM Turn & ReAct Loop',
      activeNodes: ['guardrails', 'llm_router', 'react_loop'],
      activeEdges: ['r2', 'r5'],
      description: isVi
        ? 'Mô hình đề xuất lời gọi công cụ; vòng lặp ReAct (maxTurns <= 12) phân nhánh theo quyền ALLOW vs ASK.'
        : 'The routed LLM emits tool calls; the ReAct loop (maxTurns <= 12) branches by tool permission into ALLOW vs ASK.',
      route: 'GET /api/dxosAi:surfaceEvents',
      payload: 'model: ag/gemini-3.8-flash | maxTurns: 5',
      chips: ['local-9router', 'SSE'],
    },
    {
      id: 'react-s3',
      title: isVi ? 'Nhánh ALLOW <-> Advisory Memory & Audit' : 'ALLOW Tools <-> Advisory Memory & Audit',
      activeNodes: ['react_loop', 'unified_tools', 'memory_vault', 'audit_ledger'],
      activeEdges: ['r6', 'r7', 'r8', 'r9', 'r3'],
      description: isVi
        ? 'Công cụ ALLOW chạy trong createAuditedTool + PG16 RLS, đọc/ghi hai chiều với Advisory Memory (latticeAiMemory) và đẩy vết về Audit/OTel.'
        : 'ALLOW tools run via createAuditedTool + PG16 RLS, exchange advisory-fenced context with latticeAiMemory, and emit Audit & OTel traces.',
      route: 'createAuditedTool() <-> latticeAiMemory',
      payload: '<dxos_memory_context advisory="true"> · SET LOCAL app.current_org',
      chips: ['ALLOW Branch', 'Advisory Memory'],
    },
    {
      id: 'react-s4',
      title: isVi ? 'Nhánh ASK -> HITL Queue -> approveAction' : 'ASK Mutations -> HITL Queue -> approveAction',
      activeNodes: ['react_loop', 'hitl_exec', 'decide_approval', 'unified_tools', 'audit_ledger'],
      activeEdges: ['r10', 'r11', 'r12', 'r13'],
      description: isVi
        ? 'Thao tác ASK tạm dừng trong latticeAiApprovalQueue; khi được approveAction chấp thuận, lệnh chạy qua createAuditedTool và ghi Audit/OTel.'
        : 'ASK mutations pause in latticeAiApprovalQueue; upon approveAction confirmation, execution flows through createAuditedTool and emits Audit & OTel.',
      route: 'POST /api/dxosAi:approveAction | :rejectAction',
      payload: 'latticeAiApprovalQueue -> createAuditedTool()',
      chips: ['ASK Branch', 'OTel Traces'],
    },
  ];

  // Mode 2: App Builder 2.0 Lifecycle (Independent Branches from Versioned App)
  const builderZones: DiagramZone[] = [
    {
      id: 'ab-provision',
      label: isVi ? '1–2 · Lập kế hoạch, Dựng & Chốt Versioned App (dxos-architect)' : '1–2 · Plan, Build & Versioned App (dxos-architect)',
      x: 16,
      y: 16,
      width: 1056,
      height: 120,
      kind: 'admin',
    },
    {
      id: 'ab-lifecycle',
      label: isVi ? '4 Nhánh Vận hành Độc lập từ Versioned App (Không nối chuỗi tuyến tính)' : '4 Independent Branches from Versioned App',
      x: 16,
      y: 172,
      width: 1056,
      height: 196,
      kind: 'traffic',
    },
  ];

  const builderNodes: DiagramNode[] = [
    {
      id: 'architect_prompt',
      title: 'dxos-architect',
      sub: 'root | admin only',
      icon: 'bot',
      x: 32,
      y: 52,
      width: 192,
      height: 64,
      zoneId: 'ab-provision',
      focal: true,
      inspector: isVi
        ? {
            role: 'Hồ sơ kiến trúc sư hệ thống dành riêng cho quản trị viên',
            packageOrPort: 'ai-schemas.js · ai-surface-creative-tools.js',
            protocol: 'Admin Lock · dxos_provision_role_workspace',
            payloadOrSchema: 'allowedRoles: [root, admin] · 16 ALLOW + 1 ASK tools',
            responsibilities:
              'Tiếp nhận đặc tả tự nhiên hoặc cấu trúc và điều phối toàn bộ vòng đời App Builder 2.0 thông qua công cụ dxos_provision_role_workspace.',
          }
        : {
            role: 'Admin-locked system architect profile',
            packageOrPort: 'ai-schemas.js · ai-surface-creative-tools.js',
            protocol: 'Admin Lock · dxos_provision_role_workspace',
            payloadOrSchema: 'allowedRoles: [root, admin] · 16 ALLOW + 1 ASK tools',
            responsibilities:
              'Accepts natural-language prompts or structured specs and orchestrates the App Builder 2.0 pipeline via dxos_provision_role_workspace.',
          },
    },
    {
      id: 'plan_app',
      title: isVi ? '1. Plan (ER Diff)' : '1. Plan (ER Diff)',
      sub: 'POST :planBuiltApp',
      icon: 'git-branch',
      x: 308,
      y: 52,
      width: 192,
      height: 64,
      zoneId: 'ab-provision',
      focal: true,
      inspector: isVi
        ? {
            role: 'Phân tích đồ thị thực thể và diff không ghi DB',
            packageOrPort: 'app-builder-planner.js · dxosAi:planBuiltApp',
            protocol: 'HTTPS POST · Zero DB Writes',
            payloadOrSchema: 'buildErGraph (Kahn topo sort) + computeSpecDiff',
            responsibilities:
              'Tạo bản nháp spec từ prompt, sắp xếp thứ tự phụ thuộc bảng bằng thuật toán Kahn và trả về bản xem trước ER Diff mà chưa chạm DB.',
          }
        : {
            role: 'Zero-write ER topological planner and spec diff',
            packageOrPort: 'app-builder-planner.js · dxosAi:planBuiltApp',
            protocol: 'HTTPS POST · Zero DB Writes',
            payloadOrSchema: 'buildErGraph (Kahn topo sort) + computeSpecDiff',
            responsibilities:
              'Builds a draft spec, resolves dependency order with Kahn topological sort, and computes ER diffs with zero database writes.',
          },
    },
    {
      id: 'build_app',
      title: isVi ? '2. Build & Self-Heal' : '2. Build & Self-Heal',
      sub: 'POST :buildBuiltApp',
      icon: 'layers',
      x: 584,
      y: 52,
      width: 192,
      height: 64,
      zoneId: 'ab-provision',
      focal: true,
      inspector: isVi
        ? {
            role: 'Khởi tạo toàn bộ bảng, RLS, vai trò, block, DMN và tự sửa lỗi',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:buildBuiltApp',
            protocol: 'PG Transaction · Up to 2 Self-Heal Rounds',
            payloadOrSchema: 'latticeCustom* + FORCE RLS + 12 BlockModels + LatticeFlow/DMN',
            responsibilities:
              'Chụp snapshot portal, tạo bảng tùy biến có FORCE RLS, dựng 12 Native BlockModels, triển khai DMN/Flow và tự sửa lỗi tối đa 2 vòng.',
          }
        : {
            role: 'Full-stack provisioner with 2-round targeted self-repair',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:buildBuiltApp',
            protocol: 'PG Transaction · Up to 2 Self-Heal Rounds',
            payloadOrSchema: 'latticeCustom* + FORCE RLS + 12 BlockModels + LatticeFlow/DMN',
            responsibilities:
              'Snapshots portals, creates FORCE RLS custom collections, mounts Native v2 blocks, deploys DMN/Flow rules, and runs up to 2 self-heal cycles.',
          },
    },
    {
      id: 'verify_app',
      title: isVi ? 'Versioned App' : 'Versioned App',
      sub: 'latticeBuiltApps + Snap',
      icon: 'check-circle',
      x: 860,
      y: 52,
      width: 196,
      height: 64,
      zoneId: 'ab-provision',
      focal: true,
      inspector: isVi
        ? {
            role: 'Ứng dụng đã kiểm chứng kèm lịch sử phiên bản & snapshot',
            packageOrPort: 'PG16 · latticeBuiltApps / Versions / UiSnapshots',
            protocol: 'verifyEnterpriseApp · RLS',
            payloadOrSchema: 'latticeBuiltApps + latticeBuiltAppVersions + latticeUiSnapshots',
            responsibilities:
              'Là điểm gốc để thực hiện độc lập bất kỳ thao tác hậu kiểm nào: cập nhật Patch v2+, Rollback về snapshot, xuất Bundle v3 hoặc Safe Teardown.',
          }
        : {
            role: 'Verified application with version ledger & UI snapshots',
            packageOrPort: 'PG16 · latticeBuiltApps / Versions / UiSnapshots',
            protocol: 'verifyEnterpriseApp · RLS',
            payloadOrSchema: 'latticeBuiltApps + latticeBuiltAppVersions + latticeUiSnapshots',
            responsibilities:
              'Root state from which operators independently branch to Patch Spec (v2+), Rollback to Snapshot, Export Bundle v3, or Safe Teardown.',
          },
    },
    {
      id: 'patch_app',
      title: isVi ? 'Patch Spec (v2+)' : 'Patch Spec (v2+)',
      sub: 'POST :patchBuiltApp',
      icon: 'terminal',
      x: 32,
      y: 236,
      width: 192,
      height: 64,
      zoneId: 'ab-lifecycle',
      inspector: isVi
        ? {
            role: 'Cập nhật tăng dần trực tiếp trên Versioned App',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:patchBuiltApp',
            protocol: 'HTTPS POST · Incremental Diff',
            payloadOrSchema: 'applySpecPatch + latticeBuiltAppVersions++',
            responsibilities:
              'Áp dụng phần thay đổi cho collection, block hoặc quy tắc mới và tự động tạo phiên bản mới trong latticeBuiltAppVersions.',
          }
        : {
            role: 'Incremental non-destructive specification patcher',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:patchBuiltApp',
            protocol: 'HTTPS POST · Incremental Diff',
            payloadOrSchema: 'applySpecPatch + latticeBuiltAppVersions++',
            responsibilities:
              'Applies incremental field, block, and workflow updates directly to a Versioned App while recording a new version entry.',
          },
    },
    {
      id: 'rollback_app',
      title: isVi ? 'Rollback Snapshot' : 'Rollback to Snapshot',
      sub: ':rollbackBuiltApp',
      icon: 'activity',
      x: 308,
      y: 236,
      width: 192,
      height: 64,
      zoneId: 'ab-lifecycle',
      inspector: isVi
        ? {
            role: 'Khôi phục giao diện, block và quyền về targetVersion',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:rollbackBuiltApp',
            protocol: 'HTTPS POST · Time-Machine Restore',
            payloadOrSchema: '{ builtAppId, targetVersion } -> latticeUiSnapshots',
            responsibilities:
              'Phục hồi toàn bộ bố cục portal, block FlowEngine, phân quyền vai trò và spec về đúng phiên bản mục tiêu trong snapshot.',
          }
        : {
            role: 'Snapshot-backed version rollback engine',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:rollbackBuiltApp',
            protocol: 'HTTPS POST · Time-Machine Restore',
            payloadOrSchema: '{ builtAppId, targetVersion } -> latticeUiSnapshots',
            responsibilities:
              'Restores UI portal layouts, block configs, role bindings, and app specifications cleanly to a recorded targetVersion.',
          },
    },
    {
      id: 'bundle_export',
      title: isVi ? 'Xuất Bundle v3' : 'Export Bundle v3',
      sub: 'solution-bundle/v3',
      icon: 'box',
      x: 584,
      y: 236,
      width: 192,
      height: 64,
      zoneId: 'ab-lifecycle',
      inspector: isVi
        ? {
            role: 'Đóng gói ứng dụng thành GitOps Solution Bundle v3',
            packageOrPort: 'solution-bundle.js · dxosStudio:solutionBundleExport',
            protocol: 'JSON · SHA-256 contentSha256',
            payloadOrSchema: 'latticedx.solution-bundle/v3 (8 top-level keys)',
            responsibilities:
              'Xuất khẩu roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks và governance với chữ ký SHA-256.',
          }
        : {
            role: 'Exports provisioned apps as GitOps Solution Bundle v3',
            packageOrPort: 'solution-bundle.js · dxosStudio:solutionBundleExport',
            protocol: 'JSON · SHA-256 contentSha256',
            payloadOrSchema: 'latticedx.solution-bundle/v3 (8 top-level keys)',
            responsibilities:
              'Serializes roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks, and governance with SHA-256 digest.',
          },
    },
    {
      id: 'teardown_app',
      title: isVi ? 'Safe Teardown' : 'Safe Teardown',
      sub: 'keepData=true',
      icon: 'shield',
      x: 860,
      y: 236,
      width: 196,
      height: 64,
      zoneId: 'ab-lifecycle',
      focal: true,
      inspector: isVi
        ? {
            role: 'Tháo dỡ có bảo vệ bảng dùng chung và vai trò lõi',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:teardownBuiltApp',
            protocol: 'System RLS Cross-Org Audit · keepData=true',
            payloadOrSchema: 'keepData: true (default) | BUILTIN_PROTECTED_ROLES guard',
            responsibilities:
              'Nhánh độc lập từ Versioned App; mặc định keepData=true và quét liên tổ chức để không xóa bảng, vai trò hay portal đang dùng chung.',
          }
        : {
            role: 'Cross-org safe teardown protecting shared data and roles',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:teardownBuiltApp',
            protocol: 'System RLS Cross-Org Audit · keepData=true',
            payloadOrSchema: 'keepData: true (default) | BUILTIN_PROTECTED_ROLES guard',
            responsibilities:
              'Independent branch from Versioned App; defaults keepData=true and checks cross-org usage so shared tables/roles are never dropped.',
          },
    },
  ];

  const builderEdges: DiagramEdge[] = [
    { id: 'b1', from: 'architect_prompt', to: 'plan_app', label: 'Prompt', kind: 'primary' },
    { id: 'b2', from: 'plan_app', to: 'build_app', label: 'Diff OK', kind: 'primary' },
    { id: 'b3', from: 'build_app', to: 'verify_app', label: 'Heal <=2', kind: 'primary' },
    {
      id: 'b4',
      from: 'verify_app',
      to: 'patch_app',
      label: 'Patch v2+',
      kind: 'flow',
      points: [
        [958, 116],
        [958, 154],
        [128, 154],
        [128, 236],
      ],
    },
    {
      id: 'b5',
      from: 'verify_app',
      to: 'rollback_app',
      label: 'Rollback',
      kind: 'flow',
      points: [
        [958, 116],
        [958, 154],
        [404, 154],
        [404, 236],
      ],
    },
    {
      id: 'b6',
      from: 'verify_app',
      to: 'bundle_export',
      label: 'Export v3',
      kind: 'primary',
      points: [
        [958, 116],
        [958, 154],
        [680, 154],
        [680, 236],
      ],
    },
    {
      id: 'b7',
      from: 'verify_app',
      to: 'teardown_app',
      label: 'Teardown',
      kind: 'dashed',
      points: [
        [958, 116],
        [958, 236],
      ],
    },
  ];

  const builderSteps: DiagramStep[] = [
    {
      id: 'ab-s1',
      title: isVi ? '1. Plan không ghi DB (ER Diff)' : '1. Plan (Dry-Run ER Diff)',
      activeNodes: ['architect_prompt', 'plan_app'],
      activeEdges: ['b1'],
      description: isVi
        ? 'dxos-architect gọi planBuiltApp để dựng đồ thị ER theo thuật toán Kahn và tính toán spec diff mà chưa tạo bảng thực tế.'
        : 'dxos-architect invokes planBuiltApp to generate a Kahn-sorted ER graph and structural ER diff with zero database mutations.',
      route: 'POST /api/dxosAi:planBuiltApp',
      payload: 'buildErGraph() + computeSpecDiff()',
      chips: ['Dry-Run', 'Kahn Sort'],
    },
    {
      id: 'ab-s2',
      title: isVi ? '2. Build, Self-Heal & Versioned App' : '2. Build, Self-Heal & Versioned App',
      activeNodes: ['plan_app', 'build_app', 'verify_app'],
      activeEdges: ['b2', 'b3'],
      description: isVi
        ? 'buildBuiltApp tạo bảng FORCE RLS, 12 BlockModels, DMN/Flow, chạy tối đa 2 vòng tự sửa và lưu bản ghi Versioned App kèm snapshot.'
        : 'buildBuiltApp creates FORCE RLS tables, 12 BlockModels, and DMN/Flow rules, runs up to 2 self-heal rounds, and commits Versioned App + Snapshots.',
      route: 'POST /api/dxosAi:buildBuiltApp',
      payload: 'DEFAULT_SELF_HEAL_MAX_ROUNDS = 2 -> latticeBuiltApps',
      chips: ['FORCE RLS', 'Versioned App'],
    },
    {
      id: 'ab-s3',
      title: isVi ? 'Nhánh Patch (v2+) & Rollback độc lập' : 'Independent Patch (v2+) & Rollback Branches',
      activeNodes: ['verify_app', 'patch_app', 'rollback_app'],
      activeEdges: ['b4', 'b5'],
      description: isVi
        ? 'Từ Versioned App, quản trị viên có thể rẽ nhánh Patch Spec (v2+) để nâng cấp tăng dần hoặc Rollback trực tiếp về snapshot đã lưu.'
        : 'From Versioned App, operators independently branch to Patch Spec (v2+) for incremental updates or Rollback directly to any saved snapshot.',
      route: 'POST /api/dxosAi:patchBuiltApp | :rollbackBuiltApp',
      payload: 'latticeBuiltAppVersions | latticeUiSnapshots',
      chips: ['Direct Branching', 'Time-Machine'],
    },
    {
      id: 'ab-s4',
      title: isVi ? 'Nhánh Export Bundle v3 & Safe Teardown' : 'Independent Export Bundle v3 & Safe Teardown',
      activeNodes: ['verify_app', 'bundle_export', 'teardown_app'],
      activeEdges: ['b6', 'b7'],
      description: isVi
        ? 'Từ Versioned App có thể xuất trực tiếp Solution Bundle v3 chuẩn GitOps hoặc chạy Safe Teardown (keepData=true) độc lập.'
        : 'From Versioned App, operators can independently Export Bundle v3 for GitOps promotion or invoke Safe Teardown (keepData=true).',
      route: 'POST /api/dxosAi:exportBuiltAppBundle | :teardownBuiltApp',
      payload: 'keepData: true | latticedx.solution-bundle/v3',
      chips: ['Bundle v3', 'Safe Teardown'],
    },
  ];

  // Mode 3: MCP Gateway & A2A Protocol
  const protoZones: DiagramZone[] = [
    {
      id: 'ext-clients',
      label: isVi ? 'Client Ngoài (Bearer)' : 'External Clients (Bearer)',
      x: 16,
      y: 16,
      width: 216,
      height: 368,
      kind: 'external',
    },
    {
      id: 'dxos-gateways',
      label: isVi ? 'Cổng MCP Gateway, A2A & Kiểm soát Quản trị' : 'MCP Gateway, A2A & Governance Plane',
      x: 300,
      y: 16,
      width: 772,
      height: 368,
      kind: 'admin',
    },
  ];

  const protoNodes: DiagramNode[] = [
    {
      id: 'mcp_client',
      title: 'MCP Client',
      sub: 'JSON-RPC 2.0 · Bearer',
      icon: 'terminal',
      x: 32,
      y: 64,
      width: 184,
      height: 64,
      zoneId: 'ext-clients',
      inspector: isVi
        ? {
            role: 'IDE hoặc tác nhân ngoài kết nối giao thức MCP',
            packageOrPort: 'Streamable HTTP · Bearer JWT / ldx_pat_*',
            protocol: 'MCP 2025-03-26 / 2024-11-05',
            payloadOrSchema: 'initialize, tools/list, tools/call, prompts/list, resources/read',
            responsibilities:
              'Gửi yêu cầu JSON-RPC 2.0 kèm Bearer token; các caller không phải admin sẽ tự động bị lọc bỏ công cụ và prompt adminOnly.',
          }
        : {
            role: 'External IDE or agent host speaking MCP',
            packageOrPort: 'Streamable HTTP · Bearer JWT / ldx_pat_*',
            protocol: 'MCP 2025-03-26 / 2024-11-05',
            payloadOrSchema: 'initialize, tools/list, tools/call, prompts/list, resources/read',
            responsibilities:
              'Sends JSON-RPC 2.0 requests with Bearer credentials; non-admin callers automatically exclude adminOnly tools and prompts.',
          },
    },
    {
      id: 'a2a_peer',
      title: 'A2A Peer Agent',
      sub: 'Agent Card · Bearer',
      icon: 'globe',
      x: 32,
      y: 220,
      width: 184,
      height: 64,
      zoneId: 'ext-clients',
      inspector: isVi
        ? {
            role: 'Tác nhân đối tác khám phá năng lực và giao tác vụ A2A',
            packageOrPort: 'External A2A Client · HTTPS',
            protocol: 'HTTP GET + JSON-RPC 2.0',
            payloadOrSchema: 'GET /.well-known/agent-card.json -> POST /api/dxos-a2a',
            responsibilities:
              'Đọc Agent Card công khai để phát hiện skills, sau đó gửi tác vụ qua tasks/send, theo dõi qua tasks/get hoặc hủy qua tasks/cancel.',
          }
        : {
            role: 'Peer agent discovering skills and submitting A2A tasks',
            packageOrPort: 'External A2A Client · HTTPS',
            protocol: 'HTTP GET + JSON-RPC 2.0',
            payloadOrSchema: 'GET /.well-known/agent-card.json -> POST /api/dxos-a2a',
            responsibilities:
              'Fetches the Agent Card to inspect supported skills and authentication schemes, then dispatches tasks via tasks/send, tasks/get, and tasks/cancel.',
          },
    },
    {
      id: 'mcp_gateway',
      title: 'MCP Gateway',
      sub: 'POST /api/dxos-mcp',
      icon: 'plug',
      x: 320,
      y: 64,
      width: 184,
      height: 64,
      zoneId: 'dxos-gateways',
      focal: true,
      inspector: isVi
        ? {
            role: 'Máy chủ MCP Stateless Streamable HTTP chính',
            packageOrPort: 'mcp-gateway.js · /api/dxos-mcp',
            protocol: 'JSON-RPC 2.0 · defaultResolveHostAuth',
            payloadOrSchema: '20 Unified Tools + 4 MCP_PROMPT_CATALOG + dxos://org/* resources',
            responsibilities:
              'Xác thực Bearer, thương lượng phiên bản MCP, liệt kê và thực thi 20 công cụ hợp nhất cũng như đọc tài nguyên cảnh báo/lineage theo tenant.',
          }
        : {
            role: 'Stateless Streamable HTTP MCP server',
            packageOrPort: 'mcp-gateway.js · /api/dxos-mcp',
            protocol: 'JSON-RPC 2.0 · defaultResolveHostAuth',
            payloadOrSchema: '20 Unified Tools + 4 MCP_PROMPT_CATALOG + dxos://org/* resources',
            responsibilities:
              'Authenticates Bearer tokens, negotiates protocol version, dispatches the 20 Unified Tools, and serves alarms/lineage resources under tenant RLS.',
          },
    },
    {
      id: 'itot_mcp',
      title: '4 IT/OT MCP',
      sub: '/api/dxos-mcp/it-ot',
      icon: 'radio',
      x: 596,
      y: 64,
      width: 184,
      height: 64,
      zoneId: 'dxos-gateways',
      inspector: isVi
        ? {
            role: 'Hồ sơ MCP chuyên biệt cho dữ liệu cảm biến và vận hành IT/OT',
            packageOrPort: 'mcp-itot-tools.js · /api/dxos-mcp/it-ot',
            protocol: 'MCP JSON-RPC 2.0 · DXOS_MCP_INTERNAL_HTTP_ALLOWLIST',
            payloadOrSchema: 'get_live_ngsi_telemetry, get_sensor_and_incident_timeline, get_stack_connector_health, dispatch_itot_webhook_or_sync',
            responsibilities:
              'Cung cấp đúng 4 công cụ đọc telemetry NGSI-LD, dòng thời gian sự cố, sức khỏe connector và kích hoạt đồng bộ IT/OT có kiểm soát SSRF.',
          }
        : {
            role: 'Dedicated MCP endpoint for IT/OT telemetry and sync',
            packageOrPort: 'mcp-itot-tools.js · /api/dxos-mcp/it-ot',
            protocol: 'MCP JSON-RPC 2.0 · DXOS_MCP_INTERNAL_HTTP_ALLOWLIST',
            payloadOrSchema: 'get_live_ngsi_telemetry, get_sensor_and_incident_timeline, get_stack_connector_health, dispatch_itot_webhook_or_sync',
            responsibilities:
              'Exposes the 4 specialized IT/OT MCP tools for live NGSI-LD telemetry, incident timelines, connector health, and allowlisted webhook dispatch.',
          },
    },
    {
      id: 'unified_pool',
      title: isVi ? 'Kho 20+4 Tool' : '20+4 Tool Pool',
      sub: 'createAuditedTool',
      icon: 'box',
      x: 872,
      y: 64,
      width: 184,
      height: 64,
      zoneId: 'dxos-gateways',
      inspector: isVi
        ? {
            role: 'Lớp thực thi hợp nhất chia sẻ giữa ReAct và MCP',
            packageOrPort: 'ai-tools-core.js · PG16 FORCE RLS',
            protocol: 'Tenant RLS + PII Scrubbing',
            payloadOrSchema: 'tools (20) + itOtTools (4) -> dxos://org/<org>/alarms/active',
            responsibilities:
              'Đảm bảo lời gọi từ MCP ngoài tuân thủ cùng một rào chắn RBAC, RLS và ghi nhật ký như tác nhân nội bộ.',
          }
        : {
            role: 'Unified tool execution pool shared by ReAct and MCP',
            packageOrPort: 'ai-tools-core.js · PG16 FORCE RLS',
            protocol: 'Tenant RLS + PII Scrubbing',
            payloadOrSchema: 'tools (20) + itOtTools (4) -> dxos://org/<org>/alarms/active',
            responsibilities:
              'Ensures external MCP invocations enforce the exact same RBAC, tenant RLS, and audit logging boundaries as internal agents.',
          },
    },
    {
      id: 'a2a_gateway',
      title: 'A2A Gateway',
      sub: 'POST /api/dxos-a2a',
      icon: 'server',
      x: 320,
      y: 220,
      width: 184,
      height: 64,
      zoneId: 'dxos-gateways',
      focal: true,
      inspector: isVi
        ? {
            role: 'Cổng Agent-to-Agent công bố Agent Card và tiếp nhận task',
            packageOrPort: 'a2a-gateway.js · /api/dxos-a2a',
            protocol: 'HTTP Agent Card + JSON-RPC 2.0',
            payloadOrSchema: 'GET /.well-known/agent-card.json & /api/dxos-a2a/agent-card.json',
            responsibilities:
              'Phục vụ Agent Card với authentication.schemes=[bearer], stateTransitionHistory=true và điều phối các phương thức tasks/send, tasks/get, tasks/cancel.',
          }
        : {
            role: 'Agent-to-Agent discovery and JSON-RPC task gateway',
            packageOrPort: 'a2a-gateway.js · /api/dxos-a2a',
            protocol: 'HTTP Agent Card + JSON-RPC 2.0',
            payloadOrSchema: 'GET /.well-known/agent-card.json & /api/dxos-a2a/agent-card.json',
            responsibilities:
              'Serves the Agent Card with bearer authentication and stateTransitionHistory, handling tasks/send, tasks/get, and tasks/cancel.',
          },
    },
    {
      id: 'a2a_tasks',
      title: isVi ? 'Trạng thái A2A' : 'A2A Task Store',
      sub: 'latticeA2aTasks',
      icon: 'database',
      x: 596,
      y: 220,
      width: 184,
      height: 64,
      zoneId: 'dxos-gateways',
      inspector: isVi
        ? {
            role: 'Bảng lưu vết máy trạng thái tác vụ A2A được bảo vệ CRUD',
            packageOrPort: 'PG16 · latticeA2aTasks',
            protocol: 'A2A_VALID_STATUSES · FORCE RLS',
            payloadOrSchema: 'submitted | working | input-required | completed | failed | canceled',
            responsibilities:
              'Lưu lịch sử chuyển trạng thái tác vụ theo từng tenant; mọi truy cập CRUD trực tiếp từ client đều bị chặn bởi mã lỗi DXOS_A2A_DIRECT_CRUD_FORBIDDEN.',
          }
        : {
            role: 'Direct-CRUD-locked A2A task state machine store',
            packageOrPort: 'PG16 · latticeA2aTasks',
            protocol: 'A2A_VALID_STATUSES · FORCE RLS',
            payloadOrSchema: 'submitted | working | input-required | completed | failed | canceled',
            responsibilities:
              'Persists tenant-isolated A2A task transitions while blocking direct client CRUD via DXOS_A2A_DIRECT_CRUD_FORBIDDEN.',
          },
    },
    {
      id: 'gov_eval',
      title: 'Eval & Guardrails',
      sub: 'Eval Lab · 3 Suites',
      icon: 'shield',
      x: 872,
      y: 220,
      width: 184,
      height: 64,
      zoneId: 'dxos-gateways',
      inspector: isVi
        ? {
            role: 'Eval Lab, kiểm tra đỏ-team bảo mật và kiểm toán PII/401',
            packageOrPort: 'ai-eval-lab.js · ai-governance.js',
            protocol: 'Deterministic NL | Live LLM · OTel',
            payloadOrSchema: 'WAVE1_3_EVAL_CASES, SECURITY_RED_TEAM_CASES, VIETNAMESE_NL_EVAL_CASES',
            responsibilities:
              'Đo passRate, avgLatencyMs, p95LatencyMs trên 3 bộ kiểm thử và ghi nhận mọi lỗi 401 hoặc vi phạm hạn mức vào latticeAiAuditLogs.',
          }
        : {
            role: 'Eval Lab benchmark harness and security audit layer',
            packageOrPort: 'ai-eval-lab.js · ai-governance.js',
            protocol: 'Deterministic NL | Live LLM · OTel',
            payloadOrSchema: 'WAVE1_3_EVAL_CASES, SECURITY_RED_TEAM_CASES, VIETNAMESE_NL_EVAL_CASES',
            responsibilities:
              'Measures passRate, avgLatencyMs, and p95LatencyMs across three benchmark suites and logs unauthorized 401 attempts and quota checks to latticeAiAuditLogs.',
          },
    },
  ];

  const protoEdges: DiagramEdge[] = [
    { id: 'p1', from: 'mcp_client', to: 'mcp_gateway', label: 'JSON-RPC', kind: 'primary' },
    { id: 'p2', from: 'mcp_gateway', to: 'itot_mcp', label: 'IT/OT', kind: 'flow' },
    { id: 'p3', from: 'itot_mcp', to: 'unified_pool', label: '4 Tools', kind: 'flow' },
    {
      id: 'p4',
      from: 'mcp_gateway',
      to: 'unified_pool',
      label: '20 Tools',
      kind: 'primary',
      points: [
        [412, 128],
        [412, 160],
        [964, 160],
        [964, 128],
      ],
    },
    { id: 'p5', from: 'a2a_peer', to: 'a2a_gateway', label: 'Agent Card', kind: 'primary' },
    { id: 'p6', from: 'a2a_gateway', to: 'a2a_tasks', label: 'tasks/*', kind: 'primary' },
    { id: 'p7', from: 'a2a_tasks', to: 'gov_eval', label: 'Trace', kind: 'flow' },
    {
      id: 'p8',
      from: 'unified_pool',
      to: 'gov_eval',
      label: 'PII / Quota',
      kind: 'dashed',
      points: [
        [964, 128],
        [964, 220],
      ],
    },
  ];

  const protoSteps: DiagramStep[] = [
    {
      id: 'pr-s1',
      title: isVi ? 'Khởi tạo MCP (/api/dxos-mcp)' : 'MCP Initialize & Tools',
      activeNodes: ['mcp_client', 'mcp_gateway', 'unified_pool'],
      activeEdges: ['p1', 'p4'],
      description: isVi
        ? 'Client MCP xác thực Bearer, thương lượng phiên bản 2025-03-26 / 2024-11-05 và gọi trực tiếp 20 Unified Tools theo quyền caller.'
        : 'External MCP clients authenticate via Bearer token, negotiate 2025-03-26 / 2024-11-05, and invoke the 20 Unified Tools scoped to caller RBAC.',
      route: 'POST /api/dxos-mcp',
      payload: 'method: "tools/call" | SUPPORTED_PROTOCOL_VERSIONS',
      chips: ['JSON-RPC 2.0', '20 Tools'],
    },
    {
      id: 'pr-s2',
      title: isVi ? 'Cụm IT/OT MCP chuyên biệt' : 'IT/OT MCP Tool Profile',
      activeNodes: ['mcp_gateway', 'itot_mcp', 'unified_pool'],
      activeEdges: ['p2', 'p3'],
      description: isVi
        ? 'Endpoint /api/dxos-mcp/it-ot phục vụ 4 công cụ telemetry NGSI-LD, dòng thời gian sự cố, trạng thái connector và webhook IT/OT.'
        : 'The /api/dxos-mcp/it-ot endpoint exposes 4 specialized tools for live NGSI-LD telemetry, incident timelines, connector health, and allowlisted sync.',
      route: 'POST /api/dxos-mcp/it-ot',
      payload: 'get_live_ngsi_telemetry | dispatch_itot_webhook_or_sync',
      chips: ['4 IT/OT Tools', 'SSRF Guard'],
    },
    {
      id: 'pr-s3',
      title: isVi ? 'Khám phá & tác vụ A2A' : 'A2A Discovery & Tasks',
      activeNodes: ['a2a_peer', 'a2a_gateway', 'a2a_tasks'],
      activeEdges: ['p5', 'p6'],
      description: isVi
        ? 'Đối tác tải /.well-known/agent-card.json rồi gửi tasks/send qua /api/dxos-a2a; trạng thái tác vụ lưu trong latticeA2aTasks.'
        : 'Peers fetch /.well-known/agent-card.json and dispatch tasks/send to /api/dxos-a2a, persisting state transitions in latticeA2aTasks.',
      route: 'GET /.well-known/agent-card.json',
      payload: 'submitted -> working -> completed | failed | canceled',
      chips: ['A2A Card', 'Direct CRUD Blocked'],
    },
    {
      id: 'pr-s4',
      title: isVi ? 'Eval Lab & kiểm toán PII' : 'Eval Lab & PII Audit',
      activeNodes: ['unified_pool', 'a2a_tasks', 'gov_eval'],
      activeEdges: ['p7', 'p8'],
      description: isVi
        ? 'Mọi lời gọi giao thức đều qua kiểm tra quota, ẩn danh PII và đối chiếu chất lượng bằng 3 bộ Eval Lab (WAVE1_3, RED_TEAM, VN_NL).'
        : 'Protocol calls pass quota and PII redaction checks while Eval Lab benchmarks WAVE1_3, SECURITY_RED_TEAM, and VIETNAMESE_NL suites.',
      route: 'POST /api/dxosAi:runEvalBenchmark',
      payload: 'passRate | avgLatencyMs | p95LatencyMs',
      chips: ['Eval Lab', 'OTel Waterfall'],
    },
  ];

  return [
    {
      id: 'react-tools',
      label: isVi ? 'ReAct & 20 Tools' : 'ReAct & 20 Tools',
      summary: isVi ? 'ALLOW <-> Memory & ASK -> HITL -> Audit' : 'ALLOW <-> Memory & ASK -> HITL -> Audit',
      zones: reactZones,
      nodes: reactNodes,
      edges: reactEdges,
      steps: reactSteps,
    },
    {
      id: 'app-builder',
      label: 'App Builder 2.0',
      summary: isVi ? 'Plan -> Build -> 4 Nhánh Độc lập' : 'Plan -> Build -> 4 Independent Branches',
      zones: builderZones,
      nodes: builderNodes,
      edges: builderEdges,
      steps: builderSteps,
    },
    {
      id: 'mcp-a2a',
      label: 'MCP & A2A',
      summary: '/api/dxos-mcp · /.well-known/agent-card.json',
      zones: protoZones,
      nodes: protoNodes,
      edges: protoEdges,
      steps: protoSteps,
    },
  ];
});
</script>

<template>
  <DiagramCanvas
    :title="meta.title"
    :caption="meta.caption"
    viewBox="0 0 1088 400"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
