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
    ? 'Luồng Yêu cầu Đa Tenant & PostgreSQL 16 FORCE RLS'
    : 'Multi-Tenant Request Pipeline & PostgreSQL 16 FORCE RLS',
);

const caption = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Mọi yêu cầu người dùng hoặc khóa ldx_pat_* đều qua Caddy, APISIX và middleware NocoBase để gắn app.current_org (is_local=true) trong AsyncLocalStorage và thực thi dưới vai trò nocobase_app (NOSUPERUSER NOBYPASSRLS) trên 56 bảng tĩnh và bảng động latticeCustom*. Chỉ các tác vụ nền nội bộ mới dùng withSystemRlsBypass.'
    : 'Every user request or ldx_pat_* token traverses Caddy, APISIX, and NocoBase scope middleware to bind transaction-local app.current_org (is_local=true) via AsyncLocalStorage and execute as nocobase_app (NOSUPERUSER NOBYPASSRLS) across 56 static and dynamic latticeCustom* tables. Only internal background workers use withSystemRlsBypass.',
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const tenantMode: DiagramMode = {
    id: 'tenant-rls',
    label: isVi ? 'Luồng Tenant & FORCE RLS' : 'Tenant Request & FORCE RLS Pipeline',
    viewBox: '0 0 1200 336',
    zones: [
      {
        id: 'edge-identity',
        label: isVi ? 'MẶT PHẲNG BIÊN & CỔNG API' : 'EDGE & IDENTITY PLANE',
        x: 16,
        y: 16,
        width: 406,
        height: 156,
        kind: 'admin',
      },
      {
        id: 'host-rls',
        label: isVi ? 'HOST TRANSACTION & CÔ LẬP PG16 FORCE RLS' : 'HOST TRANSACTION & PG16 FORCE RLS ISOLATION',
        x: 476,
        y: 16,
        width: 708,
        height: 304,
        kind: 'traffic',
      },
    ],
    nodes: [
      {
        id: 'req_in',
        title: isVi ? 'Yêu cầu Client' : 'Client Request',
        sub: ['OIDC · Bearer JWT', 'ldx_pat_* API Key'],
        icon: 'globe',
        x: 28,
        y: 54,
        width: 160,
        height: 92,
        zoneId: 'edge-identity',
        inspector: {
          role: isVi ? 'Nguồn Yêu cầu Đầu vào' : 'Inbound Authenticated Request',
          packageOrPort: 'HTTPS :443 · /p/* · /api/* · /v1/*',
          protocol: 'OIDC Cookie | Bearer JWT | X-Lattice-API-Key',
          payloadOrSchema: 'ldx_pat_<8hex>_<32hex> | Session Ticket',
          responsibilities: isVi
            ? 'Tiếp nhận phiên OIDC, JWT hoặc khóa API theo tenant ldx_pat_* (luôn gắn app.current_org, không bao giờ bật rls_bypass).'
            : 'Carries an OIDC session, Bearer JWT, or tenant-scoped ldx_pat_* token (always bound to app.current_org, never rls_bypass).',
        },
      },
      {
        id: 'edge_gw',
        title: 'Caddy 2.10 + APISIX 3.19',
        sub: ['TLS 1.3 · JWKS', 'Valkey Rate Limit'],
        icon: 'shield',
        x: 242,
        y: 54,
        width: 168,
        height: 92,
        zoneId: 'edge-identity',
        inspector: {
          role: isVi ? 'Biên TLS & Cổng API Zero-Trust' : 'Edge TLS & Zero-Trust API Gateway',
          packageOrPort: 'caddy:2.10-alpine (:443) · apisix:3.19.0 (:9080)',
          protocol: 'TLS 1.3 · HSTS · OIDC JWKS · Valkey limit-count',
          payloadOrSchema: 'X-Request-Id · 120/240/300 req/60s',
          responsibilities: isVi
            ? 'Chấm dứt TLS, xóa header Server, kiểm tra CORS/JWKS, gắn X-Request-Id và giới hạn lưu lượng theo IP qua Valkey.'
            : 'Terminates TLS 1.3, strips Server headers, validates CORS/JWKS, injects X-Request-Id, and enforces Valkey rate limits.',
        },
      },
      {
        id: 'nb_auth',
        title: isVi ? 'NocoBase Auth & Scope' : 'NocoBase Auth & Scope',
        sub: ['PKCE · Valkey DB 2', 'Resolve tenant orgId'],
        icon: 'key',
        x: 488,
        y: 54,
        width: 172,
        height: 92,
        zoneId: 'host-rls',
        inspector: {
          role: isVi ? 'Middleware Xác thực & Phạm vi Tenant' : 'Host Auth & Tenant Scope Middleware',
          packageOrPort: 'plugin-enterprise-auth · native-scope.js · paas-api-keys.js',
          protocol: 'HTTP · PKCE S256 · SHA-256 timingSafeEqualHex',
          payloadOrSchema: 'DX_PG_RLS_SESSION=true · validated orgId',
          responsibilities: isVi
            ? 'Xác thực OIDC hoặc ldx_pat_*, kiểm tra thu hồi phiên trên Valkey DB 2, chặn leo thang vai trò và trích xuất orgId hợp lệ.'
            : 'Verifies OIDC tickets or ldx_pat_* keys against Valkey DB 2 revocations, clamps role escalation, and resolves validated orgId.',
        },
      },
      {
        id: 'idp_valkey',
        title: 'Keycloak 26.8 + Valkey DB 2',
        sub: ['PKCE S256 (300s / 60s)', 'Revocation Guard (24h)'],
        icon: 'lock',
        x: 478,
        y: 214,
        width: 192,
        height: 86,
        zoneId: 'host-rls',
        inspector: {
          role: isVi ? 'Nhà cung cấp OIDC & Kho Thu hồi Phiên' : 'OIDC Identity Provider & Session Revocation Store',
          packageOrPort: 'keycloak:26.8.2 · valkey:8.1-alpine (:6379/2)',
          protocol: 'OIDC PKCE S256 · RESP DB 2',
          payloadOrSchema: 'state: 300s · ticket: 60s · revoked/revoked_sid: 24h',
          responsibilities: isVi
            ? 'Cấp mã OIDC PKCE S256 với khóa brute-force, đồng thời lưu state, ticket dùng một lần và danh sách thu hồi trong Valkey DB 2.'
            : 'Executes PKCE S256 login with brute-force lockout while storing state, single-use exchange tickets, and 24h revocations in Valkey DB 2.',
        },
      },
      {
        id: 'als_tx',
        title: 'AsyncLocalStorage Tx',
        sub: ['withTenantRlsContext', 'SET LOCAL', 'app.current_org'],
        icon: 'git-branch',
        x: 714,
        y: 54,
        width: 176,
        height: 92,
        zoneId: 'host-rls',
        inspector: {
          role: isVi ? 'Cầu nối Giao dịch AsyncLocalStorage' : 'AsyncLocalStorage Transaction Bridge',
          packageOrPort: '@latticedx/plugin-lattice-foundation · pg-rls.js',
          protocol: 'Sequelize Transaction · AsyncLocalStorage',
          payloadOrSchema: "SELECT set_config('app.current_org', :orgId, true)",
          responsibilities: isVi
            ? 'Mở giao dịch qua withTenantRlsContext, truyền ngữ cảnh qua AsyncLocalStorage tới mọi truy vấn ORM/SQL và dùng is_local=true để tự xóa khi COMMIT/ROLLBACK.'
            : 'Opens a Sequelize transaction via withTenantRlsContext, propagates it via AsyncLocalStorage to nested queries, and uses is_local=true so pool connections never leak GUCs.',
        },
      },
      {
        id: 'pg16_rls',
        title: 'PostgreSQL 16 FORCE RLS',
        sub: ['Role: nocobase_app', 'NOBYPASSRLS', '56 + Custom Tables'],
        icon: 'database',
        x: 982,
        y: 54,
        width: 190,
        height: 92,
        zoneId: 'host-rls',
        focal: true,
        inspector: {
          role: isVi ? 'Công cụ Cô lập Hàng PG16 (Role nocobase_app)' : 'PG16 Row Isolation Engine (Role nocobase_app)',
          packageOrPort: 'pgvector/pgvector:0.8.1-pg16 (:5432) · NOCOBASE_APP_DB_USER=nocobase_app',
          protocol: 'ENABLE + FORCE ROW LEVEL SECURITY · NOSUPERUSER NOBYPASSRLS',
          payloadOrSchema: 'Policy lattice_tenant_isolation (USING & WITH CHECK · 56 static + latticeCustom*)',
          responsibilities: isVi
            ? 'Kết nối bằng role nocobase_app (NOSUPERUSER NOBYPASSRLS); buộc mọi SELECT/INSERT/UPDATE/DELETE trên 54 bảng camelCase, 2 bảng snake_case và bảng động latticeCustom* khớp app.current_org.'
            : 'Connects as nocobase_app (NOSUPERUSER NOBYPASSRLS); enforces lattice_tenant_isolation USING & WITH CHECK across 54 camelCase tables, 2 snake_case attachment tables, and dynamic latticeCustom* tables.',
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        from: 'req_in',
        to: 'edge_gw',
        label: 'HTTPS',
        kind: 'primary',
        points: [
          [188, 100],
          [242, 100],
        ],
      },
      {
        id: 'e2',
        from: 'edge_gw',
        to: 'nb_auth',
        label: 'X-Req-Id',
        kind: 'primary',
        points: [
          [410, 100],
          [488, 100],
        ],
      },
      {
        id: 'e3',
        from: 'nb_auth',
        to: 'idp_valkey',
        label: 'PKCE / Revoked',
        kind: 'flow',
        points: [
          [574, 146],
          [574, 214],
        ],
      },
      {
        id: 'e4',
        from: 'nb_auth',
        to: 'als_tx',
        label: 'orgId',
        kind: 'primary',
        points: [
          [660, 100],
          [714, 100],
        ],
      },
      {
        id: 'e5',
        from: 'als_tx',
        to: 'pg16_rls',
        label: 'BEGIN + GUC',
        kind: 'primary',
        points: [
          [890, 100],
          [982, 100],
        ],
      },
    ],
    steps: [
      {
        id: 'step-edge',
        title: isVi ? 'Biên TLS & APISIX' : 'Edge TLS & APISIX',
        activeNodes: ['req_in', 'edge_gw'],
        activeEdges: ['e1'],
        description: isVi
          ? 'Caddy chấm dứt TLS 1.3 với HSTS; APISIX gắn X-Request-Id, kiểm tra CORS/JWKS và áp đặt giới hạn lưu lượng qua Valkey.'
          : 'Caddy terminates TLS 1.3 with strict HSTS; APISIX injects X-Request-Id, checks CORS/JWKS, and enforces Valkey rate limits.',
        route: 'HTTPS -> Caddy 2.10 -> APISIX 3.19',
        payload: 'X-Request-Id + limit-count (120/240/300 req/60s)',
        chips: ['TLS 1.3', 'Zero-Trust Edge'],
      },
      {
        id: 'step-oidc',
        title: isVi ? 'OIDC / PAT Scope & Valkey DB 2' : 'OIDC / PAT Scope & Valkey DB 2',
        activeNodes: ['edge_gw', 'nb_auth', 'idp_valkey'],
        activeEdges: ['e2', 'e3'],
        description: isVi
          ? 'NocoBase Auth & Scope đối chiếu OIDC PKCE (Keycloak + Valkey DB 2) hoặc băm SHA-256 khóa ldx_pat_* để xác định tenant orgId.'
          : 'NocoBase Auth & Scope resolves tenant orgId via Keycloak PKCE (backed by Valkey DB 2) or SHA-256 verification of ldx_pat_* tokens.',
        route: 'enterpriseAuth:callback | paas-api-keys.js -> orgId',
        payload: 'state: 300s · ticket: 60s · revoked: 24h',
        chips: ['PKCE S256', 'Valkey DB 2', 'ldx_pat_* -> orgId'],
      },
      {
        id: 'step-als',
        title: 'withTenantRlsContext (is_local=true)',
        activeNodes: ['nb_auth', 'als_tx'],
        activeEdges: ['e4'],
        description: isVi
          ? 'withTenantRlsContext mở giao dịch Sequelize, gắn set_config(\'app.current_org\', :orgId, true) và lan truyền qua AsyncLocalStorage.'
          : 'withTenantRlsContext opens a Sequelize transaction, runs set_config(\'app.current_org\', :orgId, true), and propagates it via AsyncLocalStorage.',
        route: 'withTenantRlsContext(db, orgId, fn)',
        payload: "SELECT set_config('app.current_org', :orgId, true);",
        chips: ['AsyncLocalStorage', 'is_local=true'],
      },
      {
        id: 'step-rls',
        title: isVi ? 'nocobase_app & lattice_tenant_isolation' : 'nocobase_app & FORCE RLS Policy',
        activeNodes: ['als_tx', 'pg16_rls'],
        activeEdges: ['e5'],
        description: isVi
          ? 'Truy vấn thực thi dưới vai trò nocobase_app (NOSUPERUSER NOBYPASSRLS); PostgreSQL 16 kiểm tra USING và WITH CHECK trên 56 bảng tĩnh + latticeCustom*.'
          : 'Queries execute under nocobase_app (NOSUPERUSER NOBYPASSRLS); PostgreSQL 16 evaluates USING and WITH CHECK across 56 static + dynamic latticeCustom* tables.',
        route: 'POLICY lattice_tenant_isolation ON public."<table>"',
        payload: '"organizationId" = nullif(current_setting(\'app.current_org\', true), \'\')',
        chips: ['NOBYPASSRLS', '56 Static + Custom'],
      },
    ],
  };

  const workerMode: DiagramMode = {
    id: 'workers-savepoint',
    label: isVi ? 'Worker Nội bộ & Savepoint Guard' : 'Internal Workers & Savepoint Guard',
    viewBox: '0 0 1080 300',
    zones: [
      {
        id: 'worker-bypass-zone',
        label: isVi
          ? 'BYPASS PHẠM VI HỆ THỐNG — CHỈ DÀNH CHO WORKER NỀN NỘI BỘ (KHÔNG BAO GIỜ CHO LDX_PAT_*)'
          : 'SCOPED SYSTEM WORKER BYPASS — INTERNAL BACKGROUND TX ONLY (NEVER USER / PAT REQUESTS)',
        x: 16,
        y: 14,
        width: 1048,
        height: 124,
        kind: 'admin',
      },
      {
        id: 'savepoint-zone',
        label: isVi
          ? 'CÔ LẬP LỖI SAVEPOINT — NGĂN NHIỄM ĐỘC GIAO DỊCH 25P02'
          : 'SAVEPOINT ERROR ISOLATION — PREVENTS 25P02 TX POISONING',
        x: 16,
        y: 158,
        width: 1048,
        height: 124,
        kind: 'traffic',
      },
    ],
    nodes: [
      {
        id: 'sys_worker',
        title: isVi ? 'Worker Nội bộ' : 'Internal Worker',
        sub: ['Outbox · SLA · Bootstrap', isVi ? 'Không dùng cho ldx_pat_*' : 'Never user / ldx_pat_*'],
        icon: 'workflow',
        x: 32,
        y: 50,
        width: 272,
        height: 72,
        zoneId: 'worker-bypass-zone',
        inspector: {
          role: isVi ? 'Tác vụ Nền Hệ thống Nội bộ' : 'Internal System Background Worker',
          packageOrPort: 'event-bus.js · sla-monitor · bootstrap',
          protocol: 'Internal Scheduler (10s / 60s)',
          payloadOrSchema: 'Outbox drain · Pre-tenant lookup · Seeding',
          responsibilities: isVi
            ? 'Chỉ dùng cho các drainer nội bộ (outbox, SLA, bootstrap). Mọi khóa API ldx_pat_* của người dùng/đối tác đều bị ràng buộc vào tenant app.current_org.'
            : 'Restricted solely to internal system tasks (outbox drain, SLA check, seeding). Tenant ldx_pat_* API keys always use withTenantRlsContext, never rls_bypass.',
        },
      },
      {
        id: 'sys_tx',
        title: 'withSystemRlsBypass',
        sub: ["SET LOCAL app.rls_bypass = 'on'", isVi ? 'Tự lưu & khôi phục GUC cũ' : 'Saves & restores prior GUC'],
        icon: 'shield',
        x: 404,
        y: 50,
        width: 272,
        height: 72,
        zoneId: 'worker-bypass-zone',
        inspector: {
          role: isVi ? 'Bao bọc Giao dịch Bypass Có Kiểm soát' : 'Controlled System Bypass Transaction Wrapper',
          packageOrPort: 'pg-rls.js · withSystemRlsBypass(db, fn)',
          protocol: 'AsyncLocalStorage · Transaction-Local GUC',
          payloadOrSchema: "SELECT set_config('app.rls_bypass', 'on', true)",
          responsibilities: isVi
            ? 'Đọc current_setting(\'app.rls_bypass\', true) trước đó, bật \'on\' cục bộ trong giao dịch ngắn và khôi phục trong khối finally.'
            : 'Reads prior app.rls_bypass state, sets transaction-local \'on\' for a short scoped callback, and restores the prior GUC in a finally block.',
        },
      },
      {
        id: 'pg_sys',
        title: isVi ? 'Giao dịch Ngắn PG16' : 'PG16 Short Transaction',
        sub: ['nocobase_app (NOBYPASSRLS)', isVi ? 'Tự đặt lại khi Commit/Rollback' : 'Auto-reset on Commit / Rollback'],
        icon: 'database',
        x: 776,
        y: 50,
        width: 272,
        height: 72,
        zoneId: 'worker-bypass-zone',
        focal: true,
        inspector: {
          role: isVi ? 'Thực thi Ngắn Hạn trên PostgreSQL 16' : 'PostgreSQL 16 Short-Lived Scoped Execution',
          packageOrPort: 'pgvector:0.8.1-pg16 · nocobase_app',
          protocol: 'BEGIN ... COMMIT / ROLLBACK (is_local=true)',
          payloadOrSchema: "current_setting('app.rls_bypass', true) = 'on'",
          responsibilities: isVi
            ? 'Cho phép tác vụ hệ thống đọc/ghi liên tổ chức trong giao dịch ngắn và tự động xóa GUC khi giao dịch kết thúc.'
            : 'Permits bounded cross-tenant system queries inside the short transaction and guarantees PostgreSQL resets the GUC at transaction end.',
        },
      },
      {
        id: 'opt_query',
        title: isVi ? 'Truy vấn Tùy chọn trong Tx' : 'Optional Query in Tx',
        sub: [isVi ? 'Bên trong giao dịch RLS hiện hành' : 'Inside active RLS transaction', isVi ? 'Cô lập lỗi SQL tùy chọn' : 'Guards against SQL error'],
        icon: 'terminal',
        x: 32,
        y: 194,
        width: 272,
        height: 72,
        zoneId: 'savepoint-zone',
        inspector: {
          role: isVi ? 'Truy vấn Phụ Tùy chọn Trong Giao dịch' : 'Optional Fallback Query Inside Active Tx',
          packageOrPort: 'pg-rls.js · ORM / Metadata Probe',
          protocol: 'Sequelize Transaction Context',
          payloadOrSchema: 'Optional lookup that may raise SQL error',
          responsibilities: isVi
            ? 'Khi một truy vấn tùy chọn (vd kiểm tra bảng hoặc fallback) gặp lỗi trong PostgreSQL, giao dịch ngoài sẽ rơi vào trạng thái 25P02 nếu không có SAVEPOINT.'
            : 'Without a SAVEPOINT, any SQL error in an optional probe aborts the entire outer PostgreSQL transaction with SQLSTATE 25P02.',
        },
      },
      {
        id: 'sp_guard',
        title: 'runInRlsSavepoint',
        sub: ['SAVEPOINT "ldx_sp_<n>"', isVi ? 'Cô lập lỗi từng câu lệnh' : 'Isolates statement failure'],
        icon: 'git-branch',
        x: 404,
        y: 194,
        width: 272,
        height: 72,
        zoneId: 'savepoint-zone',
        focal: true,
        inspector: {
          role: isVi ? 'Bộ bảo vệ Savepoint Chống Lỗi 25P02' : '25P02 Transaction Poisoning Guard',
          packageOrPort: 'pg-rls.js · runInRlsSavepoint(db, fn)',
          protocol: 'PostgreSQL SAVEPOINT / RELEASE / ROLLBACK TO',
          payloadOrSchema: 'SAVEPOINT "ldx_sp_<counter>"',
          responsibilities: isVi
            ? 'Tạo điểm lưu tuần tự ldx_sp_<n> quanh truy vấn tùy chọn để lỗi cục bộ không làm hỏng toàn bộ giao dịch RLS của tenant.'
            : 'Wraps optional sub-queries in sequential SAVEPOINT "ldx_sp_<n>" frames so a localized error never aborts the surrounding tenant RLS transaction.',
        },
      },
      {
        id: 'pg_sp',
        title: isVi ? 'Phục hồi An toàn PG16' : 'PG16 Safe Recovery',
        sub: ['RELEASE SAVEPOINT on OK', 'ROLLBACK TO SAVEPOINT on Err'],
        icon: 'check-circle',
        x: 776,
        y: 194,
        width: 272,
        height: 72,
        zoneId: 'savepoint-zone',
        inspector: {
          role: isVi ? 'Trạng thái Giao dịch Ngoài Nguyên vẹn' : 'Intact Outer Tenant Transaction State',
          packageOrPort: 'PostgreSQL 16 Transaction Manager',
          protocol: 'RELEASE SAVEPOINT | ROLLBACK TO SAVEPOINT',
          payloadOrSchema: 'Outer app.current_org Tx remains committable',
          responsibilities: isVi
            ? 'Giải phóng savepoint khi thành công hoặc quay lui đúng điểm lưu khi có lỗi, giữ nguyên ngữ cảnh app.current_org của giao dịch ngoài.'
            : 'Releases the savepoint on success or rolls back solely to the savepoint on error, keeping the outer app.current_org transaction healthy.',
        },
      },
    ],
    edges: [
      {
        id: 'w1',
        from: 'sys_worker',
        to: 'sys_tx',
        label: 'Internal Tx',
        kind: 'primary',
        points: [
          [304, 86],
          [404, 86],
        ],
      },
      {
        id: 'w2',
        from: 'sys_tx',
        to: 'pg_sys',
        label: 'Short Tx',
        kind: 'primary',
        points: [
          [676, 86],
          [776, 86],
        ],
      },
      {
        id: 'w3',
        from: 'opt_query',
        to: 'sp_guard',
        label: 'Wrap Query',
        kind: 'flow',
        points: [
          [304, 230],
          [404, 230],
        ],
      },
      {
        id: 'w4',
        from: 'sp_guard',
        to: 'pg_sp',
        label: 'No 25P02',
        kind: 'primary',
        points: [
          [676, 230],
          [776, 230],
        ],
      },
    ],
    steps: [
      {
        id: 'step-worker-bypass',
        title: isVi ? 'withSystemRlsBypass (Worker Nội bộ)' : 'withSystemRlsBypass (Internal Workers)',
        activeNodes: ['sys_worker', 'sys_tx', 'pg_sys'],
        activeEdges: ['w1', 'w2'],
        description: isVi
          ? 'Chỉ các worker nền nội bộ (outbox, SLA, bootstrap) mới dùng withSystemRlsBypass để đặt app.rls_bypass=\'on\' cục bộ trong giao dịch ngắn; mọi token ldx_pat_* đều chạy theo luồng app.current_org.'
          : 'Only internal background workers (outbox, SLA, bootstrap) call withSystemRlsBypass to set transaction-local app.rls_bypass=\'on\'; ldx_pat_* requests always use tenant app.current_org.',
        route: 'Internal Worker -> withSystemRlsBypass -> PG16 Short Tx',
        payload: "SELECT set_config('app.rls_bypass', 'on', true);",
        chips: ['Internal Tx Only', 'Auto-Reset', 'No ldx_pat_* Mix'],
      },
      {
        id: 'step-savepoint-guard',
        title: isVi ? 'runInRlsSavepoint (Chống 25P02)' : 'runInRlsSavepoint (25P02 Guard)',
        activeNodes: ['opt_query', 'sp_guard', 'pg_sp'],
        activeEdges: ['w3', 'w4'],
        description: isVi
          ? 'runInRlsSavepoint bọc truy vấn tùy chọn bằng SAVEPOINT "ldx_sp_<n>" để nếu có lỗi SQL thì chỉ quay lui về savepoint, không làm hỏng giao dịch RLS ngoài.'
          : 'runInRlsSavepoint wraps optional queries in SAVEPOINT "ldx_sp_<n>" so localized SQL failures roll back only to the savepoint instead of aborting the outer transaction (25P02).',
        route: 'SAVEPOINT "ldx_sp_<n>" -> RELEASE / ROLLBACK TO SAVEPOINT',
        payload: 'Outer app.current_org transaction stays valid',
        chips: ['No 25P02 Poison', 'Sequential Savepoints'],
      },
    ],
  };

  return [tenantMode, workerMode];
});
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 1200 336"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
