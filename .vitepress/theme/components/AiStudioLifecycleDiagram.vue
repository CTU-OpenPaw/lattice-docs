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
          'Luồng thực thi ReAct qua 7 hồ sơ Agent, 20 Unified Tools (+ 4 công cụ IT/OT MCP), vòng đời App Builder 2.0 và cổng chuẩn hóa MCP / A2A.',
      }
    : {
        title: 'DX-OS AI Studio, App Builder 2.0 & MCP/A2A Lifecycle',
        caption:
          'ReAct execution across 7 Agent Profiles, 20 Unified Tools (+ 4 IT/OT MCP tools), App Builder 2.0 lifecycle, and standardized MCP / A2A gateways.',
      },
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const reactZones: DiagramZone[] = [
    {
      id: 'ai-control',
      label: isVi ? 'Điều phối Hồ sơ, Bảo vệ PII & Định tuyến LLM' : 'Profile Control, PII Guard & LLM Routing',
      x: 16,
      y: 16,
      width: 848,
      height: 128,
      kind: 'admin',
    },
    {
      id: 'ai-react',
      label: isVi ? 'Vòng lặp ReAct & 20 Unified Tools (Tenant RLS)' : 'ReAct Execution & 20 Unified Tools (Tenant RLS)',
      x: 16,
      y: 160,
      width: 848,
      height: 204,
      kind: 'traffic',
    },
  ];

  const reactNodes: DiagramNode[] = [
    {
      id: 'profiles',
      title: isVi ? '7 Hồ sơ Agent' : '7 Agent Profiles',
      sub: 'dxos-coordinator..analyst',
      icon: 'bot',
      x: 32,
      y: 56,
      width: 184,
      height: 64,
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
      x: 244,
      y: 56,
      width: 184,
      height: 64,
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
      x: 456,
      y: 56,
      width: 184,
      height: 64,
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
      title: isVi ? 'Nhật ký & Trace' : 'Audit & Traces',
      sub: 'latticeAiAuditLogs',
      icon: 'database',
      x: 668,
      y: 56,
      width: 184,
      height: 64,
      zoneId: 'ai-control',
      inspector: isVi
        ? {
            role: 'Lưu vết kiểm toán bất biến và OTel GenAI Waterfall',
            packageOrPort: 'PG16 · latticeAiAuditLogs / Traces',
            protocol: 'SQL Transaction · OTLP HTTP :4318',
            payloadOrSchema: 'latticeAiAuditLogs, latticeAiTraces, latticeAiQuotaUsage',
            responsibilities:
              'Ghi lại mọi lời gọi công cụ đã ẩn danh PII, độ trễ p95, số token tiêu thụ và khóa chặt quyền chỉnh sửa trực tiếp từ phía client.',
          }
        : {
            role: 'Immutable AI audit log and OTel GenAI trace store',
            packageOrPort: 'PG16 · latticeAiAuditLogs / Traces',
            protocol: 'SQL Transaction · OTLP HTTP :4318',
            payloadOrSchema: 'latticeAiAuditLogs, latticeAiTraces, latticeAiQuotaUsage',
            responsibilities:
              'Records PII-redacted tool invocations, token costs, and OpenTelemetry span waterfalls in client-locked PostgreSQL 16 RLS tables.',
          },
    },
    {
      id: 'react_loop',
      title: isVi ? 'Vòng lặp ReAct' : 'ReAct Loop',
      sub: 'ALLOW | ASK · turns<=12',
      icon: 'workflow',
      x: 32,
      y: 204,
      width: 184,
      height: 64,
      zoneId: 'ai-react',
      focal: true,
      inspector: isVi
        ? {
            role: 'Bộ thực thi suy luận - hành động nhiều bước có kiểm soát',
            packageOrPort: 'plugin-dxos-ai · plugin-dxos-studio',
            protocol: 'In-process ReAct · SSE surfaceEvents',
            payloadOrSchema: 'maxTurns: 5 (1..12) | mode: single | react',
            responsibilities:
              'Điều phối chuỗi Thought-Action-Observation cho trợ lý chat và node ai.agent trong LatticeFlow; tách biệt công cụ ALLOW tự chạy và ASK chờ xác nhận.',
          }
        : {
            role: 'Bounded multi-turn Thought-Action-Observation loop',
            packageOrPort: 'plugin-dxos-ai · plugin-dxos-studio',
            protocol: 'In-process ReAct · SSE surfaceEvents',
            payloadOrSchema: 'maxTurns: 5 (1..12) | mode: single | react',
            responsibilities:
              'Executes iterative tool calls for Studio chat and LatticeFlow ai.agent nodes, separating autonomous ALLOW calls from human-gated ASK actions.',
          },
    },
    {
      id: 'unified_tools',
      title: isVi ? '20 Unified Tools' : '20 Unified Tools',
      sub: 'createAuditedTool+RLS',
      icon: 'box',
      x: 244,
      y: 204,
      width: 184,
      height: 64,
      zoneId: 'ai-react',
      inspector: isVi
        ? {
            role: 'Kho 20 công cụ hợp nhất kèm 4 công cụ IT/OT MCP',
            packageOrPort: 'ai-tools-core.js · mcp-itot-tools.js',
            protocol: 'JSON Schema · runWithTenantRls',
            payloadOrSchema: '5 Schema + 2 Flow + 4 Surface + 6 Ops + 3 Memory (+4 IT/OT)',
            responsibilities:
              'Mọi tool đều qua lớp bọc createAuditedTool để ép buộc ngữ cảnh app.current_org, xác thực schema và chặn ghi đè các bảng hệ thống được bảo vệ.',
          }
        : {
            role: '20 audited unified tools plus 4 IT/OT MCP tools',
            packageOrPort: 'ai-tools-core.js · mcp-itot-tools.js',
            protocol: 'JSON Schema · runWithTenantRls',
            payloadOrSchema: '5 Schema + 2 Flow + 4 Surface + 6 Ops + 3 Memory (+4 IT/OT)',
            responsibilities:
              'Every tool runs inside createAuditedTool, enforcing app.current_org tenant RLS, strict JSON schema validation, and system-collection write protection.',
          },
    },
    {
      id: 'hitl_exec',
      title: isVi ? 'Hàng đợi HITL' : 'HITL Queue',
      sub: 'ASK · latticeAiApproval',
      icon: 'lock',
      x: 456,
      y: 204,
      width: 184,
      height: 64,
      zoneId: 'ai-react',
      inspector: isVi
        ? {
            role: 'Cổng phê duyệt con người cho thao tác ghi có rủi ro',
            packageOrPort: 'ai-hitl-executors.js · latticeAiApprovalQueue',
            protocol: 'Human-in-the-Loop · RBAC',
            payloadOrSchema: 'dxos_execute_record_action | dxos_alarm_action | dxos_provision_role_workspace',
            responsibilities:
              'Tạm giữ các đề xuất thay đổi nghiệp vụ, xóa bộ nhớ org hoặc cấp phát không gian làm việc cho tới khi người dùng hợp lệ xác nhận, đồng thời lọc bỏ PROTECTED_SERVER_FIELDS.',
          }
        : {
            role: 'Human-in-the-loop gate for mutating tool calls',
            packageOrPort: 'ai-hitl-executors.js · latticeAiApprovalQueue',
            protocol: 'Human-in-the-Loop · RBAC',
            payloadOrSchema: 'dxos_execute_record_action | dxos_alarm_action | dxos_provision_role_workspace',
            responsibilities:
              'Holds ASK-tier mutations, alarm escalations, and workspace provisioning in latticeAiApprovalQueue until authorized review while stripping PROTECTED_SERVER_FIELDS.',
          },
    },
    {
      id: 'memory_vault',
      title: isVi ? 'Bộ nhớ Agent' : 'Agent Memory',
      sub: 'latticeAiMemory · scope',
      icon: 'key',
      x: 668,
      y: 204,
      width: 184,
      height: 64,
      zoneId: 'ai-react',
      inspector: isVi
        ? {
            role: 'Bộ nhớ dài hạn phân tách theo org, agent và user',
            packageOrPort: 'ai-memory.js · latticeAiMemory',
            protocol: 'Advisory Context Delimiter · RLS',
            payloadOrSchema: '<dxos_memory_context advisory="true">...</dxos_memory_context>',
            responsibilities:
              'Cung cấp remember/recall/forget có kiểm soát quyền admin cho scope org/agent và bọc dữ liệu truy xuất trong thẻ advisory để chống chèn lệnh prompt.',
          }
        : {
            role: 'Persistent scoped memory with prompt-injection fencing',
            packageOrPort: 'ai-memory.js · latticeAiMemory',
            protocol: 'Advisory Context Delimiter · RLS',
            payloadOrSchema: '<dxos_memory_context advisory="true">...</dxos_memory_context>',
            responsibilities:
              'Manages remember, recall, and forget operations across org, agent, and user scopes, wrapping recalled entries in untrusted advisory delimiters.',
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
        [124, 120],
        [124, 204],
      ],
    },
    {
      id: 'r5',
      from: 'react_loop',
      to: 'react_loop',
      label: isVi ? 'Thought/Obs' : 'Thought/Obs',
      kind: 'flow',
      selfLoop: 'bottom',
    },
    { id: 'r6', from: 'react_loop', to: 'unified_tools', label: 'ALLOW', kind: 'primary' },
    { id: 'r7', from: 'unified_tools', to: 'hitl_exec', label: 'ASK', kind: 'flow' },
    { id: 'r8', from: 'hitl_exec', to: 'memory_vault', label: 'Recall', kind: 'dashed' },
    {
      id: 'r9',
      from: 'unified_tools',
      to: 'audit_ledger',
      label: 'Audit',
      kind: 'flow',
      points: [
        [336, 204],
        [336, 152],
        [760, 152],
        [760, 120],
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
      route: 'POST /api/dxosAi:chat',
      payload: 'orgDailyCalls <= 5000 · redactPiiText()',
      chips: ['7 Profiles', '9 PII Regex'],
    },
    {
      id: 'react-s2',
      title: isVi ? 'Suy luận LLM & vòng lặp ReAct' : 'LLM Turn & ReAct Loop',
      activeNodes: ['guardrails', 'llm_router', 'react_loop'],
      activeEdges: ['r2', 'r5'],
      description: isVi
        ? 'Mô hình đề xuất lời gọi công cụ; vòng lặp ReAct thực thi tối đa maxTurns (mặc định 5, trần 12) và phát trạng thái qua SSE.'
        : 'The routed LLM emits tool calls; the ReAct orchestrator iterates up to maxTurns (default 5, cap 12) while streaming SSE progress.',
      route: 'GET /api/dxosAi:surfaceEvents',
      payload: 'model: ag/gemini-3.8-flash | maxTurns: 5',
      chips: ['local-9router', 'SSE'],
    },
    {
      id: 'react-s3',
      title: isVi ? 'Thực thi 20 Unified Tools' : 'Execute 20 Unified Tools',
      activeNodes: ['react_loop', 'unified_tools', 'audit_ledger'],
      activeEdges: ['r6', 'r3', 'r9'],
      description: isVi
        ? 'Công cụ thuộc nhóm ALLOW chạy trực tiếp trong giao dịch PostgreSQL app.current_org và ghi dấu kiểm toán kèm chi phí token.'
        : 'ALLOW tools execute directly inside the transaction-scoped app.current_org RLS context and persist token metrics to latticeAiAuditLogs.',
      route: 'createAuditedTool()',
      payload: 'SET LOCAL app.current_org = <orgId>',
      chips: ['20 Tools', 'FORCE RLS'],
    },
    {
      id: 'react-s4',
      title: isVi ? 'Chặn HITL & ghi nhớ ngữ cảnh' : 'HITL Gate & Memory Recall',
      activeNodes: ['unified_tools', 'hitl_exec', 'memory_vault'],
      activeEdges: ['r7', 'r8'],
      description: isVi
        ? 'Thao tác ghi hoặc xử lý cảnh báo thuộc nhóm ASK tạm dừng tại hàng đợi HITL; kết quả được đối chiếu với bộ nhớ advisory chống chèn prompt.'
        : 'ASK-tier record mutations and alarm actions pause in latticeAiApprovalQueue for operator confirmation while memory recall stays advisory-fenced.',
      route: 'POST /api/dxosAi:decideApproval',
      payload: '<dxos_memory_context advisory="true">',
      chips: ['ASK Gate', 'Advisory Memory'],
    },
  ];

  // Mode 2: App Builder 2.0 Lifecycle
  const builderZones: DiagramZone[] = [
    {
      id: 'ab-provision',
      label: isVi ? 'Lập kế hoạch, Dựng ứng dụng & Tự sửa lỗi (dxos-architect)' : 'Plan, Provision & Self-Heal (dxos-architect)',
      x: 16,
      y: 16,
      width: 848,
      height: 128,
      kind: 'admin',
    },
    {
      id: 'ab-lifecycle',
      label: isVi ? 'Cập nhật phiên bản, Khôi phục, Tháo dỡ an toàn & Xuất Bundle' : 'Patch, Rollback, Safe Teardown & Bundle Export',
      x: 16,
      y: 160,
      width: 848,
      height: 204,
      kind: 'traffic',
    },
  ];

  const builderNodes: DiagramNode[] = [
    {
      id: 'architect_prompt',
      title: isVi ? 'dxos-architect' : 'dxos-architect',
      sub: 'adminOnly · root|admin',
      icon: 'bot',
      x: 32,
      y: 56,
      width: 184,
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
      title: isVi ? '1. Plan (Dry-Run)' : '1. Plan (Dry-Run)',
      sub: 'POST :planBuiltApp',
      icon: 'git-branch',
      x: 244,
      y: 56,
      width: 184,
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
              'Tạo bản nháp spec từ prompt, sắp xếp thứ tự phụ thuộc bảng bằng thuật toán Kahn và trả về bản xem trước thay đổi mà chưa chạm vào cơ sở dữ liệu.',
          }
        : {
            role: 'Zero-write ER topological planner and spec diff',
            packageOrPort: 'app-builder-planner.js · dxosAi:planBuiltApp',
            protocol: 'HTTPS POST · Zero DB Writes',
            payloadOrSchema: 'buildErGraph (Kahn topo sort) + computeSpecDiff',
            responsibilities:
              'Builds a draft spec from prompt input, resolves dependency order with Kahn topological sort, and computes structural diffs with zero database writes.',
          },
    },
    {
      id: 'build_app',
      title: isVi ? '2. Build & Repair' : '2. Build & Repair',
      sub: 'POST :buildBuiltApp',
      icon: 'layers',
      x: 456,
      y: 56,
      width: 184,
      height: 64,
      zoneId: 'ab-provision',
      focal: true,
      inspector: isVi
        ? {
            role: 'Khởi tạo toàn bộ bảng, RLS, vai trò, block, DMN và luồng',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:buildBuiltApp',
            protocol: 'PG Transaction · Up to 2 Self-Heal Rounds',
            payloadOrSchema: 'latticeCustom* + FORCE RLS + 12 BlockModels + LatticeFlow/DMN',
            responsibilities:
              'Chụp snapshot portal, tạo bảng tùy biến có FORCE RLS, gắn vai trò ldx_*, dựng 12 Native BlockModels, triển khai DMN/Flow và tự sửa lỗi tối đa 2 vòng.',
          }
        : {
            role: 'Full-stack provisioner with 2-round targeted self-repair',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:buildBuiltApp',
            protocol: 'PG Transaction · Up to 2 Self-Heal Rounds',
            payloadOrSchema: 'latticeCustom* + FORCE RLS + 12 BlockModels + LatticeFlow/DMN',
            responsibilities:
              'Snapshots portals, creates FORCE RLS custom collections, provisions ldx_* RBAC, mounts Native v2 blocks, deploys DMN/Flow rules, and runs up to 2 self-heal cycles.',
          },
    },
    {
      id: 'verify_app',
      title: isVi ? 'Kiểm chứng App' : 'Verify & Snapshot',
      sub: 'latticeBuiltApps',
      icon: 'check-circle',
      x: 668,
      y: 56,
      width: 184,
      height: 64,
      zoneId: 'ab-provision',
      inspector: isVi
        ? {
            role: 'Kiểm tra tính toàn vẹn cấu trúc và lưu phiên bản',
            packageOrPort: 'PG16 · latticeBuiltApps / Versions',
            protocol: 'verifyEnterpriseApp · RLS',
            payloadOrSchema: 'verify_app | list_built_apps | latticeUiSnapshots',
            responsibilities:
              'Xác nhận toàn bộ bảng, chính sách RLS, route portal và luồng hoạt động đồng bộ trước khi chốt bản ghi vào latticeBuiltAppVersions.',
          }
        : {
            role: 'Structural verification and version ledger commit',
            packageOrPort: 'PG16 · latticeBuiltApps / Versions',
            protocol: 'verifyEnterpriseApp · RLS',
            payloadOrSchema: 'verify_app | list_built_apps | latticeUiSnapshots',
            responsibilities:
              'Runs verifyEnterpriseApp across created collections, RLS policies, portal routes, and automations, persisting immutable version records.',
          },
    },
    {
      id: 'patch_app',
      title: isVi ? '3. Patch Spec' : '3. Patch Spec',
      sub: 'POST :patchBuiltApp',
      icon: 'terminal',
      x: 32,
      y: 212,
      width: 184,
      height: 64,
      zoneId: 'ab-lifecycle',
      inspector: isVi
        ? {
            role: 'Cập nhật tăng dần mà không phá vỡ dữ liệu hiện có',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:patchBuiltApp',
            protocol: 'HTTPS POST · Incremental Diff',
            payloadOrSchema: 'applySpecPatch + latticeBuiltAppVersions++',
            responsibilities:
              'Áp dụng phần thay đổi cho collection, block hoặc quy tắc mới và tự động tạo phiên bản mới trong latticeBuiltAppVersions để sẵn sàng rollback.',
          }
        : {
            role: 'Incremental non-destructive specification patcher',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:patchBuiltApp',
            protocol: 'HTTPS POST · Incremental Diff',
            payloadOrSchema: 'applySpecPatch + latticeBuiltAppVersions++',
            responsibilities:
              'Applies incremental field, block, and workflow updates while storing a pre-patch snapshot in latticeBuiltAppVersions.',
          },
    },
    {
      id: 'rollback_app',
      title: isVi ? '4. Rollback' : '4. Rollback',
      sub: 'POST :rollbackBuiltApp',
      icon: 'activity',
      x: 244,
      y: 212,
      width: 184,
      height: 64,
      zoneId: 'ab-lifecycle',
      inspector: isVi
        ? {
            role: 'Khôi phục giao diện, block và quyền về targetVersion',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:rollbackBuiltApp',
            protocol: 'HTTPS POST · Time-Machine Restore',
            payloadOrSchema: '{ builtAppId, targetVersion } -> latticeUiSnapshots',
            responsibilities:
              'Phục hồi toàn bộ bố cục portal, block FlowEngine, phân quyền vai trò và spec về đúng phiên bản mục tiêu đã lưu.',
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
      id: 'teardown_app',
      title: isVi ? '5. Safe Teardown' : '5. Safe Teardown',
      sub: 'POST :teardownBuiltApp',
      icon: 'shield',
      x: 456,
      y: 212,
      width: 184,
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
              'Mặc định giữ lại dữ liệu (keepData=true), quét toàn bộ latticeBuiltApps liên tổ chức trước để tuyệt đối không xóa bảng, vai trò hay portal đang dùng chung.',
          }
        : {
            role: 'Cross-org safe teardown protecting shared data and roles',
            packageOrPort: 'app-builder-orchestrator.js · dxosAi:teardownBuiltApp',
            protocol: 'System RLS Cross-Org Audit · keepData=true',
            payloadOrSchema: 'keepData: true (default) | BUILTIN_PROTECTED_ROLES guard',
            responsibilities:
              'Defaults keepData=true and inspects all tenant and cross-org latticeBuiltApps first so shared collections, built-in roles, and shared portals are never dropped.',
          },
    },
    {
      id: 'bundle_export',
      title: isVi ? 'Xuất Bundle v3' : 'Bundle v3 Export',
      sub: 'solution-bundle/v3',
      icon: 'box',
      x: 668,
      y: 212,
      width: 184,
      height: 64,
      zoneId: 'ab-lifecycle',
      inspector: isVi
        ? {
            role: 'Đóng gói ứng dụng thành GitOps Solution Bundle v3',
            packageOrPort: 'solution-bundle.js · dxosStudio:solutionBundleExport',
            protocol: 'JSON · SHA-256 contentSha256',
            payloadOrSchema: 'latticedx.solution-bundle/v3 (8 top-level keys)',
            responsibilities:
              'Xuất khẩu roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks và governance với chữ ký toàn vẹn SHA-256.',
          }
        : {
            role: 'Exports provisioned apps as GitOps Solution Bundle v3',
            packageOrPort: 'solution-bundle.js · dxosStudio:solutionBundleExport',
            protocol: 'JSON · SHA-256 contentSha256',
            payloadOrSchema: 'latticedx.solution-bundle/v3 (8 top-level keys)',
            responsibilities:
              'Serializes roles, portals, workflows, aiProfiles, customCollections, connectors, routesAndBlocks, and governance with SHA-256 digest verification.',
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
      label: 'v2+',
      kind: 'flow',
      points: [
        [760, 120],
        [760, 152],
        [124, 152],
        [124, 212],
      ],
    },
    { id: 'b5', from: 'patch_app', to: 'rollback_app', label: 'Snapshot', kind: 'flow' },
    { id: 'b6', from: 'rollback_app', to: 'teardown_app', label: 'Retire', kind: 'dashed' },
    {
      id: 'b7',
      from: 'verify_app',
      to: 'bundle_export',
      label: 'GitOps',
      kind: 'flow',
      points: [
        [788, 120],
        [788, 212],
      ],
    },
  ];

  const builderSteps: DiagramStep[] = [
    {
      id: 'ab-s1',
      title: isVi ? 'Lập kế hoạch không ghi DB' : 'Dry-Run Plan (ER Graph)',
      activeNodes: ['architect_prompt', 'plan_app'],
      activeEdges: ['b1'],
      description: isVi
        ? 'dxos-architect gọi planBuiltApp để dựng đồ thị ER theo thuật toán Kahn và tính toán spec diff mà chưa tạo bảng thực tế.'
        : 'dxos-architect invokes planBuiltApp to generate a Kahn-sorted ER graph and structural diff with zero database mutations.',
      route: 'POST /api/dxosAi:planBuiltApp',
      payload: 'buildErGraph() + computeSpecDiff()',
      chips: ['Dry-Run', 'Kahn Sort'],
    },
    {
      id: 'ab-s2',
      title: isVi ? 'Khởi tạo & tự sửa lỗi' : 'Provision & Self-Heal',
      activeNodes: ['plan_app', 'build_app', 'verify_app'],
      activeEdges: ['b2', 'b3'],
      description: isVi
        ? 'buildBuiltApp tạo bảng FORCE RLS, 12 BlockModels, quy tắc DMN/Flow, sau đó chạy verifyEnterpriseApp và tối đa 2 vòng applyTargetedRepair.'
        : 'buildBuiltApp creates FORCE RLS tables, 12 BlockModels, and DMN/Flow rules, then runs verifyEnterpriseApp with up to 2 applyTargetedRepair rounds.',
      route: 'POST /api/dxosAi:buildBuiltApp',
      payload: 'DEFAULT_SELF_HEAL_MAX_ROUNDS = 2',
      chips: ['FORCE RLS', 'Self-Heal'],
    },
    {
      id: 'ab-s3',
      title: isVi ? 'Cập nhật & khôi phục phiên bản' : 'Patch & Version Rollback',
      activeNodes: ['verify_app', 'patch_app', 'rollback_app'],
      activeEdges: ['b4', 'b5'],
      description: isVi
        ? 'patchBuiltApp lưu vết thay đổi vào latticeBuiltAppVersions; rollbackBuiltApp khôi phục layout UI, block và vai trò về targetVersion.'
        : 'patchBuiltApp records versioned updates in latticeBuiltAppVersions; rollbackBuiltApp restores snapshots, blocks, and roles to targetVersion.',
      route: 'POST /api/dxosAi:rollbackBuiltApp',
      payload: 'latticeUiSnapshots -> targetVersion',
      chips: ['Versioned', 'Time-Machine'],
    },
    {
      id: 'ab-s4',
      title: isVi ? 'Tháo dỡ an toàn & xuất Bundle v3' : 'Safe Teardown & Bundle v3',
      activeNodes: ['rollback_app', 'teardown_app', 'bundle_export', 'verify_app'],
      activeEdges: ['b6', 'b7'],
      description: isVi
        ? 'teardownBuiltApp mặc định keepData=true và kiểm tra bảng dùng chung liên tổ chức; export_app_bundle xuất chuẩn Solution Bundle v3.'
        : 'teardownBuiltApp defaults keepData=true after cross-org shared-artifact checks; export_app_bundle emits Solution Bundle v3.',
      route: 'POST /api/dxosAi:teardownBuiltApp',
      payload: 'keepData: true | latticedx.solution-bundle/v3',
      chips: ['Safe Teardown', 'Bundle v3'],
    },
  ];

  // Mode 3: MCP Gateway & A2A Protocol
  const protoZones: DiagramZone[] = [
    {
      id: 'ext-clients',
      label: isVi ? 'Client Ngoài (Bearer)' : 'External Clients (Bearer)',
      x: 16,
      y: 16,
      width: 224,
      height: 344,
      kind: 'external',
    },
    {
      id: 'dxos-gateways',
      label: isVi ? 'Cổng MCP Gateway, A2A & Kiểm soát Quản trị' : 'MCP Gateway, A2A & Governance Plane',
      x: 256,
      y: 16,
      width: 608,
      height: 344,
      kind: 'admin',
    },
  ];

  const protoNodes: DiagramNode[] = [
    {
      id: 'mcp_client',
      title: isVi ? 'MCP Client' : 'MCP Client',
      sub: 'JSON-RPC 2.0 · Bearer',
      icon: 'terminal',
      x: 32,
      y: 64,
      width: 192,
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
      title: isVi ? 'A2A Peer Agent' : 'A2A Peer Agent',
      sub: 'Agent Card · Bearer',
      icon: 'globe',
      x: 32,
      y: 220,
      width: 192,
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
      title: isVi ? 'MCP Gateway' : 'MCP Gateway',
      sub: 'POST /api/dxos-mcp',
      icon: 'plug',
      x: 276,
      y: 64,
      width: 176,
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
      title: isVi ? '4 IT/OT MCP' : '4 IT/OT MCP',
      sub: '/api/dxos-mcp/it-ot',
      icon: 'radio',
      x: 476,
      y: 64,
      width: 176,
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
      x: 676,
      y: 64,
      width: 176,
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
      title: isVi ? 'A2A Gateway' : 'A2A Gateway',
      sub: '/.well-known/agent-card.json',
      icon: 'server',
      x: 276,
      y: 220,
      width: 176,
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
      sub: 'latticeA2aTasks · RLS',
      icon: 'database',
      x: 476,
      y: 220,
      width: 176,
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
      title: isVi ? 'Eval & Guardrails' : 'Eval & Guardrails',
      sub: 'WAVE1_3 · RED_TEAM · VN_NL',
      icon: 'shield',
      x: 676,
      y: 220,
      width: 176,
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
        [364, 128],
        [364, 160],
        [764, 160],
        [764, 128],
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
        [764, 128],
        [764, 220],
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
      summary: isVi ? '7 Hồ sơ · 20+4 Tool · PII/Quota' : '7 Profiles · 20+4 Tools · PII/Quota',
      zones: reactZones,
      nodes: reactNodes,
      edges: reactEdges,
      steps: reactSteps,
    },
    {
      id: 'app-builder',
      label: isVi ? 'App Builder 2.0' : 'App Builder 2.0',
      summary: 'plan -> build -> patch -> rollback -> teardown',
      zones: builderZones,
      nodes: builderNodes,
      edges: builderEdges,
      steps: builderSteps,
    },
    {
      id: 'mcp-a2a',
      label: isVi ? 'MCP & A2A' : 'MCP & A2A',
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
    viewBox="0 0 880 380"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
