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

const props = defineProps<{
  lang?: DiagramLocale;
  compact?: boolean;
}>();

const vpData = inject(dataSymbol, null);

const locale = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const matrixZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'tier-experience',
          label: 'Tầng 1 & 4 & 5 — Biên Zero-Trust · Đa Cổng · Trí tuệ AI',
          x: 16,
          y: 12,
          width: 848,
          height: 112,
          kind: 'admin',
        },
        {
          id: 'tier-orchestration',
          label: 'Tầng 2 & 3 — Điều phối Luồng DAG · Sự kiện · IT/OT Digital Twin',
          x: 16,
          y: 140,
          width: 848,
          height: 112,
          kind: 'traffic',
        },
        {
          id: 'tier-substrate',
          label: 'Tầng 6 — Nền tảng NocoBase 2.2.50 · 56 Bảng PG16 FORCE RLS · PKI',
          x: 16,
          y: 268,
          width: 848,
          height: 116,
          kind: 'admin',
        },
      ]
    : [
        {
          id: 'tier-experience',
          label: 'Planes 1, 4 & 5 — Zero-Trust Edge · Multi-Portal UI · Agentic AI',
          x: 16,
          y: 12,
          width: 848,
          height: 112,
          kind: 'admin',
        },
        {
          id: 'tier-orchestration',
          label: 'Planes 2 & 3 — DAG Orchestration · Event Outbox · IT/OT Digital Twin',
          x: 16,
          y: 140,
          width: 848,
          height: 112,
          kind: 'traffic',
        },
        {
          id: 'tier-substrate',
          label: 'Plane 6 — NocoBase 2.2.50 Host · 56-Table PG16 FORCE RLS · PKI',
          x: 16,
          y: 268,
          width: 848,
          height: 116,
          kind: 'admin',
        },
      ],
);

const matrixNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'p4-portals',
      title: isVi ? 'Đa Cổng UI' : 'Multi-Portal UI',
      sub: 'P4 · /p/* · 12 Blocks · PWA',
      icon: 'layers',
      x: 36,
      y: 48,
      width: 240,
      height: 64,
      zoneId: 'tier-experience',
      inspector: isVi
        ? {
            role: 'Mặt phẳng 4 — Cổng vai trò, Biểu mẫu công khai & PWA ngoại tuyến',
            packageOrPort: '@latticedx/plugin-dxos-blocks · @latticedx/plugin-lattice-foundation',
            protocol: 'HTTPS · SSE · IndexedDB Outbox',
            payloadOrSchema: '/p/<slug> | /v/form/:slug | /v/mobile | /v/track/:code',
            responsibilities:
              'Cung cấp 12 Native v2 BlockModels, WebGIS MapLibre, Kanban/FEFO và hàng đợi ngoại tuyến IndexedDB có cơ chế cách ly xung đột.',
          }
        : {
            role: 'Plane 4 — Role Portals, Public Forms & Offline Field PWA',
            packageOrPort: '@latticedx/plugin-dxos-blocks · @latticedx/plugin-lattice-foundation',
            protocol: 'HTTPS · SSE · IndexedDB Outbox',
            payloadOrSchema: '/p/<slug> | /v/form/:slug | /v/mobile | /v/track/:code',
            responsibilities:
              'Delivers 12 Native v2 BlockModels, MapLibre WebGIS, FEFO warehouse operations, and an IndexedDB field outbox with conflict quarantine.',
          },
    },
    {
      id: 'p1-edge',
      title: isVi ? 'Biên Zero-Trust' : 'Zero-Trust Edge',
      sub: 'P1 · Caddy · APISIX · OIDC',
      icon: 'shield',
      x: 320,
      y: 48,
      width: 240,
      height: 64,
      zoneId: 'tier-experience',
      focal: true,
      inspector: isVi
        ? {
            role: 'Mặt phẳng 1 — Biên TLS, Cổng API & Xác thực Định danh PKCE',
            packageOrPort: 'caddy:2.10 · apisix:3.19.0 · keycloak:26.8.2 · valkey:8.1',
            protocol: 'HTTPS TLS · OIDC PKCE S256 · X-Lattice-API-Key',
            payloadOrSchema: '/api/enterpriseAuth:* | ldx_pat_<8hex>_<32hex>',
            responsibilities:
              'Chấm dứt TLS với HSTS/CSP nonce, giới hạn tốc độ qua Valkey, xác thực Keycloak OIDC/PKCE và chặn leo thang quyền vai trò quản trị.',
          }
        : {
            role: 'Plane 1 — TLS Edge, API Gateway & OIDC PKCE Identity',
            packageOrPort: 'caddy:2.10 · apisix:3.19.0 · keycloak:26.8.2 · valkey:8.1',
            protocol: 'HTTPS TLS · OIDC PKCE S256 · X-Lattice-API-Key',
            payloadOrSchema: '/api/enterpriseAuth:* | ldx_pat_<8hex>_<32hex>',
            responsibilities:
              'Enforces TLS with strict CSP nonces, Valkey-backed rate limits, Keycloak PKCE S256 login, and backchannel session revocation.',
          },
    },
    {
      id: 'p5-ai',
      title: isVi ? 'Trí tuệ AI' : 'Agentic AI',
      sub: 'P5 · 7 Profiles · MCP · A2A',
      icon: 'bot',
      x: 604,
      y: 48,
      width: 240,
      height: 64,
      zoneId: 'tier-experience',
      inspector: isVi
        ? {
            role: 'Mặt phẳng 5 — AI Workforce, App Builder 2.0, MCP & A2A',
            packageOrPort: '@latticedx/plugin-dxos-ai · /api/dxos-mcp · /api/dxos-a2a',
            protocol: 'JSON-RPC 2.0 Streamable HTTP · pgvector HNSW + BM25 RRF',
            payloadOrSchema: 'dxosAi:* | /.well-known/agent-card.json | latticeParaChunks',
            responsibilities:
              'Vận hành 7 Agent Profiles, 20 Unified Tools có kiểm soát HITL, quy trình App Builder 2.0 (plan/build/patch/rollback) và lọc PII trước khi ghi dấu vết.',
          }
        : {
            role: 'Plane 5 — AI Workforce, App Builder 2.0, MCP & A2A',
            packageOrPort: '@latticedx/plugin-dxos-ai · /api/dxos-mcp · /api/dxos-a2a',
            protocol: 'JSON-RPC 2.0 Streamable HTTP · pgvector HNSW + BM25 RRF',
            payloadOrSchema: 'dxosAi:* | /.well-known/agent-card.json | latticeParaChunks',
            responsibilities:
              'Runs 7 Agent Profiles, 20 audited Unified Tools with HITL gates, App Builder 2.0 lifecycle orchestration, and Vietnamese PII redaction.',
          },
    },
    {
      id: 'p3-flow',
      title: isVi ? 'Luồng & DMN' : 'Flow & DMN',
      sub: 'P3 · 24 Nodes · FEEL · FEFO',
      icon: 'workflow',
      x: 36,
      y: 176,
      width: 240,
      height: 64,
      zoneId: 'tier-orchestration',
      focal: true,
      inspector: isVi
        ? {
            role: 'Mặt phẳng 3 — Động cơ DAG LatticeFlow v2, Visual DMN & WMS',
            packageOrPort: '@latticedx/plugin-dxos-studio · n8n:2.48.1 (opt-in)',
            protocol: 'JSON/YAML DSL · FEEL Hit Policy · M-of-N Quorum',
            payloadOrSchema: 'dxosAutomations:* | dxosDmn:* | dxosWms:* | dxosApprovals:*',
            responsibilities:
              'Thực thi đồ thị DAG 24 loại node với loopCursor bền vững, bảng quyết định DMN (FIRST/UNIQUE/COLLECT/PRIORITY) và phân bổ lô FEFO.',
          }
        : {
            role: 'Plane 3 — LatticeFlow v2 DAG, Visual DMN & Cold-Chain WMS',
            packageOrPort: '@latticedx/plugin-dxos-studio · n8n:2.48.1 (opt-in)',
            protocol: 'JSON/YAML DSL · FEEL Hit Policy · M-of-N Quorum',
            payloadOrSchema: 'dxosAutomations:* | dxosDmn:* | dxosWms:* | dxosApprovals:*',
            responsibilities:
              'Executes 24-node DAG flows with durable loop cursors, DMN rule tables, M-of-N approvals, OAuth2 PKCE n8n bridges, and FEFO lot allocation.',
          },
    },
    {
      id: 'p3-outbox',
      title: isVi ? 'Bus Sự kiện' : 'CloudEvents Bus',
      sub: 'P3 · SKIP LOCKED · Valkey',
      icon: 'git-branch',
      x: 320,
      y: 176,
      width: 240,
      height: 64,
      zoneId: 'tier-orchestration',
      inspector: isVi
        ? {
            role: 'Mặt phẳng 3 — Hàng đợi Outbox Giao dịch & CloudEvents 1.0',
            packageOrPort: '@latticedx/plugin-lattice-foundation · valkey:8.1 (DB 1)',
            protocol: 'CloudEvents 1.0 · Standard Webhooks HMAC · Redis PubSub',
            payloadOrSchema: 'latticeEventBus | latticeContextOutbox | latticedx:surface-updates',
            responsibilities:
              'Rút hàng đợi bằng khóa PostgreSQL FOR UPDATE SKIP LOCKED theo thứ tự FIFO từng thực thể, kèm bộ ngắt mạch và hàng đợi DLQ.',
          }
        : {
            role: 'Plane 3 — Transactional Outbox & CloudEvents 1.0 Bus',
            packageOrPort: '@latticedx/plugin-lattice-foundation · valkey:8.1 (DB 1)',
            protocol: 'CloudEvents 1.0 · Standard Webhooks HMAC · Redis PubSub',
            payloadOrSchema: 'latticeEventBus | latticeContextOutbox | latticedx:surface-updates',
            responsibilities:
              'Drains outbox rows with PostgreSQL FOR UPDATE SKIP LOCKED per-entity FIFO ordering, circuit breakers, DLQ replay, and Valkey DB 1 SSE updates.',
          },
    },
    {
      id: 'p2-iiot',
      title: isVi ? 'Bản sao Số OT' : 'IT/OT Twin',
      sub: 'P2 · Mosquitto · Orion-LD',
      icon: 'radio',
      x: 604,
      y: 176,
      width: 240,
      height: 64,
      zoneId: 'tier-orchestration',
      inspector: isVi
        ? {
            role: 'Mặt phẳng 2 — Giám sát Cảm biến IIoT & Digital Twin 2 chiều',
            packageOrPort: 'mosquitto:2.0.21 · orion-ld:1.12.0 · nodered:4.0.9',
            protocol: 'MQTT DynSec LWT (:1883) · NGSI-LD (:1026) · HTTP Downlink',
            payloadOrSchema: 'urn:ngsi-ld:Asset:<org>:native:<id> | Arrhenius MKT',
            responsibilities:
              'Đồng bộ trạng thái thiết bị qua Mosquitto DynSec/LWT, tính toán nhiệt độ động học Arrhenius MKT và áp dụng cổng HITL khi lệch > 2.0°C.',
          }
        : {
            role: 'Plane 2 — IIoT Edge Telemetry & 2-Way Digital Twin',
            packageOrPort: 'mosquitto:2.0.21 · orion-ld:1.12.0 · nodered:4.0.9',
            protocol: 'MQTT DynSec LWT (:1883) · NGSI-LD (:1026) · HTTP Downlink',
            payloadOrSchema: 'urn:ngsi-ld:Asset:<org>:native:<id> | Arrhenius MKT',
            responsibilities:
              'Streams MQTT DynSec telemetry into FIWARE Orion-LD twins, computes Arrhenius MKT, and enforces HITL approval on setpoints > 2.0 C.',
          },
    },
    {
      id: 'p6-host',
      title: isVi ? 'Host NocoBase' : 'NocoBase Host',
      sub: 'P6 · v2.2.50 · 7 Plugins',
      icon: 'server',
      x: 112,
      y: 304,
      width: 280,
      height: 64,
      zoneId: 'tier-substrate',
      focal: true,
      inspector: isVi
        ? {
            role: 'Mặt phẳng 6 — Runtime NocoBase Độc lập & 7 Plugin Apache-2.0',
            packageOrPort: 'nocobase/nocobase:2.2.50 · @latticedx/* (sdkProvidedByHost: true)',
            protocol: 'HTTP :80 · OpenAPI 3.1 · AsyncAPI 3.0 · OTLP :4318',
            payloadOrSchema: '/api/<resource>:<action> | /api/dxos:openapi | /api/dxos:metrics',
            responsibilities:
              'Gắn kết 7 plugin Apache-2.0 dạng chỉ đọc vào container NocoBase 2.2.50, giữ nguyên Điều 5.2 và xuất telemetry OTel/Prometheus.',
          }
        : {
            role: 'Plane 6 — External NocoBase Runtime & 7 Apache-2.0 Plugins',
            packageOrPort: 'nocobase/nocobase:2.2.50 · @latticedx/* (sdkProvidedByHost: true)',
            protocol: 'HTTP :80 · OpenAPI 3.1 · AsyncAPI 3.0 · OTLP :4318',
            payloadOrSchema: '/api/<resource>:<action> | /api/dxos:openapi | /api/dxos:metrics',
            responsibilities:
              'Mounts 7 read-only Apache-2.0 plugins into external nocobase/nocobase:2.2.50, preserving Clause 5.2 attribution and emitting OTel/Prometheus metrics.',
          },
    },
    {
      id: 'p6-pg16',
      title: 'PG16 FORCE RLS',
      sub: 'P6 · 56 Tables · PKI · PITR',
      icon: 'database',
      x: 488,
      y: 304,
      width: 280,
      height: 64,
      zoneId: 'tier-substrate',
      inspector: isVi
        ? {
            role: 'Mặt phẳng 6 — Cô lập Đa-Tenant PG16, Sổ cái Merkle & Sao lưu PITR',
            packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · nocobase_app (NOBYPASSRLS)',
            protocol: 'SQL Transaction GUC (app.current_org / app.rls_bypass) · Ed25519',
            payloadOrSchema: '56 FORCE RLS tables · latticeCryptoLedger · WAL .gz PITR',
            responsibilities:
              'Áp dụng FORCE ROW LEVEL SECURITY trên 56 bảng tĩnh và bảng động latticeCustom*, ký sổ cái chuỗi băm Ed25519/Merkle và lưu WAL PITR.',
          }
        : {
            role: 'Plane 6 — PG16 Tenant Isolation, Merkle PKI Ledger & PITR',
            packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · nocobase_app (NOBYPASSRLS)',
            protocol: 'Transaction GUC (app.current_org / app.rls_bypass) · Ed25519',
            payloadOrSchema: '56 FORCE RLS tables · latticeCryptoLedger · WAL .gz PITR',
            responsibilities:
              'Enforces FORCE ROW LEVEL SECURITY across 56 static and dynamic latticeCustom* tables, signs Ed25519 Merkle entries, and archives WAL .gz segments.',
          },
    },
  ];
});

