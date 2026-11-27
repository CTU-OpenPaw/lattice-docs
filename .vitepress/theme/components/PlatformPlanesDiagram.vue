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
          label: 'TẦNG 3 · ỨNG DỤNG NGHIỆP VỤ CẮM-NÓNG',
          x: 16,
          y: 12,
          width: 1008,
          height: 96,
          kind: 'band',
        },
        {
          id: 'tier-2',
          label: 'TẦNG 2 · TRẢI NGHIỆM NGƯỜI DÙNG & CẤU HÌNH',
          x: 16,
          y: 128,
          width: 1008,
          height: 96,
          kind: 'traffic',
        },
        {
          id: 'tier-1',
          label: 'TẦNG 1 · HEADLESS RUNTIME & DỊCH VỤ DÙNG CHUNG',
          x: 16,
          y: 244,
          width: 1008,
          height: 104,
          kind: 'band',
        },
        {
          id: 'tier-data',
          label: 'DỮ LIỆU RIÊNG DỊCH VỤ · PG16 FORCE RLS · RUSTFS · ORION-LD · SỔ CÁI MERKLE',
          x: 16,
          y: 368,
          width: 1008,
          height: 102,
          kind: 'external',
        },
      ]
    : [
        {
          id: 'tier-3',
          label: 'TIER 3 · PLUGGABLE BUSINESS APPLICATIONS',
          x: 16,
          y: 12,
          width: 1008,
          height: 96,
          kind: 'band',
        },
        {
          id: 'tier-2',
          label: 'TIER 2 · USER & CONFIGURATION EXPERIENCE',
          x: 16,
          y: 128,
          width: 1008,
          height: 96,
          kind: 'traffic',
        },
        {
          id: 'tier-1',
          label: 'TIER 1 · HEADLESS RUNTIME & SHARED SERVICES',
          x: 16,
          y: 244,
          width: 1008,
          height: 104,
          kind: 'band',
        },
        {
          id: 'tier-data',
          label: 'SERVICE-OWNED DATA STORES · PG16 FORCE RLS · RUSTFS · ORION-LD · MERKLE LEDGER',
          x: 16,
          y: 368,
          width: 1008,
          height: 102,
          kind: 'external',
        },
      ],
);

const stackNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 't3-wms',
      title: isVi ? 'Kho lạnh WMS & IIoT Twin' : 'Cold-Chain WMS & IIoT Twin',
      sub: 'FEFO · Arrhenius MKT · WebGIS · ePOD',
      icon: 'truck',
      x: 32,
      y: 40,
      width: 472,
      height: 56,
      zoneId: 'tier-3',
      inspector: isVi
        ? {
            role: 'Tầng 3 — Chuỗi lạnh WMS & Bản sao số IIoT',
            packageOrPort: 'dxosWms:* · dxosBroker:* · dxosBlocks:*',
            protocol: 'FEFO · Arrhenius MKT · MQTT/NGSI-LD · ePOD QR',
            payloadOrSchema: '/p/logistics | /p/incidents | /v/track/:code',
            responsibilities:
              'Điều phối đơn hàng, phân bổ lô FEFO, tính nhiệt độ động học Arrhenius MKT, giám sát WebGIS và xác thực chứng từ ePOD QR.',
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
      id: 't3-cmms',
      title: isVi ? 'CMMS, Bảo hành & Ứng dụng AI' : 'CMMS, Claims & AI-Built Apps',
      sub: 'Procurement · ITSM · latticeCustom*',
      icon: 'layers',
      x: 536,
      y: 40,
      width: 472,
      height: 56,
      zoneId: 'tier-3',
      inspector: isVi
        ? {
            role: 'Tầng 3 — Bảo trì CMMS, Khiếu nại & Ứng dụng App Builder 2.0',
            packageOrPort: 'dxosAi:buildBuiltApp · dxosForms:* · Business Packs',
            protocol: 'HTTPS · FORCE RLS · Solution Bundle v3',
            payloadOrSchema: '/p/cmms | /p/partner-claims | /p/procurement | latticeCustom*',
            responsibilities:
              'Cung cấp các phân hệ bảo trì SLA, khiếu nại đối tác, mua sắm ITSM và các bảng động latticeCustom* tạo bởi App Builder 2.0.',
          }
        : {
            role: 'Tier 3 — CMMS, Partner Claims, Procurement & AI-Built Apps',
            packageOrPort: 'dxosAi:buildBuiltApp · dxosForms:* · Business Packs',
            protocol: 'HTTPS · FORCE RLS · Solution Bundle v3',
            payloadOrSchema: '/p/cmms | /p/partner-claims | /p/procurement | latticeCustom*',
            responsibilities:
              'Delivers SLA maintenance, partner claims, procurement/ITSM packs, and tenant-scoped latticeCustom* apps built via App Builder 2.0.',
          },
    },
    {
      id: 't2-portals',
      title: isVi ? 'Cổng Vai trò & PWA' : 'Role Workspaces & PWA',
      sub: '/p/* Portals · /v/mobile · /v/form',
      icon: 'globe',
      x: 32,
      y: 156,
      width: 308,
      height: 56,
      zoneId: 'tier-2',
      inspector: isVi
        ? {
            role: 'Tầng 2 — Cổng vai trò /p/*, Mobile PWA & Biểu mẫu công khai',
            packageOrPort: '@latticedx/plugin-lattice-foundation · Gateway routes',
            protocol: 'HTTPS · Nonce CSP · IndexedDB Outbox',
            payloadOrSchema: '/p/<slug> | /v/mobile | /v/form/:slug | /v/track/:code',
            responsibilities:
              'Phục vụ giao diện theo vai trò, hàng đợi ngoại tuyến IndexedDB cho hiện trường và cổng công khai không rò rỉ PII.',
          }
        : {
            role: 'Tier 2 — Role Workspaces, Field PWA & Zero-PII Public Forms',
            packageOrPort: '@latticedx/plugin-lattice-foundation · Gateway routes',
            protocol: 'HTTPS · Nonce CSP · IndexedDB Outbox',
            payloadOrSchema: '/p/<slug> | /v/mobile | /v/form/:slug | /v/track/:code',
            responsibilities:
              'Renders role portals, offline field PWA synchronization with conflict quarantine, and nonce-CSP public intake/tracking views.',
          },
    },
    {
      id: 't2-studio',
      title: 'Control Studio & WebGIS',
      sub: '12 Native BlockModels · DMN · Flow v2',
      icon: 'box',
      x: 366,
      y: 156,
      width: 308,
      height: 56,
      zoneId: 'tier-2',
      inspector: isVi
        ? {
            role: 'Tầng 2 — Control Studio, 12 Native BlockModels & Visual DMN',
            packageOrPort: '@latticedx/plugin-dxos-blocks · @latticedx/plugin-dxos-studio',
            protocol: 'FlowEngine v2 · MapLibre · @xyflow/react',
            payloadOrSchema: '12 Native BlockModels · Visual DMN · Safe AST',
            responsibilities:
              'Thiết kế biểu đồ BI, bản đồ WebGIS MapLibre, bảng điều hành WMS, luồng DAG LatticeFlow v2 và bảng quyết định FEEL DMN.',
          }
        : {
            role: 'Tier 2 — Control Studio, 12 Native BlockModels & WebGIS',
            packageOrPort: '@latticedx/plugin-dxos-blocks · @latticedx/plugin-dxos-studio',
            protocol: 'FlowEngine v2 · MapLibre · @xyflow/react',
            payloadOrSchema: '12 Native BlockModels · Visual DMN · Safe AST',
            responsibilities:
              'Configures schemas, forms, MapLibre WebGIS maps, BI dashboards, LatticeFlow v2 DAGs, and Visual DMN FEEL rule tables.',
          },
    },
    {
      id: 't2-ai',
      title: isVi ? 'AI Studio & Hàng đợi HITL' : 'AI Studio & HITL Queues',
      sub: '7 Agent Profiles · App Builder 2.0',
      icon: 'bot',
      x: 700,
      y: 156,
      width: 308,
      height: 56,
      zoneId: 'tier-2',
      inspector: isVi
        ? {
            role: 'Tầng 2 — Trò chuyện Tác nhân, ER Diff & Phê duyệt HITL',
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
      title: isVi ? 'Biên Zero-Trust & IdP' : 'Zero-Trust Edge & IdP',
      sub: ['Caddy 2.10 · APISIX 3.19', 'Keycloak 26.8'],
      icon: 'shield',
      x: 32,
      y: 274,
      width: 232,
      height: 62,
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
      title: isVi ? 'NocoBase 2.2.50 + 7 Plugin' : 'NocoBase 2.2.50 + 7 Plugins',
      sub: ['Fastify 5 /v1/*', 'AsyncLocalStorage RLS'],
      icon: 'server',
      x: 376,
      y: 274,
      width: 252,
      height: 62,
      zoneId: 'tier-1',
      focal: true,
      inspector: isVi
        ? {
            role: 'Tầng 1 — Runtime NocoBase 2.2.50 (:ro 7 Plugins) & Cầu RLS duy nhất',
            packageOrPort: 'nocobase/nocobase:2.2.50 · 7 @latticedx/* · Fastify 5',
            protocol: 'HTTP · pg-rls.js (AsyncLocalStorage) · OpenAPI 3.1',
            payloadOrSchema: 'nocobase_app (NOBYPASSRLS) -> app.current_org',
            responsibilities:
              'Mọi thao tác ghi CSDL đều đi qua Host + 7 Plugins và AsyncLocalStorage RLS bridge dưới vai trò nocobase_app.',
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
      title: isVi ? 'Điều phối, IIoT & AI' : 'Orchestration, IIoT & AI',
      sub: ['LatticeFlow · DMN · Orion-LD', '20 Audited AI Tools'],
      icon: 'workflow',
      x: 760,
      y: 274,
      width: 248,
      height: 62,
      zoneId: 'tier-1',
      inspector: isVi
        ? {
            role: 'Tầng 1 — LatticeFlow v2, DMN, Orion-LD, n8n & 20 Công cụ AI',
            packageOrPort: 'plugin-dxos-studio · plugin-dxos-blocks · plugin-dxos-ai',
            protocol: 'CloudEvents 1.0 · SKIP LOCKED · MQTT · NGSI-LD · MCP/A2A',
            payloadOrSchema: '24 DAG Nodes · 7 AI Profiles · 20+4 Tools',
            responsibilities:
              'Điều phối LatticeFlow v2, bảng FEEL DMN, cầu Stock n8n REST v1, bản sao số Mosquitto/Orion-LD và 20 công cụ AI có kiểm toán.',
          }
        : {
            role: 'Tier 1 — LatticeFlow v2, DMN, Orion-LD, n8n & 20 AI Tools',
            packageOrPort: 'plugin-dxos-studio · plugin-dxos-blocks · plugin-dxos-ai',
            protocol: 'CloudEvents 1.0 · SKIP LOCKED · MQTT · NGSI-LD · MCP/A2A',
            payloadOrSchema: '24 DAG Nodes · 7 AI Profiles · 20+4 Tools',
            responsibilities:
              'Executes 24-node DAGs, Visual DMN, Stock n8n REST v1 sync, Mosquitto/Orion-LD digital twin pipelines, and 20 audited AI tools.',
          },
    },
    {
      id: 'd-pg16',
      title: 'PostgreSQL 16 (nocobase_app)',
      sub: ['56 Static + latticeCustom*', 'FORCE RLS · pgvector'],
      icon: 'database',
      x: 32,
      y: 396,
      width: 308,
      height: 64,
      zoneId: 'tier-data',
      focal: true,
      inspector: isVi
        ? {
            role: 'Dữ liệu — PostgreSQL 16 FORCE RLS & pgvector 0.8.1',
            packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · nocobase_app (NOBYPASSRLS)',
            protocol: 'app.current_org / app.rls_bypass · HNSW Cosine + GIN',
            payloadOrSchema: '56 Static Tables · latticeCustom* · latticeParaChunks',
            responsibilities:
              'Áp đặt cô lập đa tenant mức hàng cho 56 bảng tĩnh, bảng động latticeCustom* và chỉ mục vector HNSW cho Hybrid RAG.',
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
      id: 'd-stores',
      title: 'RustFS S3 · Orion-LD · Valkey 8.1',
      sub: ['Scanned Objects · NGSI-LD', 'Valkey DB 0 / 1 / 2'],
      icon: 'lock',
      x: 366,
      y: 396,
      width: 308,
      height: 64,
      zoneId: 'tier-data',
      inspector: isVi
        ? {
            role: 'Dữ liệu — Kho đối tượng S3, Ngữ cảnh Orion-LD & Valkey 8.1',
            packageOrPort: 'rustfs:1.0.6 · orion-ld:1.12.0 (Mongo 8) · valkey:8.1',
            protocol: 'S3 HTTP · NGSI-LD · RESP DB 0/1/2',
            payloadOrSchema: 'ClamAV-Cleared Objects · Context Entities · OIDC/SSE Cache',
            responsibilities:
              'Lưu tệp sạch qua ClamAV vào RustFS, duy trì trạng thái thực thể NGSI-LD và phân vùng Valkey cho cache, SSE PubSub và OIDC.',
          }
        : {
            role: 'Data — RustFS S3, Orion-LD Context & Valkey 8.1',
            packageOrPort: 'rustfs:1.0.6 · orion-ld:1.12.0 (Mongo 8) · valkey:8.1',
            protocol: 'S3 HTTP · NGSI-LD · RESP DB 0/1/2',
            payloadOrSchema: 'ClamAV-Cleared Objects · Context Entities · OIDC/SSE Cache',
            responsibilities:
              'Stores ClamAV-cleared files in RustFS, NGSI-LD twin context state in Orion-LD, and partitioned cache/SSE/OIDC state in Valkey.',
          },
    },
    {
      id: 'd-ledger',
      title: isVi ? 'Sổ cái Merkle & PITR WAL' : 'Ed25519 Merkle & PITR WAL',
      sub: ['latticeCryptoLedger', 'Gzip WAL Archive'],
      icon: 'activity',
      x: 700,
      y: 396,
      width: 308,
      height: 64,
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
    from: 't3-wms',
    to: 't2-portals',
    label: 'Portals',
    kind: 'flow',
    points: [
      [186, 96],
      [186, 156],
    ],
    labelPosition: 0.36,
  },
  {
    id: 'ts-2',
    from: 't3-cmms',
    to: 't2-studio',
    label: 'Modules',
    kind: 'flow',
    points: [
      [596, 96],
      [596, 156],
    ],
    labelPosition: 0.36,
  },
  {
    id: 'ts-3',
    from: 't3-cmms',
    to: 't2-ai',
    label: 'AI Apps',
    kind: 'flow',
    points: [
      [854, 96],
      [854, 156],
    ],
    labelPosition: 0.36,
  },
  {
    id: 'ts-4',
    from: 't2-portals',
    to: 't1-edge',
    label: 'HTTPS',
    kind: 'primary',
    points: [
      [148, 212],
      [148, 274],
    ],
    labelPosition: 0.35,
  },
  {
    id: 'ts-5',
    from: 't2-studio',
    to: 't1-host',
    label: 'Studio API',
    kind: 'primary',
    points: [
      [502, 212],
      [502, 274],
    ],
    labelPosition: 0.35,
  },
  {
    id: 'ts-6',
    from: 't2-ai',
    to: 't1-core',
    label: 'Agents / MCP',
    kind: 'flow',
    points: [
      [884, 212],
      [884, 274],
    ],
    labelPosition: 0.35,
  },
  {
    id: 'ts-7',
    from: 't1-edge',
    to: 't1-host',
    label: 'OIDC / Proxy',
    kind: 'primary',
    points: [
      [264, 305],
      [376, 305],
    ],
  },
  {
    id: 'ts-8',
    from: 't1-host',
    to: 't1-core',
    label: 'Plugins / Events',
    kind: 'primary',
    points: [
      [628, 305],
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
      [420, 336],
      [420, 358],
      [186, 358],
      [186, 396],
    ],
  },
  {
    id: 'ts-10',
    from: 't1-host',
    to: 'd-stores',
    label: 'S3 / Valkey',
    kind: 'flow',
    points: [
      [520, 336],
      [520, 396],
    ],
    labelPosition: 0.36,
  },
  {
    id: 'ts-11',
    from: 't1-core',
    to: 'd-stores',
    label: 'Orion-LD',
    kind: 'flow',
    points: [
      [792, 336],
      [792, 358],
      [620, 358],
      [620, 396],
    ],
  },
  {
    id: 'ts-12',
    from: 't1-core',
    to: 'd-ledger',
    label: 'Ed25519',
    kind: 'primary',
    points: [
      [896, 336],
      [896, 396],
    ],
    labelPosition: 0.36,
  },
]);

const stackSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'ss-1',
          title: 'Tầng 3 -> Tầng 2: Ứng dụng & Trải nghiệm',
          activeNodes: ['t3-wms', 't3-cmms', 't2-portals', 't2-studio', 't2-ai'],
          activeEdges: ['ts-1', 'ts-2', 'ts-3'],
          description:
            'Các ứng dụng nghiệp vụ (Kho lạnh WMS, IIoT Twin, CMMS, App AI) hiển thị qua cổng vai trò /p/*, Mobile PWA, 12 Native BlockModels và AI Studio.',
          route: '/p/<slug> | /v/mobile | /admin/settings/dxos-studio',
          chips: ['Tier 3 -> Tier 2', '12 Native BlockModels'],
        },
        {
          id: 'ss-2',
          title: 'Tầng 1: Biên Zero-Trust -> Host & Điều phối',
          activeNodes: ['t2-portals', 't2-studio', 't2-ai', 't1-edge', 't1-host', 't1-core'],
          activeEdges: ['ts-4', 'ts-5', 'ts-6', 'ts-7', 'ts-8'],
          description:
            'Caddy TLS, APISIX và Keycloak PKCE bảo vệ biên trước khi đẩy vào NocoBase 2.2.50 (+7 plugins) và các dịch vụ LatticeFlow, DMN, Orion-LD, AI.',
          route: 'Edge -> NocoBase 2.2.50 -> Orchestration / IIoT / AI',
          chips: ['OIDC PKCE S256', 'sdkProvidedByHost: true'],
        },
        {
          id: 'ss-3',
          title: 'Dữ liệu: PG16 FORCE RLS & Kho riêng Dịch vụ',
          activeNodes: ['t1-host', 't1-core', 'd-pg16', 'd-stores', 'd-ledger'],
          activeEdges: ['ts-9', 'ts-10', 'ts-11', 'ts-12'],
          description:
            'Mọi truy vấn CSDL chạy dưới vai trò nocobase_app (NOBYPASSRLS) với PG16 FORCE RLS; đối tượng sạch vào RustFS, ngữ cảnh vào Orion-LD và chứng từ vào sổ cái Merkle.',
          route: 'pg-rls.js -> nocobase_app -> 56 FORCE RLS Tables',
          payload: "SELECT set_config('app.current_org', :orgId, true);",
          chips: ['No Direct DB Bypass', 'Ed25519 Merkle'],
        },
      ]
    : [
        {
          id: 'ss-1',
          title: 'Tiers 3 -> 2: Business Apps & Experience',
          activeNodes: ['t3-wms', 't3-cmms', 't2-portals', 't2-studio', 't2-ai'],
          activeEdges: ['ts-1', 'ts-2', 'ts-3'],
          description:
            'Pluggable applications (Cold-Chain WMS, IIoT Twin, CMMS, AI-Built Apps) surface through role portals, offline PWA, 12 BlockModels, and AI Studio.',
          route: '/p/<slug> | /v/mobile | /admin/settings/dxos-studio',
          chips: ['Tier 3 -> Tier 2', '12 Native BlockModels'],
        },
        {
          id: 'ss-2',
          title: 'Tier 1: Edge -> Host -> Orchestration & AI',
          activeNodes: ['t2-portals', 't2-studio', 't2-ai', 't1-edge', 't1-host', 't1-core'],
          activeEdges: ['ts-4', 'ts-5', 'ts-6', 'ts-7', 'ts-8'],
          description:
            'Caddy TLS, APISIX rate limits, and Keycloak PKCE guard ingress into NocoBase 2.2.50 (+7 plugins) and the LatticeFlow, DMN, Orion-LD, and AI engines.',
          route: 'Edge -> NocoBase 2.2.50 -> Orchestration / IIoT / AI',
          chips: ['OIDC PKCE S256', 'sdkProvidedByHost: true'],
        },
        {
          id: 'ss-3',
          title: 'Data: PG16 FORCE RLS & Service Stores',
          activeNodes: ['t1-host', 't1-core', 'd-pg16', 'd-stores', 'd-ledger'],
          activeEdges: ['ts-9', 'ts-10', 'ts-11', 'ts-12'],
          description:
            'Every DB write executes as nocobase_app (NOBYPASSRLS) under PG16 FORCE RLS alongside RustFS S3, Orion-LD context, Valkey DB 0-2, and the Ed25519 Merkle ledger.',
          route: 'pg-rls.js -> nocobase_app -> 56 FORCE RLS Tables',
          payload: "SELECT set_config('app.current_org', :orgId, true);",
          chips: ['No Direct DB Bypass', 'Ed25519 Merkle'],
        },
      ],
);

const patternZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        { id: 'pz-1', label: '1 · YÊU CẦU ỨNG DỤNG (APPLICATION REQUEST)', x: 16, y: 12, width: 1048, height: 88, kind: 'traffic' },
        { id: 'pz-2', label: '2 · TÍCH HỢP NGOÀI (EXTERNAL INTEGRATION)', x: 16, y: 110, width: 1048, height: 88, kind: 'band' },
        { id: 'pz-3', label: '3 · TỰ ĐỘNG HÓA THEO NGỮ CẢNH (CONTEXT AUTOMATION)', x: 16, y: 208, width: 1048, height: 88, kind: 'traffic' },
        { id: 'pz-4', label: '4 · TÁC NHÂN NGHIỆP VỤ (BUSINESS AGENT & HITL)', x: 16, y: 306, width: 1048, height: 88, kind: 'band' },
        { id: 'pz-5', label: '5 · XÂY DỰNG ỨNG DỤNG (APP BUILDER 2.0)', x: 16, y: 404, width: 1048, height: 88, kind: 'external' },
      ]
    : [
        { id: 'pz-1', label: '1 · APPLICATION REQUEST', x: 16, y: 12, width: 1048, height: 88, kind: 'traffic' },
        { id: 'pz-2', label: '2 · EXTERNAL INTEGRATION', x: 16, y: 110, width: 1048, height: 88, kind: 'band' },
        { id: 'pz-3', label: '3 · CONTEXT AUTOMATION', x: 16, y: 208, width: 1048, height: 88, kind: 'traffic' },
        { id: 'pz-4', label: '4 · BUSINESS AGENT & HITL', x: 16, y: 306, width: 1048, height: 88, kind: 'band' },
        { id: 'pz-5', label: '5 · APP BUILDER 2.0', x: 16, y: 404, width: 1048, height: 88, kind: 'external' },
      ],
);

const patternNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    // Lane 1
    {
      id: 'p1-user',
      title: isVi ? 'Workspace / PWA' : 'Workspace / PWA',
      sub: '/p/* · /v/mobile · /v/*',
      icon: 'globe',
      x: 28,
      y: 38,
      width: 236,
      height: 54,
      zoneId: 'pz-1',
      inspector: {
        role: isVi ? 'Mẫu 1 — Điểm khởi phát yêu cầu người dùng' : 'Pattern 1 — Workspace / PWA Entry',
        packageOrPort: '/p/<slug> · /v/mobile · /v/form/*',
        protocol: 'HTTPS TLS 1.3',
        payloadOrSchema: 'OIDC Cookie | Bearer JWT',
        responsibilities: isVi
          ? 'Gửi yêu cầu thao tác nghiệp vụ từ cổng vai trò hoặc ứng dụng hiện trường.'
          : 'Submits portal or mobile PWA operations through the zero-trust edge.',
      },
    },
    {
      id: 'p1-gw',
      title: 'Caddy + APISIX',
      sub: 'TLS 1.3 · JWKS · Rate Limit',
      icon: 'shield',
      x: 290,
      y: 38,
      width: 236,
      height: 54,
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
      id: 'p1-host',
      title: 'NocoBase + 7 Plugins',
      sub: 'Fastify 5 · ALS RLS Bridge',
      icon: 'server',
      x: 552,
      y: 38,
      width: 236,
      height: 54,
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
      sub: 'nocobase_app · 56 + Custom',
      icon: 'database',
      x: 814,
      y: 38,
      width: 236,
      height: 54,
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
    // Lane 2
    {
      id: 'p2-ext',
      title: isVi ? 'Hệ thống Ngoài' : 'External System',
      sub: 'ERP · Partner · SaaS',
      icon: 'globe',
      x: 28,
      y: 136,
      width: 236,
      height: 54,
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
      title: 'HMAC Webhook',
      sub: 'Standard Webhooks · SSRF',
      icon: 'lock',
      x: 290,
      y: 136,
      width: 236,
      height: 54,
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
      title: 'PG16 Outbox / Stock n8n',
      sub: 'SKIP LOCKED · REST v1',
      icon: 'plug',
      x: 552,
      y: 136,
      width: 236,
      height: 54,
      zoneId: 'pz-2',
      inspector: {
        role: isVi ? 'Mẫu 2 — Bộ chuyển tiếp Outbox & Stock n8n' : 'Pattern 2 — Outbox Bus & Stock n8n Bridge',
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
      title: isVi ? 'API Phạm vi (ldx_pat_*)' : 'Scoped API (ldx_pat_*)',
      sub: '7 Scopes · Role Clamped',
      icon: 'key',
      x: 814,
      y: 136,
      width: 236,
      height: 54,
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
    // Lane 3
    {
      id: 'p3-mqtt',
      title: 'Mosquitto -> Node-RED',
      sub: 'DynSec :1883 · Node-RED',
      icon: 'radio',
      x: 28,
      y: 234,
      width: 204,
      height: 54,
      zoneId: 'pz-3',
      inspector: {
        role: isVi ? 'Mẫu 3 — Thu thập MQTT & chuẩn hóa Node-RED' : 'Pattern 3 — Mosquitto & Node-RED Ingest',
        packageOrPort: 'mosquitto:2.0.21 -> nodered:4.0.9 -> dxosBlocks',
        protocol: 'MQTT QoS 1 -> POST :telemetryIngest',
        payloadOrSchema: 'X-Lattice-Edge-Token',
        responsibilities: isVi
          ? 'Node-RED đọc MQTT từ Mosquitto DynSec và đẩy về NocoBase :telemetryIngest.'
          : 'Node-RED subscribes to Mosquitto DynSec and posts sanitized telemetry to NocoBase :telemetryIngest.',
      },
    },
    {
      id: 'p3-orion',
      title: 'PG16 Outbox -> Orion-LD',
      sub: '10s Sync · NGSI-LD :1026',
      icon: 'globe',
      x: 252,
      y: 234,
      width: 208,
      height: 54,
      zoneId: 'pz-3',
      inspector: {
        role: isVi ? 'Mẫu 3 — Outbox & Context Broker Orion-LD' : 'Pattern 3 — PG16 Outbox & FIWARE Orion-LD',
        packageOrPort: 'latticeContextOutbox -> fiware/orion-ld:1.12.0',
        protocol: 'NGSI-LD HTTP · NGSILD-Tenant',
        payloadOrSchema: 'urn:ngsi-ld:Asset:<org>:native:<id>',
        responsibilities: isVi
          ? 'Đồng bộ thực thể từ PG16 Context Outbox và phát Change notification về NocoBase (:orionNotify).'
          : 'Syncs NGSI-LD entities from the 10s PG16 outbox and emits Change notifications to :orionNotify.',
      },
    },
    {
      id: 'p3-dmn',
      title: 'DMN & Arrhenius MKT',
      sub: 'FEEL Rules · hold_mkt',
      icon: 'git-branch',
      x: 608,
      y: 234,
      width: 212,
      height: 54,
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
      title: 'LatticeFlow / Downlink',
      sub: '24 Nodes · |ΔT| > 2.0C HITL',
      icon: 'workflow',
      x: 840,
      y: 234,
      width: 212,
      height: 54,
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
    // Lane 4
    {
      id: 'p4-in',
      title: 'Chat / Flow / MCP / A2A',
      sub: '7 Profiles · JSON-RPC 2.0',
      icon: 'terminal',
      x: 28,
      y: 332,
      width: 236,
      height: 54,
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
      title: 'Agent + P.A.R.A. RAG',
      sub: 'ReAct Loop · RRF k=60',
      icon: 'bot',
      x: 290,
      y: 332,
      width: 236,
      height: 54,
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
      title: '20 Audited Tools',
      sub: '9 PII Regex · PG16 Quotas',
      icon: 'shield',
      x: 552,
      y: 332,
      width: 236,
      height: 54,
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
      id: 'p4-hitl',
      title: 'HITL Queue / OTel',
      sub: 'ApprovalQueue · GenAI :4318',
      icon: 'check-circle',
      x: 814,
      y: 332,
      width: 236,
      height: 54,
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
    // Lane 5
    {
      id: 'p5-arch',
      title: 'dxos-architect',
      sub: isVi ? 'Khóa quyền Admin' : 'Admin Role Lock',
      icon: 'cpu',
      x: 28,
      y: 430,
      width: 188,
      height: 54,
      zoneId: 'pz-5',
      inspector: {
        role: isVi ? 'Mẫu 5 — Kiến trúc sư AI khóa quyền Admin' : 'Pattern 5 — Admin-Locked App Builder 2.0',
        packageOrPort: 'dxos-architect · app-builder-orchestrator.js',
        protocol: 'allowedRoles: [root, admin]',
        payloadOrSchema: 'dxos_provision_role_workspace',
        responsibilities: isVi
          ? 'Tiếp nhận mô tả nghiệp vụ từ quản trị viên qua App Builder 2.0.'
          : 'Accepts structured or natural-language app specs strictly from admin roles.',
      },
    },
    {
      id: 'p5-plan',
      title: 'Plan & ER Diff',
      sub: isVi ? 'Dry-Run · Không ghi DB' : 'Dry-Run · Zero DB',
      icon: 'git-branch',
      x: 237,
      y: 430,
      width: 188,
      height: 54,
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
      id: 'p5-build',
      title: 'Build + Self-Heal',
      sub: isVi ? '<= 2 vòng tự sửa' : '<= 2 Repair Rounds',
      icon: 'activity',
      x: 446,
      y: 430,
      width: 188,
      height: 54,
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
      id: 'p5-ver',
      title: isVi ? 'Ứng dụng Phiên bản' : 'Versioned App',
      sub: 'latticeBuiltApps',
      icon: 'layers',
      x: 655,
      y: 430,
      width: 188,
      height: 54,
      zoneId: 'pz-5',
      inspector: {
        role: isVi ? 'Mẫu 5 — Quản lý phiên bản & snapshot giao diện' : 'Pattern 5 — Versioned App & Snapshots',
        packageOrPort: 'latticeBuiltApps · latticeUiSnapshots',
        protocol: 'FORCE RLS · Version History',
        payloadOrSchema: 'specJson · portalSlug · snapshotId',
        responsibilities: isVi
          ? 'Lưu trữ đặc tả ứng dụng theo phiên bản cùng snapshot giao diện để so sánh hoặc khôi phục.'
          : 'Tracks built application specs alongside UI snapshots for atomic rollback or export.',
      },
    },
    {
      id: 'p5-pub',
      title: 'Bundle v3 / Rollback',
      sub: 'Snapshot · keepData',
      icon: 'check-circle',
      x: 864,
      y: 430,
      width: 188,
      height: 54,
      zoneId: 'pz-5',
      focal: true,
      inspector: {
        role: isVi ? 'Mẫu 5 — Xuất Bundle v3 & Khôi phục an toàn' : 'Pattern 5 — Export Bundle v3 & Safe Rollback',
        packageOrPort: 'exportBuiltAppBundle · rollbackBuiltApp · teardownBuiltApp',
        protocol: 'Solution Bundle v3 · latticeUiSnapshots',
        payloadOrSchema: 'keepData=true · contentSha256',
        responsibilities: isVi
          ? 'Xuất Solution Bundle v3 chuẩn GitOps hoặc khôi phục nguyên tử về snapshot cũ.'
          : 'Exports SHA-256 Solution Bundles v3 or rolls back atomically to saved snapshots.',
      },
    },
  ];
});

const patternEdges = computed<DiagramEdge[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    // Lane 1
    { id: 'pe-1a', from: 'p1-user', to: 'p1-gw', kind: 'primary', points: [[264, 65], [290, 65]] },
    { id: 'pe-1b', from: 'p1-gw', to: 'p1-host', kind: 'primary', points: [[526, 65], [552, 65]] },
    { id: 'pe-1c', from: 'p1-host', to: 'p1-db', kind: 'primary', points: [[788, 65], [814, 65]] },
    // Lane 2
    { id: 'pe-2a', from: 'p2-ext', to: 'p2-hook', kind: 'flow', points: [[264, 163], [290, 163]] },
    { id: 'pe-2b', from: 'p2-hook', to: 'p2-bus', kind: 'flow', points: [[526, 163], [552, 163]] },
    { id: 'pe-2c', from: 'p2-bus', to: 'p2-api', kind: 'primary', points: [[788, 163], [814, 163]] },
    // Lane 3
    { id: 'pe-3a', from: 'p3-mqtt', to: 'p3-orion', kind: 'flow', points: [[232, 261], [252, 261]] },
    {
      id: 'pe-3b',
      from: 'p3-orion',
      to: 'p3-dmn',
      label: isVi ? 'Thông báo biến đổi' : 'Change Notify',
      kind: 'dashed',
      points: [[460, 261], [608, 261]],
    },
    { id: 'pe-3c', from: 'p3-dmn', to: 'p3-flow', kind: 'primary', points: [[820, 261], [840, 261]] },
    // Lane 4
    { id: 'pe-4a', from: 'p4-in', to: 'p4-rag', kind: 'flow', points: [[264, 359], [290, 359]] },
    { id: 'pe-4b', from: 'p4-rag', to: 'p4-tools', kind: 'primary', points: [[526, 359], [552, 359]] },
    { id: 'pe-4c', from: 'p4-tools', to: 'p4-hitl', kind: 'primary', points: [[788, 359], [814, 359]] },
    // Lane 5
    { id: 'pe-5a', from: 'p5-arch', to: 'p5-plan', kind: 'primary', points: [[216, 457], [237, 457]] },
    { id: 'pe-5b', from: 'p5-plan', to: 'p5-build', kind: 'flow', points: [[425, 457], [446, 457]] },
    { id: 'pe-5c', from: 'p5-build', to: 'p5-ver', kind: 'primary', points: [[634, 457], [655, 457]] },
    { id: 'pe-5d', from: 'p5-ver', to: 'p5-pub', kind: 'primary', points: [[843, 457], [864, 457]] },
  ];
});

const patternSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'pat-1',
          title: '1 · Yêu cầu Ứng dụng',
          activeNodes: ['p1-user', 'p1-gw', 'p1-host', 'p1-db'],
          activeEdges: ['pe-1a', 'pe-1b', 'pe-1c'],
          description:
            'Mọi yêu cầu từ cổng /p/*, PWA hoặc biểu mẫu đi qua Caddy + APISIX tới NocoBase + 7 Plugins và thực thi dưới PG16 FORCE RLS (nocobase_app).',
          route: 'Workspace -> Caddy + APISIX -> NocoBase -> PG16 FORCE RLS',
          chips: ['TLS 1.3', 'PKCE S256', '56 FORCE RLS'],
        },
        {
          id: 'pat-2',
          title: '2 · Tích hợp Ngoài',
          activeNodes: ['p2-ext', 'p2-hook', 'p2-bus', 'p2-api'],
          activeEdges: ['pe-2a', 'pe-2b', 'pe-2c'],
          description:
            'Hệ thống ngoài gửi webhook có chữ ký HMAC qua PG16 Outbox hoặc Stock n8n để gọi API được cấp phạm vi ldx_pat_*.',
          route: 'External -> HMAC Webhook -> PG16 Outbox / n8n -> ldx_pat_* API',
          chips: ['HMAC-SHA256', '7 PAT Scopes'],
        },
        {
          id: 'pat-3',
          title: '3 · Tự động hóa Ngữ cảnh',
          activeNodes: ['p3-mqtt', 'p3-orion', 'p3-dmn', 'p3-flow'],
          activeEdges: ['pe-3a', 'pe-3b', 'pe-3c'],
          description:
            'Cảm biến qua Mosquitto -> Node-RED -> PG16 Outbox cập nhật Orion-LD, phát Change Notify (nét đứt) tới DMN/MKT và LatticeFlow / Downlink.',
          route: 'Mosquitto -> Node-RED -> Orion-LD --(Notify)--> DMN/MKT -> Flow v2',
          chips: ['NGSI-LD', 'Dashed Notify', 'HITL > 2.0C'],
        },
        {
          id: 'pat-4',
          title: '4 · Tác nhân Nghiệp vụ',
          activeNodes: ['p4-in', 'p4-rag', 'p4-tools', 'p4-hitl'],
          activeEdges: ['pe-4a', 'pe-4b', 'pe-4c'],
          description:
            'Yêu cầu AI từ Chat, Flow hoặc MCP/A2A gọi Agent + P.A.R.A. RAG (k=60), qua 20 Audited Tools (PII/Quota) tới hàng đợi HITL & OTel GenAI.',
          route: 'Chat/Flow/MCP -> Agent + P.A.R.A. RAG -> 20 Tools -> HITL / OTel',
          chips: ['RRF k=60', '9 PII Regex', 'ASK Queue'],
        },
        {
          id: 'pat-5',
          title: '5 · App Builder 2.0',
          activeNodes: ['p5-arch', 'p5-plan', 'p5-build', 'p5-ver', 'p5-pub'],
          activeEdges: ['pe-5a', 'pe-5b', 'pe-5c', 'pe-5d'],
          description:
            'dxos-architect lập đồ thị ER Diff không ghi DB, dựng & tự sửa <= 2 vòng thành Versioned App rồi xuất Bundle v3 hoặc Rollback an toàn.',
          route: 'dxos-architect -> Plan & ER Diff -> Build -> Versioned App -> Bundle v3',
          chips: ['Zero Direct DB Write', 'Bundle v3', 'Safe Rollback'],
        },
      ]
    : [
        {
          id: 'pat-1',
          title: '1 · Application Request',
          activeNodes: ['p1-user', 'p1-gw', 'p1-host', 'p1-db'],
          activeEdges: ['pe-1a', 'pe-1b', 'pe-1c'],
          description:
            'Workspace, PWA, and public traffic traverses Caddy + APISIX to NocoBase + 7 Plugins and executes inside PG16 FORCE RLS under nocobase_app.',
          route: 'Workspace -> Caddy + APISIX -> NocoBase -> PG16 FORCE RLS',
          chips: ['TLS 1.3', 'PKCE S256', '56 FORCE RLS'],
        },
        {
          id: 'pat-2',
          title: '2 · External Integration',
          activeNodes: ['p2-ext', 'p2-hook', 'p2-bus', 'p2-api'],
          activeEdges: ['pe-2a', 'pe-2b', 'pe-2c'],
          description:
            'External systems enter via HMAC webhooks and PG16 Outbox / Stock n8n to invoke scope-clamped ldx_pat_* service APIs.',
          route: 'External -> HMAC Webhook -> PG16 Outbox / n8n -> ldx_pat_* API',
          chips: ['HMAC-SHA256', '7 PAT Scopes'],
        },
        {
          id: 'pat-3',
          title: '3 · Context Automation',
          activeNodes: ['p3-mqtt', 'p3-orion', 'p3-dmn', 'p3-flow'],
          activeEdges: ['pe-3a', 'pe-3b', 'pe-3c'],
          description:
            'Telemetry flows from Mosquitto -> Node-RED -> PG16 Outbox into Orion-LD, firing dashed Change Notify into DMN/MKT and LatticeFlow / Downlink.',
          route: 'Mosquitto -> Node-RED -> Orion-LD --(Notify)--> DMN/MKT -> Flow v2',
          chips: ['NGSI-LD', 'Dashed Notify', 'HITL > 2.0C'],
        },
        {
          id: 'pat-4',
          title: '4 · Business Agent',
          activeNodes: ['p4-in', 'p4-rag', 'p4-tools', 'p4-hitl'],
          activeEdges: ['pe-4a', 'pe-4b', 'pe-4c'],
          description:
            'Chat, Flow, or MCP/A2A requests invoke Agents with P.A.R.A. RAG (k=60) through 20 Audited Tools (PII/Quota) to the HITL queue and OTel GenAI.',
          route: 'Chat/Flow/MCP -> Agent + P.A.R.A. RAG -> 20 Tools -> HITL / OTel',
          chips: ['RRF k=60', '9 PII Regex', 'ASK Queue'],
        },
        {
          id: 'pat-5',
          title: '5 · App Builder 2.0',
          activeNodes: ['p5-arch', 'p5-plan', 'p5-build', 'p5-ver', 'p5-pub'],
          activeEdges: ['pe-5a', 'pe-5b', 'pe-5c', 'pe-5d'],
          description:
            'dxos-architect computes a dry-run ER Plan & Diff, builds with <= 2 self-heal rounds into a Versioned App, and exports Bundle v3 or rolls back safely.',
          route: 'dxos-architect -> Plan & ER Diff -> Build -> Versioned App -> Bundle v3',
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
          viewBox: '0 0 1040 480',
          zones: stackZones.value,
          nodes: stackNodes.value,
          edges: stackEdges.value,
          steps: stackSteps.value,
        },
        {
          id: 'interaction-patterns',
          label: '5 Mẫu Tương tác (1..5)',
          viewBox: '0 0 1080 506',
          zones: patternZones.value,
          nodes: patternNodes.value,
          edges: patternEdges.value,
          steps: patternSteps.value,
        },
      ]
    : [
        {
          id: 'tier-stack',
          label: '4-Tier Stack (v0.4.2)',
          viewBox: '0 0 1040 480',
          zones: stackZones.value,
          nodes: stackNodes.value,
          edges: stackEdges.value,
          steps: stackSteps.value,
        },
        {
          id: 'interaction-patterns',
          label: '5 Interaction Patterns',
          viewBox: '0 0 1080 506',
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
    : 'Select any tier component or interaction pattern (1–5) to inspect Tier 3 -> Tier 2 -> Tier 1 -> Service-owned Data boundaries and the PG16 FORCE RLS write gate.',
);
</script>

<template>
  <DiagramCanvas
    :title="titleText"
    :caption="captionText"
    view-box="0 0 1040 480"
    :modes="modes"
    :compact="props.compact"
    :lang="locale"
  />
</template>
