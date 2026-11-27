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

const contractZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'cz-build',
          label: 'GIAI ĐOẠN BIÊN DỊCH · ESBUILD 0.28.2 & NOCOBASE-EXTERNALS.MJS',
          x: 16,
          y: 16,
          width: 696,
          height: 296,
          kind: 'admin',
        },
        {
          id: 'cz-runtime',
          label: 'GIAI ĐOẠN RUNTIME · CONTAINER OCI NGOÀI (:RO MOUNT)',
          x: 772,
          y: 16,
          width: 432,
          height: 296,
          kind: 'external',
        },
      ]
    : [
        {
          id: 'cz-build',
          label: 'BUILD STAGE · ESBUILD 0.28.2 & NOCOBASE-EXTERNALS.MJS',
          x: 16,
          y: 16,
          width: 696,
          height: 296,
          kind: 'admin',
        },
        {
          id: 'cz-runtime',
          label: 'RUNTIME STAGE · EXTERNAL OCI CONTAINER (:RO MOUNT)',
          x: 772,
          y: 16,
          width: 432,
          height: 296,
          kind: 'external',
        },
      ],
);

const contractNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'src_plugins',
      title: isVi ? 'Mã nguồn 7 @latticedx/*' : '7 @latticedx/* Sources',
      sub: ['Apache-2.0 · v0.4.2', 'sdkProvidedByHost: true'],
      icon: 'file-text',
      x: 28,
      y: 118,
      width: 192,
      height: 88,
      zoneId: 'cz-build',
      inspector: isVi
        ? {
            role: 'Mã nguồn Apache-2.0 Độc lập với Upstream',
            packageOrPort: 'plugins/nocobase/*/package.json (v0.4.2)',
            protocol: 'SPDX Apache-2.0 · supportedVersions: 2.2.x',
            payloadOrSchema: 'sdkProvidedByHost: true · testedRuntime: 2.2.50',
            responsibilities:
              'Mỗi plugin khai báo rõ sdkProvidedByHost: true, có LICENSE/README riêng và phân tách rõ phụ thuộc host với thư viện Pure-OSI.',
          }
        : {
            role: 'Standalone Apache-2.0 Plugin Source Trees',
            packageOrPort: 'plugins/nocobase/*/package.json (v0.4.2)',
            protocol: 'SPDX Apache-2.0 · supportedVersions: 2.2.x',
            payloadOrSchema: 'sdkProvidedByHost: true · testedRuntime: 2.2.50',
            responsibilities:
              'Each plugin declares sdkProvidedByHost: true with its own LICENSE and splits into externalized host SDKs and bundled Pure-OSI libs.',
          },
    },
    {
      id: 'ext_sdk',
      title: isVi ? 'Host Externals (Loại trừ)' : 'Host Externals (Stripped)',
      sub: ['7 @nocobase/* packages', 'React 18.2 · AntD 5.24'],
      icon: 'shield',
      x: 284,
      y: 54,
      width: 200,
      height: 84,
      zoneId: 'cz-build',
      focal: true,
      inspector: isVi
        ? {
            role: 'Loại trừ SDK NocoBase và Vendor UI Khỏi Bundle',
            packageOrPort: 'scripts/lib/nocobase-externals.mjs',
            protocol: 'react@18.2.0 · antd@5.24.2 · 7 @nocobase/*',
            payloadOrSchema: 'Stripped at build time (externalized)',
            responsibilities:
              'Loại trừ 7 gói @nocobase/* và React/AntD khỏi bản build để runtime container host cung cấp trực tiếp, không sao chép vào dist/*.',
          }
        : {
            role: 'Host Vendor & SDK Externals (Stripped at Build)',
            packageOrPort: 'scripts/lib/nocobase-externals.mjs',
            protocol: 'react@18.2.0 · antd@5.24.2 · 7 @nocobase/*',
            payloadOrSchema: 'Stripped at build time (externalized)',
            responsibilities:
              'Marks React, AntD, and all 7 @nocobase/* SDK packages external so esbuild strips them and resolves symbols from the host container.',
          },
    },
    {
      id: 'osi_libs',
      title: isVi ? 'Thư viện Pure-OSI' : 'Bundled Pure-OSI Libs',
      sub: ['openid-client@6.8.9', 'maplibre · @xyflow/react'],
      icon: 'box',
      x: 284,
      y: 186,
      width: 200,
      height: 84,
      zoneId: 'cz-build',
      inspector: isVi
        ? {
            role: 'Đóng gói Thư viện Chuyên biệt Thuần OSI',
            packageOrPort: 'openid-client · maplibre-gl · @xyflow/react · @dagrejs/dagre',
            protocol: 'MIT / Apache-2.0 Bundled UMD & CJS',
            payloadOrSchema: 'openid-client@6.8.9 | maplibre-gl@6.19.0 | @xyflow/react@12.12.1',
            responsibilities:
              'Đóng gói trực tiếp các thư viện MIT/Apache-2.0 cần thiết vào dist/* song song với nhánh Host Externals.',
          }
        : {
            role: 'Self-Contained Pure-OSI Dependency Bundles',
            packageOrPort: 'openid-client · maplibre-gl · @xyflow/react · @dagrejs/dagre',
            protocol: 'MIT / Apache-2.0 Bundled UMD & CJS',
            payloadOrSchema: 'openid-client@6.8.9 | maplibre-gl@6.19.0 | @xyflow/react@12.12.1',
            responsibilities:
              'Bundles MIT/Apache-2.0 libraries (openid-client, maplibre-gl, @xyflow/react, dagre) into dist/* alongside externalized host references.',
          },
    },
    {
      id: 'dist_out',
      title: isVi ? 'Đầu ra dist/*' : 'Compiled dist/*',
      sub: ['server · client · client-v2', 'externalVersion.js'],
      icon: 'terminal',
      x: 528,
      y: 118,
      width: 172,
      height: 88,
      zoneId: 'cz-build',
      inspector: isVi
        ? {
            role: 'Điểm vào Đã Biên dịch Sẵn sàng Gắn Host',
            packageOrPort: 'dist/server/index.js · dist/client-v2/index.js',
            protocol: 'CommonJS / UMD · externalVersion.js',
            payloadOrSchema: 'action-bridge/dist/externalVersion.js',
            responsibilities:
              'Hợp nhất tham chiếu external tới Host SDK và các gói Pure-OSI đã đóng gói thành artifact dist/* gắn :ro vào NocoBase.',
          }
        : {
            role: 'Host-Ready Compiled Plugin Entrypoints',
            packageOrPort: 'dist/server/index.js · dist/client-v2/index.js',
            protocol: 'CommonJS / UMD · externalVersion.js',
            payloadOrSchema: 'action-bridge/dist/externalVersion.js',
            responsibilities:
              'Converges externalized @nocobase/* import shims and bundled Pure-OSI libs into dist/* artifacts mounted :ro into NocoBase.',
          },
    },
    {
      id: 'host_oci',
      title: 'NocoBase 2.2.50 Host',
      sub: ['node_modules/@latticedx/*', 'Resolves Host SDK'],
      icon: 'server',
      x: 788,
      y: 116,
      width: 200,
      height: 92,
      zoneId: 'cz-runtime',
      focal: true,
      inspector: isVi
        ? {
            role: 'Container Host Ngoài & Bảo toàn Điều 5.2',
            packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751... · :80',
            protocol: 'OCI Container · Read-Only Bind Mount (:ro) · Clause 5.2',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Nạp 7 plugin dạng :ro, giải quyết các import @nocobase/*/React/AntD tại runtime và giữ nguyên nhận diện Powered by NocoBase v2.2.50 theo Điều 5.2.',
          }
        : {
            role: 'External OCI Host & Clause 5.2 Attribution',
            packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751... · :80',
            protocol: 'OCI Container · Read-Only Bind Mount (:ro) · Clause 5.2',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Mounts all 7 plugins read-only, resolves @nocobase/*, React, and AntD symbols at runtime, and preserves Powered by NocoBase v2.2.50 attribution under Clause 5.2.',
          },
    },
    {
      id: 'pg_valkey',
      title: 'PG16 & Valkey 8.1',
      sub: ['nocobase_app · 56+ RLS', 'Valkey DB 0 / 1 / 2'],
      icon: 'database',
      x: 1004,
      y: 116,
      width: 188,
      height: 92,
      zoneId: 'cz-runtime',
      inspector: isVi
        ? {
            role: 'Lưu trữ Đa-Tenant Cô lập & Bộ nhớ đệm Phân vùng',
            packageOrPort: 'pgvector:0.8.1-pg16 (:5432) · valkey:8.1-alpine (:6379)',
            protocol: 'app.current_org / app.rls_bypass · Valkey DB 0 / 1 / 2',
            payloadOrSchema: '56 FORCE RLS tables · latticeCustom* · PubSub SSE',
            responsibilities:
              'Chạy dưới role nocobase_app (NOBYPASSRLS) cho PostgreSQL 16 và tách Valkey thành DB 0 (cache), DB 1 (SSE PubSub), DB 2 (OIDC PKCE).',
          }
        : {
            role: 'Tenant-Isolated PostgreSQL 16 & Partitioned Valkey 8.1',
            packageOrPort: 'pgvector:0.8.1-pg16 (:5432) · valkey:8.1-alpine (:6379)',
            protocol: 'app.current_org / app.rls_bypass · Valkey DB 0 / 1 / 2',
            payloadOrSchema: '56 FORCE RLS tables · latticeCustom* · PubSub SSE',
            responsibilities:
              'Enforces NOBYPASSRLS via nocobase_app in PostgreSQL 16 and partitions Valkey into DB 0 (cache), DB 1 (SSE PubSub), and DB 2 (OIDC).',
          },
    },
  ];
});

const contractEdges = computed<DiagramEdge[]>(() => [
  {
    id: 'ce-1',
    from: 'src_plugins',
    to: 'ext_sdk',
    label: 'Strip',
    kind: 'primary',
    points: [
      [220, 144],
      [252, 144],
      [252, 96],
      [284, 96],
    ],
    labelPosition: 0.5,
    labelOffset: [0, -16],
  },
  {
    id: 'ce-2',
    from: 'src_plugins',
    to: 'osi_libs',
    label: 'Bundle',
    kind: 'flow',
    points: [
      [220, 178],
      [252, 178],
      [252, 228],
      [284, 228],
    ],
    labelPosition: 0.5,
    labelOffset: [0, 16],
  },
  {
    id: 'ce-3',
    from: 'ext_sdk',
    to: 'dist_out',
    kind: 'primary',
    points: [
      [484, 96],
      [506, 96],
      [506, 144],
      [528, 144],
    ],
  },
  {
    id: 'ce-4',
    from: 'osi_libs',
    to: 'dist_out',
    kind: 'flow',
    points: [
      [484, 228],
      [506, 228],
      [506, 178],
      [528, 178],
    ],
  },
  {
    id: 'ce-5',
    from: 'dist_out',
    to: 'host_oci',
    label: 'Mount :ro',
    kind: 'primary',
    points: [
      [700, 162],
      [788, 162],
    ],
  },
  {
    id: 'ce-6',
    from: 'host_oci',
    to: 'pg_valkey',
    kind: 'primary',
    points: [
      [988, 162],
      [1004, 162],
    ],
  },
]);

const contractSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'cs-1',
          title: 'Tách Host Externals & Đóng gói Pure-OSI',
          activeNodes: ['src_plugins', 'ext_sdk', 'osi_libs', 'dist_out'],
          activeEdges: ['ce-1', 'ce-2', 'ce-3', 'ce-4'],
          description:
            '7 plugin @latticedx/* loại trừ @nocobase/*, React 18.2, AntD 5.24 qua nocobase-externals.mjs và đóng gói thư viện MIT/Apache-2.0 vào dist/*.',
          route: 'scripts/lib/nocobase-externals.mjs -> dist/*',
          chips: ['sdkProvidedByHost: true', 'esbuild 0.28.2'],
        },
        {
          id: 'cs-2',
          title: 'Gắn :ro vào NocoBase 2.2.50 -> PG16 & Valkey',
          activeNodes: ['dist_out', 'host_oci', 'pg_valkey'],
          activeEdges: ['ce-5', 'ce-6'],
          description:
            'Compose gắn dist/* dạng :ro vào /app/nocobase/node_modules/@latticedx/* để container NocoBase giải quyết SDK và kết nối PG16 FORCE RLS / Valkey DB 0-2.',
          route: '/app/nocobase/node_modules/@latticedx/* (:ro)',
          chips: ['Read-Only :ro', 'nocobase_app', 'Clause 5.2'],
        },
      ]
    : [
        {
          id: 'cs-1',
          title: 'Split Host Externals vs Pure-OSI Bundle',
          activeNodes: ['src_plugins', 'ext_sdk', 'osi_libs', 'dist_out'],
          activeEdges: ['ce-1', 'ce-2', 'ce-3', 'ce-4'],
          description:
            'All 7 @latticedx/* plugins strip @nocobase/*, React 18.2, and AntD 5.24 via nocobase-externals.mjs while bundling MIT/Apache-2.0 libs into dist/*.',
          route: 'scripts/lib/nocobase-externals.mjs -> dist/*',
          chips: ['sdkProvidedByHost: true', 'esbuild 0.28.2'],
        },
        {
          id: 'cs-2',
          title: 'Mount :ro into NocoBase 2.2.50 -> Stores',
          activeNodes: ['dist_out', 'host_oci', 'pg_valkey'],
          activeEdges: ['ce-5', 'ce-6'],
          description:
            'Compose bind-mounts dist/* read-only into /app/nocobase/node_modules/@latticedx/* so the host resolves SDK symbols and runs against PG16 FORCE RLS and Valkey DB 0-2.',
          route: '/app/nocobase/node_modules/@latticedx/* (:ro)',
          chips: ['Read-Only :ro', 'nocobase_app', 'Clause 5.2'],
        },
      ],
);

const domainZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'grp-core',
          label: 'NHÓM A · LÕI, XÁC THỰC & CẦU NỐI',
          x: 16,
          y: 14,
          width: 644,
          height: 114,
          kind: 'admin',
        },
        {
          id: 'grp-ui',
          label: 'NHÓM B · GIAO DIỆN V2 & STUDIO TỰ ĐỘNG HÓA',
          x: 16,
          y: 140,
          width: 644,
          height: 114,
          kind: 'traffic',
        },
        {
          id: 'grp-ai',
          label: 'NHÓM C · TRI THỨC P.A.R.A. & TÁC NHÂN AI',
          x: 16,
          y: 266,
          width: 644,
          height: 114,
          kind: 'admin',
        },
        {
          id: 'grp-runtime',
          label: 'HOST CONTAINER & KHO DỮ LIỆU CÔ LẬP',
          x: 728,
          y: 14,
          width: 416,
          height: 366,
          kind: 'external',
        },
      ]
    : [
        {
          id: 'grp-core',
          label: 'GROUP A · CORE, AUTH & BRIDGE',
          x: 16,
          y: 14,
          width: 644,
          height: 114,
          kind: 'admin',
        },
        {
          id: 'grp-ui',
          label: 'GROUP B · UI BLOCKS & AUTOMATION STUDIO',
          x: 16,
          y: 140,
          width: 644,
          height: 114,
          kind: 'traffic',
        },
        {
          id: 'grp-ai',
          label: 'GROUP C · KNOWLEDGE & AI WORKFORCE',
          x: 16,
          y: 266,
          width: 644,
          height: 114,
          kind: 'admin',
        },
        {
          id: 'grp-runtime',
          label: 'OCI HOST & ISOLATED DATA STORES',
          x: 728,
          y: 14,
          width: 416,
          height: 366,
          kind: 'external',
        },
      ],
);

const domainNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    // Group A (rightmost = p-foundation at x: 440)
    {
      id: 'p-bridge',
      title: 'Action Bridge',
      sub: ['plugin-action-bridge', 'dxActions · PKCE Link'],
      icon: 'plug',
      x: 28,
      y: 48,
      width: 184,
      height: 66,
      zoneId: 'grp-core',
      inspector: isVi
        ? {
            role: 'Cầu nối Hành động & Liên kết PKCE /lattice/*',
            packageOrPort: '@latticedx/plugin-action-bridge · v0.4.2',
            protocol: 'server.cjs · client-v2 · dxActions (13)',
            payloadOrSchema: 'dist/externalVersion.js | DX_BRIDGE_*',
            responsibilities:
              'Cung cấp proxy PKCE phía server và 13 hành động cầu nối từ giao diện sang runtime NocoBase 2.2.50.',
          }
        : {
            role: 'Action Execution & Studio Bridge Plugin',
            packageOrPort: '@latticedx/plugin-action-bridge · v0.4.2',
            protocol: 'server.cjs · client-v2 · dxActions (13)',
            payloadOrSchema: 'dist/externalVersion.js | DX_BRIDGE_*',
            responsibilities:
              'Provides server-side PKCE linking proxy and 13 bridge actions into NocoBase 2.2.50 with externalVersion metadata.',
          },
    },
    {
      id: 'p-auth',
      title: isVi ? 'Enterprise Auth' : 'Enterprise Auth',
      sub: ['plugin-enterprise-auth', 'OIDC PKCE · Valkey DB 2'],
      icon: 'key',
      x: 226,
      y: 48,
      width: 200,
      height: 66,
      zoneId: 'grp-core',
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
      sub: ['plugin-lattice-foundation', 'RLS · Ledger · Portals'],
      icon: 'layers',
      x: 440,
      y: 48,
      width: 208,
      height: 66,
      zoneId: 'grp-core',
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
    // Group B
    {
      id: 'p-blocks',
      title: isVi ? '12 Block v2 & IIoT' : 'Native Blocks & IIoT',
      sub: ['plugin-dxos-blocks', '12 BlockModels · MapLibre · Twin'],
      icon: 'box',
      x: 28,
      y: 174,
      width: 300,
      height: 66,
      zoneId: 'grp-ui',
      inspector: isVi
        ? {
            role: '12 Native v2 BlockModels, WebGIS & Bản sao số IIoT',
            packageOrPort: '@latticedx/plugin-dxos-blocks · v0.4.2',
            protocol: 'esbuild 0.28.2 UMD (maplibre-gl@6.19.0 bundled)',
            payloadOrSchema: 'dxosBlocks:* (17) · dxosBroker:* (10)',
            responsibilities:
              'Đăng ký 12 FlowEngine BlockModels (KPI, Telemetry, WebGIS MapLibre, Kanban, FEFO WMS, BI Chart) và điều phối IIoT Digital Twin.',
          }
        : {
            role: '12 Native v2 BlockModels, WebGIS & IIoT Broker',
            packageOrPort: '@latticedx/plugin-dxos-blocks · v0.4.2',
            protocol: 'esbuild 0.28.2 UMD (maplibre-gl@6.19.0 bundled)',
            payloadOrSchema: 'dxosBlocks:* (17) · dxosBroker:* (10)',
            responsibilities:
              'Registers 12 FlowEngine v2 BlockModels including MapLibre WebGIS and BI charts alongside dxosBroker IIoT Digital Twin APIs.',
          },
    },
    {
      id: 'p-studio',
      title: 'Admin Studio',
      sub: ['plugin-dxos-studio', 'LatticeFlow · DMN · n8n · WMS'],
      icon: 'workflow',
      x: 348,
      y: 174,
      width: 300,
      height: 66,
      zoneId: 'grp-ui',
      inspector: isVi
        ? {
            role: 'LatticeFlow v2, Visual DMN, n8n, WMS & Rich Schema',
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
    // Group C
    {
      id: 'p-para',
      title: isVi ? 'Tri thức P.A.R.A.' : 'P.A.R.A. Knowledge',
      sub: ['plugin-dxos-para', 'PDF/Office · Hybrid RAG RRF'],
      icon: 'file-text',
      x: 28,
      y: 300,
      width: 300,
      height: 66,
      zoneId: 'grp-ai',
      inspector: isVi
        ? {
            role: 'Kho Tri thức P.A.R.A. & Tìm kiếm Lai RRF',
            packageOrPort: '@latticedx/plugin-dxos-para · v0.4.2',
            protocol: 'DxosParaPlugin · pgvector + GIN tsvector (k=60)',
            payloadOrSchema: 'latticeParaDocuments | latticeParaChunks | latticePara:*',
            responsibilities:
              'Tổ chức tài liệu theo Projects/Areas/Resources/Archives, trích xuất PDF/Office và tìm kiếm ngữ cảnh lai RRF theo RLS.',
          }
        : {
            role: 'P.A.R.A. Knowledge Organization & Hybrid RAG',
            packageOrPort: '@latticedx/plugin-dxos-para · v0.4.2',
            protocol: 'DxosParaPlugin · pgvector + GIN tsvector (k=60)',
            payloadOrSchema: 'latticeParaDocuments | latticeParaChunks | latticePara:*',
            responsibilities:
              'Organizes knowledge across Projects/Areas/Resources/Archives, extracts PDF/Office content, and executes RLS-scoped RRF search.',
          },
    },
    {
      id: 'p-ai',
      title: 'DX-OS AI Studio',
      sub: ['plugin-dxos-ai', '7 Profiles · 20 Tools · MCP/A2A'],
      icon: 'bot',
      x: 348,
      y: 300,
      width: 300,
      height: 66,
      zoneId: 'grp-ai',
      inspector: isVi
        ? {
            role: 'AI Workforce, App Builder 2.0, MCP & A2A Gateway',
            packageOrPort: '@latticedx/plugin-dxos-ai · v0.4.2',
            protocol: 'DxosAiPlugin · JSON-RPC 2.0 · SSE · OTel GenAI',
            payloadOrSchema: 'dxosAi:* | /api/dxos-mcp | /api/dxos-a2a | 7 Profiles',
            responsibilities:
              'Cung cấp 7 Agent Profiles, 20 Unified Tools (+4 IT/OT MCP), App Builder 2.0 (plan/build/patch/rollback) và cổng MCP/A2A.',
          }
        : {
            role: 'AI Workforce, App Builder 2.0, MCP & A2A Gateway',
            packageOrPort: '@latticedx/plugin-dxos-ai · v0.4.2',
            protocol: 'DxosAiPlugin · JSON-RPC 2.0 · SSE · OTel GenAI',
            payloadOrSchema: 'dxosAi:* | /api/dxos-mcp | /api/dxos-a2a | 7 Profiles',
            responsibilities:
              'Hosts 7 Agent Profiles, 20 audited Unified Tools (+4 IT/OT MCP), App Builder 2.0 lifecycle, and MCP/A2A endpoints.',
          },
    },
    // Right Runtime & Data Stores
    {
      id: 'rt-host',
      title: 'NocoBase 2.2.50',
      sub: ['7 Plugins (:ro)', 'sdkProvidedByHost'],
      icon: 'server',
      x: 748,
      y: 167,
      width: 176,
      height: 80,
      zoneId: 'grp-runtime',
      focal: true,
      inspector: isVi
        ? {
            role: 'Container Host Nạp 7 Plugin (:ro) & Giữ Điều 5.2',
            packageOrPort: 'nocobase/nocobase:2.2.50 · :80',
            protocol: 'Read-Only Bind Mount (:ro) · Clause 5.2',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Khởi chạy cả 7 plugin gắn chỉ đọc, cung cấp React/AntD/@nocobase/* từ host và giữ nguyên hiển thị Powered by NocoBase v2.2.50 theo Điều 5.2.',
          }
        : {
            role: 'OCI Host Mounting 7 Plugins (:ro) & Preserving Clause 5.2',
            packageOrPort: 'nocobase/nocobase:2.2.50 · :80',
            protocol: 'Read-Only Bind Mount (:ro) · Clause 5.2',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Loads all 7 read-only plugins, provides host React/AntD/@nocobase/* externals, and preserves Powered by NocoBase v2.2.50 attribution under Clause 5.2.',
          },
    },
    {
      id: 'rt-data',
      title: isVi ? 'Kho Dữ liệu Cô lập' : 'Data Stores',
      sub: ['PG16 FORCE RLS', 'Valkey · RustFS · Orion-LD'],
      icon: 'database',
      x: 956,
      y: 167,
      width: 172,
      height: 80,
      zoneId: 'grp-runtime',
      inspector: isVi
        ? {
            role: 'Hệ thống Lưu trữ & Ngữ cảnh Cô lập',
            packageOrPort: 'PG16 (nocobase_app) · Valkey 8.1 · RustFS · Orion-LD',
            protocol: 'FORCE RLS · RESP DB 0/1/2 · S3 · NGSI-LD',
            payloadOrSchema: '56 Static + latticeCustom* · Scanned Objects',
            responsibilities:
              'Lưu trữ toàn bộ dữ liệu nghiệp vụ có cô lập đa tenant FORCE RLS, tệp sạch qua ClamAV, trạng thái OIDC/SSE và thực thể NGSI-LD.',
          }
        : {
            role: 'Isolated Persistence & Context Stores',
            packageOrPort: 'PG16 (nocobase_app) · Valkey 8.1 · RustFS · Orion-LD',
            protocol: 'FORCE RLS · RESP DB 0/1/2 · S3 · NGSI-LD',
            payloadOrSchema: '56 Static + latticeCustom* · Scanned Objects',
            responsibilities:
              'Persists tenant-isolated tables under FORCE RLS, ClamAV-cleared objects in RustFS, OIDC/SSE state in Valkey, and NGSI-LD twins in Orion-LD.',
          },
    },
  ];
});

const domainEdges = computed<DiagramEdge[]>(() => [
  {
    id: 'dm-core',
    from: 'p-foundation',
    to: 'rt-host',
    kind: 'primary',
    points: [
      [648, 81],
      [700, 81],
      [700, 187],
      [748, 187],
    ],
  },
  {
    id: 'dm-ui',
    from: 'p-studio',
    to: 'rt-host',
    label: 'Mount :ro',
    kind: 'primary',
    points: [
      [648, 207],
      [748, 207],
    ],
  },
  {
    id: 'dm-ai',
    from: 'p-ai',
    to: 'rt-host',
    kind: 'flow',
    points: [
      [648, 333],
      [700, 333],
      [700, 227],
      [748, 227],
    ],
  },
  {
    id: 'dm-data',
    from: 'rt-host',
    to: 'rt-data',
    kind: 'primary',
    points: [
      [924, 207],
      [956, 207],
    ],
  },
]);

const domainSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'ds-core',
          title: 'Nhóm A · Lõi Foundation, Auth & Bridge',
          activeNodes: ['p-bridge', 'p-auth', 'p-foundation', 'rt-host', 'rt-data'],
          activeEdges: ['dm-core', 'dm-data'],
          description:
            'Cung cấp cầu giao dịch PG16 FORCE RLS (56+ bảng), khóa ldx_pat_*, sổ cái Ed25519 Merkle, xác thực Keycloak PKCE (Valkey DB 2) và action bridge.',
          route: 'Core/Auth Plugins -> NocoBase 2.2.50 -> PG16 / Valkey',
          chips: ['56 FORCE RLS', 'PKCE S256', 'Ed25519'],
        },
        {
          id: 'ds-ui',
          title: 'Nhóm B · 12 Native Blocks & Admin Studio',
          activeNodes: ['p-blocks', 'p-studio', 'rt-host', 'rt-data'],
          activeEdges: ['dm-ui', 'dm-data'],
          description:
            'Đăng ký 12 Native BlockModels (MapLibre WebGIS, BI, WMS Ops), 24-node LatticeFlow v2, Visual DMN FEEL, FEFO WMS và cầu nối Stock n8n.',
          route: 'UI/Studio Plugins -> NocoBase 2.2.50 -> PG16 / Orion-LD',
          chips: ['12 BlockModels', '24 DAG Nodes', 'FEEL DMN'],
        },
        {
          id: 'ds-ai',
          title: 'Nhóm C · Tri thức P.A.R.A. & AI Studio',
          activeNodes: ['p-para', 'p-ai', 'rt-host', 'rt-data'],
          activeEdges: ['dm-ai', 'dm-data'],
          description:
            'Cung cấp trích xuất tài liệu PDF/Office, Hybrid RAG (pgvector + GIN RRF k=60), 7 Agent Profiles, 20+4 công cụ có kiểm toán, App Builder 2.0 và MCP/A2A.',
          route: 'PARA/AI Plugins -> NocoBase 2.2.50 -> pgvector / PG16',
          chips: ['RRF k=60', '20+4 Tools', 'App Builder 2.0'],
        },
      ]
    : [
        {
          id: 'ds-core',
          title: 'Group A · Core, Auth & Action Bridge',
          activeNodes: ['p-bridge', 'p-auth', 'p-foundation', 'rt-host', 'rt-data'],
          activeEdges: ['dm-core', 'dm-data'],
          description:
            'Provides the PG16 FORCE RLS bridge (56+ tables), ldx_pat_* API keys, Ed25519 Merkle ledger, Keycloak PKCE (Valkey DB 2), and action bridge.',
          route: 'Core/Auth Plugins -> NocoBase 2.2.50 -> PG16 / Valkey',
          chips: ['56 FORCE RLS', 'PKCE S256', 'Ed25519'],
        },
        {
          id: 'ds-ui',
          title: 'Group B · Native Blocks & Admin Studio',
          activeNodes: ['p-blocks', 'p-studio', 'rt-host', 'rt-data'],
          activeEdges: ['dm-ui', 'dm-data'],
          description:
            'Registers 12 Native BlockModels (MapLibre WebGIS, BI, WMS Ops), 24-node LatticeFlow v2, Visual DMN FEEL, FEFO WMS, and Stock n8n REST sync.',
          route: 'UI/Studio Plugins -> NocoBase 2.2.50 -> PG16 / Orion-LD',
          chips: ['12 BlockModels', '24 DAG Nodes', 'FEEL DMN'],
        },
        {
          id: 'ds-ai',
          title: 'Group C · P.A.R.A. Knowledge & AI Studio',
          activeNodes: ['p-para', 'p-ai', 'rt-host', 'rt-data'],
          activeEdges: ['dm-ai', 'dm-data'],
          description:
            'Delivers PDF/Office extraction, Hybrid RAG (pgvector + GIN RRF k=60), 7 Agent Profiles, 20+4 audited tools, App Builder 2.0, and MCP/A2A gateways.',
          route: 'PARA/AI Plugins -> NocoBase 2.2.50 -> pgvector / PG16',
          chips: ['RRF k=60', '20+4 Tools', 'App Builder 2.0'],
        },
      ],
);

const modes = computed<DiagramMode[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'externals-contract',
          label: 'Host Externals vs Pure-OSI (:ro Mount)',
          viewBox: '0 0 1220 328',
          zones: contractZones.value,
          nodes: contractNodes.value,
          edges: contractEdges.value,
          steps: contractSteps.value,
        },
        {
          id: 'plugin-domains',
          label: '7 Plugin & Trách nhiệm Miền',
          viewBox: '0 0 1160 392',
          zones: domainZones.value,
          nodes: domainNodes.value,
          edges: domainEdges.value,
          steps: domainSteps.value,
        },
      ]
    : [
        {
          id: 'externals-contract',
          label: 'Host Externals vs Pure-OSI (:ro Mount)',
          viewBox: '0 0 1220 328',
          zones: contractZones.value,
          nodes: contractNodes.value,
          edges: contractEdges.value,
          steps: contractSteps.value,
        },
        {
          id: 'plugin-domains',
          label: '7 Plugins & Domain Responsibilities',
          viewBox: '0 0 1160 392',
          zones: domainZones.value,
          nodes: domainNodes.value,
          edges: domainEdges.value,
          steps: domainSteps.value,
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
    ? 'Toàn bộ 7 plugin @latticedx/* biên dịch với sdkProvidedByHost: true (loại trừ @nocobase/*, React 18.2, AntD 5.24 và đóng gói thư viện Pure-OSI), gắn chỉ đọc (:ro) vào container ngoài nocobase/nocobase:2.2.50 và giữ nguyên ghi công Powered by NocoBase theo Điều 5.2.'
    : 'All seven @latticedx/* plugins compile under sdkProvidedByHost: true (stripping @nocobase/*, React 18.2, and AntD 5.24 while bundling Pure-OSI libs), mount read-only (:ro) into external nocobase/nocobase:2.2.50, and preserve Powered by NocoBase attribution under Clause 5.2.',
);
</script>

<template>
  <DiagramCanvas
    :title="titleText"
    :caption="captionText"
    view-box="0 0 1220 328"
    :modes="modes"
    :compact="props.compact"
    :lang="locale"
  />
</template>
