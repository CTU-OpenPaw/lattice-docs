# Demo Pack, Kịch bản 15 phút Chung kết & Khắc phục Sự cố

Tài liệu tổng hợp quy trình **15 phút Demo Pack** (`docs/DEMO_PACK.md`), **Kịch bản Tác chiến Chung kết OLP PMNM 2026 (`0:00–15:00`)** (`docs/FINALS_15MIN_SCRIPT.md`) đã đồng bộ đầy đủ thông số kỹ thuật thực tế của **LatticeDX `v0.4.2`** (**12 Native v2 BlockModels**, **11 Tabs + 6 Governance Consoles** Control Studio, **56 bảng tĩnh PG16 `FORCE RLS`** + dynamic `latticeCustom*`), kèm **Bảng Khắc phục Sự cố (Troubleshooting)** thực chiến.

---

## 1. Demo Pack `v0.4.2` — Cài sạch & Kiểm chứng Độc lập

### 1.1. Tóm tắt quy trình 15 phút Demo Pack

| Giai đoạn | Mục tiêu kiểm chứng | Điểm xác nhận chính (`v0.4.2`) |
| --- | --- | --- |
| **Phút 0–3** | Dựng mới NocoBase `2.2.50` sạch (0 bảng) trên cổng cô lập `13014` | `pnpm native:clean --port=13014` + seed demo; `/admin/pm/list` bật đủ **7 plugin `@latticedx/*` (`0.4.2`)**; chân trang giữ nguyên **Điều 5.2 NocoBase** |
| **Phút 3–7** | DX-OS Control Studio & AI Workforce Center | `/admin/settings/dxos-studio` (11 Tabs + 6 Governance Consoles + GitOps Bundle v3) và `/admin/settings/dxos-ai` (9 Tabs, 7 Profiles, 20 Unified Tools, MCP/A2A, HITL, App Builder 2.0, Eval Lab `163/163`) |
| **Phút 7–11** | **12 Native v2 BlockModels**, WebGIS, Kanban, PKI/Lineage & Mobile PWA | Kiểm tra `/p/logistics`, `/p/incidents`, `/p/services`, `/v/mobile`, và đủ **12 BlockModels** trong UI Editor → `Add block` |
| **Phút 11–13** | Phân tách quyền (`ldx_employee`) & Nghiệm thu Headless PaaS | Tài khoản `native.lab.employee@example.invalid` bị ẩn `/p/incidents` và chặn `403` vào `/admin/settings/*`; chạy `acceptance:headless-paas`, `acceptance:dxos-ai-mcp`, `acceptance:logistics-rbac` |
| **Phút 13–15** | Kiểm toán Nguồn mở (PoF), SBOM & Tái tạo từ `.tar.gz` | `source-headers.mjs --check` (`1,098` file), `pnpm pof:check` (`6/6`), `generate-sbom.mjs --check` (`257/257`), `pnpm release:tarball` → giải nén `latticedx-0.4.2-src.tar.gz` (không `.git`) chạy lại `pnpm check` & `node --test` |

### 1.2. Danh sách đầy đủ 12 Native v2 BlockModels (`v0.4.2`)

Đồng bộ trực tiếp với `plugins/nocobase/plugin-dxos-blocks/src/client/block-models.js`:

1. `DxosPortalHeroBlockModel` — DX-OS Portal Hero & Quick Actions
2. `DxosKpiMetricBlockModel` — DX-OS KPI Metric Grid
3. `DxosContextTelemetryBlockModel` — DX-OS NGSI-LD Context & Telemetry
4. `DxosAiProposalBlockModel` — DX-OS AI Proposal & Evidence
5. `DxosWorkflowTasksBlockModel` — DX-OS Workflow & My Tasks
6. `DxosParaVaultBlockModel` — DX-OS P.A.R.A. Knowledge Vault
7. `DxosCreativeStudioBlockModel` — DX-OS Creative Studio Micro-App
8. `DxosRecordWorkbenchBlockModel` — DX-OS Chatter, Chứng từ & Xuất báo cáo
9. `DxosWebGisBlockModel` — DX-OS Bản đồ Giám sát WebGIS
10. `DxosKanbanScheduleBlockModel` — DX-OS Bảng Kanban & Lịch 7 ngày
11. `DxosWmsOpsBlockModel` — DX-OS Điều hành Kho FEFO, Tạm giữ MKT & In QR WMS
12. `DxosBiChartBlockModel` — DX-OS Biểu đồ BI (Bar / Line / Pie / KPI / Pivot SQL Aggregate)

