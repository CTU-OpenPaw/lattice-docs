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

const stackZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'tier-3',
          label: 'TẦNG 3 · Ứng dụng Nghiệp vụ Cắm-nóng',
          x: 16,
          y: 12,
          width: 1056,
          height: 92,
          kind: 'admin',
        },
        {
          id: 'tier-2',
          label: 'TẦNG 2 · Trải nghiệm Người dùng & Cấu hình',
          x: 16,
          y: 128,
          width: 1056,
          height: 92,
          kind: 'traffic',
        },
        {
          id: 'tier-1',
          label: 'TẦNG 1 · Headless Runtime & Dịch vụ Dùng chung (7 Plugins)',
          x: 16,
          y: 244,
          width: 1056,
          height: 100,
          kind: 'admin',
        },
        {
          id: 'tier-data',
          label: 'DỮ LIỆU RIÊNG DỊCH VỤ · PG16 FORCE RLS · RustFS · Orion-LD · PKI Ledger',
          x: 16,
          y: 368,
          width: 1056,
          height: 96,
          kind: 'external',
        },
      ]
    : [
        {
          id: 'tier-3',
          label: 'TIER 3 · Pluggable Business Applications',
          x: 16,
          y: 12,
          width: 1056,
          height: 92,
          kind: 'admin',
        },
        {
          id: 'tier-2',
          label: 'TIER 2 · User & Configuration Experience',
          x: 16,
          y: 128,
          width: 1056,
          height: 92,
          kind: 'traffic',
        },
        {
          id: 'tier-1',
          label: 'TIER 1 · Headless Runtime & Shared Services (7 Plugins)',
          x: 16,
          y: 244,
          width: 1056,
          height: 100,
          kind: 'admin',
        },
        {
          id: 'tier-data',
          label: 'SERVICE-OWNED DATA · PG16 FORCE RLS · RustFS · Orion-LD · PKI Ledger',
          x: 16,
          y: 368,
          width: 1056,
          height: 96,
          kind: 'external',
        },
      ],
);

const stackNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 't3-wms-iiot',
      title: isVi ? 'Kho lạnh WMS & IIoT Twin' : 'Cold-Chain WMS & IIoT Twin',
      sub: 'FEFO · MKT · WebGIS · ePOD',
      icon: 'truck',
      x: 32,
      y: 40,
      width: 468,
      height: 56,
      zoneId: 'tier-3',
      inspector: isVi
        ? {
            role: 'Tầng 3 — Ứng dụng Chuỗi lạnh WMS & Bản sao số IIoT',
            packageOrPort: 'dxosWms:* · dxosBroker:* · dxosBlocks:*',
            protocol: 'FEFO · Arrhenius MKT · MQTT/NGSI-LD · ePOD QR',
            payloadOrSchema: '/p/logistics | /p/incidents | /v/track/:code',
            responsibilities:
              'Điều phối đơn hàng, phân bổ lô FEFO, giám sát nhiệt độ động học MKT, cảnh báo sự cố IIoT trên bản đồ WebGIS và xác thực ePOD QR.',
          }
        : {
            role: 'Tier 3 — Cold-Chain Logistics WMS & IIoT Digital Twin',
            packageOrPort: 'dxosWms:* · dxosBroker:* · dxosBlocks:*',
            protocol: 'FEFO · Arrhenius MKT · MQTT/NGSI-LD · ePOD QR',
            payloadOrSchema: '/p/logistics | /p/incidents | /v/track/:code',
            responsibilities:
              'Runs order fulfillment, FEFO lot allocation, Arrhenius MKT excursion holds, WebGIS IIoT twin control, and signed ePOD QR tracking.',
          },
    },
    {
      id: 't3-cmms-ai',
      title: isVi ? 'CMMS, Bảo hành & App AI' : 'CMMS, Claims & AI-Built Apps',
      sub: 'Procurement · ITSM · Custom',
      icon: 'layers',
      x: 524,
      y: 40,
      width: 468,
      height: 56,
      zoneId: 'tier-3',
      inspector: isVi
        ? {
            role: 'Tầng 3 — Bảo trì CMMS, Khiếu nại, Mua sắm & Ứng dụng App Builder 2.0',
            packageOrPort: 'dxosAi:buildBuiltApp · dxosForms:* · Business Packs',
            protocol: 'HTTPS · FORCE RLS · Solution Bundle v3',
            payloadOrSchema: '/p/cmms | /p/partner-claims | /p/procurement | latticeCustom*',
            responsibilities:
              'Cung cấp các phân hệ bảo trì SLA, khiếu nại đối tác, mua sắm ITSM và các ứng dụng nghiệp vụ sinh động qua App Builder 2.0.',
          }
        : {
            role: 'Tier 3 — CMMS, Partner Claims, Procurement & AI-Built Apps',
            packageOrPort: 'dxosAi:buildBuiltApp · dxosForms:* · Business Packs',
            protocol: 'HTTPS · FORCE RLS · Solution Bundle v3',
            payloadOrSchema: '/p/cmms | /p/partner-claims | /p/procurement | latticeCustom*',
            responsibilities:
              'Delivers SLA maintenance, partner claims, procurement/ITSM packs, and tenant-scoped custom applications generated via App Builder 2.0.',
          },
    },
    {
      id: 't2-workspaces',
      title: isVi ? 'Cổng Vai trò & PWA' : 'Role Workspaces & PWA',
      sub: '/p/* · /v/mobile · /v/*',
      icon: 'globe',
      x: 32,
      y: 156,
      width: 304,
      height: 56,
      zoneId: 'tier-2',
      inspector: isVi
        ? {
            role: 'Tầng 2 — Cổng vai trò /p/*, Mobile PWA & Biểu mẫu công khai',
            packageOrPort: '@latticedx/plugin-lattice-foundation · 10-lattice-public-routes.sh',
            protocol: 'HTTPS · Nonce CSP · IndexedDB Outbox',
            payloadOrSchema: '/p/<slug> | /v/mobile | /v/form/:slug | /v/track/:code',
            responsibilities:
              'Phục vụ giao diện theo vai trò, hàng đợi ngoại tuyến IndexedDB cho hiện trường và cổng công khai không rò rỉ PII.',
          }
        : {
            role: 'Tier 2 — Role Workspaces, Field PWA & Zero-PII Public Forms',
            packageOrPort: '@latticedx/plugin-lattice-foundation · 10-lattice-public-routes.sh',
            protocol: 'HTTPS · Nonce CSP · IndexedDB Outbox',
            payloadOrSchema: '/p/<slug> | /v/mobile | /v/form/:slug | /v/track/:code',
            responsibilities:
              'Renders role portals, offline field PWA synchronization with conflict quarantine, and nonce-CSP public intake/tracking views.',
          },
    },
    {
      id: 't2-studio',
      title: isVi ? 'Control Studio & BI/WebGIS' : 'Control Studio & BI/WebGIS',
      sub: '12 BlockModels · DMN · Flow',
      icon: 'box',
      x: 360,
      y: 156,
      width: 304,
      height: 56,
      zoneId: 'tier-2',
      inspector: isVi
        ? {
            role: 'Tầng 2 — Cấu hình Schema, 12 Native BlockModels & Visual DMN',
            packageOrPort: '@latticedx/plugin-dxos-blocks · @latticedx/plugin-dxos-studio',
            protocol: 'FlowEngine v2 · MapLibre · @xyflow/react',
            payloadOrSchema: '12 Native BlockModels · Visual DMN · Safe AST',
            responsibilities:
              'Thiết kế biểu đồ BI, bản đồ WebGIS MapLibre, bảng điều hành WMS, luồng DAG LatticeFlow v2 và bảng quyết định FEEL DMN.',
          }
        : {
            role: 'Tier 2 — NocoBase Control Studio, 12 BlockModels & WebGIS',
            packageOrPort: '@latticedx/plugin-dxos-blocks · @latticedx/plugin-dxos-studio',
            protocol: 'FlowEngine v2 · MapLibre · @xyflow/react',
            payloadOrSchema: '12 Native BlockModels · Visual DMN · Safe AST',
            responsibilities:
              'Configures schemas, forms, MapLibre WebGIS maps, BI dashboards, LatticeFlow v2 DAGs, and Visual DMN FEEL rule tables.',
          },
    },
    {
      id: 't2-ai-hitl',
      title: isVi ? 'AI Studio & Duyệt HITL' : 'AI Studio & HITL Views',
      sub: '7 Profiles · App Builder 2.0',
      icon: 'bot',
      x: 688,
      y: 156,
      width: 304,
      height: 56,
      zoneId: 'tier-2',
      inspector: isVi
        ? {
            role: 'Tầng 2 — Trò chuyện Tác nhân, Xem trước ER & Phê duyệt HITL',
            packageOrPort: '@latticedx/plugin-dxos-ai · /admin/settings/dxos-ai',
            protocol: 'SSE surfaceEvents · Approval Queue',
            payloadOrSchema: 'latticeAiApprovalQueue · planBuiltApp diff',
            responsibilities:
              'Hiển thị hội thoại tác nhân AI, xem trước ER Diff của App Builder 2.0 và hàng đợi phê duyệt M-of-N / ASK HITL.',
          }
        : {
            role: 'Tier 2 — AI Agent Chat, App Builder Diff & HITL Queues',
            packageOrPort: '@latticedx/plugin-dxos-ai · /admin/settings/dxos-ai',
            protocol: 'SSE surfaceEvents · Approval Queue',
            payloadOrSchema: 'latticeAiApprovalQueue · planBuiltApp diff',
            responsibilities:
              'Hosts agent chat workspaces, App Builder 2.0 ER plan-diff previews, and human-in-the-loop approval review queues.',
          },
    },
    {
      id: 't1-edge',
      title: isVi ? 'Biên & Định danh' : 'Edge & Identity',
      sub: 'Caddy · APISIX · Keycloak',
      icon: 'shield',
      x: 32,
      y: 276,
      width: 212,
      height: 58,
      zoneId: 'tier-1',
      inspector: isVi
        ? {
            role: 'Tầng 1 — Chấm dứt TLS, Cổng APISIX & Xác thực Keycloak PKCE',
            packageOrPort: 'caddy:2.10 · apisix:3.19.0 · keycloak:26.8.2',
            protocol: 'TLS 1.3 · OIDC PKCE S256 · Rate-Limit',
            payloadOrSchema: 'X-Request-Id | ldx_pat_* | Valkey DB 2',
            responsibilities:
              'Kiểm tra chứng chỉ TLS, giới hạn tốc độ theo IP qua Valkey và xác thực OIDC/PKCE S256 hoặc API Key trước khi vào Host.',
          }
        : {
            role: 'Tier 1 — Caddy TLS, APISIX Gateway & Keycloak OIDC PKCE',
            packageOrPort: 'caddy:2.10 · apisix:3.19.0 · keycloak:26.8.2',
            protocol: 'TLS 1.3 · OIDC PKCE S256 · Rate-Limit',
            payloadOrSchema: 'X-Request-Id | ldx_pat_* | Valkey DB 2',
            responsibilities:
              'Enforces TLS 1.3 security headers, Valkey rate limits, and Keycloak PKCE S256 or ldx_pat_* verification ahead of the host.',
          },
    },
    {
      id: 't1-host',
      title: isVi ? 'Host NocoBase + 7 Plugin' : 'NocoBase Host + 7 Plugins',
      sub: 'v2.2.50 · Fastify /v1/*',
      icon: 'server',
      x: 276,
      y: 276,
      width: 240,
      height: 58,
      zoneId: 'tier-1',
      focal: true,
      inspector: isVi
        ? {
            role: 'Tầng 1 — Runtime NocoBase 2.2.50 (:ro 7 Plugins) & Cầu RLS duy nhất',
            packageOrPort: 'nocobase/nocobase:2.2.50 · 7 @latticedx/* · Fastify 5',
            protocol: 'HTTP · pg-rls.js (AsyncLocalStorage) · OpenAPI 3.1',
            payloadOrSchema: 'nocobase_app (NOBYPASSRLS) -> app.current_org',
            responsibilities:
              'Mọi thao tác ghi CSDL từ toàn nền tảng đều đi qua Host + 7 Plugins và AsyncLocalStorage RLS bridge dưới role nocobase_app.',
          }
        : {
            role: 'Tier 1 — NocoBase 2.2.50 (:ro 7 Plugins) & Single RLS Write Gate',
            packageOrPort: 'nocobase/nocobase:2.2.50 · 7 @latticedx/* · Fastify 5',
            protocol: 'HTTP · pg-rls.js (AsyncLocalStorage) · OpenAPI 3.1',
            payloadOrSchema: 'nocobase_app (NOBYPASSRLS) -> app.current_org',
            responsibilities:
              'Routes all business APIs and database writes through the AsyncLocalStorage transaction bridge under nocobase_app with FORCE RLS.',
          },
    },
    {
      id: 't1-core',
      title: isVi ? 'Lõi, Flow v2 & IIoT' : 'Core, Flow v2 & IIoT',
      sub: 'Outbox · DMN · Orion · n8n',
      icon: 'workflow',
      x: 548,
      y: 276,
      width: 212,
      height: 58,
      zoneId: 'tier-1',
      inspector: isVi
        ? {
            role: 'Tầng 1 — Lõi Bundle v3, Outbox, LatticeFlow, DMN, n8n & Orion-LD',
            packageOrPort: 'plugin-dxos-studio · plugin-dxos-broker · n8n · Mosquitto',
            protocol: 'CloudEvents 1.0 · SKIP LOCKED · MQTT · NGSI-LD',
            payloadOrSchema: 'latticeEventBus | latticeContextOutbox | 24 DAG Nodes',
            responsibilities:
              'Điều phối LatticeFlow v2, DMN FEEL, cầu nối Stock n8n REST v1, Outbox giao dịch và đồng bộ IIoT Mosquitto -> Node-RED -> Orion-LD.',
          }
        : {
            role: 'Tier 1 — Platform Core, LatticeFlow v2, DMN, n8n & IIoT Context',
            packageOrPort: 'plugin-dxos-studio · plugin-dxos-broker · n8n · Mosquitto',
            protocol: 'CloudEvents 1.0 · SKIP LOCKED · MQTT · NGSI-LD',
            payloadOrSchema: 'latticeEventBus | latticeContextOutbox | 24 DAG Nodes',
            responsibilities:
              'Coordinates Bundle v3 registry, SKIP LOCKED outboxes, 24-node DAGs, Visual DMN, n8n REST v1, and Mosquitto -> Node-RED -> Orion-LD.',
          },
    },
    {
      id: 't1-agents',
      title: isVi ? 'Agent & Builder 2.0' : 'Agents & Builder 2.0',
      sub: '20 Tools · RAG · MCP/A2A',
      icon: 'cpu',
      x: 792,
      y: 276,
      width: 200,
      height: 58,
      zoneId: 'tier-1',
      inspector: isVi
        ? {
            role: 'Tầng 1 — Business Agents, P.A.R.A. Hybrid RAG & App Builder 2.0',
            packageOrPort: 'plugin-dxos-ai · plugin-dxos-para · /api/dxos-mcp',
            protocol: 'ReAct · JSON-RPC 2.0 · RRF k=60 · ER Diff',
            payloadOrSchema: '7 Profiles · 20+4 Tools · App Builder Plan/Build/Rollback',
            responsibilities:
              'Thực thi 7 hồ sơ tác nhân qua 20 công cụ có kiểm toán, tìm kiếm P.A.R.A. RRF và App Builder 2.0 với xem trước ER Diff an toàn.',
          }
        : {
            role: 'Tier 1 — Business Agents, P.A.R.A. Hybrid RAG & App Builder 2.0',
            packageOrPort: 'plugin-dxos-ai · plugin-dxos-para · /api/dxos-mcp',
            protocol: 'ReAct · JSON-RPC 2.0 · RRF k=60 · ER Diff',
            payloadOrSchema: '7 Profiles · 20+4 Tools · App Builder Plan/Build/Rollback',
            responsibilities:
              'Runs 7 Agent Profiles with 20 audited tools, hybrid P.A.R.A. RAG, MCP/A2A gateways, and App Builder 2.0 with isolated plan-diff.',
          },
    },
    {
      id: 'd-pg16',
      title: 'PG16 FORCE RLS (nocobase_app)',
      sub: '56 Tables · pgvector HNSW',
      icon: 'database',
      x: 32,
      y: 398,
      width: 304,
      height: 56,
      zoneId: 'tier-data',
      focal: true,
      inspector: isVi
        ? {
            role: 'Dữ liệu — PostgreSQL 16 FORCE RLS & pgvector 0.8.1',
            packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · nocobase_app (NOBYPASSRLS)',
            protocol: 'app.current_org / app.rls_bypass · HNSW Cosine + GIN',
            payloadOrSchema: '56 Static Tables · latticeCustom* · latticeParaChunks',
            responsibilities:
              'Áp đặt cô lập đa tenant mức hàng cho mọi bảng tĩnh, bảng động latticeCustom* và chỉ mục vector HNSW cho Hybrid RAG.',
          }
        : {
            role: 'Data — PostgreSQL 16 FORCE RLS & pgvector 0.8.1',
            packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · nocobase_app (NOBYPASSRLS)',
            protocol: 'app.current_org / app.rls_bypass · HNSW Cosine + GIN',
            payloadOrSchema: '56 Static Tables · latticeCustom* · latticeParaChunks',
            responsibilities:
              'Enforces fail-closed row-level isolation across 56 static tables, dynamic latticeCustom* tables, and HNSW RAG embeddings.',
          },
    },
    {
      id: 'd-context',
      title: 'RustFS · Orion-LD · Valkey',
      sub: 'S3 · NGSI-LD · DB 0/1/2',
      icon: 'lock',
      x: 360,
      y: 398,
      width: 304,
      height: 56,
      zoneId: 'tier-data',
      inspector: isVi
        ? {
            role: 'Dữ liệu — Kho đối tượng S3, Ngữ cảnh Orion-LD & Valkey 8.1',
            packageOrPort: 'rustfs:1.0.6 · orion-ld:1.12.0 (Mongo 8) · valkey:8.1',
            protocol: 'S3 HTTP · NGSI-LD · RESP DB 0/1/2',
            payloadOrSchema: 'Scanned Objects · Context Entities · OIDC/SSE Cache',
            responsibilities:
              'Lưu tệp sạch qua ClamAV vào RustFS, duy trì trạng thái thực thể NGSI-LD và phân vùng Valkey cho cache, SSE PubSub và OIDC.',
          }
        : {
            role: 'Data — RustFS Object Storage, Orion-LD Context & Valkey 8.1',
            packageOrPort: 'rustfs:1.0.6 · orion-ld:1.12.0 (Mongo 8) · valkey:8.1',
            protocol: 'S3 HTTP · NGSI-LD · RESP DB 0/1/2',
            payloadOrSchema: 'Scanned Objects · Context Entities · OIDC/SSE Cache',
            responsibilities:
              'Stores ClamAV-cleared files in RustFS, NGSI-LD twin context state in Orion-LD, and partitioned cache/SSE/OIDC state in Valkey.',
          },
    },
    {
      id: 'd-ledger',
      title: isVi ? 'Sổ cái Merkle & PITR WAL' : 'Ed25519 Merkle & PITR WAL',
      sub: 'Immutable Ledger · WAL .gz',
      icon: 'activity',
      x: 688,
      y: 398,
      width: 304,
      height: 56,
      zoneId: 'tier-data',
      inspector: isVi
        ? {
            role: 'Dữ liệu — Sổ cái Bất biến Ed25519/Merkle & Sao lưu PITR',
            packageOrPort: 'latticeCryptoLedger · pg_advisory_xact_lock · WAL .gz',
            protocol: 'Ed25519 · SHA-256 Chain · OTLP Audit',
            payloadOrSchema: 'prevHash -> entryHash · 7-day PITR WAL Archive',
            responsibilities:
              'Ký nối chuỗi kiểm toán bất biến cho giao dịch và chứng từ ePOD QR, kèm lưu trữ WAL nén gzip phục vụ khôi phục PITR.',
          }
        : {
            role: 'Data — Ed25519 Merkle Ledger & PITR WAL Archive',
            packageOrPort: 'latticeCryptoLedger · pg_advisory_xact_lock · WAL .gz',
            protocol: 'Ed25519 · SHA-256 Chain · OTLP Audit',
            payloadOrSchema: 'prevHash -> entryHash · 7-day PITR WAL Archive',
            responsibilities:
              'Signs tamper-evident hash chains for audits and ePOD QR proofs alongside gzipped PostgreSQL WAL segments for PITR.',
          },
    },
  ];
});