const matrixEdges = computed<DiagramEdge[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'm-portals-edge',
      from: 'p4-portals',
      to: 'p1-edge',
      label: 'TLS',
      kind: 'flow',
      points: [
        [276, 80],
        [320, 80],
      ],
    },
    {
      id: 'm-edge-ai',
      from: 'p1-edge',
      to: 'p5-ai',
      label: 'RBAC',
      kind: 'flow',
      points: [
        [560, 80],
        [604, 80],
      ],
    },
    {
      id: 'm-edge-host',
      from: 'p1-edge',
      to: 'p6-host',
      kind: 'primary',
      points: [
        [440, 112],
        [440, 132],
        [296, 132],
        [296, 260],
        [252, 260],
        [252, 304],
      ],
    },
    {
      id: 'm-host-flow',
      from: 'p6-host',
      to: 'p3-flow',
      kind: 'primary',
      points: [
        [156, 304],
        [156, 240],
      ],
    },
    {
      id: 'm-flow-outbox',
      from: 'p3-flow',
      to: 'p3-outbox',
      label: 'DAG',
      kind: 'flow',
      points: [
        [276, 208],
        [320, 208],
      ],
    },
    {
      id: 'm-outbox-iiot',
      from: 'p3-outbox',
      to: 'p2-iiot',
      label: 'NGSI',
      kind: 'flow',
      points: [
        [560, 208],
        [604, 208],
      ],
    },
    {
      id: 'm-ai-outbox',
      from: 'p5-ai',
      to: 'p3-outbox',
      kind: 'dashed',
      points: [
        [724, 112],
        [724, 132],
        [440, 132],
        [440, 176],
      ],
    },
    {
      id: 'm-host-pg16',
      from: 'p6-host',
      to: 'p6-pg16',
      label: isVi ? 'app.current_org' : 'app.current_org',
      kind: 'primary',
      points: [
        [392, 336],
        [488, 336],
      ],
    },
    {
      id: 'm-iiot-pg16',
      from: 'p2-iiot',
      to: 'p6-pg16',
      kind: 'flow',
      points: [
        [724, 240],
        [724, 260],
        [628, 260],
        [628, 304],
      ],
    },
  ];
});

const matrixSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'step-ingress',
          title: 'Xác thực Biên Zero-Trust',
          activeNodes: ['p4-portals', 'p1-edge', 'p6-host'],
          activeEdges: ['m-portals-edge', 'm-edge-host'],
          description:
            'Yêu cầu từ cổng /p/*, biểu mẫu /v/form hoặc PWA đi qua Caddy TLS và APISIX để xác thực Keycloak PKCE hoặc khóa ldx_pat_* trước khi vào NocoBase.',
          route: 'HTTPS -> Caddy 2.10 -> APISIX 3.19.0 -> NocoBase 2.2.50',
          chips: ['OIDC PKCE S256', 'Valkey DB 2', 'CSP Nonce'],
        },
        {
          id: 'step-rls',
          title: 'Gắn Ngữ cảnh PG16 FORCE RLS',
          activeNodes: ['p6-host', 'p6-pg16'],
          activeEdges: ['m-host-pg16'],
          description:
            'AsyncLocalStorage mở giao dịch PostgreSQL dưới role nocobase_app (NOBYPASSRLS) và gán biến cục bộ app.current_org trên toàn bộ 56 bảng FORCE RLS.',
          route: 'pg-rls.js -> withTenantRlsContext()',
          payload: "SELECT set_config('app.current_org', :orgId, true);",
          chips: ['56 FORCE RLS', 'nocobase_app', 'Ed25519 PKI'],
        },
        {
          id: 'step-flow',
          title: 'Điều phối LatticeFlow v2 & DMN',
          activeNodes: ['p6-host', 'p3-flow', 'p3-outbox'],
          activeEdges: ['m-host-flow', 'm-flow-outbox'],
          description:
            'Động cơ DAG 24 node đánh giá bảng luật DMN FEEL, tạm dừng phê duyệt M-of-N với loopCursor bền vững và đẩy sự kiện vào bảng outbox.',
          route: 'POST /api/dxosAutomations:runNow',
          payload: 'CloudEvents 1.0 -> FOR UPDATE SKIP LOCKED',
          chips: ['24 DAG Nodes', 'FEEL DMN', 'DLQ & Circuit Breaker'],
        },
        {
          id: 'step-iiot',
          title: 'Đồng bộ Digital Twin & Arrhenius MKT',
          activeNodes: ['p3-outbox', 'p2-iiot', 'p6-pg16'],
          activeEdges: ['m-outbox-iiot', 'm-iiot-pg16'],
          description:
            'Cảm biến gửi telemetry qua Mosquitto DynSec tới FIWARE Orion-LD; hệ thống tính nhiệt độ MKT và kích hoạt giữ lô hold_mkt hoặc lệnh Node-RED.',
          route: 'MQTT :1883 -> Orion-LD :1026 -> Node-RED :1880',
          chips: ['DynSec LWT', 'NGSI-LD', 'HITL > 2.0C'],
        },
        {
          id: 'step-ai',
          title: 'Tác vụ Agentic AI & MCP/A2A',
          activeNodes: ['p1-edge', 'p5-ai', 'p3-outbox'],
          activeEdges: ['m-edge-ai', 'm-ai-outbox'],
          description:
            '7 Agent Profiles thực thi 20 Unified Tools qua cổng MCP/A2A có kiểm tra hạn mức PostgreSQL, tìm kiếm lai pgvector RRF và ẩn danh PII Việt Nam.',
          route: 'POST /api/dxos-mcp | POST /api/dxos-a2a',
          chips: ['20 Unified Tools', 'pgvector HNSW + BM25', 'PII Redaction'],
        },
      ]
    : [
        {
          id: 'step-ingress',
          title: 'Zero-Trust Edge Ingress',
          activeNodes: ['p4-portals', 'p1-edge', 'p6-host'],
          activeEdges: ['m-portals-edge', 'm-edge-host'],
          description:
            'Portal, public form, and mobile PWA traffic passes through Caddy TLS and APISIX rate limits, validating Keycloak PKCE or ldx_pat_* credentials before reaching NocoBase.',
          route: 'HTTPS -> Caddy 2.10 -> APISIX 3.19.0 -> NocoBase 2.2.50',
          chips: ['OIDC PKCE S256', 'Valkey DB 2', 'CSP Nonce'],
        },
        {
          id: 'step-rls',
          title: 'Bind PG16 FORCE RLS Context',
          activeNodes: ['p6-host', 'p6-pg16'],
          activeEdges: ['m-host-pg16'],
          description:
            'AsyncLocalStorage wraps every repository query in a nocobase_app (NOBYPASSRLS) transaction with transaction-local app.current_org across 56 FORCE RLS tables.',
          route: 'pg-rls.js -> withTenantRlsContext()',
          payload: "SELECT set_config('app.current_org', :orgId, true);",
          chips: ['56 FORCE RLS', 'nocobase_app', 'Ed25519 PKI'],
        },
        {
          id: 'step-flow',
          title: 'LatticeFlow v2 & DMN Execution',
          activeNodes: ['p6-host', 'p3-flow', 'p3-outbox'],
          activeEdges: ['m-host-flow', 'm-flow-outbox'],
          description:
            'The 24-node DAG engine evaluates FEEL decision tables, checkpoints durable loopCursor HITL pauses, and enqueues CloudEvents 1.0 outbox deliveries.',
          route: 'POST /api/dxosAutomations:runNow',
          payload: 'CloudEvents 1.0 -> FOR UPDATE SKIP LOCKED',
          chips: ['24 DAG Nodes', 'FEEL DMN', 'DLQ & Circuit Breaker'],
        },
        {
          id: 'step-iiot',
          title: 'Digital Twin & Arrhenius MKT',
          activeNodes: ['p3-outbox', 'p2-iiot', 'p6-pg16'],
          activeEdges: ['m-outbox-iiot', 'm-iiot-pg16'],
          description:
            'Mosquitto DynSec telemetry updates FIWARE Orion-LD twins while Arrhenius MKT evaluation triggers hold_mkt quarantine or HITL-gated Node-RED downlinks.',
          route: 'MQTT :1883 -> Orion-LD :1026 -> Node-RED :1880',
          chips: ['DynSec LWT', 'NGSI-LD', 'HITL > 2.0C'],
        },
        {
          id: 'step-ai',
          title: 'Agentic AI & MCP/A2A Gateway',
          activeNodes: ['p1-edge', 'p5-ai', 'p3-outbox'],
          activeEdges: ['m-edge-ai', 'm-ai-outbox'],
          description:
            'Seven Agent Profiles invoke 20 audited Unified Tools via MCP or A2A with PostgreSQL token quotas, pgvector RRF hybrid search, and Vietnamese PII redaction.',
          route: 'POST /api/dxos-mcp | POST /api/dxos-a2a',
          chips: ['20 Unified Tools', 'pgvector HNSW + BM25', 'PII Redaction'],
        },
      ],
);

const flowZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'flow-edge',
          label: 'Chuỗi Xử lý Yêu cầu Xuyên suốt 6 Mặt phẳng',
          x: 16,
          y: 12,
          width: 848,
          height: 368,
          kind: 'traffic',
        },
      ]
    : [
        {
          id: 'flow-edge',
          label: 'End-to-End Request Lifecycle Across 6 Planes',
          x: 16,
          y: 12,
          width: 848,
          height: 368,
          kind: 'traffic',
        },
      ],
);

const flowNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'f-client',
      title: isVi ? 'Người dùng & OT' : 'Portal & OT Edge',
      sub: '/p/* · /v/mobile · MQTT',
      icon: 'globe',
      x: 40,
      y: 60,
      width: 200,
      height: 64,
      zoneId: 'flow-edge',
      inspector: isVi
        ? {
            role: 'Điểm phát sinh lưu lượng người dùng và thiết bị biên',
            packageOrPort: 'Web /p/* · PWA /v/mobile · Mosquitto :1883',
            protocol: 'HTTPS · MQTT QoS 1 (DynSec + LWT)',
            payloadOrSchema: '/v/form/:slug | /v/track/:code | latticedx/<org>/<dev>/#',
            responsibilities:
              'Khởi tạo yêu cầu nghiệp vụ, hàng đợi ngoại tuyến IndexedDB hoặc gói tin cảm biến trước khi đi qua biên kiểm soát.',
          }
        : {
            role: 'Portal, Field PWA & Edge Telemetry Origin',
            packageOrPort: 'Web /p/* · PWA /v/mobile · Mosquitto :1883',
            protocol: 'HTTPS · MQTT QoS 1 (DynSec + LWT)',
            payloadOrSchema: '/v/form/:slug | /v/track/:code | latticedx/<org>/<dev>/#',
            responsibilities:
              'Initiates portal actions, offline IndexedDB outbox syncs, or authenticated MQTT device telemetry.',
          },
    },
    {
      id: 'f-gateway',
      title: 'Caddy & APISIX',
      sub: ':443 TLS · :9080 Limit',
      icon: 'shield',
      x: 340,
      y: 60,
      width: 200,
      height: 64,
      zoneId: 'flow-edge',
      focal: true,
      inspector: isVi
        ? {
            role: 'Lớp biên TLS và cổng API Zero-Trust',
            packageOrPort: 'caddy:2.10-alpine · apache/apisix:3.19.0',
            protocol: 'TLS 1.3 · HSTS · Valkey limit-count',
            payloadOrSchema: 'X-Request-Id · openid-connect (bearer_only)',
            responsibilities:
              'Gắn X-Request-Id, áp dụng CORS chặt chẽ, giới hạn 120–300 req/60s theo IP qua Valkey và chuyển tiếp vào NocoBase.',
          }
        : {
            role: 'TLS Edge & Zero-Trust API Gateway',
            packageOrPort: 'caddy:2.10-alpine · apache/apisix:3.19.0',
            protocol: 'TLS 1.3 · HSTS · Valkey limit-count',
            payloadOrSchema: 'X-Request-Id · openid-connect (bearer_only)',
            responsibilities:
              'Attaches X-Request-Id, enforces strict CORS and Valkey rate limits (120–300 req/60s), and proxies verified traffic upstream.',
          },
    },
    {
      id: 'f-keycloak',
      title: 'Keycloak OIDC',
      sub: 'PKCE S256 · Valkey DB2',
      icon: 'key',
      x: 640,
      y: 60,
      width: 200,
      height: 64,
      zoneId: 'flow-edge',
      inspector: isVi
        ? {
            role: 'Xác thực định danh tập trung và thu hồi phiên',
            packageOrPort: 'keycloak:26.8.2 · @latticedx/plugin-enterprise-auth',
            protocol: 'OIDC Authorization Code + PKCE S256 · Backchannel Logout',
            payloadOrSchema: 'state: (300s) | ticket: (60s) | revoked_sid: (24h)',
            responsibilities:
              'Xác thực mật khẩu 12+ ký tự, TOTP MFA, khóa brute-force sau 5 lần sai và ánh xạ nhóm quyền an toàn.',
          }
        : {
            role: 'Enterprise OIDC Identity & Session Revocation',
            packageOrPort: 'keycloak:26.8.2 · @latticedx/plugin-enterprise-auth',
            protocol: 'OIDC Authorization Code + PKCE S256 · Backchannel Logout',
            payloadOrSchema: 'state: (300s) | ticket: (60s) | revoked_sid: (24h)',
            responsibilities:
              'Enforces TOTP MFA, brute-force lockout, single-use Valkey DB 2 PKCE tickets, and instant backchannel session revocation.',
          },
    },
    {
      id: 'f-runtime',
      title: isVi ? 'Host & 7 Plugins' : 'Host & 7 Plugins',
      sub: 'NocoBase 2.2.50 · :80',
      icon: 'server',
      x: 640,
      y: 176,
      width: 200,
      height: 64,
      zoneId: 'flow-edge',
      focal: true,
      inspector: isVi
        ? {
            role: 'Lớp thực thi nghiệp vụ và phân quyền RBAC',
            packageOrPort: 'nocobase/nocobase:2.2.50 · 7 @latticedx/* plugins',
            protocol: 'HTTP Resource/Action · MCP · A2A',
            payloadOrSchema: '/api/<resource>:<action> (31 resources)',
            responsibilities:
              'Định tuyến 31 resourceManager API, kiểm tra phạm vi ldx_pat_* (7 scopes) và bọc ngữ cảnh RLS trước khi truy vấn DB.',
          }
        : {
            role: 'Business Runtime & RBAC Enforcement',
            packageOrPort: 'nocobase/nocobase:2.2.50 · 7 @latticedx/* plugins',
            protocol: 'HTTP Resource/Action · MCP · A2A',
            payloadOrSchema: '/api/<resource>:<action> (31 resources)',
            responsibilities:
              'Routes 31 NocoBase resources, clamps ldx_pat_* scopes, and initializes transaction-scoped RLS contexts.',
          },
    },
    {
      id: 'f-pg16',
      title: 'PG16 FORCE RLS',
      sub: 'app.current_org · 56 Tbl',
      icon: 'database',
      x: 340,
      y: 176,
      width: 200,
      height: 64,
      zoneId: 'flow-edge',
      focal: true,
      inspector: isVi
        ? {
            role: 'Cơ sở dữ liệu đa-tenant cô lập mức hàng',
            packageOrPort: 'pgvector:0.8.1-pg16 · nocobase_app',
            protocol: 'Sequelize TX + AsyncLocalStorage · HNSW Vector',
            payloadOrSchema: 'current_setting(app.current_org) · latticeParaChunks',
            responsibilities:
              'Đảm bảo mọi truy vấn SELECT/INSERT/UPDATE/DELETE chỉ đọc đúng dữ liệu thuộc organizationId của giao dịch hiện tại.',
          }
        : {
            role: 'Row-Level Isolated PostgreSQL 16 + pgvector Store',
            packageOrPort: 'pgvector:0.8.1-pg16 · nocobase_app',
            protocol: 'Sequelize TX + AsyncLocalStorage · HNSW Vector',
            payloadOrSchema: 'current_setting(app.current_org) · latticeParaChunks',
            responsibilities:
              'Guarantees strict tenant isolation under NOBYPASSRLS across 56 static tables and dynamic latticeCustom* collections.',
          },
    },
    {
      id: 'f-ledger',
      title: isVi ? 'Sổ cái PKI & QR' : 'PKI Ledger & QR',
      sub: 'Ed25519 · Merkle Tree',
      icon: 'lock',
      x: 40,
      y: 176,
      width: 200,
      height: 64,
      zoneId: 'flow-edge',
      inspector: isVi
        ? {
            role: 'Lưu vết bất biến và xác minh chữ ký ePOD',
            packageOrPort: 'pki-ledger.js · wms-engine.js',
            protocol: 'Ed25519 · SHA-256 Hash Chain · HMAC-SHA256 QR',
            payloadOrSchema: 'latticeCryptoLedger · /api/dxosWms:verifyTrackSignature',
            responsibilities:
              'Khóa tuần tự theo tổ chức bằng pg_advisory_xact_lock, ngăn sửa/xóa bản ghi và tạo chứng từ QR kiểm chứng công khai.',
          }
        : {
            role: 'Immutable Hash-Chained Audit & Public QR Proof',
            packageOrPort: 'pki-ledger.js · wms-engine.js',
            protocol: 'Ed25519 · SHA-256 Hash Chain · HMAC-SHA256 QR',
            payloadOrSchema: 'latticeCryptoLedger · /api/dxosWms:verifyTrackSignature',
            responsibilities:
              'Serializes org ledger appends with pg_advisory_xact_lock, blocks mutations, and powers public /v/track/:code verification.',
          },
    },
    {
      id: 'f-obs',
      title: isVi ? 'OTel & PITR WAL' : 'OTel & PITR WAL',
      sub: 'Prom :8889 · WAL .gz',
      icon: 'activity',
      x: 340,
      y: 288,
      width: 200,
      height: 64,
      zoneId: 'flow-edge',
      inspector: isVi
        ? {
            role: 'Giám sát phân tán và khôi phục theo thời điểm',
            packageOrPort: 'otel-collector:0.123.0 · prometheus:v3.3.0 · grafana:11.5.8',
            protocol: 'OTLP HTTP :4318 · W3C traceparent · WAL Archive',
            payloadOrSchema: '/api/dxos:metrics (12 families) · PITR 7-day retention',
            responsibilities:
              'Thu thập span GenAI đã lọc PII, cảnh báo ngưỡng outbox/RLS và lưu đoạn WAL nén gzip cho khôi phục PITR.',
          }
        : {
            role: 'Distributed Observability & Point-in-Time Recovery',
            packageOrPort: 'otel-collector:0.123.0 · prometheus:v3.3.0 · grafana:11.5.8',
            protocol: 'OTLP HTTP :4318 · W3C traceparent · WAL Archive',
            payloadOrSchema: '/api/dxos:metrics (12 families) · PITR 7-day retention',
            responsibilities:
              'Exports PII-redacted GenAI and HTTP traces, alerts on RLS/outbox anomalies, and archives compressed WAL segments.',
          },
    },
  ];
});

