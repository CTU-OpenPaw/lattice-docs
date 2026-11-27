<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol } from 'vitepress';
import DiagramCanvas from './DiagramCanvas.vue';
import type { DiagramLocale, DiagramMode } from './diagramTypes';

const props = defineProps<{ lang?: DiagramLocale }>();

const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const title = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Kiến trúc Triển khai Docker Compose & 5 Mạng Cô lập (v0.4.2)'
    : 'Docker Compose Deployment & 5 Isolated Networks (v0.4.2)',
);

const caption = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Toàn bộ container trong infra/compose/prod.yml ghim digest @sha256 trên 5 mạng tách biệt (edge, app, data, scanner, iiot-net). File-scanner (read_only) nhận tệp từ app, quét qua ClamAV trên mạng scanner rồi ghi sang RustFS trên mạng data; Valkey 8.1 tách DB 0/1/2.'
    : 'All containers in infra/compose/prod.yml pin immutable @sha256 digests across 5 isolated networks (edge, app, data, scanner, iiot-net). Read-only file-scanner scans uploads via ClamAV on the scanner network before persisting clean objects to RustFS on the data network.',
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const coreNetworksMode: DiagramMode = {
    id: 'core-networks',
    label: isVi
      ? 'Mạng Lõi (edge, app, data, scanner)'
      : 'Core Networks (edge, app, data, scanner)',
    viewBox: '0 0 1168 476',
    zones: [
      {
        id: 'net-edge',
        label: isVi ? 'MẠNG EDGE (BRIDGE)' : 'EDGE NETWORK (BRIDGE)',
        x: 16,
        y: 16,
        width: 232,
        height: 444,
        kind: 'admin',
      },
      {
        id: 'net-app',
        label: isVi ? 'MẠNG APP (INTERNAL)' : 'APP NETWORK (INTERNAL)',
        x: 276,
        y: 16,
        width: 232,
        height: 248,
        kind: 'traffic',
      },
      {
        id: 'net-scanner',
        label: isVi ? 'MẠNG SCANNER (INTERNAL)' : 'SCANNER (INTERNAL: TRUE)',
        x: 556,
        y: 220,
        width: 232,
        height: 212,
        kind: 'external',
      },
      {
        id: 'net-data',
        label: isVi ? 'MẠNG DATA (INTERNAL: TRUE)' : 'DATA NETWORK (INTERNAL: TRUE)',
        x: 848,
        y: 16,
        width: 304,
        height: 444,
        kind: 'admin',
      },
    ],
    nodes: [
      {
        id: 'caddy',
        title: 'Caddy 2.10',
        sub: [':80 / :443 · TLS 1.3', 'edge + app'],
        icon: 'globe',
        x: 32,
        y: 56,
        width: 200,
        height: 72,
        zoneId: 'net-edge',
        inspector: {
          role: isVi ? 'Biên TLS & Reverse Proxy' : 'Edge TLS Termination Proxy',
          packageOrPort: 'caddy:2.10-alpine@sha256:4c6e91... · :80/:443',
          protocol: 'HTTPS / HTTP/3 · edge + app',
          payloadOrSchema: '256m / 0.5 CPU · :2020/metrics',
          responsibilities: isVi
            ? 'Mở duy nhất cổng 80/443 trên mạng edge; gắn header bảo mật và chuyển tiếp lưu lượng tới APISIX và Keycloak qua mạng nội bộ app.'
            : 'Exposes only ports 80/443 on the edge bridge; applies security headers and proxies traffic to APISIX and Keycloak over internal app networking.',
        },
      },
      {
        id: 'apisix',
        title: 'Apache APISIX 3.19',
        sub: [':9080 · JWKS / Limit', 'edge + app'],
        icon: 'shield',
        x: 32,
        y: 164,
        width: 200,
        height: 72,
        zoneId: 'net-edge',
        inspector: {
          role: isVi ? 'Cổng Kiểm soát API Zero-Trust' : 'Zero-Trust API Gateway',
          packageOrPort: 'apache/apisix:3.19.0-debian@sha256:9a7e45... · :9080',
          protocol: 'HTTP · edge + app',
          payloadOrSchema: '512m / 1.0 CPU · apisix.prod.yaml:ro',
          responsibilities: isVi
            ? 'Xác thực JWT JWKS, gắn X-Request-Id, kiểm soát CORS và giới hạn tốc độ dựa trên Valkey trước khi chuyển vào NocoBase.'
            : 'Validates JWT JWKS, attaches X-Request-Id, enforces strict CORS, and runs Valkey rate limiting ahead of NocoBase.',
        },
      },
      {
        id: 'keycloak',
        title: 'Keycloak 26.8.2',
        sub: ['OIDC PKCE S256', 'realm: lattice · iam-sync'],
        icon: 'key',
        x: 32,
        y: 356,
        width: 200,
        height: 76,
        zoneId: 'net-edge',
        inspector: {
          role: isVi ? 'Hệ thống Định danh OIDC' : 'OIDC Identity & Realm Sync',
          packageOrPort: 'quay.io/keycloak/keycloak:26.8.2@sha256:7e66a9...',
          protocol: 'OIDC · edge + app + data · iam-sync profile',
          payloadOrSchema: '1536m / 1.5 CPU · keycloak_app DB',
          responsibilities: isVi
            ? 'Phục vụ realm lattice (đồng bộ qua profile iam-sync với keycloak-config-cli:6.5.1-26) và dùng CSDL tách biệt keycloak_app.'
            : 'Serves the lattice realm (synced via iam-sync profile with keycloak-config-cli:6.5.1-26) backed by its isolated keycloak_app database.',
        },
      },
      {
        id: 'nocobase',
        title: 'NocoBase 2.2.50',
        sub: ['7 Plugins :ro · :80', 'PG16 RLS & Outbox'],
        icon: 'layers',
        x: 292,
        y: 56,
        width: 200,
        height: 80,
        zoneId: 'net-app',
        focal: true,
        inspector: {
          role: isVi ? 'Máy chủ DX-OS & 7 Plugin Apache-2.0' : 'DX-OS Host & 7 Apache-2.0 Plugins',
          packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751... · :80',
          protocol: 'HTTP · edge + app + data + iiot-net',
          payloadOrSchema: '2048m / 2.0 CPU · @latticedx/* :ro',
          responsibilities: isVi
            ? 'Gắn 7 plugin @latticedx/* chỉ đọc (:ro), thực thi AsyncLocalStorage FORCE RLS qua nocobase_app và điều phối outbox cùng tệp tin.'
            : 'Mounts all 7 @latticedx/* plugins read-only (:ro), enforces AsyncLocalStorage FORCE RLS as nocobase_app, and orchestrates outbox and upload flows.',
        },
      },
      {
        id: 'gotenberg',
        title: 'Gotenberg 8.20.1',
        sub: ['profile: pdf · :3000', 'read_only · JS disabled'],
        icon: 'file-text',
        x: 292,
        y: 176,
        width: 200,
        height: 72,
        zoneId: 'net-app',
        dashed: true,
        tone: 'muted',
        inspector: {
          role: isVi ? 'Dịch vụ Kết xuất PDF Chứng từ' : 'Hardened PDF Voucher Renderer',
          packageOrPort: 'gotenberg/gotenberg:8.20.1@sha256:cda438... · :3000',
          protocol: 'HTTP · app internal · profile: pdf',
          payloadOrSchema: 'read_only: true · --chromium-disable-javascript=true',
          responsibilities: isVi
            ? 'Kết xuất phiếu kho và chứng từ Unicode (DXOS_GOTENBERG_URL) với Chromium tắt JavaScript và hệ thống tệp read_only.'
            : 'Renders Unicode warehouse vouchers via DXOS_GOTENBERG_URL on a read_only filesystem with Chromium JavaScript disabled.',
        },
      },
      {
        id: 'file_scanner',
        title: 'File Scanner',
        sub: [':4010 · read_only: true', 'app + data + scanner'],
        icon: 'shield',
        x: 572,
        y: 256,
        width: 200,
        height: 64,
        zoneId: 'net-scanner',
        inspector: {
          role: isVi ? 'Dịch vụ Kiểm dịch Tệp tải lên' : 'Upload Quarantine & Scan Bridge',
          packageOrPort: 'apps/file-scanner · :4010',
          protocol: 'HTTP -> ClamAV · app + data + scanner',
          payloadOrSchema: 'read_only: true · tmpfs /tmp · 256m',
          responsibilities: isVi
            ? 'Nhận tệp từ NocoBase trên mạng app, chuyển qua mạng scanner cô lập tới ClamAV rồi ghi tệp sạch sang RustFS trên mạng data.'
            : 'Accepts uploads from NocoBase on app, streams bytes across the isolated scanner network to ClamAV, and persists clean objects to RustFS on data.',
        },
      },
      {
        id: 'clamav',
        title: 'ClamAV 1.5.5',
        sub: [':3310 · Malware Scan', 'scanner internal only'],
        icon: 'lock',
        x: 572,
        y: 356,
        width: 200,
        height: 64,
        zoneId: 'net-scanner',
        inspector: {
          role: isVi ? 'Bộ quét Mã độc Cô lập' : 'Isolated Antivirus Daemon',
          packageOrPort: 'clamav/clamav:1.5.5@sha256:121774... · :3310',
          protocol: 'TCP clamd · scanner internal only',
          payloadOrSchema: '2048m / 1.0 CPU · tmpfs /tmp /run/clamav',
          responsibilities: isVi
            ? 'Chỉ gắn duy nhất vào mạng scanner (internal: true), không thể chạm tới CSDL hay dịch vụ ứng dụng; kiểm tra mã độc qua cổng 3310.'
            : 'Attached solely to the internal scanner network with zero access to app or database services; scans payloads over TCP port 3310.',
        },
      },
      {
        id: 'nocobase_db',
        title: 'nocobase-db (PG16)',
        sub: ['pgvector 0.8.1 · :5432', '56+ FORCE RLS · Outbox'],
        icon: 'database',
        x: 864,
        y: 52,
        width: 272,
        height: 76,
        zoneId: 'net-data',
        focal: true,
        inspector: {
          role: isVi ? 'CSDL Lõi FORCE RLS & Vector RAG' : 'Core FORCE RLS & Vector Database',
          packageOrPort: 'pgvector/pgvector:0.8.1-pg16@sha256:33198d... · :5432',
          protocol: 'PostgreSQL Wire · data internal',
          payloadOrSchema: 'nocobase_app (NOBYPASSRLS) · 56 static + latticeCustom*',
          responsibilities: isVi
            ? 'Thực thi FORCE ROW LEVEL SECURITY cho 56 bảng tĩnh và bảng động latticeCustom*, lưu vector 1536d và hàng đợi Outbox SKIP LOCKED.'
            : 'Enforces FORCE ROW LEVEL SECURITY across 56 static and dynamic latticeCustom* tables, stores 1536d vectors, and drains SKIP LOCKED outbox queues.',
        },
      },
      {
        id: 'valkey',
        title: 'Valkey 8.1',
        sub: [':6379 · AOF 512mb', 'DB0 Cache · DB1 SSE · DB2 Auth'],
        icon: 'server',
        x: 864,
        y: 152,
        width: 272,
        height: 80,
        zoneId: 'net-data',
        inspector: {
          role: isVi ? 'Bộ nhớ Đệm, PubSub & Phiên OIDC' : 'Partitioned Cache, PubSub & OIDC Store',
          packageOrPort: 'valkey/valkey:8.1-alpine@sha256:997109... · :6379',
          protocol: 'RESP · app + data · allkeys-lru',
          payloadOrSchema: 'DB 0 Cache · DB 1 PubSub · DB 2 PKCE/Revoked',
          responsibilities: isVi
            ? 'DB 0 lưu cache NocoBase, DB 1 phát PubSub latticedx:surface-updates tới SSE, DB 2 giữ OIDC PKCE state/ticket/revoked (không dùng Streams).'
            : 'DB 0 caches app state, DB 1 routes latticedx:surface-updates PubSub to SSE, DB 2 stores OIDC PKCE state/tickets/revocations (no Streams).',
        },
      },
      {
        id: 'rustfs',
        title: 'RustFS 1.0.6',
        sub: [':9000 · S3 Storage', 'Scanned Objects'],
        icon: 'box',
        x: 864,
        y: 256,
        width: 272,
        height: 64,
        zoneId: 'net-data',
        inspector: {
          role: isVi ? 'Kho Đối tượng S3 Nội bộ' : 'Internal S3 Object Storage',
          packageOrPort: 'rustfs/rustfs:1.0.6@sha256:ee7170... · :9000',
          protocol: 'S3 HTTP · data internal only',
          payloadOrSchema: '1024m / 1.0 CPU · rustfs-data',
          responsibilities: isVi
            ? 'Lưu trữ tệp đính kèm và bằng chứng đã qua quét ClamAV hoàn toàn bên trong mạng data, không mở cổng công khai.'
            : 'Stores ClamAV-cleared attachments and evidence artifacts exclusively inside the internal data network with zero public exposure.',
        },
      },
      {
        id: 'postgres',
        title: 'PostgreSQL 16.16',
        sub: [':5432 · Isolated DBs', 'keycloak_app · lattice_app'],
        icon: 'database',
        x: 864,
        y: 356,
        width: 272,
        height: 76,
        zoneId: 'net-data',
        inspector: {
          role: isVi ? 'Cụm Postgres Dịch vụ Tách biệt' : 'Isolated Service Postgres Cluster',
          packageOrPort: 'postgres:16.16-alpine · :5432',
          protocol: 'PostgreSQL Wire · data internal',
          payloadOrSchema: 'keycloak_app · lattice_app · n8n_app',
          responsibilities: isVi
            ? 'Tách dữ liệu định danh Keycloak và n8n khỏi cụm dữ liệu tenant của nocobase-db để cô lập quyền hạn và sao lưu PITR.'
            : 'Isolates Keycloak identity and optional n8n workflow state from the nocobase-db tenant cluster for strict least-privilege separation.',
        },
      },
    ],
    edges: [
      {
        id: 'c1',
        from: 'caddy',
        to: 'apisix',
        label: 'TLS 1.3',
        kind: 'primary',
        points: [
          [132, 128],
          [132, 164],
        ],
      },
      {
        id: 'c2',
        from: 'keycloak',
        to: 'apisix',
        label: 'JWKS / OIDC',
        kind: 'flow',
        points: [
          [132, 356],
          [132, 236],
        ],
      },
      {
        id: 'c3',
        from: 'apisix',
        to: 'nocobase',
        label: 'Proxy',
        kind: 'primary',
        points: [
          [232, 200],
          [262, 200],
          [262, 96],
          [292, 96],
        ],
      },
      {
        id: 'c4',
        from: 'nocobase',
        to: 'gotenberg',
        label: 'PDF',
        kind: 'dashed',
        points: [
          [392, 136],
          [392, 176],
        ],
      },
      {
        id: 'c5',
        from: 'nocobase',
        to: 'nocobase_db',
        label: 'FORCE RLS',
        kind: 'primary',
        points: [
          [492, 82],
          [864, 82],
        ],
      },
      {
        id: 'c6',
        from: 'nocobase',
        to: 'valkey',
        label: 'DB 0/1/2',
        kind: 'flow',
        labelPosition: 0.65,
        points: [
          [492, 104],
          [544, 104],
          [544, 192],
          [864, 192],
        ],
      },
      {
        id: 'c7',
        from: 'nocobase',
        to: 'file_scanner',
        label: 'Upload',
        kind: 'flow',
        labelPosition: 0.55,
        points: [
          [492, 124],
          [526, 124],
          [526, 288],
          [572, 288],
        ],
      },
      {
        id: 'c8',
        from: 'file_scanner',
        to: 'clamav',
        label: 'Scan :3310',
        kind: 'primary',
        points: [
          [672, 320],
          [672, 356],
        ],
      },
      {
        id: 'c9',
        from: 'file_scanner',
        to: 'rustfs',
        label: 'Clean S3',
        kind: 'flow',
        points: [
          [772, 288],
          [864, 288],
        ],
      },
      {
        id: 'c10',
        from: 'keycloak',
        to: 'postgres',
        label: 'keycloak_app',
        kind: 'dashed',
        points: [
          [232, 396],
          [262, 396],
          [262, 444],
          [832, 444],
          [832, 396],
          [864, 396],
        ],
      },
    ],
    steps: [
      {
        id: 'step-core-edge',
        title: isVi ? 'Biên Edge -> App' : 'Edge to App Ingress',
        activeNodes: ['caddy', 'apisix', 'keycloak', 'nocobase'],
        activeEdges: ['c1', 'c2', 'c3'],
        description: isVi
          ? 'Caddy và APISIX chuyển tiếp yêu cầu đã xác thực JWKS từ mạng edge vào NocoBase trên mạng nội bộ app.'
          : 'Caddy and APISIX validate JWKS tokens against Keycloak and forward authenticated requests from edge into NocoBase on internal app.',
        route: 'edge (bridge) -> app (internal: true)',
        payload: 'All images pinned to @sha256 digests in prod.yml',
        chips: ['edge + app', 'JWKS + PKCE'],
      },
      {
        id: 'step-core-data',
        title: isVi ? 'PG16 FORCE RLS & Valkey DB 0/1/2' : 'PG16 FORCE RLS & Valkey DB 0/1/2',
        activeNodes: ['nocobase', 'nocobase_db', 'valkey'],
        activeEdges: ['c5', 'c6'],
        description: isVi
          ? 'NocoBase truy cập nocobase-db qua vai trò nocobase_app (NOBYPASSRLS) và tách biệt Valkey DB 0 (Cache), DB 1 (SSE), DB 2 (Auth).'
          : 'NocoBase queries nocobase-db as nocobase_app (NOBYPASSRLS) and isolates Valkey DB 0 (Cache), DB 1 (SSE PubSub), and DB 2 (OIDC Auth).',
        route: 'app -> data (internal: true)',
        payload: '56 static + latticeCustom* FORCE RLS · No Valkey Streams',
        chips: ['nocobase_app', 'DB 0/1/2'],
      },
      {
        id: 'step-core-scanner',
        title: isVi ? 'Scanner Cô lập -> RustFS S3' : 'Isolated Scanner -> RustFS S3',
        activeNodes: ['nocobase', 'file_scanner', 'clamav', 'rustfs'],
        activeEdges: ['c7', 'c8', 'c9'],
        description: isVi
          ? 'Tệp tải lên qua file-scanner (read_only) được ClamAV quét trên mạng scanner trước khi ghi sang phải vào RustFS trên mạng data.'
          : 'Uploads flow L->R through read_only file-scanner to ClamAV on the isolated scanner network before clean persistence in RustFS on data.',
        route: 'app -> scanner (internal) -> data (internal)',
        payload: 'file-scanner:4010 -> clamav:3310 -> rustfs:9000',
        chips: ['read_only: true', 'L->R Clean S3'],
      },
    ],
  };

  const optInProfilesMode: DiagramMode = {
    id: 'opt-in-profiles',
    label: isVi
      ? 'Profile Tùy chọn (iiot-net, n8n, observability)'
      : 'Opt-In Profiles (iiot-net, n8n, observability)',
    viewBox: '0 0 1240 388',
    zones: [
      {
        id: 'prof-iiot',
        label: isVi ? 'MẠNG IIOT-NET (PROFILE: IIOT)' : 'IIOT-NET (PROFILE: IIOT)',
        x: 16,
        y: 16,
        width: 240,
        height: 224,
        kind: 'external',
      },
      {
        id: 'prof-app',
        label: isVi ? 'MẠNG APP (INTERNAL: TRUE)' : 'APP NETWORK (INTERNAL: TRUE)',
        x: 276,
        y: 16,
        width: 656,
        height: 356,
        kind: 'traffic',
      },
      {
        id: 'prof-data',
        label: isVi ? 'MẠNG DATA (INTERNAL: TRUE)' : 'DATA NETWORK (INTERNAL: TRUE)',
        x: 952,
        y: 16,
        width: 272,
        height: 356,
        kind: 'admin',
      },
    ],
    nodes: [
      {
        id: 'mosquitto',
        title: 'Mosquitto 2.0.21',
        sub: [':1883 · DynSec ACL', 'iiot-net only'],
        icon: 'radio',
        x: 32,
        y: 56,
        width: 208,
        height: 64,
        zoneId: 'prof-iiot',
        dashed: true,
        inspector: {
          role: isVi ? 'Broker MQTT Nội bộ với DynSec' : 'Internal MQTT Broker with DynSec',
          packageOrPort: 'eclipse-mosquitto:2.0.21@sha256:94f5a3... · :1883',
          protocol: 'MQTT 3.1.1 / 5 · iiot-net internal',
          payloadOrSchema: 'dynamic-security.json · default deny ACL',
          responsibilities: isVi
            ? 'Chỉ gắn vào mạng iiot-net (internal: true), xác thực thiết bị bằng Dynamic Security và phát gói LWT.'
            : 'Attached strictly to internal iiot-net, enforcing Dynamic Security ACLs and device LWT status.',
        },
      },
      {
        id: 'nodered',
        title: 'Node-RED 4.0.9',
        sub: [':1880 · flows.json', 'iiot-net + app'],
        icon: 'cpu',
        x: 32,
        y: 156,
        width: 208,
        height: 64,
        zoneId: 'prof-iiot',
        dashed: true,
        inspector: {
          role: isVi ? 'Cầu nối Chuẩn hóa & Downlink IIoT' : 'IIoT Telemetry & Downlink Bridge',
          packageOrPort: 'nodered/node-red:4.0.9@sha256:0b295b... · :1880',
          protocol: 'MQTT <-> HTTP · iiot-net + app',
          payloadOrSchema: 'AES-256-CTR flows_cred.json · /twin/command',
          responsibilities: isVi
            ? 'Chuyển tiếp telemetry từ Mosquitto tới NocoBase :telemetryIngest và nhận lệnh downlink /twin/command.'
            : 'Forwards Mosquitto telemetry to NocoBase :telemetryIngest and dispatches /twin/command downlinks.',
        },
      },
      {
        id: 'nocobase_opt',
        title: 'NocoBase 2.2.50',
        sub: ['dxosBroker · dxosN8n', 'OTel GenAI · :metrics'],
        icon: 'layers',
        x: 304,
        y: 56,
        width: 200,
        height: 72,
        zoneId: 'prof-app',
        focal: true,
        inspector: {
          role: isVi ? 'Trung tâm Điều phối Profile Tùy chọn' : 'Optional Profile Orchestration Host',
          packageOrPort: 'nocobase/nocobase:2.2.50 · :80',
          protocol: 'HTTP · OTLP :4318 · Prometheus :metrics',
          payloadOrSchema: 'dxosBroker · dxosN8n · OTel PII Scrub',
          responsibilities: isVi
            ? 'Điều phối dữ liệu IIoT sang Orion-LD, đồng bộ workflow sang stock n8n và xuất span OTel GenAI đã che PII.'
            : 'Orchestrates IIoT updates to Orion-LD, syncs workflows to stock n8n, and emits PII-scrubbed OTel GenAI spans.',
        },
      },
      {
        id: 'orion_ld',
        title: 'Orion-LD 1.12.0',
        sub: [':1026 · NGSI-LD', 'app + data'],
        icon: 'globe',
        x: 588,
        y: 56,
        width: 216,
        height: 72,
        zoneId: 'prof-app',
        inspector: {
          role: isVi ? 'Context Broker NGSI-LD FIWARE' : 'FIWARE NGSI-LD Context Broker',
          packageOrPort: 'fiware/orion-ld:1.12.0@sha256:f562a9... · :1026',
          protocol: 'NGSI-LD HTTP · app + data',
          payloadOrSchema: 'NGSILD-Tenant · entity upsert & notify',
          responsibilities: isVi
            ? 'Duy trì thực thể Digital Twin theo chuẩn NGSI-LD từ bộ rút PG16 Outbox 10s của NocoBase.'
            : 'Maintains NGSI-LD Digital Twin entities synchronized by the 10s NocoBase PG16 context outbox.',
        },
      },
      {
        id: 'n8n_opt',
        title: 'n8n 2.48.1',
        sub: ['profile: n8n · :5678', 'REST v1 + OAuth2 PKCE'],
        icon: 'workflow',
        x: 380,
        y: 164,
        width: 208,
        height: 72,
        zoneId: 'prof-app',
        dashed: true,
        tone: 'muted',
        inspector: {
          role: isVi ? 'Động cơ Workflow Tích hợp Ngoài' : 'External Workflow Automation Engine',
          packageOrPort: 'n8nio/n8n:2.48.1@sha256:5e022f... · :5678',
          protocol: 'REST v1 + HMAC Callback · app + data',
          payloadOrSchema: 'DX_N8N_API_URL · n8n_app PG16 DB',
          responsibilities: isVi
            ? 'Chạy theo profile tùy chọn n8n, sử dụng CSDL riêng n8n_app trên PostgreSQL 16 và giao tiếp qua cầu nối dxosN8n.'
            : 'Runs under the opt-in n8n profile with its isolated n8n_app Postgres database via the dxosN8n REST v1 bridge.',
        },
      },
      {
        id: 'otel_col',
        title: 'OTel Collector',
        sub: ['observability', ':4318 · :8889'],
        icon: 'activity',
        x: 304,
        y: 276,
        width: 156,
        height: 76,
        zoneId: 'prof-app',
        dashed: true,
        tone: 'muted',
        inspector: {
          role: isVi ? 'Bộ thu thập Dấu vết & Chỉ số OTel' : 'OpenTelemetry Collector Contrib',
          packageOrPort: 'otel/opentelemetry-collector-contrib:0.123.0 · :4318',
          protocol: 'OTLP gRPC :4317 · HTTP :4318 · Prom :8889',
          payloadOrSchema: 'read_only: true · otel-collector.yaml:ro',
          responsibilities: isVi
            ? 'Thu nhận span W3C traceparent từ NocoBase và xuất chỉ số tổng hợp trên cổng 8889 cho Prometheus.'
            : 'Ingests W3C traceparent spans from NocoBase and exposes aggregated span metrics on port 8889 for Prometheus.',
        },
      },
      {
        id: 'prometheus',
        title: 'Prometheus 3.3',
        sub: ['observability', ':9090 · 4 Jobs'],
        icon: 'cpu',
        x: 532,
        y: 276,
        width: 156,
        height: 76,
        zoneId: 'prof-app',
        dashed: true,
        tone: 'muted',
        inspector: {
          role: isVi ? 'Hệ thống Thu thập Chuỗi Thời gian' : 'Metrics Scraper & Alert Evaluator',
          packageOrPort: 'prom/prometheus:v3.3.0@sha256:339ce8... · :9090',
          protocol: 'HTTP Scrape · DX_METRICS_TOKEN',
          payloadOrSchema: '4 targets · 5 alerts.yml · 15d retention',
          responsibilities: isVi
            ? 'Thu thập 4 nguồn (nocobase, caddy, keycloak, otel-collector) và đánh giá 5 quy tắc cảnh báo RLS/DLQ/5xx.'
            : 'Scrapes 4 targets (nocobase, caddy, keycloak, otel-collector) and evaluates 5 RLS/DLQ/5xx alert rules.',
        },
      },
      {
        id: 'grafana',
        title: 'Grafana 11.5.8',
        sub: ['observability', ':3000 · 360°'],
        icon: 'check-circle',
        x: 760,
        y: 276,
        width: 156,
        height: 76,
        zoneId: 'prof-app',
        dashed: true,
        tone: 'muted',
        inspector: {
          role: isVi ? 'Bảng điều khiển Quan sát Hợp nhất' : 'Provisioned Observability Dashboards',
          packageOrPort: 'grafana/grafana-oss:11.5.8@sha256:b8121d... · :3000',
          protocol: 'PromQL · app + data',
          payloadOrSchema: 'dashboards/latticedx-360.json',
          responsibilities: isVi
            ? 'Hiển thị bảng điều khiển latticedx-360.json dựng sẵn theo dõi độ trễ API, lỗi RLS, outbox và token AI.'
            : 'Renders the provisioned latticedx-360.json dashboard tracking API latency, RLS errors, outbox backlog, and AI tokens.',
        },
      },
      {
        id: 'orion_mongo',
        title: 'MongoDB 8.0',
        sub: [':27017 · SCRAM-SHA-256', 'Orion-LD Backing Store'],
        icon: 'server',
        x: 968,
        y: 56,
        width: 240,
        height: 72,
        zoneId: 'prof-data',
        inspector: {
          role: isVi ? 'Kho Lưu trữ Orion-LD' : 'Orion-LD Backing Store',
          packageOrPort: 'mongo:8.0@sha256:479e85... · :27017',
          protocol: 'MongoDB Wire · SCRAM-SHA-256 · data internal',
          payloadOrSchema: '1024m / 1.0 CPU · orion-mongo-data',
          responsibilities: isVi
            ? 'Lưu trạng thái thực thể NGSI-LD cho Orion-LD hoàn toàn trên mạng data nội bộ.'
            : 'Persists NGSI-LD entity state for Orion-LD strictly inside the internal data network.',
        },
      },
      {
        id: 'postgres_n8n',
        title: 'PostgreSQL 16.16',
        sub: ['n8n_app DB · :5432', 'Isolated Profile DB'],
        icon: 'database',
        x: 968,
        y: 164,
        width: 240,
        height: 72,
        zoneId: 'prof-data',
        inspector: {
          role: isVi ? 'CSDL Tách biệt cho Profile n8n' : 'Isolated Profile Database for n8n',
          packageOrPort: 'postgres:16.16-alpine · :5432',
          protocol: 'PostgreSQL Wire · data internal',
          payloadOrSchema: 'n8n_app database',
          responsibilities: isVi
            ? 'Lưu trạng thái thực thi của stock n8n tách biệt khỏi cụm dữ liệu tenant nocobase-db.'
            : 'Stores stock n8n execution state isolated from the nocobase-db tenant cluster.',
        },
      },
      {
        id: 'nocobase_db_opt',
        title: 'nocobase-db (PG16)',
        sub: ['pgvector 0.8.1 · :5432', 'Context Outbox · AiTraces'],
        icon: 'database',
        x: 968,
        y: 276,
        width: 240,
        height: 76,
        zoneId: 'prof-data',
        inspector: {
          role: isVi ? 'Outbox PG16 & Kho Dấu vết AI' : 'PG16 Context Outbox & AI Trace Store',
          packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · :5432',
          protocol: 'PostgreSQL + HNSW · data internal',
          payloadOrSchema: 'latticeContextOutbox · latticeAiTraces',
          responsibilities: isVi
            ? 'Lưu hàng đợi latticeContextOutbox (rút mỗi 10s bằng SKIP LOCKED) và dấu vết suy luận AI.'
            : 'Stores latticeContextOutbox (drained every 10s via SKIP LOCKED) alongside AI execution traces.',
        },
      },
    ],
    edges: [
      {
        id: 'p1',
        from: 'mosquitto',
        to: 'nodered',
        label: 'MQTT :1883',
        kind: 'flow',
        points: [
          [136, 120],
          [136, 156],
        ],
      },
      {
        id: 'p2',
        from: 'nodered',
        to: 'nocobase_opt',
        label: 'Ingest',
        kind: 'primary',
        points: [
          [240, 188],
          [264, 188],
          [264, 86],
          [304, 86],
        ],
      },
      {
        id: 'p3',
        from: 'nocobase_opt',
        to: 'orion_ld',
        label: 'NGSI-LD',
        kind: 'primary',
        points: [
          [504, 92],
          [588, 92],
        ],
      },
      {
        id: 'p4',
        from: 'orion_ld',
        to: 'orion_mongo',
        label: 'SCRAM',
        kind: 'flow',
        points: [
          [804, 92],
          [968, 92],
        ],
      },
      {
        id: 'p5',
        from: 'nocobase_opt',
        to: 'n8n_opt',
        label: 'REST v1',
        kind: 'dashed',
        points: [
          [440, 128],
          [440, 164],
        ],
      },
      {
        id: 'p6',
        from: 'n8n_opt',
        to: 'postgres_n8n',
        label: 'n8n_app',
        kind: 'dashed',
        points: [
          [588, 200],
          [968, 200],
        ],
      },
      {
        id: 'p7',
        from: 'nocobase_opt',
        to: 'otel_col',
        label: 'OTLP :4318',
        kind: 'dashed',
        points: [
          [324, 128],
          [324, 276],
        ],
      },
      {
        id: 'p8',
        from: 'otel_col',
        to: 'prometheus',
        label: ':8889',
        kind: 'flow',
        points: [
          [460, 314],
          [532, 314],
        ],
      },
      {
        id: 'p9',
        from: 'prometheus',
        to: 'grafana',
        label: 'PromQL',
        kind: 'flow',
        points: [
          [688, 314],
          [760, 314],
        ],
      },
      {
        id: 'p10',
        from: 'nocobase_opt',
        to: 'nocobase_db_opt',
        label: 'Outbox',
        kind: 'primary',
        labelPosition: 0.65,
        points: [
          [504, 116],
          [544, 116],
          [544, 144],
          [620, 144],
          [620, 254],
          [942, 254],
          [942, 314],
          [968, 314],
        ],
      },
    ],
    steps: [
      {
        id: 'step-opt-iiot',
        title: isVi ? 'Profile iiot & Orion-LD' : 'iiot Profile & Orion-LD Sync',
        activeNodes: ['mosquitto', 'nodered', 'nocobase_opt', 'orion_ld', 'orion_mongo', 'nocobase_db_opt'],
        activeEdges: ['p1', 'p2', 'p3', 'p4', 'p10'],
        description: isVi
          ? 'Mosquitto 2.0 (DynSec) cô lập trên iiot-net gửi dữ liệu qua Node-RED về NocoBase, ghi PG16 Context Outbox và đồng bộ sang Orion-LD + MongoDB 8.0.'
          : 'Mosquitto 2.0 (DynSec) on isolated iiot-net feeds Node-RED into NocoBase, persisting PG16 Context Outbox before syncing Orion-LD and MongoDB 8.0.',
        route: 'iiot-net -> app -> data (internal: true)',
        payload: 'FOR UPDATE OF o SKIP LOCKED · SCRAM-SHA-256',
        chips: ['profile: iiot', 'DynSec + NGSI-LD'],
      },
      {
        id: 'step-opt-n8n',
        title: isVi ? 'Profile n8n Tùy chọn' : 'Opt-In n8n Profile',
        activeNodes: ['nocobase_opt', 'n8n_opt', 'postgres_n8n'],
        activeEdges: ['p5', 'p6'],
        description: isVi
          ? 'Stock n8n 2.48.1 chạy trên mạng app/data với CSDL riêng n8n_app, đồng bộ credentials và workflow từ cầu nối dxosN8n.'
          : 'Stock n8n 2.48.1 runs on app/data with its own n8n_app Postgres database, synchronized from dxosN8n over REST v1.',
        route: 'dxosN8n -> http://n8n:5678/api/v1 -> postgres (n8n_app)',
        payload: 'OAuth2 PKCE + AES-256-GCM Vault',
        chips: ['profile: n8n', 'Isolated n8n_app'],
      },
      {
        id: 'step-opt-obs',
        title: isVi ? 'Profile observability' : 'Opt-In observability Profile',
        activeNodes: ['nocobase_opt', 'otel_col', 'prometheus', 'grafana'],
        activeEdges: ['p7', 'p8', 'p9'],
        description: isVi
          ? 'NocoBase che PII trước khi đẩy span OTLP :4318 sang OTel Collector; Prometheus 3.3 thu thập chỉ số và cấp dữ liệu cho Grafana.'
          : 'NocoBase scrubs PII before shipping OTLP :4318 spans to OTel Collector; Prometheus 3.3 scrapes metrics for Grafana latticedx-360.',
        route: 'OTLP :4318 -> OTel :8889 -> Prometheus :9090 -> Grafana :3000',
        payload: 'PII Scrubbed · 4 Scrape Jobs · 5 Alerts',
        chips: ['profile: observability', 'latticedx-360.json'],
      },
    ],
  };

  return [coreNetworksMode, optInProfilesMode];
});
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