const stackEdges = computed<DiagramEdge[]>(() => [
  {
    id: 'ts-1',
    from: 't3-wms-iiot',
    to: 't2-workspaces',
    label: 'Portals',
    kind: 'flow',
    points: [
      [184, 96],
      [184, 116],
      [280, 116],
      [280, 156],
    ],
  },
  {
    id: 'ts-2',
    from: 't3-cmms-ai',
    to: 't2-studio',
    label: 'Modules',
    kind: 'flow',
    points: [
      [640, 96],
      [640, 116],
      [512, 116],
      [512, 156],
    ],
  },
  {
    id: 'ts-3',
    from: 't2-workspaces',
    to: 't1-edge',
    label: 'HTTPS',
    kind: 'primary',
    points: [
      [100, 212],
      [100, 232],
      [200, 232],
      [200, 276],
    ],
  },
  {
    id: 'ts-4',
    from: 't2-studio',
    to: 't1-host',
    label: 'Studio API',
    kind: 'primary',
    points: [
      [512, 212],
      [512, 232],
      [396, 232],
      [396, 276],
    ],
  },
  {
    id: 'ts-5',
    from: 't2-ai-hitl',
    to: 't1-agents',
    label: 'MCP/HITL',
    kind: 'flow',
    points: [
      [892, 212],
      [892, 276],
    ],
  },
  {
    id: 'ts-6',
    from: 't1-edge',
    to: 't1-host',
    kind: 'primary',
    points: [
      [244, 305],
      [276, 305],
    ],
  },
  {
    id: 'ts-7',
    from: 't1-core',
    to: 't1-host',
    kind: 'primary',
    points: [
      [548, 305],
      [516, 305],
    ],
  },
  {
    id: 'ts-8',
    from: 't1-agents',
    to: 't1-core',
    kind: 'flow',
    points: [
      [792, 305],
      [760, 305],
    ],
  },
  {
    id: 'ts-9',
    from: 't1-host',
    to: 'd-pg16',
    label: 'nocobase_app',
    kind: 'primary',
    points: [
      [360, 334],
      [360, 356],
      [184, 356],
      [184, 398],
    ],
  },
  {
    id: 'ts-10',
    from: 't1-core',
    to: 'd-context',
    label: 'NGSI/S3',
    kind: 'flow',
    points: [
      [620, 334],
      [620, 356],
      [512, 356],
      [512, 398],
    ],
  },
  {
    id: 'ts-11',
    from: 't1-host',
    to: 'd-ledger',
    label: 'Ed25519',
    kind: 'primary',
    points: [
      [440, 334],
      [440, 356],
      [840, 356],
      [840, 398],
    ],
  },
]);

const stackSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'ss-1',
          title: 'Tầng 3 & 2: Ứng dụng -> Trải nghiệm',
          activeNodes: ['t3-wms-iiot', 't3-cmms-ai', 't2-workspaces', 't2-studio', 't2-ai-hitl'],
          activeEdges: ['ts-1', 'ts-2'],
          description:
            'Các ứng dụng nghiệp vụ (WMS chuỗi lạnh, IIoT Twin, CMMS, App AI) hiển thị qua cổng vai trò /p/*, Mobile PWA, 12 BlockModels và AI Studio.',
          route: '/p/<slug> | /v/mobile | /admin/settings/dxos-studio',
          chips: ['Tier 3 -> Tier 2', '12 Native BlockModels'],
        },
        {
          id: 'ss-2',
          title: 'Tầng 1: Biên Zero-Trust -> Host & 7 Plugin',
          activeNodes: ['t2-workspaces', 't2-studio', 't1-edge', 't1-host'],
          activeEdges: ['ts-3', 'ts-4', 'ts-6'],
          description:
            'Caddy, APISIX và Keycloak PKCE S256 bảo vệ biên trước khi chuyển yêu cầu vào NocoBase 2.2.50 và 7 plugin Apache-2.0.',
          route: 'HTTPS -> Caddy -> APISIX -> NocoBase 2.2.50',
          chips: ['OIDC PKCE S256', 'sdkProvidedByHost: true'],
        },
        {
          id: 'ss-3',
          title: 'Tầng 1: Tự động hóa, IIoT & Tác nhân AI',
          activeNodes: ['t2-ai-hitl', 't1-agents', 't1-core', 't1-host'],
          activeEdges: ['ts-5', 'ts-7', 'ts-8'],
          description:
            'Tác nhân AI (20 tools, P.A.R.A. RAG, App Builder 2.0) và dịch vụ lõi (LatticeFlow v2, DMN, n8n, Orion-LD) phối hợp qua Host Runtime.',
          route: 'createAuditedTool() | LatticeFlow v2 | Orion-LD',
          chips: ['24 DAG Nodes', 'App Builder 2.0'],
        },
        {
          id: 'ss-4',
          title: 'Dữ liệu: Mọi ghi DB qua nocobase_app -> FORCE RLS',
          activeNodes: ['t1-host', 't1-core', 'd-pg16', 'd-context', 'd-ledger'],
          activeEdges: ['ts-9', 'ts-10', 'ts-11'],
          description:
            'Không có truy cập tắt vào CSDL: toàn bộ ghi đều đi qua NocoBase Host + 7 Plugins dưới vai trò nocobase_app (NOBYPASSRLS) áp dụng PG16 FORCE RLS và ký sổ cái Merkle.',
          route: 'pg-rls.js -> nocobase_app -> 56 FORCE RLS Tables',
          payload: "SELECT set_config('app.current_org', :orgId, true);",
          chips: ['No Direct DB Bypass', 'Ed25519 Merkle'],
        },
      ]
    : [
        {
          id: 'ss-1',
          title: 'Tiers 3 & 2: Business Apps -> Experience',
          activeNodes: ['t3-wms-iiot', 't3-cmms-ai', 't2-workspaces', 't2-studio', 't2-ai-hitl'],
          activeEdges: ['ts-1', 'ts-2'],
          description:
            'Pluggable applications (Cold-Chain WMS, IIoT Twin, CMMS, AI-Built Apps) surface through role portals, offline PWA, 12 BlockModels, and AI Studio.',
          route: '/p/<slug> | /v/mobile | /admin/settings/dxos-studio',
          chips: ['Tier 3 -> Tier 2', '12 Native BlockModels'],
        },
        {
          id: 'ss-2',
          title: 'Tier 1: Zero-Trust Edge -> Host + 7 Plugins',
          activeNodes: ['t2-workspaces', 't2-studio', 't1-edge', 't1-host'],
          activeEdges: ['ts-3', 'ts-4', 'ts-6'],
          description:
            'Caddy TLS, APISIX rate limits, and Keycloak PKCE S256 guard ingress before dispatching requests into NocoBase 2.2.50 and its 7 Apache-2.0 plugins.',
          route: 'HTTPS -> Caddy -> APISIX -> NocoBase 2.2.50',
          chips: ['OIDC PKCE S256', 'sdkProvidedByHost: true'],
        },
        {
          id: 'ss-3',
          title: 'Tier 1: Automation, IIoT & Agent Services',
          activeNodes: ['t2-ai-hitl', 't1-agents', 't1-core', 't1-host'],
          activeEdges: ['ts-5', 'ts-7', 'ts-8'],
          description:
            'Agent services (20 scoped tools, P.A.R.A. RAG, App Builder 2.0) and core engines (LatticeFlow v2, DMN, n8n, Orion-LD) bind through the host runtime.',
          route: 'createAuditedTool() | LatticeFlow v2 | Orion-LD',
          chips: ['24 DAG Nodes', 'App Builder 2.0'],
        },
        {
          id: 'ss-4',
          title: 'Data: All Writes via nocobase_app -> FORCE RLS',
          activeNodes: ['t1-host', 't1-core', 'd-pg16', 'd-context', 'd-ledger'],
          activeEdges: ['ts-9', 'ts-10', 'ts-11'],
          description:
            'Zero direct database shortcuts: every write passes through NocoBase Host + 7 Plugins as nocobase_app (NOBYPASSRLS) into PG16 FORCE RLS and the Ed25519 Merkle ledger.',
          route: 'pg-rls.js -> nocobase_app -> 56 FORCE RLS Tables',
          payload: "SELECT set_config('app.current_org', :orgId, true);",
          chips: ['No Direct DB Bypass', 'Ed25519 Merkle'],
        },
      ],
);

const patternZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        { id: 'pz-1', label: '1 · YÊU CẦU ỨNG DỤNG (APPLICATION REQUEST)', x: 16, y: 12, width: 1056, height: 84, kind: 'traffic' },
        { id: 'pz-2', label: '2 · TÍCH HỢP NGOÀI (EXTERNAL INTEGRATION)', x: 16, y: 106, width: 1056, height: 84, kind: 'admin' },
        { id: 'pz-3', label: '3 · TỰ ĐỘNG HÓA THEO NGỮ CẢNH (CONTEXT-DRIVEN)', x: 16, y: 200, width: 1056, height: 84, kind: 'traffic' },
        { id: 'pz-4', label: '4 · TÁC NHÂN NGHIỆP VỤ (BUSINESS AGENT & HITL)', x: 16, y: 294, width: 1056, height: 84, kind: 'admin' },
        { id: 'pz-5', label: '5 · XÂY DỰNG ỨNG DỤNG (APP BUILDER 2.0)', x: 16, y: 388, width: 1056, height: 84, kind: 'external' },
      ]
    : [
        { id: 'pz-1', label: '1 · APPLICATION REQUEST', x: 16, y: 12, width: 1056, height: 84, kind: 'traffic' },
        { id: 'pz-2', label: '2 · EXTERNAL INTEGRATION', x: 16, y: 106, width: 1056, height: 84, kind: 'admin' },
        { id: 'pz-3', label: '3 · CONTEXT-DRIVEN AUTOMATION', x: 16, y: 200, width: 1056, height: 84, kind: 'traffic' },
        { id: 'pz-4', label: '4 · BUSINESS AGENT & HITL', x: 16, y: 294, width: 1056, height: 84, kind: 'admin' },
        { id: 'pz-5', label: '5 · APPLICATION BUILDER 2.0', x: 16, y: 388, width: 1056, height: 84, kind: 'external' },
      ],
);

const patternNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    // Pattern 1
    {
      id: 'p1-user',
      title: isVi ? 'Người dùng / Portal' : 'User / Workspace',
      sub: '/p/* · PWA · Public',
      icon: 'globe',
      x: 28,
      y: 40,
      width: 216,
      height: 48,
      zoneId: 'pz-1',
      inspector: {
        role: isVi ? 'Mẫu 1 — Điểm khởi phát yêu cầu người dùng' : 'Pattern 1 — Workspace / PWA Entry',
        packageOrPort: '/p/<slug> · /v/mobile · /v/*',
        protocol: 'HTTPS TLS 1.3',
        payloadOrSchema: 'Session Cookie | Bearer JWT',
        responsibilities: isVi
          ? 'Gửi yêu cầu thao tác nghiệp vụ từ cổng vai trò hoặc ứng dụng hiện trường.'
          : 'Submits portal or mobile PWA operations through the zero-trust edge.',
      },
    },
    {
      id: 'p1-gw',
      title: 'Caddy + APISIX',
      sub: 'TLS · Limit · OIDC',
      icon: 'shield',
      x: 278,
      y: 40,
      width: 216,
      height: 48,
      zoneId: 'pz-1',
      inspector: {
        role: isVi ? 'Mẫu 1 — Kiểm soát biên & định danh' : 'Pattern 1 — Edge TLS & API Gateway',
        packageOrPort: 'caddy:2.10 · apisix:3.19.0 · keycloak:26.8',
        protocol: 'TLS 1.3 · PKCE S256 · Valkey Limit',
        payloadOrSchema: 'X-Request-Id · JWKS',
        responsibilities: isVi
          ? 'Chấm dứt TLS, giới hạn tốc độ theo IP và xác thực OIDC PKCE S256.'
          : 'Terminates TLS, enforces Valkey rate limits, and verifies Keycloak PKCE S256.',
      },
    },
    {
      id: 'p1-api',
      title: 'NocoBase / Domain API',
      sub: '7 Plugins · Fastify',
      icon: 'server',
      x: 528,
      y: 40,
      width: 216,
      height: 48,
      zoneId: 'pz-1',
      focal: true,
      inspector: {
        role: isVi ? 'Mẫu 1 — Host NocoBase 2.2.50 & Dịch vụ miền' : 'Pattern 1 — NocoBase Host & Domain API',
        packageOrPort: 'nocobase:2.2.50 · Fastify /v1/*',
        protocol: 'RBAC · AsyncLocalStorage Tx',
        payloadOrSchema: 'withTenantRlsContext(orgId)',
        responsibilities: isVi
          ? 'Kiểm tra quyền RBAC và mở giao dịch PostgreSQL gắn app.current_org.'
          : 'Enforces RBAC and wraps repository queries in transaction-local app.current_org.',
      },
    },
    {
      id: 'p1-db',
      title: 'PG16 FORCE RLS',
      sub: 'nocobase_app · 56 Tbl',
      icon: 'database',
      x: 778,
      y: 40,
      width: 216,
      height: 48,
      zoneId: 'pz-1',
      inspector: {
        role: isVi ? 'Mẫu 1 — Cô lập mức hàng PostgreSQL 16' : 'Pattern 1 — PostgreSQL 16 Row Isolation',
        packageOrPort: 'pgvector:0.8.1-pg16 · nocobase_app',
        protocol: 'ENABLE + FORCE ROW LEVEL SECURITY',
        payloadOrSchema: '56 Static + latticeCustom*',
        responsibilities: isVi
          ? 'Chỉ trả về dữ liệu khớp organizationId dưới role NOBYPASSRLS.'
          : 'Enforces tenant isolation across 56 static and dynamic tables under NOBYPASSRLS.',
      },
    },
    // Pattern 2
    {
      id: 'p2-ext',
      title: isVi ? 'Hệ thống Ngoài' : 'External System',
      sub: 'ERP · Partner · SaaS',
      icon: 'globe',
      x: 28,
      y: 134,
      width: 216,
      height: 48,
      zoneId: 'pz-2',
      inspector: {
        role: isVi ? 'Mẫu 2 — Nguồn sự kiện đối tác ngoài' : 'Pattern 2 — External Partner System',
        packageOrPort: 'External Webhook / REST Caller',
        protocol: 'HTTPS POST',
        payloadOrSchema: 'JSON Event Payload',
        responsibilities: isVi
          ? 'Phát sự kiện tích hợp hoặc gọi API đồng bộ tới LatticeDX.'
          : 'Emits signed webhook events or invokes authorized LatticeDX APIs.',
      },
    },
    {
      id: 'p2-hook',
      title: isVi ? 'Webhook Bảo vệ HMAC' : 'Protected Webhook',
      sub: 'HMAC · Standard Hooks',
      icon: 'lock',
      x: 278,
      y: 134,
      width: 216,
      height: 48,
      zoneId: 'pz-2',
      inspector: {
        role: isVi ? 'Mẫu 2 — Xác thực chữ ký & SSRF' : 'Pattern 2 — HMAC Signature Gate',
        packageOrPort: 'dxosAutomations:webhookIngress',
        protocol: 'X-Lattice-Signature-256 · timingSafeEqualHex',
        payloadOrSchema: 'Standard Webhooks (v1,<b64>)',
        responsibilities: isVi
          ? 'Xác minh chữ ký HMAC-SHA256 thời gian hằng trước khi nạp vào bus.'
          : 'Validates HMAC-SHA256 / Standard Webhooks signatures before queuing.',
      },
    },
    {
      id: 'p2-bus',
      title: isVi ? 'Event Bus / n8n Adapter' : 'Event Bus / n8n Adapter',
      sub: 'SKIP LOCKED · REST v1',
      icon: 'plug',
      x: 528,
      y: 134,
      width: 216,
      height: 48,
      zoneId: 'pz-2',
      inspector: {
        role: isVi ? 'Mẫu 2 — Bộ chuyển tiếp Outbox & Stock n8n' : 'Pattern 2 — Outbox Bus & n8n Bridge',
        packageOrPort: 'dxosEvents · dxosN8n · Stock n8n 2.48.1',
        protocol: 'CloudEvents 1.0 · OAuth2 PKCE · 120s Breaker',
        payloadOrSchema: 'latticeEventBus | /api/v1/workflows',
        responsibilities: isVi
          ? 'Chuyển đổi sự kiện chuẩn hóa hoặc ủy thác quy trình ngoài qua Stock n8n.'
          : 'Routes CloudEvents outbox deliveries with circuit breakers or dispatches Stock n8n flows.',
      },
    },
    {
      id: 'p2-api',
      title: isVi ? 'API Cấp phép' : 'Authorized API',
      sub: 'ldx_pat_* · 7 Scopes',
      icon: 'key',
      x: 778,
      y: 134,
      width: 216,
      height: 48,
      zoneId: 'pz-2',
      inspector: {
        role: isVi ? 'Mẫu 2 — Thực thi giới hạn phạm vi PAT' : 'Pattern 2 — Scoped Service Execution',
        packageOrPort: 'paas-api-keys.js · clampHeaderRole',
        protocol: 'Authorization: Bearer ldx_pat_*',
        payloadOrSchema: 'read | write | wms | dmn | iot | ai | ledger',
        responsibilities: isVi
          ? 'Kiểm tra phạm vi khóa ldx_pat_* và chặn leo thang vai trò.'
          : 'Enforces 7 scoped PAT permissions and prevents role header escalation.',
      },
    },
    // Pattern 3
    {
      id: 'p3-mqtt',
      title: 'Mosquitto -> Node-RED',
      sub: 'DynSec · :telemetryIngest',
      icon: 'radio',
      x: 28,
      y: 228,
      width: 216,
      height: 48,
      zoneId: 'pz-3',
      inspector: {
        role: isVi ? 'Mẫu 3 — Thu thập MQTT & chuẩn hóa Node-RED' : 'Pattern 3 — Mosquitto & Node-RED Ingest',
        packageOrPort: 'mosquitto:2.0.21 -> nodered:4.0.9 -> dxosBlocks',
        protocol: 'MQTT QoS 1 -> POST :telemetryIngest -> Outbox',
        payloadOrSchema: 'X-Lattice-Edge-Token -> latticeContextOutbox',
        responsibilities: isVi
          ? 'Node-RED đọc MQTT từ Mosquitto DynSec và đẩy về NocoBase :telemetryIngest + Context Outbox.'
          : 'Node-RED subscribes to Mosquitto DynSec and posts sanitized telemetry to NocoBase :telemetryIngest + Outbox.',
      },
    },
    {
      id: 'p3-orion',
      title: 'NGSI-LD (Orion-LD)',
      sub: ':1026 · 10s Outbox Sync',
      icon: 'globe',
      x: 268,
      y: 228,
      width: 200,
      height: 48,
      zoneId: 'pz-3',
      inspector: {
        role: isVi ? 'Mẫu 3 — Context Broker NGSI-LD FIWARE' : 'Pattern 3 — FIWARE Orion-LD Context Broker',
        packageOrPort: 'fiware/orion-ld:1.12.0 · :1026',
        protocol: 'NGSI-LD HTTP · NGSILD-Tenant',
        payloadOrSchema: 'urn:ngsi-ld:Asset:<org>:native:<id>',
        responsibilities: isVi
          ? 'Nhận thực thể từ PG16 Context Outbox và phát Change notification về NocoBase (:orionNotify).'
          : 'Syncs NGSI-LD entities from the 10s PG16 outbox and emits Change notifications to :orionNotify.',
      },
    },
    {
      id: 'p3-dmn',
      title: isVi ? 'Visual DMN & MKT' : 'Visual DMN & MKT Rules',
      sub: 'FEEL · hold_mkt',
      icon: 'git-branch',
      x: 620,
      y: 228,
      width: 204,
      height: 48,
      zoneId: 'pz-3',
      inspector: {
        role: isVi ? 'Mẫu 3 — Đánh giá DMN FEEL & Arrhenius MKT' : 'Pattern 3 — Visual DMN & MKT Evaluation',
        packageOrPort: 'dmn-engine.js · wms-engine.js',
        protocol: 'FEEL PRIORITY · Arrhenius Log-Sum-Exp',
        payloadOrSchema: 'cold_chain_approval_v1 -> hold_mkt',
        responsibilities: isVi
          ? 'Tính MKT Arrhenius, đối chiếu bảng FEEL DMN và khóa lô hàng vi phạm.'
          : 'Computes Arrhenius MKT, evaluates FEEL rules, and quarantines breached lots.',
      },
    },
    {
      id: 'p3-flow',
      title: 'LatticeFlow v2 / Task',
      sub: '24 Nodes · HITL > 2.0C',
      icon: 'workflow',
      x: 848,
      y: 228,
      width: 208,
      height: 48,
      zoneId: 'pz-3',
      inspector: {
        role: isVi ? 'Mẫu 3 — Điều phối phản ứng tự động & lệnh xuống' : 'Pattern 3 — Automated DAG & Twin Downlink',
        packageOrPort: 'plugin-dxos-studio · digital-twin.js',
        protocol: 'DAG v2 · HITL Guard |ΔT| > 2.0°C',
        payloadOrSchema: 'POST /twin/command -> Mosquitto',
        responsibilities: isVi
          ? 'Thực thi quy trình xử lý sự cố và gửi lệnh điều khiển xuống thiết bị qua cổng HITL 2.0°C.'
          : 'Triggers incident workflows and dispatches HITL-guarded downlinks back through Node-RED.',
      },
    },
    // Pattern 4
    {
      id: 'p4-in',
      title: isVi ? 'User / Flow / MCP' : 'User / Workflow / MCP',
      sub: 'Chat · DAG · JSON-RPC',
      icon: 'terminal',
      x: 28,
      y: 322,
      width: 216,
      height: 48,
      zoneId: 'pz-4',
      inspector: {
        role: isVi ? 'Mẫu 4 — Nguồn kích hoạt tác nhân AI' : 'Pattern 4 — Agent Request Origin',
        packageOrPort: 'aiConversations:sendMessages | ai.agent | /api/dxos-mcp',
        protocol: 'SSE | DAG Node | JSON-RPC 2.0',
        payloadOrSchema: '7 Agent Profiles',
        responsibilities: isVi
          ? 'Gửi yêu cầu suy luận từ giao diện người dùng, DAG hoặc đối tác MCP/A2A.'
          : 'Invokes one of the 7 Agent Profiles from chat, DAG nodes, or MCP/A2A clients.',
      },
    },
    {
      id: 'p4-rag',
      title: isVi ? 'Agent + P.A.R.A. RAG' : 'Agent + P.A.R.A. RAG',
      sub: 'ReAct · RRF k=60',
      icon: 'bot',
      x: 278,
      y: 322,
      width: 216,
      height: 48,
      zoneId: 'pz-4',
      focal: true,
      inspector: {
        role: isVi ? 'Mẫu 4 — Vòng lặp ReAct & Tìm kiếm Lai RRF' : 'Pattern 4 — Business Agent & Hybrid RAG',
        packageOrPort: 'plugin-dxos-ai · para-hybrid-search.js',
        protocol: 'pgvector + GIN tsvector (k=60)',
        payloadOrSchema: 'Advisory Memory · maxTurns <= 12',
        responsibilities: isVi
          ? 'Truy xuất ngữ cảnh doanh nghiệp theo RLS và điều phối các lượt Thought-Action.'
          : 'Retrieves RLS-filtered P.A.R.A. context via RRF and orchestrates bounded ReAct turns.',
      },
    },
    {
      id: 'p4-tools',
      title: isVi ? '20 Scoped Tools' : '20 Scoped Tools',
      sub: 'PII Scrub · Quota Gate',
      icon: 'shield',
      x: 528,
      y: 322,
      width: 216,
      height: 48,
      zoneId: 'pz-4',
      inspector: {
        role: isVi ? 'Mẫu 4 — Lớp công cụ kiểm toán & che PII' : 'Pattern 4 — Audited Tool & PII Guard',
        packageOrPort: 'ai-tools-core.js · ai-governance.js',
        protocol: 'createAuditedTool · 9 PII Regex',
        payloadOrSchema: 'orgDailyCalls <= 5000 · ALLOW | ASK',
        responsibilities: isVi
          ? 'Kiểm tra hạn mức, ẩn danh PII Việt Nam và phân tách hành động ALLOW vs ASK.'
          : 'Meters token/call quotas, scrubs Vietnamese PII, and enforces ALLOW vs ASK boundaries.',
      },
    },
    {
      id: 'p4-api',
      title: isVi ? 'API Dịch vụ (HITL)' : 'Authorized APIs (HITL)',
      sub: 'ApprovalQueue · OTel',
      icon: 'check-circle',
      x: 778,
      y: 322,
      width: 216,
      height: 48,
      zoneId: 'pz-4',
      inspector: {
        role: isVi ? 'Mẫu 4 — Thực thi có phê duyệt & OTel GenAI' : 'Pattern 4 — HITL Execution & OTel',
        packageOrPort: 'latticeAiApprovalQueue · otel-exporter.js',
        protocol: 'approveAction · rejectAction · OTLP :4318',
        payloadOrSchema: 'latticeAiAuditLogs · latticeAiTraces',
        responsibilities: isVi
          ? 'Tạm dừng các thay đổi rủi ro trong hàng đợi HITL và ghi vết OTel GenAI.'
          : 'Queues ASK mutations for operator confirmation and exports redacted OTel GenAI spans.',
      },
    },
    // Pattern 5
    {
      id: 'p5-builder',
      title: 'App Builder 2.0',
      sub: 'dxos-architect · Admin',
      icon: 'cpu',
      x: 28,
      y: 416,
      width: 192,
      height: 48,
      zoneId: 'pz-5',
      inspector: {
        role: isVi ? 'Mẫu 5 — Kiến trúc sư AI khóa quyền Admin' : 'Pattern 5 — Admin-Locked App Builder 2.0',
        packageOrPort: 'dxos-architect · app-builder-orchestrator.js',
        protocol: 'allowedRoles: [root, admin]',
        payloadOrSchema: 'dxos_provision_role_workspace',
        responsibilities: isVi
          ? 'Tiếp nhận mô tả nghiệp vụ từ quản trị viên (thay thế hoàn toàn adapter cũ).'
          : 'Accepts structured or natural-language app specs strictly from admin roles.',
      },
    },
    {
      id: 'p5-plan',
      title: isVi ? 'Plan & ER Diff Cô lập' : 'Isolated Plan & ER Diff',
      sub: 'planBuiltApp · Zero DB',
      icon: 'git-branch',
      x: 238,
      y: 416,
      width: 192,
      height: 48,
      zoneId: 'pz-5',
      inspector: {
        role: isVi ? 'Mẫu 5 — Lập đồ thị ER Kahn không ghi DB' : 'Pattern 5 — Dry-Run ER Plan & Spec Diff',
        packageOrPort: 'app-builder-planner.js · dxosAi:planBuiltApp',
        protocol: 'Kahn Topo Sort · Zero DB Writes',
        payloadOrSchema: 'buildErGraph + computeSpecDiff',
        responsibilities: isVi
          ? 'Phân tích phụ thuộc bảng và diff thay đổi mà chưa tác động CSDL.'
          : 'Computes topological table dependencies and structural diffs with zero DB writes.',
      },
    },
    {
      id: 'p5-preview',
      title: isVi ? 'Kiểm tra & Xem trước' : 'Validate & Preview',
      sub: 'buildBuiltApp · Heal',
      icon: 'activity',
      x: 448,
      y: 416,
      width: 192,
      height: 48,
      zoneId: 'pz-5',
      inspector: {
        role: isVi ? 'Mẫu 5 — Dựng thử & tự sửa tối đa 2 vòng' : 'Pattern 5 — Provision & Self-Heal Preview',
        packageOrPort: 'dxosAi:buildBuiltApp · verifyEnterpriseApp',
        protocol: 'PG Transaction · <=2 Self-Heal Rounds',
        payloadOrSchema: 'latticeCustom* + 12 BlockModels',
        responsibilities: isVi
          ? 'Chụp snapshot trước khi dựng, kiểm tra RLS/routes và tự sửa lỗi cấu trúc.'
          : 'Snapshots portals, verifies collections/RLS/routes, and runs up to 2 repair rounds.',
      },
    },
    {
      id: 'p5-approve',
      title: isVi ? 'Phê duyệt Con người' : 'Human Approval',
      sub: 'ASK Gate · Review',
      icon: 'lock',
      x: 658,
      y: 416,
      width: 192,
      height: 48,
      zoneId: 'pz-5',
      inspector: {
        role: isVi ? 'Mẫu 5 — Cổng xác nhận của quản trị viên' : 'Pattern 5 — Operator Approval Gate',
        packageOrPort: 'dxosAi:approveAction | :rejectAction · latticeAiApprovalQueue',
        protocol: 'Human-in-the-Loop · RBAC',
        payloadOrSchema: 'No Unreviewed Production Writes',
        responsibilities: isVi
          ? 'Yêu cầu người quản trị duyệt bản xem trước trước khi phát hành chính thức.'
          : 'Requires explicit human review before publishing or patching production workspaces.',
      },
    },
    {
      id: 'p5-publish',
      title: isVi ? 'Bundle v3 / Rollback' : 'Bundle v3 / Rollback',
      sub: 'Snapshot · KeepData',
      icon: 'check-circle',
      x: 868,
      y: 416,
      width: 192,
      height: 48,
      zoneId: 'pz-5',
      focal: true,
      inspector: {
        role: isVi ? 'Mẫu 5 — Phát hành GitOps Bundle v3 & Khôi phục an toàn' : 'Pattern 5 — Publish Bundle v3 & Safe Rollback',
        packageOrPort: 'exportBuiltAppBundle · rollbackBuiltApp · teardownBuiltApp',
        protocol: 'Solution Bundle v3 · latticeUiSnapshots',
        payloadOrSchema: 'keepData=true · contentSha256',
        responsibilities: isVi
          ? 'Xuất Solution Bundle v3 chuẩn GitOps hoặc khôi phục nguyên tử về snapshot cũ.'
          : 'Publishes SHA-256 Solution Bundles v3 or rolls back atomically to saved snapshots.',
      },
    },
  ];
});

