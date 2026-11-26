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
    ? 'Kiến trúc Zero-Trust Ingress & PostgreSQL 16 FORCE RLS'
    : 'Zero-Trust Ingress & PostgreSQL 16 FORCE RLS',
);

const caption = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Mỗi yêu cầu đi qua Caddy TLS, APISIX JWT/Rate-Limit và Keycloak OIDC/PKCE trước khi cầu nối AsyncLocalStorage gắn app.current_org (hoặc app.rls_bypass) ở phạm vi giao dịch dưới vai trò nocobase_app (NOSUPERUSER NOBYPASSRLS) trên 56 bảng tĩnh và bảng động.'
    : 'Every request traverses Caddy TLS, APISIX JWT/rate-limit, and Keycloak OIDC/PKCE before the AsyncLocalStorage transaction bridge binds transaction-local app.current_org (or app.rls_bypass) under nocobase_app (NOSUPERUSER NOBYPASSRLS) across 56 static and dynamic tables.',
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const tenantMode: DiagramMode = {
    id: 'tenant-rls',
    label: isVi ? 'Luồng Tenant & FORCE RLS' : 'Tenant Flow & FORCE RLS',
    summary: isVi
      ? 'set_config(app.current_org, ..., true) · 56 bảng + động'
      : 'set_config(app.current_org, ..., true) · 56 static + dynamic',
    zones: [
      {
        id: 'edge-identity',
        label: isVi ? 'MẶT PHẲNG BIÊN & ĐỊNH DANH (EDGE + OIDC)' : 'EDGE & IDENTITY PLANE (CADDY / APISIX / KEYCLOAK)',
        x: 16,
        y: 16,
        width: 888,
        height: 144,
        kind: 'admin',
      },
      {
        id: 'host-rls',
        label: isVi ? 'VÙNG THỰC THI NOCOBASE & CÔ LẬP PG16 FORCE RLS' : 'NOCOBASE HOST & PG16 FORCE RLS ISOLATION ZONE',
        x: 16,
        y: 204,
        width: 888,
        height: 224,
        kind: 'traffic',
      },
    ],
    nodes: [
      {
        id: 'caddy',
        title: 'Caddy 2.10',
        sub: ':443 · TLS + HSTS',
        icon: 'globe',
        x: 36,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'edge-identity',
        inspector: {
          role: isVi ? 'Biên TLS & Tiêu đề Bảo mật' : 'Edge TLS & Security Header Proxy',
          packageOrPort: 'caddy:2.10-alpine · :80/:443',
          protocol: 'HTTPS / HTTP/3 · TLS 1.3',
          payloadOrSchema: 'HSTS 2y preload · nosniff · -Server',
          responsibilities: isVi
            ? 'Kết thúc TLS cho LATTICE_DOMAIN và KEYCLOAK_DOMAIN, xóa header Server, gắn HSTS/Permissions-Policy và chuyển tiếp /api/* tới APISIX.'
            : 'Terminates TLS for LATTICE_DOMAIN and KEYCLOAK_DOMAIN, strips Server header, injects HSTS/Permissions-Policy, and proxies /api/* to APISIX.',
        },
      },
      {
        id: 'apisix',
        title: 'APISIX 3.19',
        sub: ':9080 · JWKS/Limit',
        icon: 'shield',
        x: 264,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'edge-identity',
        inspector: {
          role: isVi ? 'Cổng API Zero-Trust' : 'Zero-Trust API Gateway',
          packageOrPort: 'apache/apisix:3.19.0 · :9080',
          protocol: 'HTTP · OIDC JWKS + Redis Limit',
          payloadOrSchema: 'X-Request-Id · 120/240/300 req/60s',
          responsibilities: isVi
            ? 'Gắn X-Request-Id, kiểm soát CORS nghiêm ngặt theo LATTICE_ALLOWED_ORIGIN, giới hạn tốc độ bằng Valkey và xác thực JWKS trên tuyến OIDC.'
            : 'Attaches X-Request-Id, enforces strict CORS via LATTICE_ALLOWED_ORIGIN, applies Valkey-backed rate limits, and validates JWKS on OIDC routes.',
        },
      },
      {
        id: 'keycloak',
        title: 'Keycloak 26.8',
        sub: 'OIDC · PKCE S256',
        icon: 'key',
        x: 492,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'edge-identity',
        inspector: {
          role: isVi ? 'Nhà cung cấp Định danh OIDC' : 'Enterprise OIDC Identity Provider',
          packageOrPort: 'quay.io/keycloak/keycloak:26.8.2',
          protocol: 'OIDC · Authorization Code + PKCE S256',
          payloadOrSchema: 'realm: lattice · dx-native / dx-gateway',
          responsibilities: isVi
            ? 'Xác thực người dùng với khóa brute-force (5 lần sai), TOTP OTP và mật khẩu tối thiểu 12 ký tự; cấp JWT và sự kiện backchannelLogout.'
            : 'Authenticates users with brute-force lockout (5 failures), TOTP MFA, and 12-char password policy; issues JWTs and backchannelLogout events.',
        },
      },
      {
        id: 'valkey2',
        title: 'Valkey 8.1 DB2',
        sub: 'DB2 · state/ticket',
        icon: 'lock',
        x: 716,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'edge-identity',
        inspector: {
          role: isVi ? 'Kho Phiên & Thu hồi OIDC' : 'OIDC State & Revocation Store',
          packageOrPort: 'valkey/valkey:8.1-alpine · :6379/2',
          protocol: 'RESP · DX_NATIVE_AUTH_SESSION_REDIS_URL',
          payloadOrSchema: 'state: 300s · ticket: 60s · revoked: 24h',
          responsibilities: isVi
            ? 'Lưu PKCE code_verifier (300s), ticket đổi phiên một lần (60s) và danh sách revoked/revoked_sid (24h) cho createRevocationGuard.'
            : 'Stores PKCE state (300s TTL), one-time session exchange tickets (60s TTL), and revoked/revoked_sid entries (24h TTL) for createRevocationGuard.',
        },
      },
      {
        id: 'nocobase',
        title: 'NocoBase Host',
        sub: 'v2.2.50 · 7 Plugins',
        icon: 'layers',
        x: 256,
        y: 232,
        width: 184,
        height: 64,
        zoneId: 'host-rls',
        inspector: {
          role: isVi ? 'Máy chủ Ứng dụng & Enterprise Auth' : 'Host Runtime & Enterprise Auth',
          packageOrPort: 'nocobase/nocobase:2.2.50 · :80',
          protocol: 'HTTP · enterpriseAuth + native-scope',
          payloadOrSchema: 'DX_PG_RLS_SESSION=true · orgId scope',
          responsibilities: isVi
            ? 'Đổi ticket OIDC thành phiên, chặn leo thang vai trò ldx_admin/allowConfigure/pm* trong ánh xạ nhóm và khóa phân trang/filter bất hợp lệ.'
            : 'Exchanges OIDC tickets for sessions, blocks ldx_admin/allowConfigure/pm* group-role escalation, and guards query pagination and filters.',
        },
      },
      {
        id: 'als_bridge',
        title: 'ALS Tx Bridge',
        sub: 'set_config(...,true)',
        icon: 'git-branch',
        x: 520,
        y: 232,
        width: 192,
        height: 64,
        zoneId: 'host-rls',
        inspector: {
          role: isVi ? 'Cầu nối Giao dịch AsyncLocalStorage' : 'AsyncLocalStorage Transaction Bridge',
          packageOrPort: '@latticedx/plugin-lattice-foundation · pg-rls.js',
          protocol: 'Sequelize Tx · AsyncLocalStorage',
          payloadOrSchema: "set_config('app.current_org', :orgId, true)",
          responsibilities: isVi
            ? 'Bọc Repository.prototype.*, sequelize.query và db.getRepository(); dùng is_local=true để PostgreSQL tự xóa GUC khi kết thúc giao dịch.'
            : 'Wraps Repository.prototype.*, sequelize.query, and db.getRepository(); uses is_local=true so PostgreSQL resets GUC on commit or rollback.',
        },
      },
      {
        id: 'nocobase_app',
        title: 'nocobase_app',
        sub: 'NOBYPASSRLS Role',
        icon: 'terminal',
        x: 520,
        y: 344,
        width: 192,
        height: 64,
        zoneId: 'host-rls',
        inspector: {
          role: isVi ? 'Vai trò Runtime Không Đặc quyền' : 'Least-Privilege Runtime DB Role',
          packageOrPort: 'init-nocobase-db.sh · NOCOBASE_APP_DB_USER',
          protocol: 'PostgreSQL Wire · TLS / SCRAM-SHA-256',
          payloadOrSchema: 'NOSUPERUSER NOCREATEDB NOINHERIT NOBYPASSRLS',
          responsibilities: isVi
            ? 'Tách biệt với superuser khởi tạo (nocobase/postgres); ngay cả khi sở hữu schema public, NOBYPASSRLS buộc mọi truy vấn phải qua chính sách RLS.'
            : 'Separated from bootstrap superuser (nocobase/postgres); even as public schema owner, NOBYPASSRLS forces every query through RLS policies.',
        },
      },
      {
        id: 'pg16_rls',
        title: 'PG16 FORCE RLS',
        sub: '56 Static + Custom',
        icon: 'database',
        x: 244,
        y: 344,
        width: 208,
        height: 64,
        zoneId: 'host-rls',
        focal: true,
        inspector: {
          role: isVi ? 'Thực thi Cô lập Đa Tổ chức' : 'Multi-Tenant Row Isolation Engine',
          packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · :5432',
          protocol: 'SQL · ENABLE + FORCE ROW LEVEL SECURITY',
          payloadOrSchema: 'lattice_tenant_isolation · organizationId / organization_id',
          responsibilities: isVi
            ? 'Áp dụng FORCE RLS trên 54 bảng camelCase, 2 bảng đính kèm snake_case và mọi bảng động latticeCustom*; từ chối truy cập nếu thiếu app.current_org.'
            : 'Enforces FORCE RLS on 54 camelCase tables, 2 snake_case attachment tables, and dynamic latticeCustom* tables; fails closed without app.current_org.',
        },
      },
    ],
    edges: [
      { id: 'e1', from: 'caddy', to: 'apisix', label: 'HTTPS', kind: 'primary' },
      { id: 'e2', from: 'apisix', to: 'keycloak', label: 'JWKS', kind: 'flow' },
      { id: 'e3', from: 'keycloak', to: 'valkey2', label: 'PKCE', kind: 'flow' },
      { id: 'e4', from: 'apisix', to: 'nocobase', label: 'X-Req-Id', kind: 'primary' },
      {
        id: 'e5',
        from: 'nocobase',
        to: 'valkey2',
        label: 'DB 2 Auth',
        kind: 'flow',
        points: [
          [404, 232],
          [404, 180],
          [800, 180],
          [800, 120],
        ],
      },
      { id: 'e6', from: 'nocobase', to: 'als_bridge', label: 'Tx Scope', kind: 'primary' },
      { id: 'e7', from: 'als_bridge', to: 'nocobase_app', label: 'set_config', kind: 'primary' },
      { id: 'e8', from: 'nocobase_app', to: 'pg16_rls', label: 'RLS', kind: 'primary' },
    ],
    steps: [
      {
        id: 'step-edge',
        title: isVi ? 'Biên TLS & Kiểm soát APISIX' : 'Edge TLS & APISIX Guard',
        activeNodes: ['caddy', 'apisix'],
        activeEdges: ['e1'],
        description: isVi
          ? 'Caddy kết thúc TLS 1.3 và gắn tiêu đề bảo mật; APISIX gắn X-Request-Id, kiểm tra CORS và đếm giới hạn tốc độ trên Valkey.'
          : 'Caddy terminates TLS 1.3 with strict security headers; APISIX injects X-Request-Id, validates CORS, and enforces Valkey rate limits.',
        route: 'HTTPS https://${LATTICE_DOMAIN}/api/*',
        payload: 'X-Request-Id + limit-count (120/240/300 req/60s)',
        chips: ['TLS 1.3', 'Zero-Trust Edge'],
      },
      {
        id: 'step-oidc',
        title: isVi ? 'Xác thực OIDC PKCE & Valkey DB 2' : 'OIDC PKCE & Valkey DB 2',
        activeNodes: ['apisix', 'keycloak', 'valkey2', 'nocobase'],
        activeEdges: ['e2', 'e3', 'e4', 'e5'],
        description: isVi
          ? 'Keycloak xác thực PKCE S256 cho client dx-native; plugin-enterprise-auth lưu state (300s), ticket (60s) và trạng thái thu hồi (24h) trong Valkey DB 2.'
          : 'Keycloak executes PKCE S256 for dx-native; plugin-enterprise-auth tracks state (300s), single-use ticket (60s), and revocations (24h) in Valkey DB 2.',
        route: 'GET /api/enterpriseAuth:start -> :callback -> POST :finish',
        payload: 'code_challenge_method=S256 · HttpOnly ldx_enterprise_binding',
        chips: ['PKCE S256', 'Valkey DB 2'],
      },
      {
        id: 'step-als',
        title: isVi ? 'Gắn app.current_org theo Giao dịch' : 'Transaction-Local GUC Binding',
        activeNodes: ['nocobase', 'als_bridge'],
        activeEdges: ['e6'],
        description: isVi
          ? 'withTenantRlsContext mở giao dịch Sequelize và truyền qua AsyncLocalStorage tới mọi truy vấn con, tránh rò rỉ GUC sang kết nối pool khác.'
          : 'withTenantRlsContext opens a Sequelize transaction and propagates it via AsyncLocalStorage to nested repository queries, preventing pool leakage.',
        route: 'withTenantRlsContext(orgId, fn)',
        payload: "SELECT set_config('app.current_org', :orgId, true);",
        chips: ['AsyncLocalStorage', 'is_local=true'],
      },
      {
        id: 'step-role',
        title: isVi ? 'Thực thi dưới Role nocobase_app' : 'Execution under nocobase_app',
        activeNodes: ['als_bridge', 'nocobase_app'],
        activeEdges: ['e7'],
        description: isVi
          ? 'Kết nối ứng dụng chạy dưới vai trò nocobase_app (NOSUPERUSER NOBYPASSRLS), đảm bảo không thể bỏ qua FORCE ROW LEVEL SECURITY.'
          : 'Application queries execute as nocobase_app (NOSUPERUSER NOBYPASSRLS), ensuring FORCE ROW LEVEL SECURITY cannot be bypassed.',
        route: 'NOCOBASE_APP_DB_USER=nocobase_app',
        payload: 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
        chips: ['NOBYPASSRLS', 'Least Privilege'],
      },
      {
        id: 'step-rls',
        title: isVi ? 'Chính sách FORCE RLS trên 56+ Bảng' : 'FORCE RLS across 56+ Tables',
        activeNodes: ['nocobase_app', 'pg16_rls'],
        activeEdges: ['e8'],
        description: isVi
          ? 'PostgreSQL 16 đối chiếu organizationId (54 bảng) và organization_id (2 bảng đính kèm) cùng các bảng động latticeCustom* theo lattice_tenant_isolation.'
          : 'PostgreSQL 16 evaluates organizationId (54 tables), organization_id (2 attachment tables), and dynamic latticeCustom* tables against lattice_tenant_isolation.',
        route: 'POLICY lattice_tenant_isolation ON public."<table>"',
        payload: '"organizationId" = nullif(current_setting(\'app.current_org\', true), \'\')',
        chips: ['56 Static Tables', 'Dynamic latticeCustom*'],
      },
    ],
  };

  const bypassMode: DiagramMode = {
    id: 'bypass-keys',
    label: isVi ? 'API Key ldx_pat_* & System Bypass' : 'ldx_pat_* Keys & System Bypass',
    summary: isVi
      ? 'SHA-256 timingSafeEqual · SAVEPOINT ldx_sp_<n> · app.rls_bypass'
      : 'SHA-256 timingSafeEqual · SAVEPOINT ldx_sp_<n> · app.rls_bypass',
    zones: [
      {
        id: 'caller-zone',
        label: isVi ? 'MẶT PHẲNG XÁC THỰC API KEY & TÁC VỤ HỆ THỐNG' : 'API KEY VERIFICATION & SYSTEM CALLER PLANE',
        x: 16,
        y: 16,
        width: 888,
        height: 144,
        kind: 'admin',
      },
      {
        id: 'savepoint-zone',
        label: isVi ? 'VÙNG SAVEPOINT & KIỂM SOÁT BYPASS CÓ PHẠM VI' : 'SAVEPOINT & SCOPED BYPASS ISOLATION ZONE',
        x: 16,
        y: 204,
        width: 888,
        height: 224,
        kind: 'traffic',
      },
    ],
    nodes: [
      {
        id: 'client_pat',
        title: 'API Client',
        sub: 'X-Lattice-API-Key',
        icon: 'terminal',
        x: 36,
        y: 56,
        width: 176,
        height: 64,
        zoneId: 'caller-zone',
        inspector: {
          role: isVi ? 'Máy khách Tích hợp Bên ngoài' : 'External Integration Client',
          packageOrPort: 'HTTPS · X-Lattice-API-Key | Bearer',
          protocol: 'REST / OpenAPI 3.1 / MCP',
          payloadOrSchema: 'ldx_pat_<8hex>_<32hex>',
          responsibilities: isVi
            ? 'Gửi khóa cá nhân ldx_pat_* được cấp một lần khi tạo; hỗ trợ 7 phạm vi read, write, wms, dmn, iot, ai và ledger.'
            : 'Presents scoped ldx_pat_* tokens returned once at creation; supports 7 scopes: read, write, wms, dmn, iot, ai, and ledger.',
        },
      },
      {
        id: 'apisix_gw',
        title: 'APISIX 3.19',
        sub: ':9080 · Limit-Count',
        icon: 'shield',
        x: 268,
        y: 56,
        width: 176,
        height: 64,
        zoneId: 'caller-zone',
        inspector: {
          role: isVi ? 'Cổng Giới hạn & Định tuyến' : 'Rate-Limiting Gateway',
          packageOrPort: 'apache/apisix:3.19.0 · :9080',
          protocol: 'HTTP · limit-count (Valkey)',
          payloadOrSchema: 'X-Request-Id · per-IP window',
          responsibilities: isVi
            ? 'Áp đặt ngưỡng lưu lượng theo IP và chuyển tiếp header xác thực sang middleware NocoBase.'
            : 'Applies per-IP rate limiting and forwards authentication headers upstream to NocoBase middleware.',
        },
      },
      {
        id: 'pat_guard',
        title: 'PAT Verifier',
        sub: 'SHA-256 · Clamp Role',
        icon: 'key',
        x: 500,
        y: 56,
        width: 184,
        height: 64,
        zoneId: 'caller-zone',
        inspector: {
          role: isVi ? 'Bộ kiểm tra Khóa PaaS' : 'Scoped PaaS Key Verifier',
          packageOrPort: 'paas-api-keys.js · latticeApiKeys',
          protocol: 'SHA-256 · timingSafeEqualHex',
          payloadOrSchema: 'clampHeaderRole · expiresInDays 1..365',
          responsibilities: isVi
            ? 'Đối chiếu keyHash bằng timingSafeEqualHex, chặn truy vấn trực tiếp bảng latticeApiKeys và dùng clampHeaderRole ngăn leo thang vai trò.'
            : 'Verifies SHA-256 keyHash via timingSafeEqualHex, blocks generic REST access to latticeApiKeys, and enforces clampHeaderRole against escalation.',
        },
      },
      {
        id: 'system_worker',
        title: 'Outbox / Cron',
        sub: 'withSystemRlsBypass',
        icon: 'workflow',
        x: 720,
        y: 56,
        width: 168,
        height: 64,
        zoneId: 'caller-zone',
        inspector: {
          role: isVi ? 'Tác vụ Hệ thống Liên tổ chức' : 'Cross-Tenant System Worker',
          packageOrPort: 'pg-rls.js · outbox / SLA drainer',
          protocol: 'Internal Scheduler (10s / 60s)',
          payloadOrSchema: "set_config('app.rls_bypass', 'on', true)",
          responsibilities: isVi
            ? 'Chạy các tác vụ nền (outbox, SLA, boot) trong giao dịch ngắn; lưu và khôi phục current_setting(app.rls_bypass, true) sau khi xong.'
            : 'Runs background drainers (outbox, SLA, bootstrap) inside short transactions; saves and restores current_setting(app.rls_bypass, true).',
        },
      },
      {
        id: 'als_bypass',
        title: 'Savepoint Bridge',
        sub: 'ldx_sp_<n> · Bypass',
        icon: 'git-branch',
        x: 496,
        y: 232,
        width: 204,
        height: 64,
        zoneId: 'savepoint-zone',
        inspector: {
          role: isVi ? 'Quản lý Savepoint & GUC Nội bộ' : 'Savepoint & Scoped GUC Controller',
          packageOrPort: 'pg-rls.js · runInRlsSavepoint',
          protocol: 'SQL SAVEPOINT + AsyncLocalStorage',
          payloadOrSchema: 'SAVEPOINT "ldx_sp_<n>" · app.rls_bypass',
          responsibilities: isVi
            ? 'Cô lập lỗi truy vấn tùy chọn bằng ROLLBACK TO SAVEPOINT để tránh lỗi 25P02 làm hỏng cả giao dịch RLS đang mở.'
            : 'Isolates optional query failures with ROLLBACK TO SAVEPOINT so PostgreSQL 25P02 aborted-transaction errors never poison active RLS transactions.',
        },
      },
      {
        id: 'nocobase_role',
        title: 'nocobase_app',
        sub: 'NOBYPASSRLS Role',
        icon: 'terminal',
        x: 496,
        y: 344,
        width: 204,
        height: 64,
        zoneId: 'savepoint-zone',
        inspector: {
          role: isVi ? 'Vai trò Thực thi Cơ sở dữ liệu' : 'Runtime Database Role',
          packageOrPort: 'init-nocobase-db.sh · NOCOBASE_APP_DB_USER',
          protocol: 'PostgreSQL Wire · Non-Superuser',
          payloadOrSchema: 'NOSUPERUSER NOBYPASSRLS',
          responsibilities: isVi
            ? 'Chỉ chấp nhận mở rộng phạm vi khi hàm ứng dụng chủ động thiết lập app.rls_bypass=on trong giao dịch nội bộ.'
            : 'Permits cross-tenant visibility strictly when application code explicitly sets transaction-local app.rls_bypass=on.',
        },
      },
      {
        id: 'pg16_policies',
        title: 'PG16 FORCE RLS',
        sub: '56 Static + Custom',
        icon: 'database',
        x: 200,
        y: 344,
        width: 224,
        height: 64,
        zoneId: 'savepoint-zone',
        focal: true,
        inspector: {
          role: isVi ? 'Chính sách Cô lập Bảng Dữ liệu' : 'Table Isolation Policy Engine',
          packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · :5432',
          protocol: 'SQL · lattice_tenant_isolation',
          payloadOrSchema: "app.rls_bypass = 'on' OR app.current_org = '*'",
          responsibilities: isVi
            ? 'Kiểm tra nhánh app.rls_bypass hoặc khớp organizationId / organization_id; mọi thao tác ghi cũng phải thỏa mệnh đề WITH CHECK.'
            : 'Evaluates app.rls_bypass or matches organizationId / organization_id; writes must also satisfy the identical WITH CHECK expression.',
        },
      },
    ],
    edges: [
      { id: 'b1', from: 'client_pat', to: 'apisix_gw', label: 'ldx_pat', kind: 'flow' },
      { id: 'b2', from: 'apisix_gw', to: 'pat_guard', label: 'Proxy', kind: 'flow' },
      {
        id: 'b3',
        from: 'pat_guard',
        to: 'als_bypass',
        label: 'orgId',
        kind: 'flow',
        points: [
          [592, 120],
          [592, 176],
          [568, 176],
          [568, 232],
        ],
      },
      {
        id: 'b4',
        from: 'system_worker',
        to: 'als_bypass',
        label: 'Bypass',
        kind: 'primary',
        points: [
          [804, 120],
          [804, 180],
          [648, 180],
          [648, 232],
        ],
      },
      { id: 'b5', from: 'als_bypass', to: 'nocobase_role', label: 'SAVEPOINT', kind: 'primary' },
      { id: 'b6', from: 'nocobase_role', to: 'pg16_policies', label: 'FORCE RLS', kind: 'primary' },
    ],
    steps: [
      {
        id: 'step-pat',
        title: isVi ? 'Xác thực Khóa ldx_pat_* Thời gian Hằng' : 'Constant-Time ldx_pat_* Verification',
        activeNodes: ['client_pat', 'apisix_gw', 'pat_guard'],
        activeEdges: ['b1', 'b2'],
        description: isVi
          ? 'PAT Verifier băm khóa bằng SHA-256, so sánh với latticeApiKeys bằng timingSafeEqualHex và giới hạn quyền theo vai trò gắn với khóa.'
          : 'PAT Verifier hashes the token with SHA-256, compares against latticeApiKeys via timingSafeEqualHex, and clamps header role escalation.',
        route: 'Authorization: Bearer ldx_pat_<8hex>_<32hex>',
        payload: '7 scopes: read | write | wms | dmn | iot | ai | ledger',
        chips: ['timingSafeEqualHex', '60s lastUsedAt throttle'],
      },
      {
        id: 'step-bypass',
        title: isVi ? 'Mở app.rls_bypass Có Phạm vi Giao dịch' : 'Transaction-Scoped app.rls_bypass',
        activeNodes: ['system_worker', 'als_bypass'],
        activeEdges: ['b4'],
        description: isVi
          ? 'Các bộ rút outbox và SLA dùng withSystemRlsBypass để bật app.rls_bypass=on cục bộ và khôi phục giá trị trước đó khi hoàn tất.'
          : 'Background outbox and SLA workers use withSystemRlsBypass to enable app.rls_bypass=on locally and restore the prior setting on completion.',
        route: 'withSystemRlsBypass(fn)',
        payload: "SELECT set_config('app.rls_bypass', 'on', true);",
        chips: ['Tx-Local', 'Auto-Reset'],
      },
      {
        id: 'step-savepoint',
        title: isVi ? 'Cô lập Truy vấn Tùy chọn bằng Savepoint' : 'Savepoint Isolation & Policy Check',
        activeNodes: ['als_bypass', 'nocobase_role', 'pg16_policies'],
        activeEdges: ['b3', 'b5', 'b6'],
        description: isVi
          ? 'runInRlsSavepoint bọc truy vấn bằng SAVEPOINT "ldx_sp_<n>" trước khi nocobase_app đánh giá chính sách lattice_tenant_isolation trên PG16.'
          : 'runInRlsSavepoint wraps optional queries in SAVEPOINT "ldx_sp_<n>" while nocobase_app evaluates lattice_tenant_isolation on PG16.',
        route: 'SAVEPOINT "ldx_sp_<n>" -> RELEASE / ROLLBACK TO SAVEPOINT',
        payload: 'USING + WITH CHECK on 56 static + latticeCustom* tables',
        chips: ['No 25P02 Poison', 'WITH CHECK'],
      },
    ],
  };

  return [tenantMode, bypassMode];
});
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 920 444"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
