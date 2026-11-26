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

const mountZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'plugins-zone',
          label: '7 Plugin Apache-2.0 (plugins/nocobase/* · sdkProvidedByHost: true)',
          x: 16,
          y: 12,
          width: 848,
          height: 220,
          kind: 'admin',
        },
        {
          id: 'host-zone',
          label: 'Container Host Ngoài (Điều 5.2 NocoBase)',
          x: 16,
          y: 256,
          width: 380,
          height: 120,
          kind: 'external',
        },
        {
          id: 'data-zone',
          label: 'Dữ liệu Cô lập & Bộ nhớ đệm',
          x: 484,
          y: 256,
          width: 380,
          height: 120,
          kind: 'traffic',
        },
      ]
    : [
        {
          id: 'plugins-zone',
          label: '7 Apache-2.0 Plugins (plugins/nocobase/* · sdkProvidedByHost: true)',
          x: 16,
          y: 12,
          width: 848,
          height: 220,
          kind: 'admin',
        },
        {
          id: 'host-zone',
          label: 'External OCI Host (Clause 5.2)',
          x: 16,
          y: 256,
          width: 380,
          height: 120,
          kind: 'external',
        },
        {
          id: 'data-zone',
          label: 'Isolated Database & Cache',
          x: 484,
          y: 256,
          width: 380,
          height: 120,
          kind: 'traffic',
        },
      ],
);

const mountNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'p-action-bridge',
      title: 'Action Bridge',
      sub: 'plugin-action-bridge',
      icon: 'plug',
      x: 32,
      y: 52,
      width: 192,
      height: 64,
      zoneId: 'plugins-zone',
      inspector: isVi
        ? {
            role: 'Cầu nối Hành động & Tích hợp Studio',
            packageOrPort: '@latticedx/plugin-action-bridge · v0.4.2',
            protocol: 'server.cjs (bridge.cjs / studio.cjs) · client-v2',
            payloadOrSchema: 'dist/externalVersion.js | @nocobase/server',
            responsibilities:
              'Ánh xạ hành động điều phối và điểm mở rộng Studio vào runtime NocoBase 2.2.50 với gói externalVersion sinh tự động.',
          }
        : {
            role: 'Action Execution & Studio Bridge Plugin',
            packageOrPort: '@latticedx/plugin-action-bridge · v0.4.2',
            protocol: 'server.cjs (bridge.cjs / studio.cjs) · client-v2',
            payloadOrSchema: 'dist/externalVersion.js | @nocobase/server',
            responsibilities:
              'Bridges studio and action endpoints into NocoBase 2.2.50 using generated externalVersion metadata for host SDK resolution.',
          },
    },
    {
      id: 'p-dxos-para',
      title: isVi ? 'Không gian PARA' : 'P.A.R.A. Space',
      sub: 'plugin-dxos-para',
      icon: 'file-text',
      x: 240,
      y: 52,
      width: 192,
      height: 64,
      zoneId: 'plugins-zone',
      inspector: isVi
        ? {
            role: 'Quản trị Kho Tri thức P.A.R.A. & Tìm kiếm Tài liệu',
            packageOrPort: '@latticedx/plugin-dxos-para · v0.4.2',
            protocol: 'DxosParaPlugin · DxosParaClientV2',
            payloadOrSchema: 'latticeParaDocuments | latticePara:*',
            responsibilities:
              'Tổ chức tài liệu theo 4 khu vực Projects/Areas/Resources/Archives phục vụ tra cứu ngữ cảnh doanh nghiệp.',
          }
        : {
            role: 'P.A.R.A. Knowledge Organization Plugin',
            packageOrPort: '@latticedx/plugin-dxos-para · v0.4.2',
            protocol: 'DxosParaPlugin · DxosParaClientV2',
            payloadOrSchema: 'latticeParaDocuments | latticePara:*',
            responsibilities:
              'Organizes operational knowledge across Projects, Areas, Resources, and Archives with tenant-scoped collections.',
          },
    },
    {
      id: 'p-dxos-blocks',
      title: isVi ? '12 Block v2' : 'Native Blocks',
      sub: 'plugin-dxos-blocks',
      icon: 'box',
      x: 448,
      y: 52,
      width: 192,
      height: 64,
      zoneId: 'plugins-zone',
      inspector: isVi
        ? {
            role: '12 Native v2 BlockModels, WebGIS & Creative Studio',
            packageOrPort: '@latticedx/plugin-dxos-blocks · v0.4.2',
            protocol: 'esbuild 0.28.2 UMD (maplibre-gl@6.19.0 bundled)',
            payloadOrSchema: 'dxosBlocks:* · DxosWebGisBlockModel · DxosWmsOpsBlockModel',
            responsibilities:
              'Đăng ký 12 FlowEngine BlockModels (KPI, Telemetry, WebGIS MapLibre, Kanban, FEFO WMS, BI Chart) giữ nguyên externals host.',
          }
        : {
            role: '12 Native v2 BlockModels, WebGIS & BI Charts',
            packageOrPort: '@latticedx/plugin-dxos-blocks · v0.4.2',
            protocol: 'esbuild 0.28.2 UMD (maplibre-gl@6.19.0 bundled)',
            payloadOrSchema: 'dxosBlocks:* · DxosWebGisBlockModel · DxosWmsOpsBlockModel',
            responsibilities:
              'Registers 12 FlowEngine v2 BlockModels including MapLibre WebGIS, FEFO warehouse operations, Creative Studio, and BI charts.',
          },
    },
    {
      id: 'p-dxos-ai',
      title: 'DX-OS AI Studio',
      sub: 'plugin-dxos-ai',
      icon: 'bot',
      x: 656,
      y: 52,
      width: 192,
      height: 64,
      zoneId: 'plugins-zone',
      inspector: isVi
        ? {
            role: 'AI Workforce, App Builder 2.0, MCP & A2A Gateway',
            packageOrPort: '@latticedx/plugin-dxos-ai · v0.4.2',
            protocol: 'DxosAiPlugin · JSON-RPC 2.0 · SSE · pgvector',
            payloadOrSchema: 'dxosAi:* | /api/dxos-mcp | /api/dxos-a2a | 7 Profiles',
            responsibilities:
              'Cung cấp 7 Agent Profiles, 20 Unified Tools, App Builder 2.0 (plan/build/patch/rollback), RAG lai RRF và cổng MCP/A2A.',
          }
        : {
            role: 'AI Workforce, App Builder 2.0, MCP & A2A Gateway',
            packageOrPort: '@latticedx/plugin-dxos-ai · v0.4.2',
            protocol: 'DxosAiPlugin · JSON-RPC 2.0 · SSE · pgvector',
            payloadOrSchema: 'dxosAi:* | /api/dxos-mcp | /api/dxos-a2a | 7 Profiles',
            responsibilities:
              'Hosts 7 Agent Profiles, 20 audited Unified Tools, App Builder 2.0 lifecycle, hybrid pgvector RAG, and MCP/A2A endpoints.',
          },
    },
    {
      id: 'p-enterprise-auth',
      title: isVi ? 'Xác thực OIDC' : 'Enterprise Auth',
      sub: 'plugin-enterprise-auth',
      icon: 'key',
      x: 32,
      y: 148,
      width: 256,
      height: 64,
      zoneId: 'plugins-zone',
      inspector: isVi
        ? {
            role: 'Đăng nhập SSO Keycloak OIDC / PKCE S256',
            packageOrPort: '@latticedx/plugin-enterprise-auth · v0.4.2',
            protocol: 'openid-client@6.8.9 (bundled) · Valkey DB 2',
            payloadOrSchema: 'enterpriseAuth:start | callback | finish | backchannelLogout',
            responsibilities:
              'Đóng gói openid-client@6.8.9, xử lý PKCE S256, vé dùng một lần 60 giây và thu hồi phiên qua backchannelLogout.',
          }
        : {
            role: 'Enterprise OIDC / PKCE S256 Authentication',
            packageOrPort: '@latticedx/plugin-enterprise-auth · v0.4.2',
            protocol: 'openid-client@6.8.9 (bundled) · Valkey DB 2',
            payloadOrSchema: 'enterpriseAuth:start | callback | finish | backchannelLogout',
            responsibilities:
              'Bundles openid-client@6.8.9 to handle PKCE S256 exchange, 60s one-time Valkey DB 2 tickets, and backchannel revocation.',
          },
    },
    {
      id: 'p-foundation',
      title: isVi ? 'Lõi Foundation' : 'Foundation Core',
      sub: 'plugin-lattice-foundation',
      icon: 'layers',
      x: 312,
      y: 148,
      width: 256,
      height: 64,
      zoneId: 'plugins-zone',
      focal: true,
      inspector: isVi
        ? {
            role: 'Nền tảng RLS, PKI Merkle, Outbox, PWA & OpenAPI',
            packageOrPort: '@latticedx/plugin-lattice-foundation · v0.4.2',
            protocol: 'pg-rls.js · CloudEvents 1.0 · OpenAPI 3.1 · OTLP',
            payloadOrSchema: 'dxos:* | dxosApiKeys:* | dxosLedger:* | dxosForms:*',
            responsibilities:
              'Cài đặt cầu giao dịch AsyncLocalStorage cho 56 bảng FORCE RLS, sổ cái Ed25519/Merkle, khóa ldx_pat_*, đa cổng /p/* và biểu mẫu công khai.',
          }
        : {
            role: 'RLS Engine, PKI Ledger, Outbox, Portals & OpenAPI Core',
            packageOrPort: '@latticedx/plugin-lattice-foundation · v0.4.2',
            protocol: 'pg-rls.js · CloudEvents 1.0 · OpenAPI 3.1 · OTLP',
            payloadOrSchema: 'dxos:* | dxosApiKeys:* | dxosLedger:* | dxosForms:*',
            responsibilities:
              'Installs the AsyncLocalStorage RLS bridge, Ed25519 Merkle ledger, ldx_pat_* API keys, multi-portal routing, and OTel/Prometheus.',
          },
    },
    {
      id: 'p-dxos-studio',
      title: 'Admin Studio',
      sub: 'plugin-dxos-studio',
      icon: 'workflow',
      x: 592,
      y: 148,
      width: 256,
      height: 64,
      zoneId: 'plugins-zone',
      inspector: isVi
        ? {
            role: 'LatticeFlow v2, Visual DMN, n8n, WMS & Schema Studio',
            packageOrPort: '@latticedx/plugin-dxos-studio · v0.4.2',
            protocol: 'esbuild 0.28.2 UMD (@xyflow/react + @dagrejs/dagre)',
            payloadOrSchema: 'dxosAutomations:* | dxosDmn:* | dxosWms:* | dxosN8n:*',
            responsibilities:
              'Cung cấp trình thiết kế DAG 24 node, bảng quyết định FEEL DMN, Safe AST Formula 22 hàm, FEFO WMS, ePOD QR và cầu nối n8n.',
          }
        : {
            role: 'LatticeFlow v2, Visual DMN, n8n Bridge & WMS Studio',
            packageOrPort: '@latticedx/plugin-dxos-studio · v0.4.2',
            protocol: 'esbuild 0.28.2 UMD (@xyflow/react + @dagrejs/dagre)',
            payloadOrSchema: 'dxosAutomations:* | dxosDmn:* | dxosWms:* | dxosN8n:*',
            responsibilities:
              'Powers the 24-node LatticeFlow DAG, Visual DMN FEEL engine, 22-function Safe AST formulas, FEFO WMS, ePOD QR, and n8n REST bridge.',
          },
    },
    {
      id: 'host-nocobase',
      title: isVi ? 'Host NocoBase' : 'NocoBase Host',
      sub: 'nocobase/nocobase:2.2.50 · :80',
      icon: 'server',
      x: 36,
      y: 292,
      width: 340,
      height: 68,
      zoneId: 'host-zone',
      focal: true,
      inspector: isVi
        ? {
            role: 'Container Host Độc lập Cung cấp SDK Thời điểm Chạy',
            packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751... · :80',
            protocol: 'sdkProvidedByHost: true · Read-Only Bind Mount (:ro)',
            payloadOrSchema: '@nocobase/server, database, client, client-v2, auth, workflow',
            responsibilities:
              'Nạp 7 plugin từ /app/nocobase/node_modules/@latticedx/* (:ro), cung cấp React 18.2 / AntD 5.24.2 / SDK và giữ nguyên Điều 5.2.',
          }
        : {
            role: 'External OCI Host Providing Runtime SDK Externals',
            packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751... · :80',
            protocol: 'sdkProvidedByHost: true · Read-Only Bind Mount (:ro)',
            payloadOrSchema: '@nocobase/server, database, client, client-v2, auth, workflow',
            responsibilities:
              'Mounts all 7 plugins read-only at /app/nocobase/node_modules/@latticedx/*, injects shared host externals, and preserves Clause 5.2.',
          },
    },
    {
      id: 'data-pg-valkey',
      title: 'PG16 & Valkey 8.1',
      sub: 'nocobase_app · 56 FORCE RLS · DB 0-2',
      icon: 'database',
      x: 504,
      y: 292,
      width: 340,
      height: 68,
      zoneId: 'data-zone',
      inspector: isVi
        ? {
            role: 'Lưu trữ Đa-Tenant Cô lập & Bộ nhớ đệm Phân vùng',
            packageOrPort: 'pgvector:0.8.1-pg16 (:5432) · valkey:8.1-alpine (:6379)',
            protocol: 'app.current_org / app.rls_bypass · Valkey DB 0 / 1 / 2',
            payloadOrSchema: '56 FORCE RLS tables · latticeCustom* · PubSub surface-updates',
            responsibilities:
              'Chạy dưới role nocobase_app (NOBYPASSRLS) cho PostgreSQL 16 và tách Valkey thành DB 0 (cache), DB 1 (SSE PubSub), DB 2 (OIDC PKCE).',
          }
        : {
            role: 'Tenant-Isolated PostgreSQL 16 & Partitioned Valkey 8.1',
            packageOrPort: 'pgvector:0.8.1-pg16 (:5432) · valkey:8.1-alpine (:6379)',
            protocol: 'app.current_org / app.rls_bypass · Valkey DB 0 / 1 / 2',
            payloadOrSchema: '56 FORCE RLS tables · latticeCustom* · PubSub surface-updates',
            responsibilities:
              'Enforces NOBYPASSRLS via nocobase_app in PostgreSQL 16 and separates Valkey into DB 0 (cache), DB 1 (SSE PubSub), and DB 2 (OIDC).',
          },
    },
  ];
});