const patternEdges = computed<DiagramEdge[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    // Pattern 1
    { id: 'pe-1a', from: 'p1-user', to: 'p1-gw', kind: 'primary', points: [[244, 64], [278, 64]] },
    { id: 'pe-1b', from: 'p1-gw', to: 'p1-api', kind: 'primary', points: [[494, 64], [528, 64]] },
    { id: 'pe-1c', from: 'p1-api', to: 'p1-db', kind: 'primary', points: [[744, 64], [778, 64]] },
    // Pattern 2
    { id: 'pe-2a', from: 'p2-ext', to: 'p2-hook', kind: 'flow', points: [[244, 158], [278, 158]] },
    { id: 'pe-2b', from: 'p2-hook', to: 'p2-bus', kind: 'flow', points: [[494, 158], [528, 158]] },
    { id: 'pe-2c', from: 'p2-bus', to: 'p2-api', kind: 'primary', points: [[744, 158], [778, 158]] },
    // Pattern 3 (includes dashed Change notification!)
    { id: 'pe-3a', from: 'p3-mqtt', to: 'p3-orion', kind: 'flow', points: [[244, 252], [268, 252]] },
    {
      id: 'pe-3b',
      from: 'p3-orion',
      to: 'p3-dmn',
      label: isVi ? 'Thông báo biến đổi' : 'Change notification',
      kind: 'dashed',
      points: [[468, 252], [620, 252]],
    },
    { id: 'pe-3c', from: 'p3-dmn', to: 'p3-flow', kind: 'primary', points: [[824, 252], [848, 252]] },
    // Pattern 4
    { id: 'pe-4a', from: 'p4-in', to: 'p4-rag', kind: 'flow', points: [[244, 346], [278, 346]] },
    { id: 'pe-4b', from: 'p4-rag', to: 'p4-tools', kind: 'primary', points: [[494, 346], [528, 346]] },
    { id: 'pe-4c', from: 'p4-tools', to: 'p4-api', kind: 'primary', points: [[744, 346], [778, 346]] },
    // Pattern 5
    { id: 'pe-5a', from: 'p5-builder', to: 'p5-plan', kind: 'primary', points: [[220, 440], [238, 440]] },
    { id: 'pe-5b', from: 'p5-plan', to: 'p5-preview', kind: 'flow', points: [[430, 440], [448, 440]] },
    { id: 'pe-5c', from: 'p5-preview', to: 'p5-approve', kind: 'primary', points: [[640, 440], [658, 440]] },
    { id: 'pe-5d', from: 'p5-approve', to: 'p5-publish', kind: 'primary', points: [[850, 440], [868, 440]] },
  ];
});

const patternSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'pat-1',
          title: '1 · Yêu cầu Ứng dụng',
          activeNodes: ['p1-user', 'p1-gw', 'p1-api', 'p1-db'],
          activeEdges: ['pe-1a', 'pe-1b', 'pe-1c'],
          description:
            'Mọi yêu cầu từ cổng /p/*, PWA hoặc biểu mẫu đi qua Caddy + APISIX tới NocoBase / Domain API và thực thi dưới PG16 FORCE RLS (nocobase_app).',
          route: 'User -> Caddy + APISIX -> NocoBase -> PG16 FORCE RLS',
          chips: ['TLS 1.3', 'PKCE S256', '56 FORCE RLS'],
        },
        {
          id: 'pat-2',
          title: '2 · Tích hợp Ngoài',
          activeNodes: ['p2-ext', 'p2-hook', 'p2-bus', 'p2-api'],
          activeEdges: ['pe-2a', 'pe-2b', 'pe-2c'],
          description:
            'Hệ thống ngoài gửi webhook có chữ ký HMAC qua Event Bus hoặc bộ chuyển tiếp Stock n8n để gọi API được cấp phạm vi ldx_pat_*.',
          route: 'External -> Protected Webhook -> Event Bus / n8n -> ldx_pat_* API',
          chips: ['HMAC-SHA256', '7 PAT Scopes'],
        },
        {
          id: 'pat-3',
          title: '3 · Tự động hóa Ngữ cảnh',
          activeNodes: ['p3-mqtt', 'p3-orion', 'p3-dmn', 'p3-flow'],
          activeEdges: ['pe-3a', 'pe-3b', 'pe-3c'],
          description:
            'Cảm biến qua Mosquitto -> Node-RED -> NocoBase Outbox cập nhật NGSI-LD (Orion-LD), phát Change notification (nét đứt) tới Visual DMN/MKT và LatticeFlow v2.',
          route: 'Mosquitto -> Node-RED -> Orion-LD --(Notify)--> DMN/MKT -> Flow v2',
          chips: ['NGSI-LD', 'Dashed Notify', 'HITL > 2.0C'],
        },
        {
          id: 'pat-4',
          title: '4 · Tác nhân Nghiệp vụ',
          activeNodes: ['p4-in', 'p4-rag', 'p4-tools', 'p4-api'],
          activeEdges: ['pe-4a', 'pe-4b', 'pe-4c'],
          description:
            'Yêu cầu AI từ người dùng, DAG hoặc MCP gọi Business Agent kèm P.A.R.A. Hybrid RAG, qua 20 Scoped Tools (PII/Quota) tới API có cổng HITL.',
          route: 'User/Flow/MCP -> Agent + P.A.R.A. RAG -> 20 Tools -> HITL APIs',
          chips: ['RRF k=60', '9 PII Regex', 'ASK Queue'],
        },
        {
          id: 'pat-5',
          title: '5 · App Builder 2.0',
          activeNodes: ['p5-builder', 'p5-plan', 'p5-preview', 'p5-approve', 'p5-publish'],
          activeEdges: ['pe-5a', 'pe-5b', 'pe-5c', 'pe-5d'],
          description:
            'App Builder 2.0 lập đồ thị ER Diff cô lập, kiểm tra & xem trước, chờ Human Approval rồi phát hành Bundle v3 hoặc khôi phục về snapshot cũ.',
          route: 'Builder 2.0 -> Plan & ER Diff -> Preview -> Approval -> Bundle v3 / Rollback',
          chips: ['Zero Direct DB Write', 'Bundle v3', 'Safe Rollback'],
        },
      ]
    : [
        {
          id: 'pat-1',
          title: '1 · Application Request',
          activeNodes: ['p1-user', 'p1-gw', 'p1-api', 'p1-db'],
          activeEdges: ['pe-1a', 'pe-1b', 'pe-1c'],
          description:
            'Workspace, PWA, and public traffic traverses Caddy + APISIX to NocoBase / Domain API and executes inside PG16 FORCE RLS under nocobase_app.',
          route: 'User -> Caddy + APISIX -> NocoBase -> PG16 FORCE RLS',
          chips: ['TLS 1.3', 'PKCE S256', '56 FORCE RLS'],
        },
        {
          id: 'pat-2',
          title: '2 · External Integration',
          activeNodes: ['p2-ext', 'p2-hook', 'p2-bus', 'p2-api'],
          activeEdges: ['pe-2a', 'pe-2b', 'pe-2c'],
          description:
            'External systems enter via HMAC-protected webhooks and the Event Bus / Stock n8n adapter to invoke scope-clamped ldx_pat_* service APIs.',
          route: 'External -> Protected Webhook -> Event Bus / n8n -> ldx_pat_* API',
          chips: ['HMAC-SHA256', '7 PAT Scopes'],
        },
        {
          id: 'pat-3',
          title: '3 · Context Automation',
          activeNodes: ['p3-mqtt', 'p3-orion', 'p3-dmn', 'p3-flow'],
          activeEdges: ['pe-3a', 'pe-3b', 'pe-3c'],
          description:
            'Telemetry flows from Mosquitto -> Node-RED -> NocoBase Outbox into NGSI-LD (Orion-LD), firing dashed Change notifications into Visual DMN/MKT and LatticeFlow v2.',
          route: 'Mosquitto -> Node-RED -> Orion-LD --(Notify)--> DMN/MKT -> Flow v2',
          chips: ['NGSI-LD', 'Dashed Notify', 'HITL > 2.0C'],
        },
        {
          id: 'pat-4',
          title: '4 · Business Agent',
          activeNodes: ['p4-in', 'p4-rag', 'p4-tools', 'p4-api'],
          activeEdges: ['pe-4a', 'pe-4b', 'pe-4c'],
          description:
            'User, workflow, or MCP requests invoke Business Agents with P.A.R.A. Hybrid RAG through 20 Scoped Tools (PII/Quota) to HITL-gated service APIs.',
          route: 'User/Flow/MCP -> Agent + P.A.R.A. RAG -> 20 Tools -> HITL APIs',
          chips: ['RRF k=60', '9 PII Regex', 'ASK Queue'],
        },
        {
          id: 'pat-5',
          title: '5 · Application Builder 2.0',
          activeNodes: ['p5-builder', 'p5-plan', 'p5-preview', 'p5-approve', 'p5-publish'],
          activeEdges: ['pe-5a', 'pe-5b', 'pe-5c', 'pe-5d'],
          description:
            'App Builder 2.0 computes an isolated ER Plan & Diff, validates & previews, awaits Human Approval, and publishes Bundle v3 or rolls back safely.',
          route: 'Builder 2.0 -> Plan & ER Diff -> Preview -> Approval -> Bundle v3 / Rollback',
          chips: ['Zero Direct DB Write', 'Bundle v3', 'Safe Rollback'],
        },
      ],
);

