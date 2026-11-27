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
    ? 'Kiến trúc Triển khai Docker Compose, 5 Mạng Cô lập & Valkey/PG16'
    : 'Docker Compose Profiles, 5 Isolated Networks & Valkey/PG16 Topology',
);

const caption = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Toàn bộ image trong prod.yml khóa bằng @sha256 trên 5 mạng tách biệt (edge, app, data, scanner, iiot-net). Valkey 8.1 phân vùng DB 0/1/2 (không dùng Valkey Streams), còn Outbox và Event Bus chạy trên PostgreSQL 16 với FOR UPDATE SKIP LOCKED.'
    : 'All prod.yml images pin immutable @sha256 digests across 5 isolated networks (edge, app, data, scanner, iiot-net). Valkey 8.1 partitions DB 0/1/2 (no Valkey Streams), while transactional outbox draining runs on PostgreSQL 16 with FOR UPDATE SKIP LOCKED.',
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const coreEdgeMode: DiagramMode = {
    id: 'core-edge',
    label: isVi ? 'Core & Edge Stack' : 'Core & Edge Stack',
    summary: isVi
      ? '4 mạng (edge, app, data, scanner) · Valkey DB 0/1/2 · PG16 Outbox'
      : '4 networks (edge, app, data, scanner) · Valkey DB 0/1/2 · PG16 Outbox',
    zones: [
      {
        id: 'net-edge',
        label: isVi ? 'MẠNG EDGE (BRIDGE)' : 'EDGE NETWORK (BRIDGE)',
        x: 16,
        y: 16,
        width: 428,
        height: 132,
        kind: 'admin',
      },
      {
        id: 'net-app',
        label: isVi ? 'MẠNG APP (INTERNAL: TRUE)' : 'APP NETWORK (INTERNAL: TRUE)',
        x: 460,
        y: 16,
        width: 444,
        height: 132,
        kind: 'traffic',
      },
      {
        id: 'net-data',
        label: isVi ? 'MẠNG DATA (INTERNAL: TRUE)' : 'DATA NETWORK (INTERNAL: TRUE)',
        x: 16,
        y: 184,
        width: 600,
        height: 244,
        kind: 'traffic',
      },
      {
        id: 'net-scanner',
        label: isVi ? 'MẠNG SCANNER (INTERNAL: TRUE)' : 'SCANNER NETWORK (INTERNAL: TRUE)',
        x: 632,
        y: 184,
        width: 272,
        height: 244,
        kind: 'external',
      },
    ],
    nodes: [
      {
        id: 'caddy',
        title: 'Caddy 2.10',
        sub: '@sha256 · :80/:443',
        icon: 'globe',
        x: 36,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'net-edge',
        inspector: {
          role: isVi ? 'Biên TLS & Reverse Proxy' : 'Edge TLS Termination Proxy',
          packageOrPort: 'caddy:2.10-alpine@sha256:4c6e91... · :80/:443',
          protocol: 'HTTPS / HTTP/3 · edge + app',
          payloadOrSchema: '256m / 0.5 CPU · :2019/:2020 metrics',
          responsibilities: isVi
            ? 'Mở duy nhất cổng 80/443 ra ngoài trên mạng edge; chuyển tiếp lưu lượng sang APISIX và Keycloak qua mạng nội bộ app.'
            : 'Exposes only ports 80/443 on the edge bridge; forwards traffic to APISIX and Keycloak over internal app networking.',
        },
      },
      {
        id: 'apisix',
        title: 'APISIX 3.19',
        sub: '@sha256 · :9080',
        icon: 'shield',
        x: 252,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'net-edge',
        inspector: {
          role: isVi ? 'Cổng Kiểm soát API' : 'Zero-Trust API Gateway',
          packageOrPort: 'apache/apisix:3.19.0-debian@sha256:9a7e45... · :9080',
          protocol: 'HTTP · edge + app',
          payloadOrSchema: '512m / 1.0 CPU · config.prod.yaml:ro',
          responsibilities: isVi
            ? 'Kiểm tra JWT JWKS, gắn X-Request-Id, áp dụng CORS và đếm giới hạn tốc độ bằng Valkey trước khi vào NocoBase.'
            : 'Validates JWT JWKS, attaches X-Request-Id, enforces CORS, and runs Valkey rate limiting ahead of NocoBase.',
        },
      },
      {
        id: 'nocobase',
        title: 'NocoBase 2.2.50',
        sub: '@sha256 · 7 Plugins',
        icon: 'layers',
        x: 480,
        y: 56,
        width: 184,
        height: 64,
        zoneId: 'net-app',
        focal: true,
        inspector: {
          role: isVi ? 'Máy chủ DX-OS & 7 Plugin Pure-OSI' : 'DX-OS Host & 7 Pure-OSI Plugins',
          packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751... · :80',
          protocol: 'HTTP · edge + app + data + iiot-net',
          payloadOrSchema: '2048m / 2.0 CPU · @latticedx/* :ro',
          responsibilities: isVi
            ? 'Gắn 7 plugin Apache-2.0 ở chế độ chỉ đọc (:ro), kết nối PG16 bằng nocobase_app và điều phối outbox cùng tệp tin.'
            : 'Mounts all 7 Apache-2.0 plugins read-only (:ro), connects to PG16 as nocobase_app, and coordinates outbox and file workflows.',
        },
      },
      {
        id: 'keycloak',
        title: 'Keycloak 26.8',
        sub: '@sha256 · iam-sync',
        icon: 'key',
        x: 716,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'net-app',
        inspector: {
          role: isVi ? 'Hệ thống Định danh OIDC' : 'OIDC Identity & Realm Sync',
          packageOrPort: 'quay.io/keycloak/keycloak:26.8.2@sha256:7e66a9...',
          protocol: 'OIDC · edge + app + data · iam-sync profile',
          payloadOrSchema: '1536m / 1.5 CPU · keycloak_app DB',
          responsibilities: isVi
            ? 'Chạy cấu hình realm lattice (đồng bộ qua profile iam-sync với keycloak-config-cli:6.5.1-26) và dùng DB riêng keycloak_app.'
            : 'Serves the lattice realm (provisioned via iam-sync profile with keycloak-config-cli:6.5.1-26) backed by isolated keycloak_app DB.',
        },
      },
      {
        id: 'pg16_db',
        title: 'PG16 + pgvector',
        sub: 'Outbox SKIP LOCKED',
        icon: 'database',
        x: 36,
        y: 228,
        width: 236,
        height: 64,
        zoneId: 'net-data',
        inspector: {
          role: isVi ? 'CSDL Lõi, RLS & Hàng đợi Outbox' : 'Core DBs, FORCE RLS & Transactional Outbox',
          packageOrPort: 'pgvector:0.8.1-pg16 & postgres:16.16-alpine · :5432',
          protocol: 'PostgreSQL Wire · data internal',
          payloadOrSchema: 'WAL PITR .gz · FOR UPDATE SKIP LOCKED',
          responsibilities: isVi
            ? 'Tách nocobase-db (nocobase_app, pgvector) và postgres (lattice_app, keycloak_app, n8n_app); rút outbox bằng FOR UPDATE SKIP LOCKED.'
            : 'Separates nocobase-db (nocobase_app, pgvector) from postgres (lattice_app, keycloak_app, n8n_app); drains outbox via FOR UPDATE SKIP LOCKED.',
        },
      },
      {
        id: 'valkey',
        title: 'Valkey 8.1',
        sub: 'DB0/1/2 · No Streams',
        icon: 'server',
        x: 356,
        y: 228,
        width: 240,
        height: 64,
        zoneId: 'net-data',
        inspector: {
          role: isVi ? 'Bộ nhớ Đệm, PubSub & Phiên OIDC' : 'Partitioned Cache, PubSub & OIDC Store',
          packageOrPort: 'valkey/valkey:8.1-alpine@sha256:997109... · :6379',
          protocol: 'RESP · app + data · AOF 512mb allkeys-lru',
          payloadOrSchema: 'DB 0 Cache · DB 1 PubSub · DB 2 Auth (No Streams)',
          responsibilities: isVi
            ? 'DB 0 lưu cache NocoBase, DB 1 phát PubSub latticedx:surface-updates tới SSE, DB 2 giữ OIDC state/ticket/revoked; không dùng Valkey Streams.'
            : 'DB 0 holds app cache, DB 1 routes latticedx:surface-updates PubSub to SSE, DB 2 stores OIDC state/tickets/revocations; Valkey Streams is not used.',
        },
      },
      {
        id: 'rustfs',
        title: 'RustFS 1.0.6',
        sub: '@sha256 · S3 :9000',
        icon: 'box',
        x: 36,
        y: 340,
        width: 236,
        height: 64,
        zoneId: 'net-data',
        inspector: {
          role: isVi ? 'Kho Đối tượng S3 Nội bộ' : 'Internal S3 Object Storage',
          packageOrPort: 'rustfs/rustfs:1.0.6@sha256:ee7170... · :9000',
          protocol: 'S3 HTTP · data internal',
          payloadOrSchema: '1024m / 1.0 CPU · rustfs-data',
          responsibilities: isVi
            ? 'Lưu trữ tệp đính kèm và bằng chứng đã qua quét mã độc chỉ trong mạng data nội bộ, không mở cổng ra ngoài.'
            : 'Stores scanned attachments and artifact objects exclusively inside the internal data network with zero public exposure.',
        },
      },
      {
        id: 'file_scanner',
        title: 'File Scanner',
        sub: 'read_only · :4010',
        icon: 'file-text',
        x: 652,
        y: 228,
        width: 232,
        height: 64,
        zoneId: 'net-scanner',
        inspector: {
          role: isVi ? 'Dịch vụ Kiểm dịch Tệp tải lên' : 'Upload Quarantine & Scan Bridge',
          packageOrPort: 'apps/file-scanner · :4010',
          protocol: 'HTTP -> ClamAV · app + data + scanner',
          payloadOrSchema: 'read_only: true · tmpfs /tmp · 256m',
          responsibilities: isVi
            ? 'Nhận tệp từ mạng app ở chế độ read_only, chuyển qua mạng scanner cô lập tới ClamAV trước khi lưu vào RustFS.'
            : 'Accepts uploads on a read_only root filesystem, forwards bytes across the isolated scanner network to ClamAV, and writes clean objects.',
        },
      },
      {
        id: 'clamav',
        title: 'ClamAV 1.5.5',
        sub: '@sha256 · :3310',
        icon: 'lock',
        x: 652,
        y: 340,
        width: 232,
        height: 64,
        zoneId: 'net-scanner',
        inspector: {
          role: isVi ? 'Bộ quét Mã độc Cô lập' : 'Isolated Antivirus Daemon',
          packageOrPort: 'clamav/clamav:1.5.5@sha256:121774... · :3310',
          protocol: 'TCP clamd · scanner internal only',
          payloadOrSchema: '2048m / 1.0 CPU · tmpfs /tmp /run/clamav',
          responsibilities: isVi
            ? 'Chỉ gắn vào mạng scanner (internal: true), không thể truy cập CSDL hay dịch vụ ứng dụng; quét tệp qua cổng 3310.'
            : 'Attached solely to the internal scanner network with zero access to app or database services; inspects payloads on port 3310.',
        },
      },
    ],
    edges: [
      { id: 'c1', from: 'caddy', to: 'apisix', label: 'TLS', kind: 'primary' },
      { id: 'c2', from: 'apisix', to: 'nocobase', label: 'Proxy', kind: 'primary' },
      { id: 'c3', from: 'nocobase', to: 'keycloak', label: 'OIDC', kind: 'flow' },
      { id: 'c4', from: 'nocobase', to: 'valkey', label: 'DB0/1/2', kind: 'flow' },
      {
        id: 'c5',
        from: 'nocobase',
        to: 'pg16_db',
        label: 'FORCE RLS',
        kind: 'primary',
        points: [
          [508, 120],
          [508, 168],
          [156, 168],
          [156, 228],
        ],
      },
      {
        id: 'c6',
        from: 'nocobase',
        to: 'file_scanner',
        label: 'Upload',
        kind: 'flow',
        points: [
          [624, 120],
          [624, 168],
          [768, 168],
          [768, 228],
        ],
      },
      { id: 'c7', from: 'file_scanner', to: 'clamav', label: 'Scan', kind: 'primary' },
      {
        id: 'c8',
        from: 'file_scanner',
        to: 'rustfs',
        label: 'Clean S3',
        kind: 'flow',
        points: [
          [652, 260],
          [612, 260],
          [612, 372],
          [272, 372],
        ],
      },
    ],
    steps: [
      {
        id: 'step-core-edge',
        title: isVi ? 'Biên Edge -> App qua Ảnh Khóa @sha256' : 'Edge to App over @sha256 Images',
        activeNodes: ['caddy', 'apisix', 'nocobase', 'keycloak'],
        activeEdges: ['c1', 'c2', 'c3'],
        description: isVi
          ? 'Caddy và APISIX nằm ở vùng giao tiếp edge/app, định tuyến yêu cầu đã xác thực JWKS tới NocoBase và Keycloak.'
          : 'Caddy and APISIX bridge edge and app networks, routing JWKS-validated requests to NocoBase and Keycloak.',
        route: 'edge (bridge) -> app (internal: true)',
        payload: 'Every service pinned to @sha256 digest in prod.yml',
        chips: ['edge + app', 'OIDC iam-sync'],
      },
      {
        id: 'step-core-valkey',
        title: isVi ? 'Phân vùng Valkey 8.1 DB 0/1/2' : 'Valkey 8.1 DB 0/1/2 Partitioning',
        activeNodes: ['nocobase', 'valkey'],
        activeEdges: ['c4'],
        description: isVi
          ? 'Valkey 8.1 tách rạch ròi DB 0 (Cache), DB 1 (PubSub SSE surface-updates) và DB 2 (OIDC PKCE state/ticket/revocation); không dùng Valkey Streams.'
          : 'Valkey 8.1 isolates DB 0 (Cache), DB 1 (PubSub SSE surface-updates), and DB 2 (OIDC PKCE state/ticket/revocation); Valkey Streams is not used.',
        route: 'redis://:***@redis:6379/{0,1,2}',
        payload: '--appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru',
        chips: ['DB 0/1/2', 'No Valkey Streams'],
      },
      {
        id: 'step-core-pg16',
        title: isVi ? 'PG16 FORCE RLS & Outbox SKIP LOCKED' : 'PG16 FORCE RLS & Outbox SKIP LOCKED',
        activeNodes: ['nocobase', 'pg16_db'],
        activeEdges: ['c5'],
        description: isVi
          ? 'Dữ liệu tổ chức và hàng đợi Outbox/Event Bus nằm hoàn toàn trên mạng data (internal: true), rút việc bằng FOR UPDATE SKIP LOCKED.'
          : 'Tenant data and transactional outbox queues stay inside the internal data network, drained via PostgreSQL FOR UPDATE SKIP LOCKED.',
        route: 'data (internal: true) · :5432',
        payload: 'FOR UPDATE OF o SKIP LOCKED · WAL .gz PITR',
        chips: ['data internal', 'PG16 Outbox'],
      },
      {
        id: 'step-core-scanner',
        title: isVi ? 'Mạng Scanner Cô lập & Kho RustFS S3' : 'Isolated Scanner Network & RustFS S3',
        activeNodes: ['nocobase', 'file_scanner', 'clamav', 'rustfs'],
        activeEdges: ['c6', 'c7', 'c8'],
        description: isVi
          ? 'Tệp tải lên qua file-scanner (read_only) được quét bởi ClamAV trên mạng scanner riêng trước khi ghi vào RustFS trên mạng data.'
          : 'Uploads pass through read_only file-scanner to ClamAV on the isolated scanner network before clean persistence in RustFS.',
        route: 'scanner (internal: true) -> data (internal: true)',
        payload: 'clamav:3310 -> rustfs:9000',
        chips: ['scanner internal', 'read_only: true'],
      },
    ],
  };

  const aiObsMode: DiagramMode = {
    id: 'ai-obs',
    label: isVi ? 'AI, PDF & Observability' : 'AI, PDF & Observability',
    summary: isVi
      ? 'Profile observability + pdf · OTel GenAI · Prometheus 3.3 · pgvector'
      : 'observability + pdf profiles · OTel GenAI · Prometheus 3.3 · pgvector',
    zones: [
      {
        id: 'obs-app',
        label: isVi ? 'MẠNG APP (DEFAULT + PROFILE: PDF)' : 'APP NETWORK (DEFAULT + PROFILE: PDF)',
        x: 16,
        y: 16,
        width: 488,
        height: 244,
        kind: 'traffic',
      },
      {
        id: 'obs-profile',
        label: isVi ? 'PROFILE: OBSERVABILITY (APP + DATA)' : 'PROFILE: OBSERVABILITY (APP + DATA)',
        x: 520,
        y: 16,
        width: 424,
        height: 412,
        kind: 'external',
      },
      {
        id: 'obs-data',
        label: isVi ? 'MẠNG DATA (PGVECTOR + TRACES)' : 'DATA NETWORK (PGVECTOR + TRACES)',
        x: 16,
        y: 288,
        width: 488,
        height: 140,
        kind: 'admin',
      },
    ],
    nodes: [
      {
        id: 'nocobase_obs',
        title: 'NocoBase 2.2.50',
        sub: 'OTel GenAI + :metrics',
        icon: 'bot',
        x: 36,
        y: 64,
        width: 196,
        height: 64,
        zoneId: 'obs-app',
        focal: true,
        inspector: {
          role: isVi ? 'Nguồn Span GenAI & Chỉ số Ứng dụng' : 'GenAI Span & App Metrics Emitter',
          packageOrPort: 'otel-exporter.js · observability.js',
          protocol: 'OTLP HTTP :4318 + GET /api/dxos:metrics',
          payloadOrSchema: 'Queue 256 · Batch 64 · PII Scrubbed',
          responsibilities: isVi
            ? 'Gắn ngữ nghĩa OTel GenAI (gen_ai.system, token), che CCCD/Phone/Bank/MST/JWT/Email trước khi gửi OTLP và xuất 16 nhóm chỉ số Prometheus.'
            : 'Attaches OTel GenAI attributes, scrubs CCCD/Phone/Bank/MST/JWT/Email PII before OTLP export, and serves 16 Prometheus metric families.',
        },
      },
      {
        id: 'caddy_obs',
        title: 'Caddy 2.10',
        sub: ':2020/metrics',
        icon: 'globe',
        x: 296,
        y: 64,
        width: 188,
        height: 64,
        zoneId: 'obs-app',
        inspector: {
          role: isVi ? 'Điểm Thu thập Chỉ số Biên' : 'Edge Proxy Metrics Target',
          packageOrPort: 'caddy:2.10-alpine · :2020/metrics',
          protocol: 'Prometheus Pull · app internal',
          payloadOrSchema: 'Job: caddy:2020',
          responsibilities: isVi
            ? 'Cung cấp thông lượng HTTP, mã trạng thái TLS và độ trễ biên cho Prometheus.'
            : 'Exposes edge TLS throughput, status counters, and upstream latency metrics to Prometheus.',
        },
      },
      {
        id: 'gotenberg',
        title: 'Gotenberg 8.20',
        sub: 'profile:pdf · JS Off',
        icon: 'file-text',
        x: 36,
        y: 176,
        width: 184,
        height: 64,
        zoneId: 'obs-app',
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
        id: 'keycloak_obs',
        title: 'Keycloak 26.8',
        sub: ':9000 · KC_METRICS',
        icon: 'key',
        x: 300,
        y: 176,
        width: 184,
        height: 64,
        zoneId: 'obs-app',
        inspector: {
          role: isVi ? 'Điểm Thu thập Chỉ số Định danh' : 'Identity Provider Metrics Target',
          packageOrPort: 'keycloak:26.8.2 · :9000/metrics',
          protocol: 'Prometheus Pull · KC_METRICS_ENABLED=true',
          payloadOrSchema: 'Job: keycloak:9000',
          responsibilities: isVi
            ? 'Báo cáo lượt đăng nhập OIDC, thất bại xác thực và tình trạng kết nối keycloak_app.'
            : 'Reports OIDC login counts, authentication errors, and keycloak_app pool telemetry.',
        },
      },
      {
        id: 'pgvector_rag',
        title: 'pgvector 0.8.1 (PG16)',
        sub: 'HNSW 1536d · AiTraces',
        icon: 'database',
        x: 36,
        y: 336,
        width: 268,
        height: 64,
        zoneId: 'obs-data',
        inspector: {
          role: isVi ? 'Kho Vector Hybrid RAG & Dấu vết AI' : 'Hybrid RAG Vector & AI Trace Store',
          packageOrPort: 'pgvector/pgvector:0.8.1-pg16@sha256:33198d...',
          protocol: 'PostgreSQL + HNSW · data internal',
          payloadOrSchema: 'latticeParaChunks (1536d) · latticeAiTraces',
          responsibilities: isVi
            ? 'Lưu vector nhúng P.A.R.A. cho tìm kiếm lai HNSW + BM25 RRF cùng nhật ký suy luận và hạn mức token.'
            : 'Stores 1536-dim P.A.R.A. vectors for HNSW + BM25 RRF retrieval alongside AI trace and quota records.',
        },
      },
      {
        id: 'otel_collector',
        title: 'OTel Collector',
        sub: ':4318 OTLP · :8889',
        icon: 'activity',
        x: 604,
        y: 64,
        width: 248,
        height: 64,
        zoneId: 'obs-profile',
        inspector: {
          role: isVi ? 'Bộ thu thập Dấu vết & Chỉ số OTel' : 'OpenTelemetry Collector Contrib',
          packageOrPort: 'otel/opentelemetry-collector-contrib:0.123.0@sha256:e39311...',
          protocol: 'gRPC :4317 · HTTP :4318 · Prom :8889',
          payloadOrSchema: 'read_only: true · otel-collector.yaml:ro',
          responsibilities: isVi
            ? 'Nhận span W3C traceparent từ NocoBase và xuất chỉ số tổng hợp trên cổng 8889 để Prometheus thu thập.'
            : 'Ingests W3C traceparent spans from NocoBase and exposes aggregated span metrics on port 8889.',
        },
      },
      {
        id: 'prometheus',
        title: 'Prometheus 3.3',
        sub: '4 Jobs · 5 Alerts',
        icon: 'cpu',
        x: 604,
        y: 176,
        width: 248,
        height: 64,
        zoneId: 'obs-profile',
        inspector: {
          role: isVi ? 'Hệ thống Thu thập Chuỗi Thời gian' : 'Metrics Scraper & Alert Evaluator',
          packageOrPort: 'prom/prometheus:v3.3.0@sha256:339ce8... · :9090',
          protocol: 'HTTP Scrape · DX_METRICS_TOKEN',
          payloadOrSchema: '4 targets · 5 rules (alerts.yml) · 15d retention',
          responsibilities: isVi
            ? 'Thu thập 4 nguồn (nocobase /api/dxos:metrics, caddy:2020, keycloak:9000, otel-collector:8889) và đánh giá 5 quy tắc cảnh báo RLS/DLQ/5xx.'
            : 'Scrapes 4 targets (nocobase /api/dxos:metrics, caddy:2020, keycloak:9000, otel-collector:8889) and evaluates 5 RLS/DLQ/5xx alert rules.',
        },
      },
      {
        id: 'grafana',
        title: 'Grafana 11.5.8',
        sub: 'latticedx-360.json',
        icon: 'check-circle',
        x: 604,
        y: 336,
        width: 248,
        height: 64,
        zoneId: 'obs-profile',
        inspector: {
          role: isVi ? 'Bảng điều khiển Quan sát Hợp nhất' : 'Provisioned Observability Dashboards',
          packageOrPort: 'grafana/grafana-oss:11.5.8@sha256:b8121d... · :3000',
          protocol: 'PromQL · app + data',
          payloadOrSchema: 'dashboards/latticedx-360.json',
          responsibilities: isVi
            ? 'Hiển thị bảng điều khiển latticedx-360.json dựng sẵn cho thông lượng API, lỗi RLS, hàng đợi Outbox và token AI.'
            : 'Renders the provisioned latticedx-360.json dashboard tracking API latency, RLS errors, outbox backlog, and AI tokens.',
        },
      },
    ],
    edges: [
      {
        id: 'o1',
        from: 'nocobase_obs',
        to: 'gotenberg',
        label: 'PDF',
        kind: 'flow',
        points: [
          [128, 128],
          [128, 176],
        ],
      },
      {
        id: 'o2',
        from: 'nocobase_obs',
        to: 'pgvector_rag',
        label: 'HNSW',
        kind: 'primary',
        points: [
          [204, 128],
          [204, 154],
          [260, 154],
          [260, 336],
        ],
      },
      {
        id: 'o3',
        from: 'nocobase_obs',
        to: 'otel_collector',
        label: 'OTLP',
        kind: 'primary',
        points: [
          [172, 128],
          [172, 144],
          [536, 144],
          [536, 96],
          [604, 96],
        ],
      },
      {
        id: 'o8',
        from: 'nocobase_obs',
        to: 'prometheus',
        label: ':metrics',
        kind: 'primary',
        points: [
          [134, 64],
          [134, 50],
          [568, 50],
          [568, 182],
          [604, 182],
        ],
      },
      {
        id: 'o4',
        from: 'caddy_obs',
        to: 'prometheus',
        label: ':2020',
        kind: 'flow',
        points: [
          [484, 108],
          [542, 108],
          [542, 198],
          [604, 198],
        ],
      },
      {
        id: 'o5',
        from: 'keycloak_obs',
        to: 'prometheus',
        label: ':9000',
        kind: 'flow',
        points: [
          [484, 214],
          [604, 214],
        ],
      },
      {
        id: 'o6',
        from: 'otel_collector',
        to: 'prometheus',
        label: ':8889',
        kind: 'primary',
        points: [
          [728, 128],
          [728, 176],
        ],
      },
      {
        id: 'o7',
        from: 'prometheus',
        to: 'grafana',
        label: 'PromQL',
        kind: 'primary',
        points: [
          [728, 240],
          [728, 336],
        ],
      },
    ],
    steps: [
      {
        id: 'step-otel',
        title: isVi ? 'OTel GenAI & Che PII Trước Xuất' : 'OTel GenAI & Pre-Export PII Scrubbing',
        activeNodes: ['nocobase_obs', 'otel_collector'],
        activeEdges: ['o3'],
        description: isVi
          ? 'NocoBase gom tối đa 256 span (lô 64, xả mỗi 5s), che CCCD/Phone/Bank/MST/JWT/Email rồi đẩy qua OTLP :4318.'
          : 'NocoBase buffers up to 256 spans (batch 64, 5s flush), redacts CCCD/Phone/Bank/MST/JWT/Email, and exports via OTLP :4318.',
        route: 'POST http://otel-collector:4318/v1/traces',
        payload: 'gen_ai.system · gen_ai.request.model · traceparent',
        chips: ['PII Scrubbed', 'profile: observability'],
      },
      {
        id: 'step-prom',
        title: isVi ? 'Thu thập 4 Nguồn & Grafana 360' : '4-Target Prometheus Scrape & Grafana',
        activeNodes: ['nocobase_obs', 'caddy_obs', 'keycloak_obs', 'otel_collector', 'prometheus', 'grafana'],
        activeEdges: ['o8', 'o4', 'o5', 'o6', 'o7'],
        description: isVi
          ? 'Prometheus 3.3 thu thập đủ 4 nguồn: nocobase (/api/dxos:metrics), caddy:2020, keycloak:9000 và otel-collector:8889, cấp dữ liệu cho Grafana.'
          : 'Prometheus 3.3 scrapes all 4 targets: nocobase (/api/dxos:metrics), caddy:2020, keycloak:9000, and otel-collector:8889 for Grafana.',
        route: 'GET /api/dxos:metrics (DX_METRICS_TOKEN)',
        payload: '4 targets · 5 alerts.yml · 15d retention',
        chips: ['latticedx-360.json', '4 Scrape Jobs'],
      },
      {
        id: 'step-pdf-rag',
        title: isVi ? 'Gotenberg PDF & Vector pgvector' : 'Gotenberg PDF & pgvector HNSW Store',
        activeNodes: ['nocobase_obs', 'gotenberg', 'pgvector_rag'],
        activeEdges: ['o1', 'o2'],
        description: isVi
          ? 'Profile pdf chạy Gotenberg tắt JavaScript để xuất chứng từ, còn pgvector 0.8.1 lưu vector 1536 chiều cho Hybrid RAG.'
          : 'The pdf profile runs JS-disabled Gotenberg for voucher exports while pgvector 0.8.1 stores 1536-dim Hybrid RAG embeddings.',
        route: 'http://gotenberg:3000 | pgvector:5432',
        payload: '--chromium-disable-javascript=true · HNSW 1536d',
        chips: ['profile: pdf', 'pgvector 0.8.1'],
      },
    ],
  };

  const iiotN8nMode: DiagramMode = {
    id: 'iiot-n8n',
    label: isVi ? 'IIoT & Integration' : 'IIoT & Integration',
    summary: isVi
      ? 'Mạng iiot-net · Profile iiot + n8n · Orion-LD NGSI-LD · Outbox'
      : 'iiot-net · iiot + n8n profiles · Orion-LD NGSI-LD · Outbox',
    zones: [
      {
        id: 'net-iiot',
        label: isVi ? 'MẠNG IIOT-NET INTERNAL (PROFILE: IIOT)' : 'IIOT-NET INTERNAL (PROFILE: IIOT)',
        x: 16,
        y: 16,
        width: 416,
        height: 152,
        kind: 'traffic',
      },
      {
        id: 'net-app-iiot',
        label: isVi ? 'MẠNG APP INTERNAL (BROKER + ORION-LD)' : 'APP INTERNAL (BROKER + ORION-LD)',
        x: 452,
        y: 16,
        width: 452,
        height: 152,
        kind: 'traffic',
      },
      {
        id: 'net-data-iiot',
        label: isVi ? 'MẠNG DATA INTERNAL (PG16 OUTBOX + MONGO)' : 'DATA INTERNAL (PG16 OUTBOX + MONGO)',
        x: 16,
        y: 224,
        width: 560,
        height: 204,
        kind: 'admin',
      },
      {
        id: 'net-n8n',
        label: isVi ? 'PROFILE: N8N (APP + DATA)' : 'PROFILE: N8N (APP + DATA)',
        x: 616,
        y: 224,
        width: 288,
        height: 204,
        kind: 'external',
      },
    ],
    nodes: [
      {
        id: 'mosquitto',
        title: 'Mosquitto 2.0',
        sub: ':1883 · DynSec',
        icon: 'radio',
        x: 36,
        y: 64,
        width: 156,
        height: 64,
        zoneId: 'net-iiot',
        inspector: {
          role: isVi ? 'Broker MQTT Nội bộ với DynSec' : 'Internal MQTT Broker with DynSec',
          packageOrPort: 'eclipse-mosquitto:2.0.21@sha256:94f5a3... · :1883',
          protocol: 'MQTT 3.1.1/5 · iiot-net internal',
          payloadOrSchema: 'init-dynsec.sh · LWT + ACLs',
          responsibilities: isVi
            ? 'Chỉ gắn vào iiot-net (internal: true), xác thực thiết bị bằng Dynamic Security (DynSec) và xử lý Last Will (LWT).'
            : 'Attached strictly to internal iiot-net, enforcing Dynamic Security (DynSec) ACLs and device LWT status.',
        },
      },
      {
        id: 'nodered',
        title: 'Node-RED 4.0.9',
        sub: ':1880 · @sha256',
        icon: 'cpu',
        x: 248,
        y: 64,
        width: 164,
        height: 64,
        zoneId: 'net-iiot',
        inspector: {
          role: isVi ? 'Cổng Chuẩn hóa & Lệnh Downlink IIoT' : 'IIoT Normalization & Downlink Bridge',
          packageOrPort: 'nodered/node-red:4.0.9@sha256:0b295b... · :1880',
          protocol: 'MQTT <-> HTTP · iiot-net + app',
          payloadOrSchema: 'AES-256-CTR flows_cred.json · /twin/command',
          responsibilities: isVi
            ? 'Chuẩn hóa đo từ xa từ Mosquitto đẩy về NocoBase bằng DX_IIOT_INGEST_TOKEN và nhận lệnh downlink điều khiển thiết bị.'
            : 'Normalizes Mosquitto telemetry into NocoBase via DX_IIOT_INGEST_TOKEN and dispatches /twin/command downlinks.',
        },
      },
      {
        id: 'nocobase_iiot',
        title: 'NocoBase 2.2.50',
        sub: 'dxosBroker · dxosN8n',
        icon: 'layers',
        x: 472,
        y: 64,
        width: 180,
        height: 64,
        zoneId: 'net-app-iiot',
        focal: true,
        inspector: {
          role: isVi ? 'Trung tâm Điều phối IIoT & n8n' : 'IIoT Twin & n8n Orchestration Host',
          packageOrPort: 'nocobase:2.2.50 · SSRF Allowlists',
          protocol: 'HTTP · iiot-net + app + data',
          payloadOrSchema: 'DX_ORION_HOST_ALLOWLIST · DX_NODERED_HOST_ALLOWLIST',
          responsibilities: isVi
            ? 'Kiểm tra allowlist chống SSRF khi gọi Orion-LD/Node-RED, ghi latticeContextOutbox và cầu nối OAuth2 PKCE sang n8n.'
            : 'Enforces SSRF host allowlists for Orion-LD/Node-RED, records latticeContextOutbox, and bridges OAuth2 PKCE to n8n.',
        },
      },
      {
        id: 'orion_ld',
        title: 'Orion-LD 1.12',
        sub: '@sha256 · :1026 NGSI',
        icon: 'plug',
        x: 704,
        y: 64,
        width: 180,
        height: 64,
        zoneId: 'net-app-iiot',
        inspector: {
          role: isVi ? 'Context Broker NGSI-LD FIWARE' : 'FIWARE NGSI-LD Context Broker',
          packageOrPort: 'fiware/orion-ld:1.12.0@sha256:f562a9... · :1026',
          protocol: 'NGSI-LD HTTP · app + data',
          payloadOrSchema: 'Entity upsert & relationship DELETE sync',
          responsibilities: isVi
            ? 'Duy trì thực thể Digital Twin theo chuẩn NGSI-LD từ bộ rút outbox 10s của NocoBase.'
            : 'Maintains NGSI-LD Digital Twin entities synchronized by the 10s NocoBase context outbox drainer.',
        },
      },
      {
        id: 'pg16_outbox',
        title: 'PG16 Outbox',
        sub: 'FOR UPDATE SKIP LOCKED',
        icon: 'database',
        x: 36,
        y: 288,
        width: 236,
        height: 64,
        zoneId: 'net-data-iiot',
        inspector: {
          role: isVi ? 'Hàng đợi Outbox FIFO theo Thực thể' : 'Per-Entity FIFO Transactional Outbox',
          packageOrPort: 'nocobase-db · latticeContextOutbox',
          protocol: 'SQL · FOR UPDATE OF o SKIP LOCKED',
          payloadOrSchema: '10s drainer · 120s stale lock · 5 retries -> dlq',
          responsibilities: isVi
            ? 'Đảm bảo thứ tự FIFO cho từng thực thể twin, tự thu hồi khóa treo quá 120s và đẩy vào DLQ sau 5 lần thử thất bại.'
            : 'Guarantees per-entity FIFO ordering, reclaims locks older than 120s, and moves failed deliveries to DLQ after 5 attempts.',
        },
      },
      {
        id: 'orion_mongo',
        title: 'MongoDB 8.0',
        sub: '@sha256 · SCRAM-SHA',
        icon: 'server',
        x: 320,
        y: 288,
        width: 224,
        height: 64,
        zoneId: 'net-data-iiot',
        inspector: {
          role: isVi ? 'Kho Lưu trữ Orion-LD' : 'Orion-LD Backing Store',
          packageOrPort: 'mongo:8.0@sha256:479e85... · :27017',
          protocol: 'MongoDB Wire · SCRAM-SHA-256 · data internal',
          payloadOrSchema: '1024m / 1.0 CPU · orion-mongo-data',
          responsibilities: isVi
            ? 'Lưu trạng thái thực thể NGSI-LD cho Orion-LD trên mạng data nội bộ với xác thực SCRAM-SHA-256.'
            : 'Persists NGSI-LD entity state for Orion-LD on the internal data network with SCRAM-SHA-256 auth.',
        },
      },
      {
        id: 'n8n_engine',
        title: 'n8n 2.48.1',
        sub: '@sha256 · :5678 REST v1',
        icon: 'workflow',
        x: 656,
        y: 288,
        width: 208,
        height: 64,
        zoneId: 'net-n8n',
        inspector: {
          role: isVi ? 'Động cơ Workflow Tích hợp Ngoài' : 'External Workflow Automation Engine',
          packageOrPort: 'n8nio/n8n:2.48.1@sha256:5e022f... · :5678',
          protocol: 'REST v1 + OAuth2 PKCE · app + data',
          payloadOrSchema: 'DX_N8N_API_URL · n8n_app PG16 DB',
          responsibilities: isVi
            ? 'Chạy trong profile tùy chọn n8n, dùng CSDL riêng n8n_app trên Postgres và kết nối qua cầu nối dxosN8n.'
            : 'Runs under the optional n8n profile with its isolated n8n_app Postgres database, connected via dxosN8n.',
        },
      },
    ],
    edges: [
      { id: 'i1', from: 'mosquitto', to: 'nodered', label: 'MQTT', kind: 'flow' },
      { id: 'i2', from: 'nodered', to: 'nocobase_iiot', label: 'Ingest', kind: 'primary' },
      {
        id: 'i3',
        from: 'nocobase_iiot',
        to: 'nodered',
        label: 'Downlink',
        kind: 'flow',
        points: [
          [500, 128],
          [500, 152],
          [332, 152],
          [332, 128],
        ],
      },
      {
        id: 'i4',
        from: 'nocobase_iiot',
        to: 'pg16_outbox',
        label: 'Outbox',
        kind: 'primary',
        points: [
          [548, 128],
          [548, 184],
          [156, 184],
          [156, 288],
        ],
      },
      { id: 'i5', from: 'nocobase_iiot', to: 'orion_ld', label: 'NGSI', kind: 'primary' },
      {
        id: 'i6',
        from: 'orion_ld',
        to: 'orion_mongo',
        label: 'SCRAM',
        kind: 'flow',
        points: [
          [792, 128],
          [792, 204],
          [432, 204],
          [432, 288],
        ],
      },
      {
        id: 'i7',
        from: 'nocobase_iiot',
        to: 'n8n_engine',
        label: 'REST v1',
        kind: 'dashed',
        points: [
          [596, 128],
          [596, 320],
          [656, 320],
        ],
      },
    ],
    steps: [
      {
        id: 'step-iiot-up',
        title: isVi ? 'Mạng iiot-net -> NocoBase Broker' : 'iiot-net Telemetry to NocoBase',
        activeNodes: ['mosquitto', 'nodered', 'nocobase_iiot'],
        activeEdges: ['i1', 'i2'],
        description: isVi
          ? 'Mosquitto 2.0 (DynSec) cô lập hoàn toàn trên iiot-net chuyển gói MQTT qua Node-RED (AES-256-CTR) về NocoBase.'
          : 'Mosquitto 2.0 (DynSec) isolated on iiot-net forwards telemetry via Node-RED (AES-256-CTR credentials) to NocoBase.',
        route: 'iiot-net (internal: true) -> app',
        payload: 'Authorization: Bearer ${DX_IIOT_INGEST_TOKEN}',
        chips: ['profile: iiot', 'DynSec + LWT'],
      },
      {
        id: 'step-iiot-outbox',
        title: isVi ? 'Đồng bộ Outbox PG16 -> Orion-LD' : 'PG16 Outbox FIFO -> Orion-LD Sync',
        activeNodes: ['nocobase_iiot', 'pg16_outbox', 'orion_ld', 'orion_mongo'],
        activeEdges: ['i4', 'i5', 'i6'],
        description: isVi
          ? 'Bộ rút 10s dùng FOR UPDATE OF o SKIP LOCKED đồng bộ thực thể NGSI-LD sang Orion-LD và MongoDB 8.0 (SCRAM-SHA-256).'
          : 'The 10s drainer uses FOR UPDATE OF o SKIP LOCKED to sync NGSI-LD entities to Orion-LD and MongoDB 8.0 (SCRAM-SHA-256).',
        route: 'http://orion-ld:1026 | latticeContextOutbox',
        payload: "eventId = 'native-' + sha256(projection) · 120s stale reclaim",
        chips: ['FOR UPDATE SKIP LOCKED', 'Per-Entity FIFO'],
      },
      {
        id: 'step-iiot-down',
        title: isVi ? 'Lệnh Downlink & Cầu nối n8n' : 'Digital-Twin Downlink & n8n Bridge',
        activeNodes: ['nocobase_iiot', 'nodered', 'n8n_engine'],
        activeEdges: ['i3', 'i7'],
        description: isVi
          ? 'NocoBase kiểm tra SSRF allowlist trước khi gửi lệnh /twin/command tới Node-RED hoặc kích hoạt luồng ngoài qua profile n8n.'
          : 'NocoBase validates SSRF allowlists before sending /twin/command downlinks to Node-RED or dispatching flows to the n8n profile.',
        route: 'http://nodered:1880/twin/command | http://n8n:5678/api/v1',
        payload: 'DX_NODERED_HOST_ALLOWLIST · DX_N8N_API_URL',
        chips: ['SSRF Guard', 'profile: n8n'],
      },
    ],
  };

  return [coreEdgeMode, aiObsMode, iiotN8nMode];
});
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 960 444"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
