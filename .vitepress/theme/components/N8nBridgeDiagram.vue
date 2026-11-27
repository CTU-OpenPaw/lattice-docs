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
    ? 'Cầu nối Stock n8n REST v1, Vault OAuth2 PKCE & Outbox EventBus'
    : 'Stock n8n REST v1 Bridge, OAuth2 PKCE Vault & EventBus Outbox',
);

const caption = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Chuyển chế độ để xem quy trình mã hóa Vault / bắt tay OAuth2 PKCE S256 đồng bộ sang Stock n8n REST v1 (:5678) và hàng đợi Outbox PG16 chuẩn Standard Webhooks.'
    : 'Switch views to inspect Connector Vault / two-phase OAuth2 PKCE S256 syncing with Stock n8n REST v1 (:5678) and the PG16 Standard Webhooks outbox.',
);

const modes = computed<DiagramMode[]>(() => {
  if (resolvedLang.value === 'vi') {
    return [
      {
        id: 'vault-n8n-sync',
        label: 'Connector Vault & Stock n8n REST v1',
        viewBox: '0 0 1160 356',
        zones: [
          {
            id: 'vault-lane',
            label: 'Nhánh 1: Connector Vault & OAuth2 PKCE S256',
            x: 12,
            y: 20,
            width: 668,
            height: 140,
            kind: 'admin',
          },
          {
            id: 'n8n-lane',
            label: 'Nhánh 2: Cầu nối Studio & Stock n8n 2.48.1',
            x: 246,
            y: 192,
            width: 902,
            height: 148,
            kind: 'traffic',
          },
        ],
        nodes: [
          {
            id: 'vault-enc',
            title: 'Kho Vault Mã hóa',
            sub: ['AES-256-GCM (iv:tag)', 'DX_VAULT_MASTER_KEY'],
            icon: 'lock',
            x: 24,
            y: 56,
            width: 176,
            height: 88,
            zoneId: 'vault-lane',
            inspector: {
              role: 'Lưu trữ bí mật connector mã hóa theo tenant',
              packageOrPort: '@latticedx/plugin-dxos-studio · connector-vault.js',
              protocol: 'AES-256-GCM · SHA-256 Derived Key · FORCE RLS',
              payloadOrSchema: 'latticeConnectors · dxosVault:{list,save,rotateSecret,testConnection}',
              responsibilities:
                'Chặn CRUD trực tiếp vào latticeConnectors; mã hóa toàn bộ khóa bí mật và token OAuth2 theo định dạng iv:tag:cipher.',
            },
          },
          {
            id: 'pkce-tx',
            title: 'OAuth2 PKCE S256\n(2 Pha)',
            sub: ['TX1 Tiêu thụ Nonce', 'HTTP -> TX2 Mã hóa'],
            icon: 'key',
            x: 258,
            y: 56,
            width: 176,
            height: 88,
            zoneId: 'vault-lane',
            focal: true,
            inspector: {
              role: 'Bắt tay RFC 7636 PKCE S256 tách giao dịch CSDL',
              packageOrPort: 'connector-vault.js · oauthStart / oauthCallback',
              protocol: "TX1 SELECT FOR UPDATE -> fetch(redirect:'error') -> TX2",
              payloadOrSchema: '32B verifier · 24B hex stateNonce (TTL 15m)',
              responsibilities:
                'Tiêu thụ nonce dùng một lần tại TX1, gọi đổi authorization_code ngoài DB transaction (timeout 10s), rồi mã hóa token tại TX2.',
            },
          },
          {
            id: 'token-refresh',
            title: 'Làm mới (Đệm 180s)',
            sub: ['180s trước hết hạn', 'WeakMap Chống trùng'],
            icon: 'activity',
            x: 492,
            y: 56,
            width: 176,
            height: 88,
            zoneId: 'vault-lane',
            inspector: {
              role: 'Làm mới OAuth2 token đơn luồng trước khi hết hạn',
              packageOrPort: 'connector-vault.js · getFreshConnectorToken',
              protocol: 'dbInflightTokenRefresh WeakMap · 180s Buffer',
              payloadOrSchema: 'expiresAt - now <= 180s -> refresh_token',
              responsibilities:
                'Gộp các yêu cầu đồng thời trên cùng (organizationId, connectorId) vào một Promise duy nhất và lưu token mới về Vault.',
            },
          },
          {
            id: 'dxos-n8n',
            title: 'Cầu nối dxosN8n',
            sub: ['SSRF Host Allowlist', 'Idempotency-Key'],
            icon: 'workflow',
            x: 258,
            y: 232,
            width: 176,
            height: 88,
            zoneId: 'n8n-lane',
            focal: true,
            inspector: {
              role: 'Cổng quản trị workflow & ánh xạ 11 loại connector',
              packageOrPort: '@latticedx/plugin-dxos-studio · n8n-api-client.js',
              protocol: 'Admin + PAT Scope · assertSafeConnectorUrlAsync',
              payloadOrSchema: 'buildCredentialPayloadFromConnector · Idempotency-Key',
              responsibilities:
                'Kiểm tra SSRF/DNS allowlist, gắn Idempotency-Key, che bí mật lỗi bằng scrubN8nSecrets và ánh xạ payload credential.',
            },
          },
          {
            id: 'n8n-api',
            title: 'Stock n8n REST v1',
            sub: [':5678 /api/v1/', 'creds · workflows'],
            icon: 'server',
            x: 492,
            y: 232,
            width: 176,
            height: 88,
            zoneId: 'n8n-lane',
            dashed: true,
            inspector: {
              role: 'Container n8n chuẩn tách biệt trên mạng nội bộ app',
              packageOrPort: 'n8nio/n8n:2.48.1 (profile: n8n) · :5678',
              protocol: 'REST v1 · X-N8N-API-KEY · /healthz',
              payloadOrSchema: '/api/v1/credentials · /api/v1/workflows · /activate',
              responsibilities:
                'Nhận credential đã đồng bộ (trả n8nCredentialId), lưu định nghĩa workflow và bật/tắt luồng trên container độc lập.',
            },
          },
          {
            id: 'n8n-exec',
            title: 'Chạy & Thử lại n8n',
            sub: ['/api/v1/executions', ':retryExecution'],
            icon: 'plug',
            x: 726,
            y: 232,
            width: 176,
            height: 88,
            zoneId: 'n8n-lane',
            dashed: true,
            inspector: {
              role: 'Thực thi workflow n8n & hỗ trợ chạy lại khi lỗi',
              packageOrPort: 'dxosN8n:{executions, retryExecution}',
              protocol: 'REST v1 · GET /executions · POST /retry',
              payloadOrSchema: '{ workflowId, executionId, loadWorkflow }',
              responsibilities:
                'Theo dõi lịch sử chạy trên stock n8n, kích hoạt thử lại từ bản ghi lỗi và phát callback kết quả có ký số.',
            },
          },
          {
            id: 'ingress-cb',
            title: 'Nhận Callback Ký số',
            sub: [':webhookIngress', 'HMAC-SHA256 Verified'],
            icon: 'radio',
            x: 960,
            y: 232,
            width: 176,
            height: 88,
            zoneId: 'n8n-lane',
            inspector: {
              role: 'Đón phản hồi đã xác thực chữ ký về LatticeFlow v2',
              packageOrPort: 'dxosAutomations:webhookIngress',
              protocol: 'HMAC-SHA256 | Standard Webhooks | timingSafeEqualHex',
              payloadOrSchema: 'X-Lattice-Signature-256: sha256=<hex>',
              responsibilities:
                'Xác minh chữ ký đầu vào hằng-thời-gian và khởi chạy quy trình LatticeFlow v2 nhận kết quả từ n8n.',
            },
          },
        ],
        edges: [
          {
            id: 'v1',
            from: 'vault-enc',
            to: 'pkce-tx',
            label: 'pkce',
            kind: 'flow',
            points: [
              [200, 100],
              [258, 100],
            ],
          },
          {
            id: 'v2',
            from: 'pkce-tx',
            to: 'token-refresh',
            label: 'token',
            kind: 'primary',
            points: [
              [434, 100],
              [492, 100],
            ],
          },
          {
            id: 'v3',
            from: 'vault-enc',
            to: 'dxos-n8n',
            label: 'secrets',
            kind: 'flow',
            labelPosition: 0.68,
            points: [
              [112, 144],
              [112, 276],
              [258, 276],
            ],
          },
          {
            id: 'v4',
            from: 'token-refresh',
            to: 'n8n-api',
            label: 'OAuth2',
            kind: 'dashed',
            labelPosition: 0.36,
            points: [
              [580, 144],
              [580, 232],
            ],
          },
          {
            id: 'v5',
            from: 'dxos-n8n',
            to: 'n8n-api',
            label: 'REST',
            kind: 'primary',
            points: [
              [434, 276],
              [492, 276],
            ],
          },
          {
            id: 'v6',
            from: 'n8n-api',
            to: 'n8n-exec',
            label: 'run',
            kind: 'flow',
            points: [
              [668, 276],
              [726, 276],
            ],
          },
          {
            id: 'v7',
            from: 'n8n-exec',
            to: 'ingress-cb',
            label: 'HMAC',
            kind: 'primary',
            points: [
              [902, 276],
              [960, 276],
            ],
          },
        ],
        steps: [
          {
            id: 'ns1',
            title: 'Kho Vault AES-256-GCM & Bắt tay PKCE S256',
            activeNodes: ['vault-enc', 'pkce-tx', 'token-refresh'],
            activeEdges: ['v1', 'v2'],
            description:
              'Kho Vault mã hóa bí mật, chạy OAuth2 PKCE S256 hai pha (TX1 -> HTTP -> TX2) và tự làm mới trong đệm 180 giây.',
            route: 'dxosVault:{oauthStart, oauthCallback} · getFreshConnectorToken',
            payload: 'AES-256-GCM · dbInflightTokenRefresh WeakMap',
            chips: ['Two-Phase PKCE', '180s Refresh'],
          },
          {
            id: 'ns2',
            title: 'Đồng bộ Credential & Workflow REST v1',
            activeNodes: ['vault-enc', 'token-refresh', 'dxos-n8n', 'n8n-api'],
            activeEdges: ['v3', 'v4', 'v5'],
            description:
              'dxosN8n kiểm tra SSRF/DNS allowlist, lấy token/bí mật giải mã và đẩy sang Stock n8n :5678 kèm Idempotency-Key.',
            route: 'POST /api/dxosN8n:{syncCredential, createWorkflow}',
            payload: '/api/v1/credentials · /api/v1/workflows',
            chips: ['SSRF Guard', 'Idempotency-Key'],
          },
          {
            id: 'ns3',
            title: 'Thực thi, Thử lại & Callback Ký số',
            activeNodes: ['n8n-api', 'n8n-exec', 'ingress-cb'],
            activeEdges: ['v6', 'v7'],
            description:
              'Theo dõi và thử lại lượt chạy qua /api/v1/executions; phản hồi từ n8n gọi về :webhookIngress có chữ ký HMAC-SHA256.',
            route: 'POST /api/dxosAutomations:webhookIngress',
            payload: 'X-Lattice-Signature-256 · timingSafeEqualHex',
            chips: ['retryExecution', 'HMAC Verified'],
          },
        ],
      },
      {
        id: 'transactional-outbox',
        label: 'Outbox PG16 & Standard Webhooks',
        viewBox: '0 0 1160 272',
        zones: [
          { id: 'pg-tx', label: 'Giao dịch PG16 (FORCE RLS)', x: 12, y: 20, width: 432, height: 220, kind: 'admin' },
          { id: 'dispatch-zone', label: 'Ký số & Giao nhận Bền bỉ', x: 480, y: 20, width: 432, height: 220, kind: 'traffic' },
          { id: 'target-zone', label: 'Đích Nhận Ngoài', x: 948, y: 20, width: 200, height: 220, kind: 'external' },
        ],
        nodes: [
          {
            id: 'evt-pub',
            title: 'Đột biến Miền\n& Phát sự kiện',
            sub: ['dxosEvents:publish', 'Trong PG16 Tx'],
            icon: 'bell',
            x: 24,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'pg-tx',
            inspector: {
              role: 'Phát CloudEvent 1.0 gắn liền giao dịch nghiệp vụ',
              packageOrPort: '@latticedx/plugin-lattice-foundation · event-bus.js',
              protocol: 'dxosEvents:{publish, listSubscriptions}',
              payloadOrSchema: 'ce-type · organizationId · active subscriptions',
              responsibilities:
                'Ghi nhận sự kiện miền cùng transaction nghiệp vụ để bảo đảm không mất sự kiện khi hệ thống gặp sự cố.',
            },
          },
          {
            id: 'pg-outbox',
            title: 'Hàng đợi Outbox PG16',
            sub: ['latticeEventBus', 'FOR UPDATE', 'SKIP LOCKED · RLS'],
            icon: 'database',
            x: 258,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'pg-tx',
            focal: true,
            inspector: {
              role: 'Hàng đợi Outbox đa tenant không xung đột worker',
              packageOrPort: 'PostgreSQL 16 FORCE RLS · dxosEvents',
              protocol: 'SELECT ... FOR UPDATE SKIP LOCKED',
              payloadOrSchema: 'latticeWebhookDeliveries (attemptCount, nextAttemptAt)',
              responsibilities:
                'Cho phép nhiều replica worker lấy lô giao nhận song song an toàn mà không xử lý trùng cùng một bản ghi.',
            },
          },
          {
            id: 'std-signer',
            title: 'Webhooks Chuẩn & SSRF',
            sub: ['webhook-id · v1,<b64>', 'ce-type · 5s timeout'],
            icon: 'shield',
            x: 492,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'dispatch-zone',
            inspector: {
              role: 'Ký Standard Webhooks & kiểm tra SSRF trước khi gửi',
              packageOrPort: 'event-bus.js · Standard Webhooks',
              protocol: 'HMAC-SHA256 Base64 · WEBHOOK_TIMEOUT_MS = 5000',
              payloadOrSchema: 'webhook-id · webhook-timestamp · webhook-signature: v1,<b64>',
              responsibilities:
                'Xác thực lại IP/DNS đích chống SSRF tại thời điểm gửi và đính kèm chữ ký chuẩn Standard Webhooks + ce-type.',
            },
          },
          {
            id: 'delivery-sm',
            title: 'Máy trạng thái\nGiao nhận',
            sub: ['Backoff 5x (5s..1h)', 'Cầu dao (5/120s)', 'status=dlq -> :replay'],
            icon: 'cpu',
            x: 726,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'dispatch-zone',
            focal: true,
            inspector: {
              role: 'Điều phối thử lại, ngắt mạch và chuyển DLQ thống nhất',
              packageOrPort: 'event-bus.js · Delivery State Machine',
              protocol: '5 Retries (5s..3600s) · Breaker (5/120s) · DLQ',
              payloadOrSchema: "pending -> retrying -> delivered | circuit_open | status='dlq'",
              responsibilities:
                'Thử lại lũy thừa tối đa 5 lần (5s..3600s), mở cầu dao 120s sau 5 lỗi liên tiếp (khôi phục bằng :resetCircuit) và chuyển DLQ khi cạn lượt.',
            },
          },
          {
            id: 'ext-target',
            title: 'n8n / Đích ngoài',
            sub: ['2xx ACK hoặc', 'Khôi phục :replayDlq'],
            icon: 'plug',
            x: 960,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'target-zone',
            dashed: true,
            inspector: {
              role: 'Đầu nhận webhook Stock n8n hoặc hệ thống đối tác',
              packageOrPort: 'n8n Webhook Node · External HTTPS',
              protocol: 'Standard Webhooks Verify · dxosEvents:replayDlq',
              payloadOrSchema: '2xx ACK | POST /api/dxosEvents:replayDlq',
              responsibilities:
                'Xác minh chữ ký v1,<b64> và cửa sổ thời gian; các bản ghi vào DLQ được phát lại an toàn qua dxosEvents:replayDlq.',
            },
          },
        ],
        edges: [
          {
            id: 'o1',
            from: 'evt-pub',
            to: 'pg-outbox',
            label: 'queue',
            kind: 'flow',
            points: [
              [200, 132],
              [258, 132],
            ],
          },
          {
            id: 'o2',
            from: 'pg-outbox',
            to: 'std-signer',
            label: 'claim',
            kind: 'primary',
            points: [
              [434, 132],
              [492, 132],
            ],
          },
          {
            id: 'o3',
            from: 'std-signer',
            to: 'delivery-sm',
            label: 'sign',
            kind: 'primary',
            points: [
              [668, 132],
              [726, 132],
            ],
          },
          {
            id: 'o4',
            from: 'delivery-sm',
            to: 'ext-target',
            label: 'POST',
            kind: 'primary',
            points: [
              [902, 132],
              [960, 132],
            ],
          },
        ],
        steps: [
          {
            id: 'os1',
            title: 'Ghi Outbox PG16 & Lấy Lô SKIP LOCKED',
            activeNodes: ['evt-pub', 'pg-outbox'],
            activeEdges: ['o1'],
            description:
              'Sự kiện phát qua dxosEvents:publish nằm trong giao dịch PG16 và được worker lấy ra bằng FOR UPDATE SKIP LOCKED.',
            route: 'dxosEvents:publish -> FOR UPDATE SKIP LOCKED',
            payload: 'FORCE RLS · Zero Lost Events',
            chips: ['Transactional Outbox'],
          },
          {
            id: 'os2',
            title: 'Ký Standard Webhooks & Kiểm tra SSRF',
            activeNodes: ['pg-outbox', 'std-signer'],
            activeEdges: ['o2'],
            description:
              'Gắn header webhook-id, webhook-timestamp, webhook-signature: v1,<b64> và ce-type sau khi xác thực DNS/IP an toàn.',
            route: 'Standard Webhooks + SSRF Guard',
            payload: 'WEBHOOK_TIMEOUT_MS = 5000',
            chips: ['HMAC v1,<b64>', 'SSRF Safe'],
          },
          {
            id: 'os3',
            title: 'Máy trạng thái Giao nhận & Phát lại DLQ',
            activeNodes: ['std-signer', 'delivery-sm', 'ext-target'],
            activeEdges: ['o3', 'o4'],
            description:
              'Quản lý 5 lần thử lại (5s..3600s), cầu dao 120s và trạng thái DLQ; hỗ trợ khôi phục qua :replayDlq.',
            route: 'POST /api/dxosEvents:replayDlq',
            payload: "5x Backoff · Breaker 5/120s · status='dlq'",
            chips: ['State Machine', 'DLQ Replay'],
          },
        ],
      },
    ];
  }

  return [
    {
      id: 'vault-n8n-sync',
      label: 'Connector Vault & Stock n8n REST v1 Sync',
      viewBox: '0 0 1160 356',
      zones: [
        {
          id: 'vault-lane',
          label: 'Lane 1: Connector Vault & 2-Phase OAuth2 PKCE S256',
          x: 12,
          y: 20,
          width: 668,
          height: 140,
          kind: 'admin',
        },
        {
          id: 'n8n-lane',
          label: 'Lane 2: Stock n8n 2.48.1 Bridge & Signed Callback',
          x: 246,
          y: 192,
          width: 902,
          height: 148,
          kind: 'traffic',
        },
      ],
      nodes: [
        {
          id: 'vault-enc',
          title: 'Connector Vault',
          sub: ['AES-256-GCM (iv:tag)', 'DX_VAULT_MASTER_KEY'],
          icon: 'lock',
          x: 24,
          y: 56,
          width: 176,
          height: 88,
          zoneId: 'vault-lane',
          inspector: {
            role: 'Tenant-isolated encrypted connector repository',
            packageOrPort: '@latticedx/plugin-dxos-studio · connector-vault.js',
            protocol: 'AES-256-GCM · SHA-256 Derived Key · FORCE RLS',
            payloadOrSchema: 'latticeConnectors · dxosVault:{list,save,rotateSecret,testConnection}',
            responsibilities:
              'Blocks direct CRUD on latticeConnectors; encrypts all secrets and OAuth2 tokens in iv:tag:cipher format.',
          },
        },
        {
          id: 'pkce-tx',
          title: '2-Phase OAuth2\nPKCE S256',
          sub: ['TX1 Consume Nonce ->', 'HTTP -> TX2 Encrypt'],
          icon: 'key',
          x: 258,
          y: 56,
          width: 176,
          height: 88,
          zoneId: 'vault-lane',
          focal: true,
          inspector: {
            role: 'RFC 7636 PKCE S256 handshake without holding DB locks',
            packageOrPort: 'connector-vault.js · oauthStart / oauthCallback',
            protocol: "TX1 SELECT FOR UPDATE -> fetch(redirect:'error') -> TX2",
            payloadOrSchema: '32B verifier · 24B hex stateNonce (15m TTL)',
            responsibilities:
              'Atomically consumes the one-time nonce in TX1, exchanges authorization_code outside DB locks (10s timeout), then encrypts tokens in TX2.',
          },
        },
        {
          id: 'token-refresh',
          title: 'Auto-Refresh\n(180s Buffer)',
          sub: ['180s expiry buffer', 'WeakMap Dedup'],
          icon: 'activity',
          x: 492,
          y: 56,
          width: 176,
          height: 88,
          zoneId: 'vault-lane',
          inspector: {
            role: 'Single-flight proactive OAuth2 token refresh',
            packageOrPort: 'connector-vault.js · getFreshConnectorToken',
            protocol: 'dbInflightTokenRefresh WeakMap · 180s Buffer',
            payloadOrSchema: 'expiresAt - now <= 180s -> refresh_token',
            responsibilities:
              'Deduplicates concurrent refresh requests per (organizationId, connectorId) into one in-flight Promise and persists rotated tokens.',
          },
        },
        {
          id: 'dxos-n8n',
          title: 'dxosN8n Studio Bridge',
          sub: ['SSRF Host Allowlist', 'Idempotency-Key'],
          icon: 'workflow',
          x: 258,
          y: 232,
          width: 176,
          height: 88,
          zoneId: 'n8n-lane',
          focal: true,
          inspector: {
            role: 'REST v1 workflow orchestrator & 11-app credential mapper',
            packageOrPort: '@latticedx/plugin-dxos-studio · n8n-api-client.js',
            protocol: 'Admin + PAT Scope · assertSafeConnectorUrlAsync',
            payloadOrSchema: 'buildCredentialPayloadFromConnector · Idempotency-Key',
            responsibilities:
              'Validates SSRF host allowlists, attaches Idempotency-Key headers, scrubs error secrets via scrubN8nSecrets, and maps credentials.',
          },
        },
        {
          id: 'n8n-api',
          title: 'Stock n8n REST v1',
          sub: [':5678 /api/v1/', 'creds · workflows'],
          icon: 'server',
          x: 492,
          y: 232,
          width: 176,
          height: 88,
          zoneId: 'n8n-lane',
          dashed: true,
          inspector: {
            role: 'Isolated stock n8n OCI service on internal app network',
            packageOrPort: 'n8nio/n8n:2.48.1 (profile: n8n) · :5678',
            protocol: 'REST v1 · X-N8N-API-KEY · /healthz',
            payloadOrSchema: '/api/v1/credentials · /api/v1/workflows · /activate',
            responsibilities:
              'Receives synced credentials (returning n8nCredentialId), stores workflow graphs, and activates/deactivates flows in isolation.',
          },
        },
        {
          id: 'n8n-exec',
          title: 'Workflow Execution & Retry',
          sub: ['/api/v1/executions', ':retryExecution'],
          icon: 'plug',
          x: 726,
          y: 232,
          width: 176,
          height: 88,
          zoneId: 'n8n-lane',
          dashed: true,
          inspector: {
            role: 'Execution tracking & failed run recovery on stock n8n',
            packageOrPort: 'dxosN8n:{executions, retryExecution}',
            protocol: 'REST v1 · GET /executions · POST /retry',
            payloadOrSchema: '{ workflowId, executionId, loadWorkflow }',
            responsibilities:
              'Monitors execution status inside stock n8n, supports retrying failed runs, and emits signed completion callbacks.',
          },
        },
        {
          id: 'ingress-cb',
          title: 'Signed Callback Ingress',
          sub: [':webhookIngress', 'HMAC-SHA256 Verified'],
          icon: 'radio',
          x: 960,
          y: 232,
          width: 176,
          height: 88,
          zoneId: 'n8n-lane',
          inspector: {
            role: 'Signature-verified callback entry into LatticeFlow v2',
            packageOrPort: 'dxosAutomations:webhookIngress',
            protocol: 'HMAC-SHA256 | Standard Webhooks | timingSafeEqualHex',
            payloadOrSchema: 'X-Lattice-Signature-256: sha256=<hex>',
            responsibilities:
              'Verifies inbound signatures in constant time and triggers downstream LatticeFlow v2 DAGs with n8n results.',
          },
        },
      ],
      edges: [
        {
          id: 'v1',
          from: 'vault-enc',
          to: 'pkce-tx',
          label: 'pkce',
          kind: 'flow',
          points: [
            [200, 100],
            [258, 100],
          ],
        },
        {
          id: 'v2',
          from: 'pkce-tx',
          to: 'token-refresh',
          label: 'token',
          kind: 'primary',
          points: [
            [434, 100],
            [492, 100],
          ],
        },
        {
          id: 'v3',
          from: 'vault-enc',
          to: 'dxos-n8n',
          label: 'secrets',
          kind: 'flow',
          labelPosition: 0.68,
          points: [
            [112, 144],
            [112, 276],
            [258, 276],
          ],
        },
        {
          id: 'v4',
          from: 'token-refresh',
          to: 'n8n-api',
          label: 'OAuth2',
          kind: 'dashed',
          labelPosition: 0.36,
          points: [
            [580, 144],
            [580, 232],
          ],
        },
        {
          id: 'v5',
          from: 'dxos-n8n',
          to: 'n8n-api',
          label: 'REST',
          kind: 'primary',
          points: [
            [434, 276],
            [492, 276],
          ],
        },
        {
          id: 'v6',
          from: 'n8n-api',
          to: 'n8n-exec',
          label: 'run',
          kind: 'flow',
          points: [
            [668, 276],
            [726, 276],
          ],
        },
        {
          id: 'v7',
          from: 'n8n-exec',
          to: 'ingress-cb',
          label: 'HMAC',
          kind: 'primary',
          points: [
            [902, 276],
            [960, 276],
          ],
        },
      ],
      steps: [
        {
          id: 'ns1',
          title: 'AES-256-GCM Vault & 2-Phase PKCE S256',
          activeNodes: ['vault-enc', 'pkce-tx', 'token-refresh'],
          activeEdges: ['v1', 'v2'],
          description:
            'Connector Vault encrypts secrets, runs two-phase OAuth2 PKCE S256 (TX1 -> HTTP -> TX2), and refreshes tokens within a 180s buffer.',
          route: 'dxosVault:{oauthStart, oauthCallback} · getFreshConnectorToken',
          payload: 'AES-256-GCM · dbInflightTokenRefresh WeakMap',
          chips: ['Two-Phase PKCE', '180s Refresh'],
        },
        {
          id: 'ns2',
          title: 'Credential & Workflow Sync via REST v1',
          activeNodes: ['vault-enc', 'token-refresh', 'dxos-n8n', 'n8n-api'],
          activeEdges: ['v3', 'v4', 'v5'],
          description:
            'dxosN8n checks SSRF allowlists, binds decrypted credentials or fresh OAuth2 tokens, and syncs to Stock n8n :5678 with Idempotency-Key.',
          route: 'POST /api/dxosN8n:{syncCredential, createWorkflow}',
          payload: '/api/v1/credentials · /api/v1/workflows',
          chips: ['SSRF Guard', 'Idempotency-Key'],
        },
        {
          id: 'ns3',
          title: 'Execution, Retry & Signed Callback',
          activeNodes: ['n8n-api', 'n8n-exec', 'ingress-cb'],
          activeEdges: ['v6', 'v7'],
          description:
            'Tracks and retries runs via /api/v1/executions; completed workflows post HMAC-SHA256 callbacks to :webhookIngress.',
          route: 'POST /api/dxosAutomations:webhookIngress',
          payload: 'X-Lattice-Signature-256 · timingSafeEqualHex',
          chips: ['retryExecution', 'HMAC Verified'],
        },
      ],
    },
    {
      id: 'transactional-outbox',
      label: 'Transactional Outbox & Standard Webhooks',
      viewBox: '0 0 1160 272',
      zones: [
        { id: 'pg-tx', label: 'PG16 Transaction (FORCE RLS)', x: 12, y: 20, width: 432, height: 220, kind: 'admin' },
        { id: 'dispatch-zone', label: 'Signing & Durable Delivery', x: 480, y: 20, width: 432, height: 220, kind: 'traffic' },
        { id: 'target-zone', label: 'External Target', x: 948, y: 20, width: 200, height: 220, kind: 'external' },
      ],
      nodes: [
        {
          id: 'evt-pub',
          title: 'Domain Mutation / Publish',
          sub: ['dxosEvents:publish', 'Inside PG16 Tx'],
          icon: 'bell',
          x: 24,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'pg-tx',
          inspector: {
            role: 'CloudEvents 1.0 emission inside business transaction',
            packageOrPort: '@latticedx/plugin-lattice-foundation · event-bus.js',
            protocol: 'dxosEvents:{publish, listSubscriptions}',
            payloadOrSchema: 'ce-type · organizationId · active subscriptions',
            responsibilities:
              'Persists domain events atomically alongside business state changes so no event is lost on process crash.',
          },
        },
        {
          id: 'pg-outbox',
          title: 'PG16 Outbox',
          sub: ['latticeEventBus', 'FOR UPDATE', 'SKIP LOCKED · RLS'],
          icon: 'database',
          x: 258,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'pg-tx',
          focal: true,
          inspector: {
            role: 'Contention-free multi-tenant PG16 outbox queue',
            packageOrPort: 'PostgreSQL 16 FORCE RLS · dxosEvents',
            protocol: 'SELECT ... FOR UPDATE SKIP LOCKED',
            payloadOrSchema: 'latticeWebhookDeliveries (attemptCount, nextAttemptAt)',
            responsibilities:
              'Allows parallel dispatcher workers to claim non-overlapping delivery batches without duplicate webhook sends.',
          },
        },
        {
          id: 'std-signer',
          title: 'Standard Webhooks\n& SSRF',
          sub: ['webhook-id · v1,<b64>', 'ce-type · 5s timeout'],
          icon: 'shield',
          x: 492,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'dispatch-zone',
          inspector: {
            role: 'Standard Webhooks signer & dispatch-time SSRF guard',
            packageOrPort: 'event-bus.js · Standard Webhooks',
            protocol: 'HMAC-SHA256 Base64 · WEBHOOK_TIMEOUT_MS = 5000',
            payloadOrSchema: 'webhook-id · webhook-timestamp · webhook-signature: v1,<b64>',
            responsibilities:
              'Re-validates destination DNS/IP safety against SSRF before POSTing with Standard Webhooks and ce-type headers.',
          },
        },
        {
          id: 'delivery-sm',
          title: 'Delivery State Machine',
          sub: ['5x Backoff (5s..1h)', 'Breaker (5/120s)', 'status=dlq -> :replay'],
          icon: 'cpu',
          x: 726,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'dispatch-zone',
          focal: true,
          inspector: {
            role: 'Unified retry, circuit-breaker & DLQ state transitions',
            packageOrPort: 'event-bus.js · Delivery State Machine',
            protocol: '5 Retries (5s..3600s) · Breaker (5/120s) · DLQ',
            payloadOrSchema: "pending -> retrying -> delivered | circuit_open | status='dlq'",
            responsibilities:
              'Retries up to 5 times with exponential backoff (5s..3600s), trips open for 120s on 5 failures (:resetCircuit), and parks exhausted items in DLQ.',
          },
        },
        {
          id: 'ext-target',
          title: 'n8n / External Endpoint',
          sub: ['2xx ACK or', ':replayDlq Recovery'],
          icon: 'plug',
          x: 960,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'target-zone',
          dashed: true,
          inspector: {
            role: 'Stock n8n Webhook trigger or external HTTPS receiver',
            packageOrPort: 'n8n Webhook Node · External HTTPS',
            protocol: 'Standard Webhooks Verify · dxosEvents:replayDlq',
            payloadOrSchema: '2xx ACK | POST /api/dxosEvents:replayDlq',
            responsibilities:
              'Validates v1,<b64> signatures within a 300s timestamp window; operators replay failed DLQ deliveries via dxosEvents:replayDlq.',
          },
        },
      ],
      edges: [
        {
          id: 'o1',
          from: 'evt-pub',
          to: 'pg-outbox',
          label: 'queue',
          kind: 'flow',
          points: [
            [200, 132],
            [258, 132],
          ],
        },
        {
          id: 'o2',
          from: 'pg-outbox',
          to: 'std-signer',
          label: 'claim',
          kind: 'primary',
          points: [
            [434, 132],
            [492, 132],
          ],
        },
        {
          id: 'o3',
          from: 'std-signer',
          to: 'delivery-sm',
          label: 'sign',
          kind: 'primary',
          points: [
            [668, 132],
            [726, 132],
          ],
        },
        {
          id: 'o4',
          from: 'delivery-sm',
          to: 'ext-target',
          label: 'POST',
          kind: 'primary',
          points: [
            [902, 132],
            [960, 132],
          ],
        },
      ],
      steps: [
        {
          id: 'os1',
          title: 'PG16 Outbox & SKIP LOCKED Claim',
          activeNodes: ['evt-pub', 'pg-outbox'],
          activeEdges: ['o1'],
          description:
            'Events published via dxosEvents:publish are committed atomically in PG16 and claimed via FOR UPDATE SKIP LOCKED.',
          route: 'dxosEvents:publish -> FOR UPDATE SKIP LOCKED',
          payload: 'FORCE RLS · Zero Lost Events',
          chips: ['Transactional Outbox'],
        },
        {
          id: 'os2',
          title: 'Standard Webhooks Signing & SSRF Guard',
          activeNodes: ['pg-outbox', 'std-signer'],
          activeEdges: ['o2'],
          description:
            'Attaches webhook-id, webhook-timestamp, webhook-signature: v1,<b64>, and ce-type after verifying destination DNS/IP safety.',
          route: 'Standard Webhooks + SSRF Guard',
          payload: 'WEBHOOK_TIMEOUT_MS = 5000',
          chips: ['HMAC v1,<b64>', 'SSRF Safe'],
        },
        {
          id: 'os3',
          title: 'Delivery State Machine & DLQ Replay',
          activeNodes: ['std-signer', 'delivery-sm', 'ext-target'],
          activeEdges: ['o3', 'o4'],
          description:
            'Handles 5x exponential backoff (5s..3600s), 120s circuit breaker, and DLQ persistence with manual :replayDlq recovery.',
          route: 'POST /api/dxosEvents:replayDlq',
          payload: "5x Backoff · Breaker 5/120s · status='dlq'",
          chips: ['State Machine', 'DLQ Replay'],
        },
      ],
    },
  ];
});
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 1160 356"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