const modes = computed<DiagramMode[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'tier-stack',
          label: 'Kiến trúc 4 Tầng (v0.4.2)',
          summary: 'Tier 3 -> Tier 2 -> Tier 1 -> Service-owned Data',
          zones: stackZones.value,
          nodes: stackNodes.value,
          edges: stackEdges.value,
          steps: stackSteps.value,
        },
        {
          id: 'interaction-patterns',
          label: '5 Mẫu Tương tác (1..5)',
          summary: 'Request · Webhook · Context · Agent · Builder 2.0',
          zones: patternZones.value,
          nodes: patternNodes.value,
          edges: patternEdges.value,
          steps: patternSteps.value,
        },
      ]
    : [
        {
          id: 'tier-stack',
          label: '4-Tier Architecture (v0.4.2)',
          summary: 'Tier 3 -> Tier 2 -> Tier 1 -> Service-owned Data',
          zones: stackZones.value,
          nodes: stackNodes.value,
          edges: stackEdges.value,
          steps: stackSteps.value,
        },
        {
          id: 'interaction-patterns',
          label: '5 Interaction Patterns (1..5)',
          summary: 'Request · Webhook · Context · Agent · Builder 2.0',
          zones: patternZones.value,
          nodes: patternNodes.value,
          edges: patternEdges.value,
          steps: patternSteps.value,
        },
      ],
);

const titleText = computed(() =>
  locale.value === 'vi'
    ? 'Kiến trúc Nền tảng LatticeDX v0.4.2 & 5 Mẫu Tương tác'
    : 'LatticeDX v0.4.2 Platform Architecture & 5 Interaction Patterns',
);

const captionText = computed(() =>
  locale.value === 'vi'
    ? 'Chọn bất kỳ khối kiến trúc hoặc mẫu tương tác (1–5) để kiểm tra ranh giới Tier 3 -> Tier 2 -> Tier 1 -> Dữ liệu và cổng ghi duy nhất qua PG16 FORCE RLS.'
    : 'Select any tier module or interaction pattern (1–5) to inspect the Tier 3 -> Tier 2 -> Tier 1 -> Service-owned Data boundaries and single nocobase_app RLS write gate.',
);
</script>

<template>
  <DiagramCanvas
    :title="titleText"
    :caption="captionText"
    view-box="0 0 1088 484"
    :modes="modes"
    :compact="props.compact"
    :lang="locale"
  />
</template>