---

## 2. Kịch bản Trình diễn Chung kết 15 Phút (`0:00–15:00`)

### 2.1. Chuẩn bị Trước giờ G (`T-5 phút`)

```sh
pnpm native:clean --port=13014
node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"
pnpm setup:dxos-ai -- --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" pnpm seed:v100-showcase -- --origin=http://localhost:13014
```

**Các Tab trình duyệt mở sẵn:**
1. `http://localhost:13014/admin/settings/dxos-ai` (AI Studio 9 Tabs)
2. `http://localhost:13014/admin/settings/dxos-studio` (Control Studio 11 Tabs + 6 Governance Consoles) & `/admin/settings/workflow/automation` (LatticeFlow v2 — 24 nodes)
3. `http://localhost:13014/p/logistics` (Logistics 5 bước, `DxosWmsOpsBlockModel`, Kanban/Schedule, PKI, In QR SVG)
4. `http://localhost:13014/p/incidents` (WebGIS MapLibre, IIoT Digital Twin & GraphRAG Agent)
5. `http://localhost:13014/p/cmms` & `http://localhost:13014/p/partner-claims` (`CLM-V100-001`)
6. `http://localhost:13014/v/mobile` (Mobile Field PWA + IndexedDB Outbox)

### 2.2. Diễn tiến Từng phút (`0:00 – 15:00`)

| Khung giờ | Màn hình trình chiếu | Thao tác & Thông điệp cốt lõi |
| --- | --- | --- |
| **0:00 – 1:45** | `/admin/settings/dxos-ai` → `/admin/pm/list` → Chân trang | Định vị DX-OS 6 phân hệ (`Plane #6: NocoBase 2.2.50`, 7 plugin `Apache-2.0` `sdkProvidedByHost: true`, giữ Điều 5.2). Nhấn mạnh **Pure-OSI 0% BSL-1.1**: dùng Valkey `8.1`, Mosquitto `2.0.21`, Node-RED `4.0.9`, PG16 (`latticeTelemetryPoints`), Prometheus `v3.3.0`, OTel Collector `0.123.0`. |
| **1:45 – 4:15** | `/p/logistics` → `/admin/settings/dxos-studio` | Trình diễn `ORD-V100-001` trên Kanban/Lịch & `DxosWmsOpsBlockModel`, xác minh **Ed25519 PKI & Merkle**, Lineage, In QR ISO SVG + `/v/track/:code` không PII; kho `LOT-V100-FEFO-A` / `LOT-V100-MKT-HOLD` (Arrhenius MKT) và **Visual DMN** `cold_chain_approval_v1` (`maxTempC: 9.5` → `quality_hold_director`). |
| **4:15 – 8:45** | `/p/incidents` → Studio (Tab 7, 8) → `/p/cmms` → `PortalAgentLauncher` → AI Tab 8 (HITL) | Cảnh báo nhiệt độ `8.9°C > 8°C`, Mosquitto DynSec + Orion-LD 2 chiều → CloudEvents + Standard Webhooks (`dxosEvents`) → Vault (`dxosVault` AES-256-GCM + OAuth2 PKCE) + Stock `n8n` (`dxos-enterprise-compliance-orchestrator.json` 26 nodes) + Native Automation (`auto_cmms_on_coldchain_fault`). Gọi `#16 dxos_graph_impact_analysis` và trình diễn **HITL Digital Twin gate** (`\|delta\| > 2.0°C`). |
| **8:45 – 10:45** | Studio (Tab 9) → `/v/mobile` → `/p/services` | Tạo thực thể động `latticeCustom*` tự gắn **PG16 `FORCE RLS`** + cập nhật `/api/dxos:openapi` + `provisionTenant`; trên `/v/mobile` chứng minh `NetworkOnly` `/api/*` & IndexedDB Outbox; lướt P.A.R.A. OCR PDF `ToUnicode` CMap. |
| **10:45 – 13:15** | Studio (Tab 6 GitOps) + Terminal | Xuất `latticedx.solution-bundle/v3` (che sạch secret) và chạy live terminal: `/api/dxos:health`, `/api/dxos:openapi`, `acceptance:headless-paas`, `acceptance:dxos-ai-mcp`, `acceptance:broker-automation-builder`, `pnpm release:sbom -- --check` (`257/257`), `pnpm pof:check` (`6/6`). |
| **13:15 – 15:00** | Đăng nhập `native.lab.employee@example.invalid` | Chứng minh Negative RBAC: menu ẩn `/p/incidents` & `/admin/settings/*`; các lời gọi trái quyền sang Builder/Vault/Broker/cross-org trả **`HTTP 403`**. Chốt thông điệp **50 điểm PoF thuần OSI + Hệ điều hành Doanh nghiệp Số 6 Phân hệ**. |

