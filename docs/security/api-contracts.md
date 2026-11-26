# Hợp đồng API (OpenAPI 3.1 / AsyncAPI 3.0 & Companion Fastify)

LatticeDX **`0.4.2`** cung cấp đặc tả API sống (*live runtime specs*) chuẩn **OpenAPI 3.1.0** và **AsyncAPI 3.0.0** trực tiếp từ NocoBase host, kết hợp cùng tập các NocoBase resource RPC (`/api/<resource>:<action>`), gateway chuẩn **MCP** / **A2A**, và các hợp đồng REST `/v1/*` của dịch vụ lõi Fastify (`apps/api`).

---

## 1. Đặc tả OpenAPI 3.1.0 & AsyncAPI 3.0.0 Sống

Được đăng ký bởi `observability.js` & `openapi-spec.js` trong `@latticedx/plugin-lattice-foundation`, hai endpoint công khai sau luôn sinh đặc tả JSON khớp với runtime phiên bản **`0.4.2`** (bao gồm cả các collection động `latticeCustom*` đang kích hoạt trong DB):

| Endpoint | Phương thức | Quyền | Chuẩn | Nội dung trả về |
| :--- | :---: | :--- | :--- | :--- |
| `/api/dxos:openapi` | `GET` | `public` | **OpenAPI `3.1.0`** | Danh mục endpoint chuẩn `/api/<resource>:<action>`, `/api/dxos-mcp*`, bảo mật `bearerAuth` (`JWT` / `ldx_pat_*`) + `latticeApiKey` (`X-Lattice-API-Key`), và schema động cho mọi `latticeCustom*` |
| `/api/dxos:asyncapi` | `GET` | `public` | **AsyncAPI `3.0.0`** | 3 server (`mqttBroker` cổng `1883`, `httpGateway`, `redisPubSub` `redis:6379`) và 5 kênh sự kiện: `latticedx/{org}/{entity}/telemetry`, `latticedx/{org}/{entity}/command`, `/api/dxosAi:surfaceEvents` (SSE), `latticedx:surface-updates` (Redis Pub/Sub), và `latticeContextOutbox` (Webhook) |

Hai endpoint giám sát đi kèm trên cùng resource `dxos`:
- `GET /api/dxos:health` (`public`): kiểm tra kết nối DB (`200 ok` hoặc `503 degraded`) và thống kê OTel exporter.
- `GET /api/dxos:metrics` (yêu cầu `DX_METRICS_TOKEN` qua Bearer hoặc JWT có vai trò `root` / `ldx_admin`): xuất metrics Prometheus (`text/plain; version=0.0.4`).

---

## 2. Bảng Tổng hợp NocoBase Resources (`/api/<resource>:<action>`)

Dưới đây là bảng tổng hợp chính xác **19 NocoBase resources** cốt lõi thuộc 7 plugin Pure-OSI `Apache-2.0` của LatticeDX **`0.4.2`** (cùng các resource nền tảng bổ sung từ `@latticedx/plugin-lattice-foundation`):