const flowEdges = computed<DiagramEdge[]>(() => [
  {
    id: 'fe-1',
    from: 'f-client',
    to: 'f-gateway',
    label: 'HTTPS',
    kind: 'flow',
    points: [
      [240, 92],
      [340, 92],
    ],
  },
  {
    id: 'fe-2',
    from: 'f-gateway',
    to: 'f-keycloak',
    label: 'OIDC',
    kind: 'flow',
    points: [
      [540, 92],
      [640, 92],
    ],
  },
  {
    id: 'fe-3',
    from: 'f-keycloak',
    to: 'f-runtime',
    label: 'JWT',
    kind: 'primary',
    points: [
      [740, 124],
      [740, 176],
    ],
  },
  {
    id: 'fe-4',
    from: 'f-runtime',
    to: 'f-pg16',
    label: 'GUC',
    kind: 'primary',
    points: [
      [640, 208],
      [540, 208],
    ],
  },
  {
    id: 'fe-5',
    from: 'f-pg16',
    to: 'f-ledger',
    label: 'Ed25519',
    kind: 'primary',
    points: [
      [340, 208],
      [240, 208],
    ],
  },
  {
    id: 'fe-6',
    from: 'f-pg16',
    to: 'f-obs',
    label: 'WAL',
    kind: 'dashed',
    points: [
      [440, 240],
      [440, 288],
    ],
  },
  {
    id: 'fe-7',
    from: 'f-runtime',
    to: 'f-obs',
    label: 'OTLP',
    kind: 'flow',
    points: [
      [740, 240],
      [740, 320],
      [540, 320],
    ],
  },
]);

const flowSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'fs-1',
          title: 'Kiểm soát Biên & Xác thực OIDC',
          activeNodes: ['f-client', 'f-gateway', 'f-keycloak'],
          activeEdges: ['fe-1', 'fe-2'],
          description:
            'Caddy và APISIX kiểm tra chứng chỉ TLS, giới hạn tốc độ và trao đổi mã OIDC PKCE S256 với Keycloak trước khi cấp phiên Valkey DB 2.',
          route: 'GET /api/enterpriseAuth:start -> callback -> finish',
          chips: ['TLS 1.3', 'PKCE S256', 'Valkey DB 2'],
        },
        {
          id: 'fs-2',
          title: 'Thực thi Plugin & Cô lập PG16 RLS',
          activeNodes: ['f-keycloak', 'f-runtime', 'f-pg16'],
          activeEdges: ['fe-3', 'fe-4'],
          description:
            'NocoBase và 7 plugin Apache-2.0 xác nhận quyền RBAC và thiết lập biến giao dịch app.current_org cho truy vấn PostgreSQL 16.',
          route: 'POST /api/dxosWms:allocateFefo',
          payload: "set_config('app.current_org', :orgId, true)",
          chips: ['nocobase_app', '56 Tables', 'NOBYPASSRLS'],
        },
        {
          id: 'fs-3',
          title: 'Niêm phong Sổ cái Merkle & Giám sát OTel',
          activeNodes: ['f-pg16', 'f-ledger', 'f-obs', 'f-runtime'],
          activeEdges: ['fe-5', 'fe-6', 'fe-7'],
          description:
            'Giao dịch quan trọng được băm nối chuỗi vào latticeCryptoLedger ký Ed25519, đồng thời xuất trace OTLP đã lọc PII và lưu WAL PITR.',
          route: 'POST /api/dxosLedger:verifyMerkle',
          chips: ['Ed25519', 'OTLP :4318', 'PITR WAL .gz'],
        },
      ]
    : [
        {
          id: 'fs-1',
          title: 'Edge Guard & OIDC Verification',
          activeNodes: ['f-client', 'f-gateway', 'f-keycloak'],
          activeEdges: ['fe-1', 'fe-2'],
          description:
            'Caddy and APISIX enforce TLS and Valkey rate limits while Keycloak completes PKCE S256 verification and issues a revocable session.',
          route: 'GET /api/enterpriseAuth:start -> callback -> finish',
          chips: ['TLS 1.3', 'PKCE S256', 'Valkey DB 2'],
        },
        {
          id: 'fs-2',
          title: 'Plugin Execution & PG16 RLS Binding',
          activeNodes: ['f-keycloak', 'f-runtime', 'f-pg16'],
          activeEdges: ['fe-3', 'fe-4'],
          description:
            'NocoBase and the 7 Apache-2.0 plugins enforce RBAC and scope every PostgreSQL query with transaction-local app.current_org.',
          route: 'POST /api/dxosWms:allocateFefo',
          payload: "set_config('app.current_org', :orgId, true)",
          chips: ['nocobase_app', '56 Tables', 'NOBYPASSRLS'],
        },
        {
          id: 'fs-3',
          title: 'Merkle PKI Seal, OTel & PITR Archive',
          activeNodes: ['f-pg16', 'f-ledger', 'f-obs', 'f-runtime'],
          activeEdges: ['fe-5', 'fe-6', 'fe-7'],
          description:
            'Critical records append to the Ed25519 hash-chained ledger while OTLP exports PII-redacted traces and Postgres archives gzipped WAL segments.',
          route: 'POST /api/dxosLedger:verifyMerkle',
          chips: ['Ed25519', 'OTLP :4318', 'PITR WAL .gz'],
        },
      ],
);