### 2.3. Lệnh Dự phòng Offline (Khi gián đoạn mạng hoặc LLM Gateway)

```sh
node scripts/source-headers.mjs --check
pnpm pof:check
pnpm release:sbom -- --check
node --test scripts/tests/oss-pof-audit.test.mjs scripts/tests/generate-sbom.test.mjs scripts/tests/infra-compose-security.test.mjs
node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95
node --test plugins/nocobase/*/tests/*.test.cjs
```

### 2.4. Năm Điểm Trả lời Phản biện Giám khảo (Q&A Defense Points)

1. **Bản quyền NocoBase & Vendor Lock-in:** Toàn bộ mã nguồn nhóm đặt trong 7 plugin `Apache-2.0` (`sdkProvidedByHost: true`), không chứa `upstream/nocobase` hay `.gitmodules`, host `nocobase/nocobase:2.2.50` chỉ chạy dạng OCI container ngoài kho Git và bảo toàn **Điều 5.2 NocoBase**. Lõi nghiệp vụ mở qua OpenAPI 3.1 / AsyncAPI 3.0 / MCP / A2A.
2. **Thuần khiết Pure-OSI (`0% BSL-1.1`):** Loại bỏ hoàn toàn ThingsBoard, EMQX, Redis bản nguồn hạn chế; thay bằng **Valkey `8.1` (`BSD-3-Clause`)**, **Mosquitto `2.0.21` (`EPL-2.0 OR BSD-3-Clause`)**, **Node-RED `4.0.9` (`Apache-2.0`)**, chuỗi thời gian IIoT trên **PG16 `latticeTelemetryPoints`**, cùng **Prometheus `v3.3.0`** và **OTel Collector `0.123.0`**.
3. **Cô lập Đa tổ chức (Defense-in-Depth):** Ngoài middleware scope ở plugin, PostgreSQL chạy qua vai trò non-superuser `nocobase_app` và bật **`FORCE ROW LEVEL SECURITY` (`lattice_tenant_isolation`) trên cả `56` bảng tĩnh `lattice*` + toàn bộ bảng động `latticeCustom*`** (`pg-rls.js` + `AsyncLocalStorage` `set_config('app.current_org', ..., true)`).
4. **Chống Ảo giác AI (Hallucination):** Mọi tool thay đổi trạng thái (`dxos_execute_record_action`, `dxos_alarm_action`, `dxos_twin_set_desired`, `dxos_wms_hold_lot`) bị chặn sau **Hàng chờ HITL** (`requesterUserId !== approver`). Digital Twin chặn mọi đổi setpoint lệch `> 2.0°C` chờ người có ACL duyệt trước khi phát downlink MQTT qua Node-RED.
5. **Mất mạng 4G trong kho lạnh (`/v/mobile`):** Service Worker `/api/dxos:sw.js` giữ bất biến `NetworkOnly` cho `/api/*` (không cache lộ token), lưu an toàn ePOD & yêu cầu xử lý vào **IndexedDB Outbox** kèm cơ chế **Quarantine** cho lỗi `400/403/404/409/422` để không mất chứng từ khi đồng bộ lại.

---

## 3. Bảng Khắc phục Sự cố Thực tế (Troubleshooting)