| Resource | Plugin sở hữu | Số Actions | Danh sách Actions đã xác minh trong mã nguồn |
| :--- | :--- | :---: | :--- |
| `dxosStudio` | `plugin-dxos-studio` | 15 | `listTemplates`, `listEmployees`, `installWorkflow`, `composePortals`, `pluginStatus`, `readiness`, `outboxDlqList`, `outboxDlqPurge`, `outboxDlqReplay`, `solutionBundleExport`, `solutionBundleDiff`, `solutionBundleImport`, `solutionBundleRollback`, `listAutomationRules`, `seedShowcaseData` |
| `dxosWms` | `plugin-dxos-studio` | 12 | `orderLines`, `saveOrderLine`, `receiveStock`, `lots`, `allocateFefo`, `issueStock`, `holdLotByMkt`, `releaseLotByQa`, `epodCapture`, `publicTrack`, `verifyTrackSignature`, `printVoucher` |
| `dxosDmn` | `plugin-dxos-studio` | 3 | `listTables`, `saveTable`, `evaluate` |
| `dxosDelegations` | `plugin-dxos-studio` | 4 | `list`, `create`, `revoke`, `activeForUser` |
| `dxosAutomations` | `plugin-dxos-studio` | 19 | `listRules`, `saveRule`, `saveDraft`, `publishRule`, `listRuleVersions`, `rollbackRuleVersion`, `toggleRule`, `deleteRule`, `testRule`, `runNow`, `listRuns`, `getRunTrace`, `replayRun`, `builderCatalog`, `aiAssist`, `nodeRegistry`, `testNode`, `resumeRun`, `webhookIngress` |
| `dxosBuilder` | `plugin-dxos-studio` | 6 | `listDomains`, `createDomain`, `listBusinessPacks`, `installBusinessPack`, `listTenants`, `provisionTenant` |
| `dxosN8n` | `plugin-dxos-studio` | 10 | `status`, `appCatalog`, `workflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`, `activateWorkflow`, `executions`, `retryExecution`, `syncCredential` |
| `dxosAi` | `plugin-dxos-ai` | 41 | `listProfiles`, `saveProfile`, `deleteProfile`, `bootstrapDefaults`, `portalAgents`, `auditLogs`, `quotaSummary`, `saveQuotaPolicy`, `mcpCatalog`, `testMcpEndpoint`, `enterpriseTopology`, `pageSurfaceState`, `surfaceEvents`, `inspectPageBlocks`, `rollbackPageSnapshot`, `listApprovals`, `triageScan`, `approveAction`, `rejectAction`, `checkLlmHealth`, `quickConnectLlm`, `listLlmServices`, `deleteLlmService`, `switchLlmServiceModel`, `listBuiltApps`, `rebuildBuiltApp`, `buildBuiltApp`, `planBuiltApp`, `patchBuiltApp`, `rollbackBuiltApp`, `listBuiltAppVersions`, `exportBuiltAppBundle`, `teardownBuiltApp`, `listMemories`, `rememberFact`, `recallMemories`, `forgetMemory`, `listAgentTraces`, `getAgentTraceDetail`, `listEvalSuites`, `runEvalBenchmark` |
| `dxosBlocks` | `plugin-dxos-blocks` | 17 | `proposals`, `decideProposal`, `contextTelemetry`, `telemetrySeries`, `telemetryIngest`, `alarmIngest`, `alarmAck`, `alarmClear`, `exportReport`, `globalSearch`, `twinShadow`, `twinSetDesired`, `twinAckCommand`, `bulkImportDryRun`, `bulkImportCommit`, `collectionsMeta`, `aggregateQuery` |
| `dxosBroker` | `plugin-dxos-blocks` | 10 | `listDevices`, `provisionDevice`, `revokeDevice`, `deviceStatusIngest`, `orionEntities`, `orionListSubscriptions`, `orionCreateSubscription`, `orionToggleSubscription`, `orionDeleteSubscription`, `orionNotify` |
| `dxosApprovals` | `plugin-lattice-foundation` | 8 | `listInbox`, `decide`, `request`, `cancel`, `listPolicies`, `savePolicy`, `deletePolicy`, `evaluateSlaNow` |
| `dxosNotify` | `plugin-lattice-foundation` | 4 | `send`, `testSend`, `logs`, `channels` |
| `dxosForms` | `plugin-lattice-foundation` | 10 | `meta`, `submit`, `status`, `list`, `get`, `save`, `delete`, `rotateToken`, `listSubmissions`, `downloadAttachment` |
| `dxosLedger` | `plugin-lattice-foundation` | 8 | `publicKey`, `entries`, `status`, `verify`, `signDocument`, `verifySignature`, `rotateKey`, `exportProof` |
| `dxosVault` | `plugin-lattice-foundation` | 8 | `list`, `save`, `rotateSecret`, `delete`, `testConnection`, `appCatalog`, `oauthStart`, `oauthCallback` |
| `dxosEvents` | `plugin-lattice-foundation` | 10 | `listEvents`, `publish`, `listSubscriptions`, `saveSubscription`, `toggleSubscription`, `deleteSubscription`, `listDeliveries`, `dispatchNow`, `replayDlq`, `resetCircuit` |
| `dxActions` | `action-bridge` | 13 | `connect`, `callback`, `status`, `catalog`, `list`, `run`, `files`, `workflow`, `studio`, `entity`, `agent`, `logistics`, `disconnect` |
| `latticePara` | `plugin-dxos-para` | 6 | `summary`, `hybridSearch`, `reindex`, `extractAttachment`, `extractFormFields`, `indexHealth` |
| `enterpriseAuth` | `plugin-enterprise-auth` | 9 | `start`, `callback`, `finish`, `backchannelLogout`, `configuration`, `link`, `listLinkTargets`, `listMappings`, `unlink` |