const mountEdges = computed<DiagramEdge[]>(() => [
  {
    id: 'ph-bridge',
    from: 'p-action-bridge',
    to: 'host-nocobase',
    kind: 'flow',
    points: [
      [128, 116],
      [128, 132],
      [300, 132],
      [300, 244],
      [84, 244],
      [84, 292],
    ],
  },
  {
    id: 'ph-para',
    from: 'p-dxos-para',
    to: 'host-nocobase',
    kind: 'flow',
    points: [
      [336, 116],
      [336, 132],
      [300, 132],
      [300, 244],
      [148, 244],
      [148, 292],
    ],
  },
  {
    id: 'ph-blocks',
    from: 'p-dxos-blocks',
    to: 'host-nocobase',
    kind: 'flow',
    points: [
      [544, 116],
      [544, 132],
      [580, 132],
      [580, 244],
      [212, 244],
      [212, 292],
    ],
  },
  {
    id: 'ph-ai',
    from: 'p-dxos-ai',
    to: 'host-nocobase',
    kind: 'primary',
    points: [
      [752, 116],
      [752, 132],
      [580, 132],
      [580, 244],
      [276, 244],
      [276, 292],
    ],
  },
  {
    id: 'ph-auth',
    from: 'p-enterprise-auth',
    to: 'host-nocobase',
    kind: 'flow',
    points: [
      [160, 212],
      [160, 244],
      [116, 244],
      [116, 292],
    ],
  },
  {
    id: 'ph-foundation',
    from: 'p-foundation',
    to: 'host-nocobase',
    kind: 'primary',
    points: [
      [440, 212],
      [440, 244],
      [244, 244],
      [244, 292],
    ],
  },
  {
    id: 'ph-studio',
    from: 'p-dxos-studio',
    to: 'host-nocobase',
    kind: 'primary',
    points: [
      [720, 212],
      [720, 244],
      [324, 244],
      [324, 292],
    ],
  },
  {
    id: 'ph-host-data',
    from: 'host-nocobase',
    to: 'data-pg-valkey',
    label: 'app.current_org',
    kind: 'primary',
    points: [
      [376, 324],
      [504, 324],
    ],
  },
]);

const mountSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'ms-1',
          title: 'Gắn chỉ đọc 7 Plugin vào Host OCI',
          activeNodes: [
            'p-action-bridge',
            'p-dxos-para',
            'p-dxos-blocks',
            'p-dxos-ai',
            'p-enterprise-auth',
            'p-foundation',
            'p-dxos-studio',
            'host-nocobase',
          ],
          activeEdges: [
            'ph-bridge',
            'ph-para',
            'ph-blocks',
            'ph-ai',
            'ph-auth',
            'ph-foundation',
            'ph-studio',
          ],
          description:
            'Compose gắn cả 7 thư mục plugins/nocobase/* dạng :ro vào /app/nocobase/node_modules/@latticedx/* của image ngoài nocobase/nocobase:2.2.50.',
          route: 'sdkProvidedByHost: true · v0.4.2',
          chips: ['7 Plugins', 'Read-Only Mount', 'Clause 5.2'],
        },
        {
          id: 'ms-2',
          title: 'Lớp Lõi Foundation & Xác thực OIDC',
          activeNodes: ['p-foundation', 'p-enterprise-auth', 'host-nocobase', 'data-pg-valkey'],
          activeEdges: ['ph-foundation', 'ph-auth', 'ph-host-data'],
          description:
            'plugin-lattice-foundation thiết lập ngữ cảnh RLS app.current_org trên PG16, trong khi plugin-enterprise-auth quản lý vé PKCE ở Valkey DB 2.',
          route: 'pg-rls.js + enterpriseAuth:callback',
          payload: "set_config('app.current_org', :orgId, true)",
          chips: ['56 FORCE RLS', 'nocobase_app', 'Valkey DB 2'],
        },
        {
          id: 'ms-3',
          title: 'Khối Giao diện v2, Studio & AI Workforce',
          activeNodes: ['p-dxos-blocks', 'p-dxos-studio', 'p-dxos-ai', 'p-dxos-para', 'host-nocobase'],
          activeEdges: ['ph-blocks', 'ph-studio', 'ph-ai', 'ph-para'],
          description:
            'Các plugin client-v2 và server mở rộng FlowEngine 12 BlockModels, LatticeFlow v2, DMN, P.A.R.A. và 20 Unified Tools qua SDK của host.',
          route: 'dist/client-v2/index.js + dist/server/index.js',
          chips: ['12 BlockModels', '24 DAG Nodes', '20 AI Tools'],
        },
      ]
    : [
        {
          id: 'ms-1',
          title: 'Read-Only Mount of All 7 Plugins',
          activeNodes: [
            'p-action-bridge',
            'p-dxos-para',
            'p-dxos-blocks',
            'p-dxos-ai',
            'p-enterprise-auth',
            'p-foundation',
            'p-dxos-studio',
            'host-nocobase',
          ],
          activeEdges: [
            'ph-bridge',
            'ph-para',
            'ph-blocks',
            'ph-ai',
            'ph-auth',
            'ph-foundation',
            'ph-studio',
          ],
          description:
            'Compose bind-mounts all 7 plugins/nocobase/* directories read-only into /app/nocobase/node_modules/@latticedx/* inside nocobase/nocobase:2.2.50.',
          route: 'sdkProvidedByHost: true · v0.4.2',
          chips: ['7 Plugins', 'Read-Only Mount', 'Clause 5.2'],
        },
        {
          id: 'ms-2',
          title: 'Foundation RLS & Enterprise Auth',
          activeNodes: ['p-foundation', 'p-enterprise-auth', 'host-nocobase', 'data-pg-valkey'],
          activeEdges: ['ph-foundation', 'ph-auth', 'ph-host-data'],
          description:
            'plugin-lattice-foundation binds transaction-local app.current_org under nocobase_app while plugin-enterprise-auth stores PKCE state in Valkey DB 2.',
          route: 'pg-rls.js + enterpriseAuth:callback',
          payload: "set_config('app.current_org', :orgId, true)",
          chips: ['56 FORCE RLS', 'nocobase_app', 'Valkey DB 2'],
        },
        {
          id: 'ms-3',
          title: 'Blocks v2, Studio & AI Workforce',
          activeNodes: ['p-dxos-blocks', 'p-dxos-studio', 'p-dxos-ai', 'p-dxos-para', 'host-nocobase'],
          activeEdges: ['ph-blocks', 'ph-studio', 'ph-ai', 'ph-para'],
          description:
            'Server and client-v2 entrypoints register 12 native BlockModels, LatticeFlow v2, Visual DMN, P.A.R.A. spaces, and 20 AI tools against host externals.',
          route: 'dist/client-v2/index.js + dist/server/index.js',
          chips: ['12 BlockModels', '24 DAG Nodes', '20 AI Tools'],
        },
      ],
);

const contractZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'cz-build',
          label: 'Chuỗi Đóng gói Plugin (esbuild 0.28.2 & nocobase-externals.mjs)',
          x: 16,
          y: 12,
          width: 848,
          height: 204,
          kind: 'admin',
        },
        {
          id: 'cz-runtime',
          label: 'Liên kết Runtime & Tuân thủ Điều 5.2',
          x: 16,
          y: 240,
          width: 848,
          height: 132,
          kind: 'external',
        },
      ]
    : [
        {
          id: 'cz-build',
          label: 'Plugin Build Pipeline (esbuild 0.28.2 & nocobase-externals.mjs)',
          x: 16,
          y: 12,
          width: 848,
          height: 204,
          kind: 'admin',
        },
        {
          id: 'cz-runtime',
          label: 'Runtime Resolution & Clause 5.2 Attribution',
          x: 16,
          y: 240,
          width: 848,
          height: 132,
          kind: 'external',
        },
      ],
);

const contractNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'c-src',
      title: isVi ? 'Mã nguồn Plugin' : 'Plugin Sources',
      sub: 'src/server · client-v2',
      icon: 'file-text',
      x: 40,
      y: 56,
      width: 216,
      height: 64,
      zoneId: 'cz-build',
      inspector: isVi
        ? {
            role: 'Mã nguồn Apache-2.0 độc lập hoàn toàn với upstream',
            packageOrPort: 'plugins/nocobase/*/package.json (v0.4.2)',
            protocol: 'SPDX Apache-2.0 · supportedVersions: 2.2.x',
            payloadOrSchema: 'sdkProvidedByHost: true · testedRuntime: 2.2.50',
            responsibilities:
              'Mỗi plugin khai báo rõ sdkProvidedByHost: true, có LICENSE/README riêng và không nhúng bất kỳ submodule upstream nào.',
          }
        : {
            role: 'Standalone Apache-2.0 Plugin Source Trees',
            packageOrPort: 'plugins/nocobase/*/package.json (v0.4.2)',
            protocol: 'SPDX Apache-2.0 · supportedVersions: 2.2.x',
            payloadOrSchema: 'sdkProvidedByHost: true · testedRuntime: 2.2.50',
            responsibilities:
              'Each plugin declares sdkProvidedByHost: true with its own LICENSE and README and zero upstream git submodules.',
          },
    },
    {
      id: 'c-externals',
      title: 'Host Externals',
      sub: 'nocobase-externals.mjs',
      icon: 'shield',
      x: 332,
      y: 56,
      width: 216,
      height: 64,
      zoneId: 'cz-build',
      focal: true,
      inspector: isVi
        ? {
            role: 'Danh sách Gói Dùng chung do Host Cung cấp',
            packageOrPort: 'scripts/lib/nocobase-externals.mjs',
            protocol: 'react@18.2.0 · antd@5.24.2 · @nocobase/*',
            payloadOrSchema: 'server, auth, plugin-auth, database, client, client-v2, workflow',
            responsibilities:
              'Loại trừ 7 gói SDK NocoBase và vendor UI khỏi bundle plugin để tránh xung đột phiên bản hoặc nhân bản thư viện khi chạy.',
          }
        : {
            role: 'Shared Host Vendor & SDK External Registry',
            packageOrPort: 'scripts/lib/nocobase-externals.mjs',
            protocol: 'react@18.2.0 · antd@5.24.2 · @nocobase/*',
            payloadOrSchema: 'server, auth, plugin-auth, database, client, client-v2, workflow',
            responsibilities:
              'Marks React, AntD, and 7 NocoBase SDK packages external during bundling so host runtime symbols resolve cleanly.',
          },
    },
    {
      id: 'c-bundled',
      title: isVi ? 'Gói Nhúng Pure-OSI' : 'Bundled OSI Deps',
      sub: 'esbuild 0.28.2 · UMD',
      icon: 'box',
      x: 624,
      y: 56,
      width: 216,
      height: 64,
      zoneId: 'cz-build',
      inspector: isVi
        ? {
            role: 'Đóng gói Thư viện Chuyên biệt Thuần OSI',
            packageOrPort: 'openid-client · maplibre-gl · @xyflow/react',
            protocol: 'MIT / Apache-2.0 Bundled UMD & CJS',
            payloadOrSchema: 'openid-client@6.8.9 | maplibre-gl@6.19.0 | @xyflow/react@12.12.1',
            responsibilities:
              'Chỉ đóng gói nội bộ các thư viện MIT/Apache-2.0 cần thiết như openid-client, MapLibre CSS/worker và React Flow + Dagre.',
          }
        : {
            role: 'Self-Contained Pure-OSI Dependency Bundles',
            packageOrPort: 'openid-client · maplibre-gl · @xyflow/react',
            protocol: 'MIT / Apache-2.0 Bundled UMD & CJS',
            payloadOrSchema: 'openid-client@6.8.9 | maplibre-gl@6.19.0 | @xyflow/react@12.12.1',
            responsibilities:
              'Bundles MIT/Apache-2.0 specialized packages such as openid-client, MapLibre GL, and @xyflow/react into plugin dist outputs.',
          },
    },
    {
      id: 'c-dist',
      title: isVi ? 'Đầu ra dist/*' : 'Compiled dist/*',
      sub: 'server · client · client-v2',
      icon: 'terminal',
      x: 332,
      y: 140,
      width: 216,
      height: 64,
      zoneId: 'cz-build',
      inspector: isVi
        ? {
            role: 'Điểm vào Đã Biên dịch Sẵn sàng Gắn Host',
            packageOrPort: 'dist/server/index.js · dist/client-v2/index.js',
            protocol: 'CommonJS / UMD · externalVersion.js',
            payloadOrSchema: 'action-bridge/dist/externalVersion.js',
            responsibilities:
              'Xuất các entrypoint server, client, client-v2 và tệp externalVersion.js để tương thích vòng đời plugin NocoBase 2.2.50.',
          }
        : {
            role: 'Host-Ready Compiled Plugin Entrypoints',
            packageOrPort: 'dist/server/index.js · dist/client-v2/index.js',
            protocol: 'CommonJS / UMD · externalVersion.js',
            payloadOrSchema: 'action-bridge/dist/externalVersion.js',
            responsibilities:
              'Emits server, client, and client-v2 entrypoints alongside externalVersion.js metadata for NocoBase 2.2.50 loading.',
          },
    },
    {
      id: 'c-host',
      title: 'NocoBase 2.2.50',
      sub: 'node_modules/@latticedx/*',
      icon: 'server',
      x: 164,
      y: 288,
      width: 240,
      height: 64,
      zoneId: 'cz-runtime',
      focal: true,
      inspector: isVi
        ? {
            role: 'Runtime Host Giải quyết Phụ thuộc Ngoại tuyến',
            packageOrPort: 'nocobase/nocobase:2.2.50 · :ro mount',
            protocol: 'OCI Container · Read-Only Plugin Bindings',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Cung cấp các module @nocobase/* từ trong container host khi 7 plugin khởi động và đăng ký tài nguyên API.',
          }
        : {
            role: 'External Host Container Resolving SDK Imports',
            packageOrPort: 'nocobase/nocobase:2.2.50 · :ro mount',
            protocol: 'OCI Container · Read-Only Plugin Bindings',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Provides @nocobase/* runtime dependencies inside the container when all 7 read-only plugins initialize.',
          },
    },
    {
      id: 'c-clause52',
      title: isVi ? 'Ghi nhận Điều 5.2' : 'Clause 5.2 Notice',
      sub: 'Powered by NocoBase v2.2.50',
      icon: 'check-circle',
      x: 476,
      y: 288,
      width: 240,
      height: 64,
      zoneId: 'cz-runtime',
      inspector: isVi
        ? {
            role: 'Bảo toàn Nhận diện Thương hiệu Nguồn NocoBase',
            packageOrPort: 'native-portal-settings.js · plugin-dxos-ai',
            protocol: 'NocoBase License Clause 5.2',
            payloadOrSchema: 'Powered by NocoBase · v2.2.50 · https://www.nocobase.com',
            responsibilities:
              'Giữ nguyên hiển thị Powered by NocoBase v2.2.50 và liên kết License settings trên giao diện điều hướng và trang quản trị.',
          }
        : {
            role: 'Preserved Upstream Clause 5.2 Attribution',
            packageOrPort: 'native-portal-settings.js · plugin-dxos-ai',
            protocol: 'NocoBase License Clause 5.2',
            payloadOrSchema: 'Powered by NocoBase · v2.2.50 · https://www.nocobase.com',
            responsibilities:
              'Keeps Powered by NocoBase v2.2.50, upstream URL, and License settings visible and unmodified across portals.',
          },
    },
  ];
});

const contractEdges = computed<DiagramEdge[]>(() => [
  {
    id: 'ce-1',
    from: 'c-src',
    to: 'c-externals',
    label: 'Strip SDK',
    kind: 'primary',
    points: [
      [256, 88],
      [332, 88],
    ],
  },
  {
    id: 'ce-2',
    from: 'c-externals',
    to: 'c-bundled',
    label: 'esbuild',
    kind: 'flow',
    points: [
      [548, 88],
      [624, 88],
    ],
  },
  {
    id: 'ce-3',
    from: 'c-bundled',
    to: 'c-dist',
    kind: 'flow',
    points: [
      [732, 120],
      [732, 172],
      [548, 172],
    ],
  },
  {
    id: 'ce-4',
    from: 'c-externals',
    to: 'c-dist',
    kind: 'primary',
    points: [
      [440, 120],
      [440, 140],
    ],
  },
  {
    id: 'ce-5',
    from: 'c-dist',
    to: 'c-host',
    label: ':ro Mount',
    kind: 'primary',
    points: [
      [440, 204],
      [440, 224],
      [284, 224],
      [284, 288],
    ],
  },
  {
    id: 'ce-6',
    from: 'c-host',
    to: 'c-clause52',
    label: 'Clause 5.2',
    kind: 'dashed',
    points: [
      [404, 320],
      [476, 320],
    ],
  },
]);

const contractSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'cs-1',
          title: 'Loại trừ Host SDK khi Biên dịch',
          activeNodes: ['c-src', 'c-externals', 'c-bundled'],
          activeEdges: ['ce-1', 'ce-2'],
          description:
            'nocobase-externals.mjs đánh dấu @nocobase/*, react và antd là external trong khi esbuild chỉ đóng gói các thư viện Pure-OSI như MapLibre và React Flow.',
          route: 'scripts/lib/nocobase-externals.mjs',
          chips: ['sdkProvidedByHost: true', 'esbuild 0.28.2', 'MIT/Apache-2.0'],
        },
        {
          id: 'cs-2',
          title: 'Gắn dist/* vào Container NocoBase 2.2.50',
          activeNodes: ['c-dist', 'c-host', 'c-clause52'],
          activeEdges: ['ce-4', 'ce-5', 'ce-6'],
          description:
            'Các tệp dist/* được gắn chỉ đọc vào container nocobase/nocobase:2.2.50 và giữ nguyên nhận diện Powered by NocoBase theo Điều 5.2.',
          route: '/app/nocobase/node_modules/@latticedx/*',
          chips: ['Read-Only :ro', 'Clause 5.2', 'Zero Upstream Fork'],
        },
      ]
    : [
        {
          id: 'cs-1',
          title: 'Externalize Host SDK at Build Time',
          activeNodes: ['c-src', 'c-externals', 'c-bundled'],
          activeEdges: ['ce-1', 'ce-2'],
          description:
            'nocobase-externals.mjs externalizes @nocobase/*, react, and antd while esbuild bundles only Pure-OSI packages such as MapLibre GL and @xyflow/react.',
          route: 'scripts/lib/nocobase-externals.mjs',
          chips: ['sdkProvidedByHost: true', 'esbuild 0.28.2', 'MIT/Apache-2.0'],
        },
        {
          id: 'cs-2',
          title: 'Mount dist/* & Preserve Clause 5.2',
          activeNodes: ['c-dist', 'c-host', 'c-clause52'],
          activeEdges: ['ce-4', 'ce-5', 'ce-6'],
          description:
            'Compiled plugin artifacts mount read-only into nocobase/nocobase:2.2.50 while keeping Powered by NocoBase v2.2.50 attribution intact.',
          route: '/app/nocobase/node_modules/@latticedx/*',
          chips: ['Read-Only :ro', 'Clause 5.2', 'Zero Upstream Fork'],
        },
      ],
);

const modes = computed<DiagramMode[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'runtime-mount',
          label: '7 Plugin & Host Runtime',
          summary: '7 plugins + NocoBase 2.2.50 + PG16/Valkey',
          zones: mountZones.value,
          nodes: mountNodes.value,
          edges: mountEdges.value,
          steps: mountSteps.value,
        },
        {
          id: 'sdk-contract',
          label: 'Hợp đồng sdkProvidedByHost',
          summary: 'Build Externals & Điều 5.2',
          zones: contractZones.value,
          nodes: contractNodes.value,
          edges: contractEdges.value,
          steps: contractSteps.value,
        },
      ]
    : [
        {
          id: 'runtime-mount',
          label: '7-Plugin Host Mount',
          summary: '7 plugins + NocoBase 2.2.50 + PG16/Valkey',
          zones: mountZones.value,
          nodes: mountNodes.value,
          edges: mountEdges.value,
          steps: mountSteps.value,
        },
        {
          id: 'sdk-contract',
          label: 'sdkProvidedByHost Contract',
          summary: 'Build Externals & Clause 5.2',
          zones: contractZones.value,
          nodes: contractNodes.value,
          edges: contractEdges.value,
          steps: contractSteps.value,
        },
      ],
);

const titleText = computed(() =>
  locale.value === 'vi'
    ? 'Kiến trúc 7 Plugin Apache-2.0 & Host NocoBase 2.2.50'
    : '7 Apache-2.0 Plugins & NocoBase 2.2.50 Host Contract',
);

const captionText = computed(() =>
  locale.value === 'vi'
    ? 'Toàn bộ 7 plugin @latticedx/* được gắn chỉ đọc vào container ngoài nocobase/nocobase:2.2.50 theo cơ chế sdkProvidedByHost: true.'
    : 'All seven @latticedx/* plugins mount read-only into external nocobase/nocobase:2.2.50 using sdkProvidedByHost: true.',
);
</script>

<template>
  <DiagramCanvas
    :title="titleText"
    :caption="captionText"
    view-box="0 0 880 392"
    :modes="modes"
    :compact="props.compact"
    :lang="locale"
  />
</template>
