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
        width: 928,
        height: 144,
        kind: 'admin',
      },
      {
        id: 'host-rls',
        label: isVi ? 'VÙNG THỰC THI NOCOBASE & CÔ LẬP PG16 FORCE RLS' : 'NOCOBASE HOST & PG16 FORCE RLS ISOLATION ZONE',
        x: 16,
        y: 204,
        width: 928,
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
      ? 'PAT -> app.current_org (Tenant) vs System Worker -> app.rls_bypass=on (Tx nội bộ)'
      : 'PAT -> app.current_org (Tenant) vs System Worker -> app.rls_bypass=on (Internal Tx)',
    zones: [
      {
        id: 'caller-zone',
        label: isVi ? 'XÁC THỰC API KEY (TENANT) VS TÁC VỤ HỆ THỐNG (INTERNAL TX)' : 'API KEY (TENANT-SCOPED) VS SYSTEM WORKER (INTERNAL TX ONLY)',
        x: 16,
        y: 16,
        width: 928,
        height: 144,
        kind: 'admin',
      },
      {
        id: 'savepoint-zone',
        label: isVi ? 'ALS TX & SAVEPOINT GUARD (RUNINRLSSAVEPOINT)' : 'ALS TX & SAVEPOINT GUARD (RUNINRLSSAVEPOINT)',
        x: 16,
        y: 204,
        width: 928,
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
        x: 28,
        y: 56,
        width: 160,
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
        x: 260,
        y: 56,
        width: 172,
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
        sub: 'app.current_org',
        icon: 'key',
        x: 500,
        y: 56,
        width: 180,
        height: 64,
        zoneId: 'caller-zone',
        inspector: {
          role: isVi ? 'Xác thực Khóa PaaS Phạm vi Tenant (Không Bypass)' : 'Tenant-Scoped PaaS Key Verifier (No Bypass)',
          packageOrPort: 'paas-api-keys.js · latticeApiKeys',
          protocol: 'SHA-256 · timingSafeEqualHex',
          payloadOrSchema: "set_config('app.current_org', key.organizationId, true)",
          responsibilities: isVi
            ? 'Đối chiếu keyHash bằng timingSafeEqualHex, gắn app.current_org đúng tổ chức sở hữu khóa và dùng clampHeaderRole ngăn leo thang vai trò.'
            : 'Verifies SHA-256 keyHash via timingSafeEqualHex, binds tenant-scoped app.current_org (never rls_bypass), and clamps role escalation.',
        },
      },
      {
        id: 'system_worker',
        title: 'System Worker',
        sub: 'app.rls_bypass=on',
        icon: 'workflow',
        x: 744,
        y: 56,
        width: 184,
        height: 64,
        zoneId: 'caller-zone',
        inspector: {
          role: isVi ? 'Tác vụ Hệ thống Nội bộ (Chỉ trong Giao dịch nội bộ)' : 'Cross-Tenant System Worker (Internal Tx Only)',
          packageOrPort: 'pg-rls.js · withSystemRlsBypass',
          protocol: 'Internal Scheduler (10s / 60s)',
          payloadOrSchema: "set_config('app.rls_bypass', 'on', true)",
          responsibilities: isVi
            ? 'Chỉ dùng cho tác vụ nền nội bộ (outbox, SLA, boot) trong giao dịch ngắn; lưu và khôi phục current_setting(app.rls_bypass, true) ngay sau khi xong.'
            : 'Restricted strictly to internal background drainers (outbox, SLA, bootstrap) inside short transactions with automatic GUC restore.',
        },
      },
      {
        id: 'als_bypass',
        title: 'ALS Tx & Savepoint Guard',
        sub: 'runInRlsSavepoint · GUC',
        icon: 'git-branch',
        x: 492,
        y: 232,
        width: 256,
        height: 64,
        zoneId: 'savepoint-zone',
        inspector: {
          role: isVi ? 'Bộ điều phối Giao dịch AsyncLocalStorage & Savepoint' : 'AsyncLocalStorage Tx & Savepoint Guard',
          packageOrPort: 'pg-rls.js · runInRlsSavepoint',
          protocol: 'SQL SAVEPOINT + AsyncLocalStorage',
          payloadOrSchema: 'SAVEPOINT "ldx_sp_<n>" · app.current_org | app.rls_bypass',
          responsibilities: isVi
            ? 'Truyền ngữ cảnh app.current_org (PAT/User) hoặc app.rls_bypass=on (System Worker) trong AsyncLocalStorage và bọc truy vấn tùy chọn bằng SAVEPOINT ldx_sp_<n> để tránh lỗi 25P02.'
            : 'Propagates tenant-scoped app.current_org or internal-only app.rls_bypass=on in AsyncLocalStorage and isolates optional queries with SAVEPOINT ldx_sp_<n>.',
        },
      },
      {
        id: 'nocobase_role',
        title: 'nocobase_app',
        sub: 'NOBYPASSRLS Role',
        icon: 'terminal',
        x: 492,
        y: 344,
        width: 256,
        height: 64,
        zoneId: 'savepoint-zone',
        inspector: {
          role: isVi ? 'Vai trò Thực thi Cơ sở dữ liệu' : 'Runtime Database Role',
          packageOrPort: 'init-nocobase-db.sh · NOCOBASE_APP_DB_USER',
          protocol: 'PostgreSQL Wire · Non-Superuser',
          payloadOrSchema: 'NOSUPERUSER NOBYPASSRLS',
          responsibilities: isVi
            ? 'Tài khoản không đặc quyền; mọi truy vấn PAT chỉ thấy đúng tenant app.current_org, chỉ mở phạm vi liên tổ chức khi System Worker bật app.rls_bypass=on.'
            : 'Non-superuser role: PAT queries remain strictly scoped to app.current_org unless an internal System Worker sets transaction-local app.rls_bypass=on.',
        },
      },
      {
        id: 'pg16_policies',
        title: 'PG16 FORCE RLS',
        sub: '56 Static + Custom',
        icon: 'database',
        x: 164,
        y: 344,
        width: 236,
        height: 64,
        zoneId: 'savepoint-zone',
        focal: true,
        inspector: {
          role: isVi ? 'Chính sách Cô lập Bảng Dữ liệu' : 'Table Isolation Policy Engine',
          packageOrPort: 'pgvector/pgvector:0.8.1-pg16 · :5432',
          protocol: 'SQL · lattice_tenant_isolation',
          payloadOrSchema: "app.current_org OR (internal app.rls_bypass = 'on')",
          responsibilities: isVi
            ? 'Kiểm tra khớp organizationId / organization_id theo app.current_org, hoặc nhánh app.rls_bypass=on cho tác vụ hệ thống nội bộ; mọi ghi đều qua WITH CHECK.'
            : 'Matches organizationId / organization_id against app.current_org, or permits internal app.rls_bypass=on; writes enforce the identical WITH CHECK rule.',
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
        label: 'app.current_org',
        kind: 'flow',
        points: [
          [590, 120],
          [590, 232],
        ],
      },
      {
        id: 'b4',
        from: 'system_worker',
        to: 'als_bypass',
        label: 'rls_bypass=on',
        kind: 'primary',
        points: [
          [836, 120],
          [836, 184],
          [704, 184],
          [704, 232],
        ],
      },
      { id: 'b5', from: 'als_bypass', to: 'nocobase_role', label: 'SAVEPOINT', kind: 'primary' },
      { id: 'b6', from: 'nocobase_role', to: 'pg16_policies', label: 'FORCE RLS', kind: 'primary' },
    ],
    steps: [
      {
        id: 'step-pat',
        title: isVi ? 'PAT Verifier -> app.current_org (Tenant)' : 'PAT Verifier -> app.current_org (Tenant Scoped)',
        activeNodes: ['client_pat', 'apisix_gw', 'pat_guard', 'als_bypass'],
        activeEdges: ['b1', 'b2', 'b3'],
        description: isVi
          ? 'PAT Verifier băm khóa bằng SHA-256 (timingSafeEqualHex), chặn leo thang vai trò và truyền app.current_org theo tenant vào ALS Tx & Savepoint Guard (không bao giờ bật bypass).'
          : 'PAT Verifier hashes ldx_pat_* via SHA-256 (timingSafeEqualHex), clamps roles, and binds tenant-scoped app.current_org into ALS Tx & Savepoint Guard.',
        route: 'Authorization: Bearer ldx_pat_<8hex>_<32hex>',
        payload: "set_config('app.current_org', :orgId, true) · 7 scopes",
        chips: ['Tenant Scoped', 'timingSafeEqualHex'],
      },
      {
        id: 'step-bypass',
        title: isVi ? 'System Worker -> app.rls_bypass=on (Tx Nội bộ)' : 'System Worker -> app.rls_bypass=on (Internal Tx)',
        activeNodes: ['system_worker', 'als_bypass'],
        activeEdges: ['b4'],
        description: isVi
          ? 'Chỉ các worker nền nội bộ (outbox, SLA) mới dùng withSystemRlsBypass để bật app.rls_bypass=on trong giao dịch ngắn và tự khôi phục khi xong.'
          : 'Only internal background workers (outbox, SLA) use withSystemRlsBypass to enable app.rls_bypass=on locally for the duration of a short transaction.',
        route: 'withSystemRlsBypass(fn) -> ALS Tx Guard',
        payload: "SELECT set_config('app.rls_bypass', 'on', true);",
        chips: ['Internal Tx Only', 'Auto-Reset'],
      },
      {
        id: 'step-savepoint',
        title: isVi ? 'runInRlsSavepoint & Chính sách PG16' : 'runInRlsSavepoint & PG16 FORCE RLS',
        activeNodes: ['als_bypass', 'nocobase_role', 'pg16_policies'],
        activeEdges: ['b5', 'b6'],
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
    viewBox="0 0 960 444"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