::: tip Các Resource nền tảng bổ sung trong `@latticedx/plugin-lattice-foundation`
Ngoài 19 resource trên, `plugin-lattice-foundation` còn cung cấp `dxosApiKeys` (`issue`, `list`, `revoke`), `dxos` (`health`, `metrics`, `openapi`, `asyncapi`, `manifest`, `sw.js`, `sw`, `icon-192.png`, `icon-512.png`), `dxosDataGov` (`freezeSnapshot`, `listSnapshots`, `lineage`, `listQuarantine`, `resolveQuarantine`, `computeMkt`), `latticeVoucher` (`submit`, `cancel`, `amend`, `lineage`), `latticeNotifications` (`listMine`, `unreadCount`, `markRead`, `markAllRead`), `latticeSla` (`summary`, `policies`, `savePolicy`, `evaluateNow`), `latticeChatter`, `latticePortals`, `latticeApps`, và `latticeNative`.
:::

---

## 3. MCP (Model Context Protocol) & A2A (Agent-to-Agent) Endpoints

Plugin `@latticedx/plugin-dxos-ai` đăng ký các gateway giao thức mở cho tác nhân AI bên ngoài và liên kết đa tác nhân:

### MCP Gateway (`mcp-gateway.js`)

- **Endpoints JSON-RPC 2.0 (`POST`)**:
  - `/api/dxos-mcp`: Enterprise MCP Gateway (công cụ nghiệp vụ, RAG, phê duyệt, builder cho admin).
  - `/api/dxos-mcp/it-ot`: IT/OT MCP Gateway (telemetry Orion-LD, sự cố, workflow).
- **Phiên bản giao thức hỗ trợ**: `'2025-03-26'`, `'2024-11-05'`.
- **Xác thực**: Bắt buộc Bearer JWT hợp lệ hoặc PaaS PAT (`ldx_pat_*`) có scope `ai` (từ chối key chỉ có scope `read`, trả JSON-RPC `-32001` và HTTP `401` kèm header `WWW-Authenticate: Bearer realm="LatticeDX-MCP"` khi thiếu token).
- **MCP Prompts (`4`)**: `dxos-cold-chain-incident-triage`, `dxos-fefo-dispatch-audit`, `dxos-executive-radar-brief`, `dxos-system-blueprint-architect`.
- **MCP Resource URIs**:
  - `dxos://org/{organizationId}/alarms/active`
  - `dxos://org/{organizationId}/lineage/{collection}/{recordId}`

### A2A Protocol (`a2a-gateway.js`)

- **Agent Card Discovery (`GET`)**:
  - `/.well-known/agent-card.json`
  - `/api/dxos-a2a/agent-card.json`
- **A2A JSON-RPC Endpoint (`POST`)**: `/api/dxos-a2a`
- **Vòng đời trạng thái Task (`A2A_VALID_STATUSES`)**: `submitted`, `working`, `input-required`, `completed`, `failed`, `canceled` (lưu bền vững trong bảng `latticeA2aTasks` có `FORCE RLS`).
- **7 Starter Agent Profiles**: `dxos-coordinator`, `dxos-architect`, `dxos-ops`, `dxos-logistics`, `dxos-workspace`, `dxos-operator`, `dxos-analyst`.

---

## 4. Hợp đồng Companion Fastify API (`/v1/*` trong `apps/api`)

Dịch vụ backend lõi `@dx/api` (Fastify `5.12.8`) giữ vai trò engine thẩm quyền cho dữ liệu thực thể có kiểu (*typed entities*), workflow engine lõi và quản lý tác vụ qua các nhóm endpoint `/v1/*` (tham chiếu hợp đồng trong `docs/backend-api-index.md` và `docs/studio-context-api.openapi.json` của `lattice-dx`):

### Quy tắc Yêu cầu Dùng chung