| Triệu chứng / Mã lỗi | Nguyên nhân gốc rễ | Cách khắc phục chuẩn (`v0.4.2`) |
| --- | --- | --- |
| **Windows `VirtualAlloc` OOM (`errno=1455`)** khi chạy `pnpm check` hoặc `pnpm build` | Nạp bộ nhớ ảo Windows (Pagefile) bị cạn khi `tsc`/Vitest và `node --test` chạy song song nhiều workspace | Tách bước kiểm tra và build tuần tự với concurrency = 1:<br/>`pnpm typecheck && pnpm test`<br/>`pnpm -r --workspace-concurrency=1 build`<br/>Hoặc build riêng package cần kiểm tra: `pnpm --filter @dx/api build` |
| **Lỗi xung đột Port** (`13004–13999`, `13000`, `8080`, `8081`, `1026`, `5678`, `20128`) hoặc `Clean project already owns resources` | Container/tiến trình lab trước đó chưa tắt hết hoặc cổng đang bị chiếm | Kiểm tra cổng bận và dọn stack cũ (`docker compose -f infra/compose/nocobase.yml down` hoặc `docker compose -p <project> down -v`). Chạy `pnpm native:clean --port=13015` (dải hợp lệ `13004–13999`) và kiểm trạng thái dịch vụ bằng `pnpm local:doctor --integration --agent` |
| **ePOD trên `/v/mobile` chuyển trạng thái `quarantined`** | API trả `400`, `403`, `404`, `409` (xung đột phiên bản) hoặc `422` (thường do nhập sai `orderCode` hoặc sai trường) | Đây là cơ chế **bảo toàn dữ liệu có chủ đích** (`mobile-field-pwa.js`): tuyệt đối không xóa payload. Mở thẻ item trong danh sách Quarantine trên `/v/mobile` để **Sửa mã đơn** rồi gửi lại, giải quyết xung đột `409`, hoặc bấm **Xuất JSON dự phòng** |
| **Đồng bộ `/v/mobile` dừng lại với banner "Đăng nhập ngay"** | JWT trong phiên đã hết hạn (`401` hoặc `isJwtTokenExpired`) | Hệ thống tự động dừng ngay ở lỗi `401` đầu tiên để tránh bão `401` và giữ nguyên toàn bộ Outbox trong IndexedDB. Đăng nhập lại rồi bấm **Đồng bộ ngay** |
| **Webhook Event Bus ngừng gửi (`circuitState: 'open'`)** | Đích webhook lỗi/timeout liên tiếp đủ **5 lần** (`CIRCUIT_FAILURE_THRESHOLD = 5`) | Mạch tự mở trong **`120` giây** (`CIRCUIT_COOLDOWN_MS = 120000`) và đưa delivery quá `5` lần thử vào `dlq`. Sửa endpoint đích (kiểm tra xác thực `webhook-id`/`webhook-timestamp`/`webhook-signature`), sau đó vào **Control Studio → Tab Broker & Sự kiện / Outbox DLQ** (hoặc gọi `dxosEvents:resetCircuit` và `dxosEvents:replayDlq`) |
| **Toast `503` hoặc AI Chat dừng khi tắt `9router` / LLM** | Chưa cấu hình LLM Provider hợp lệ hoặc URL provider trỏ vào địa chỉ nội bộ bị chặn SSRF | Kiểm tra **AI Studio Tab 1** (`dxosAi:listLlmServices`, `dxosAi:checkLlmHealth`); tránh dùng URL loopback/metadata (`127.0.0.1`, `169.254.169.254`) vì bị DNS SSRF guard chặn. Để kiểm thử offline không cần API key, dùng `node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95` |
| **Digital Twin `twinSetDesired` không đẩy xuống Node-RED** | Độ lệch nhiệt độ đặt mới so với shadow hiện tại `> 2.0°C` (`HITL_TEMP_THRESHOLD_C = 2.0`), hoặc thiếu `NODERED_ADMIN_PASS_HASH` trên prod | Vào **AI Studio → Tab 8 (HITL)** để người có thẩm quyền khác `requesterUserId` duyệt (`dxosAi:approveAction`). Trên `prod.yml`, bảo đảm đã đặt `NODERED_ADMIN_PASS_HASH` và `NODERED_CREDENTIAL_SECRET` |
| **Lỗi `pitr-backup.mjs check-config` từ chối backend** | Thiếu khóa mã hóa client-side cho `wal-g`/`pgbackrest` hoặc chạy `local-gz` mà thiếu cờ xác nhận | Production phải cung cấp `WALG_LIBSODIUM_KEY_PATH` / `WALG_PGP_KEY_PATH` (hoặc `PGBACKREST_REPO1_CIPHER_PASS`). Trong lab/nội bộ dùng `local-gz`, bắt buộc truyền `--allow-unencrypted-local` |

Xem thêm: [Hướng dẫn Kiểm thử Tự động & E2E Toàn diện](/operations/testing-e2e-guide) · [Sao lưu Toàn stack, PITR WAL `.gz` & Diễn tập DR](/operations/backup-pitr-dr)