const modes = computed<DiagramMode[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'planes',
          label: 'Ma trận 6 Mặt phẳng',
          summary: '8 khối lõi · 6 mặt phẳng DX-OS',
          zones: matrixZones.value,
          nodes: matrixNodes.value,
          edges: matrixEdges.value,
          steps: matrixSteps.value,
        },
        {
          id: 'request-flow',
          label: 'Luồng Yêu cầu End-to-End',
          summary: 'Ingress -> RLS -> PKI -> OTel',
          zones: flowZones.value,
          nodes: flowNodes.value,
          edges: flowEdges.value,
          steps: flowSteps.value,
        },
      ]
    : [
        {
          id: 'planes',
          label: '6-Plane Matrix',
          summary: '8 core modules · 6 DX-OS planes',
          zones: matrixZones.value,
          nodes: matrixNodes.value,
          edges: matrixEdges.value,
          steps: matrixSteps.value,
        },
        {
          id: 'request-flow',
          label: 'Request Lifecycle',
          summary: 'Ingress -> RLS -> PKI -> OTel',
          zones: flowZones.value,
          nodes: flowNodes.value,
          edges: flowEdges.value,
          steps: flowSteps.value,
        },
      ],
);

const titleText = computed(() =>
  locale.value === 'vi'
    ? 'Kiến trúc 6 Mặt phẳng LatticeDX DX-OS'
    : 'LatticeDX 6-Plane DX-OS Architecture',
);

const captionText = computed(() =>
  locale.value === 'vi'
    ? 'Chọn bất kỳ khối kiến trúc hoặc bước luồng nào để kiểm tra vai trò, cổng kết nối, giao thức và ranh giới bảo mật.'
    : 'Select any plane node or flow step to inspect its exact role, container package, protocol, and fail-closed boundary.',
);
</script>

<template>
  <DiagramCanvas
    :title="titleText"
    :caption="captionText"
    view-box="0 0 880 400"
    :modes="modes"
    :compact="props.compact"
    :lang="locale"
  />
</template>