- **Xác thực & Ngữ cảnh**: Gửi Bearer token đã xác minh tới Gateway; actor, tổ chức (`organizationId`) và vai trò được lấy từ token, **không** tin cậy giá trị truyền trong payload nghiệp vụ.
- **Idempotency & Concurrency**: Các lệnh ghi mới yêu cầu header `Idempotency-Key` và phiên bản kỳ vọng (`version`/`revision`); xung đột phiên bản trả về HTTP `409`.
- **Truy vấn & Phân trang**: Lọc theo quyền truy cập được đẩy xuống SQL trước bước giới hạn trang (`page.hasMore`, `page.nextOffset`).
- **Tương quan & Mã lỗi chuẩn**: `X-Request-Id` dùng để truy vết chẩn đoán; phản hồi lỗi dạng `{ error }` (`401` lỗi danh tính, `403` thiếu quyền route/action, `404` ẩn tài nguyên không khả dụng hoặc không thuộc phạm vi, `409` xung đột trạng thái/phiên bản, `503` năng lực backend chưa sẵn sàng).

### Bảng Nhóm Endpoint `/v1/*` của Companion Fastify

| Nhóm năng lực | Đường dẫn API chính | Mô tả phạm vi |
| :--- | :--- | :--- |
| **Schema & Dữ liệu Doanh nghiệp** | `/v1/entity-schemas`, `/v1/entities` | Vòng đời schema có kiểu và bản ghi thực thể |
| **Chia sẻ & Tìm kiếm / Tổng hợp** | `/v1/entities/:id/shares`, `/v1/entities/search`, `/v1/entities/aggregate`, `/v1/entities/query`, `/v1/blocks` | Cấp quyền theo người/phòng ban, tìm kiếm toàn văn, tổng hợp đúng phạm vi và khối dữ liệu API |
| **Báo cáo, Tài liệu & Nhập/Xuất** | `/v1/entity-report-snapshots/*`, `/v1/entities/:id/attachments`, `/v1/entity-imports/*`, `/v1/entities/export` | Snapshot báo cáo đóng băng, tệp đính kèm theo ngữ cảnh và xử lý dữ liệu hàng loạt |
| **Tác vụ & Hàng đợi Phòng ban** | `/v1/tasks`, `/v1/task-queues` | Vòng đời tác vụ và hàng đợi phân bổ theo phòng ban |
| **Workflow Engine & Timers** | `/v1/workflow-drafts`, `/v1/workflow-definitions`, `/v1/workflows`, `/v1/workflow-waits`, `/v1/workflow-blocks`, `/v1/workflow-services`, `/v1/workflows/:id/timers` | Soạn thảo, xuất bản, thực thi, tạm chờ, khối riêng tư và bộ đếm thời gian bền vững |
| **Ngữ cảnh Thực thể & Sự kiện** | `/v1/entities/:id/workflows`, `/v1/workflows/:id/entity-context`, `/v1/entity-automations/*`, `/v1/entities/:id/events` | Ngữ cảnh workflow-thực thể, tự động hóa sau commit và nhật ký sự kiện |
| **Tổ chức, Sự kiện vào & Agent Jobs** | `/v1/organization/*`, `/v1/workflow-events`, `/v1/workflow-event-subscriptions`, `/v1/agent-jobs` | Danh mục tổ chức, cổng nhận sự kiện có chữ ký và tác vụ đề xuất của agent |
| **Modules, Bundles & Vận hành** | `/v1/workflow-bundles/*`, `/v1/enterprise-modules/*`, `/health`, `/ready`, `/v1/operations/*`, `/v1/operations/metrics`, `/v1/operations/queues` | Gói workflow di động, module doanh nghiệp phân phiên bản và kiểm tra sẵn sàng / hàng đợi |

*(Lưu ý: Tác vụ sao lưu và diễn tập khôi phục PostgreSQL / dữ liệu đối tượng cặp đôi thực hiện qua CLI `pnpm backup:core` / `pnpm backup:full` / `pnpm backup:rehearse*`, không mở endpoint restore trên trình duyệt.)*

## Liên kết Liên quan

- [Kiến trúc Đa Khách Hàng & PostgreSQL 16 FORCE RLS](/security/multi-tenant-rls)
- [PKI Merkle Ledger & PaaS API Keys](/security/pki-ledger-api-keys)
- [Xác thực OIDC/PKCE & Phòng thủ Chiều sâu](/security/auth-oidc-hardening)
