# Hướng dẫn Kiểm thử Tự động & E2E Toàn diện

Tài liệu này đồng bộ trực tiếp với [`docs/E2E_TESTING_GUIDE_HUNG.md`](https://github.com/CTU-OpenPaw/lattice-dx/blob/main/docs/E2E_TESTING_GUIDE_HUNG.md) trong **LatticeDX `v0.4.2`**, hướng dẫn dựng môi trường cài sạch từ đầu và kiểm thử trọn bộ toàn hệ thống qua **8 miền nghiệp vụ**, **5 vai trò người dùng** (+ khách ẩn danh), **12 Native v2 BlockModels**, **Mobile Field PWA (`/v/mobile`)**, **Public Portals (`/v/form/*`, `/v/track/*`)**, **P.A.R.A. OCR/RAG**, **DX-OS AI Studio (9 tab)**, **Control Studio (11 tab + 6 consoles)**, **LatticeFlow v2 (24 node)** và toàn bộ bộ kiểm thử tự động / Pure-OSI.

---

## Số liệu Kiểm chứng Baseline (`v0.4.2`)

| Hạng mục kiểm thử | Kết quả xác minh | Lệnh thực thi chính |
| --- | --- | --- |
| **Unit & Integration Tests (Tổng)** | **`2,509 / 2,509`** (`100%`) | `pnpm test` (`1,128` Vitest / `152` file) + `node --test` (`1,381` Node / `174` file) |
| **Live Docker Playwright & API E2E** | **`124 / 124`** (`100%`) | `pnpm acceptance:*` + bộ Playwright E2E trên runtime `:13014` |
| **Vietnamese NL Agent Eval** | **`163 / 163`** (`100%`) | `node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95` |
| **Pure-OSI PoF & SPDX Audit** | **`6 / 6 PASS`** (`1,098` file SPDX) | `node scripts/source-headers.mjs --check` & `pnpm pof:check` |
| **CycloneDX 1.5 SBOM & Security** | **`257 / 257`** (`0 NONE`, `0 CVE`) | `pnpm release:sbom -- --check` & `pnpm audit --prod --audit-level=low` |

---

## 0. Chuẩn bị Môi trường & Dựng Stack Từ Đầu (5–10 phút)

### 0.1. Yêu cầu môi trường

- **Node.js `24.x`** (`>=24 <25`), **pnpm `10.23.0`**, **Git**, và **Docker Desktop** đang chạy.
- Trình duyệt **Chrome / Edge** (khuyên mở thêm 1 cửa sổ **Ẩn danh / Incognito** để test luồng khách công khai và chuyển đổi tài khoản không dính session).

### 0.2. Dựng NocoBase `2.2.50` sạch + 7 plugin `0.4.2` + nạp dữ liệu demo

```powershell
git pull origin main
pnpm install --frozen-lockfile

# 1. Dựng NocoBase 2.2.50 trắng (0 bảng) + cài & bật đủ 7 plugin Apache-2.0 (0.4.2) ở cổng 13014
pnpm native:clean --port=13014
```

*(Ghi lại đường dẫn tệp `report.json` in ra ở cuối lệnh trên, thay vào `<path-to-report.json>` bên dưới.)*

```powershell
# 2. Dựng toàn bộ Multi-Portal + Workspace + đội ngũ nhân sự demo
node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"

# 3. Nạp 7 Starter AI Workforce, 20 Unified Tools, MCP Gateway & A2A
pnpm setup:dxos-ai -- --origin=http://localhost:13014

# 4. Nạp dữ liệu trình diễn chuỗi lạnh, OMS/WMS/FEFO, PKI, DMN, P.A.R.A., Public Forms
$env:NOCOBASE_ADMIN_PASSWORD = "admin123"
node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
pnpm seed:v100-showcase -- --origin=http://localhost:13014
```

> **Kiểm thử chế độ cài trắng (Blank-Slate):** Nếu muốn kiểm tra Onboarding Checklist khi chưa có dữ liệu mẫu, chạy:
> `LATTICE_SKIP_DEMO_SEED=1 pnpm native:clean --port=13014 --blank-slate`

### 0.3. Năm Vai trò & Tài khoản Kiểm thử (`http://localhost:13014`)

| Vai trò | Email / Tài khoản | Mật khẩu mặc định | Phạm vi kiểm thử |
| --- | --- | --- | --- |
| **Quản trị tối cao (`root`)** | `admin@nocobase.com` | `admin123` | Toàn bộ Admin Studio, AI Studio, Flow Studio, P.A.R.A., UI Editor, đa tổ chức |
| **Quản lý (`ldx_manager`)** | `native.lab.manager@example.invalid` | `NativeLab-2026!` | Phê duyệt, WMS FEFO, Sự cố, Portal quản lý, đối chiếu phân quyền với Admin |
| **Nhân viên (`ldx_employee`)** | `native.lab.employee@example.invalid` | `NativeLab-2026!` | Cổng nhân viên, tự chuyển hướng `/p/logistics`, kiểm tra chặn `403` vào Studio |
| **Điều phối (`ldx_dispatcher`)** | `native.lab.dispatcher@example.invalid` | `NativeLab-2026!` | Điều phối vận tải, phân bổ lô hàng & ePOD |
| **Tài xế (`ldx_driver`)** | `native.lab.driver@example.invalid` | `NativeLab-2026!` | Mobile Field PWA `/v/mobile`, ePOD offline & kiểm tra ẩn Digital Twin theo ACL |
| **Khách ngoài (Ẩn danh)** | *(Cửa sổ Incognito)* | — | `/v/form/:slug`, `/v/track/:code?verify=...`, `/signin` |

---

## 1. Miền 1 — Onboarding, Đăng nhập, Auth & Cổng Công khai

1. **Test 1.1 (`/signin` sạch lỗi & Việt hóa):** Mở cửa sổ Ẩn danh kèm DevTools (`Network` & `Console`), truy cập `http://localhost:13014/signin`. Kỳ vọng: không bắn bão `401` (`aiEmployees`/`aiConversations`), không có link tự đăng ký công khai; nhập sai mật khẩu hiển thị thông báo tiếng Việt rõ ràng.
2. **Test 1.2 (`root` vào thẳng Workspace):** Đăng nhập `admin@nocobase.com` / `admin123` → tự điều hướng tới `/admin/lattice-workspace` (không rơi vào trang trống `"No pages yet"`), chân trang giữ nguyên nhận diện **Điều 5.2 NocoBase** (`Powered by NocoBase`, `v2.2.50`, `https://www.nocobase.com`, `License settings`).
3. **Test 1.3 (Enterprise Auth SSO):** Truy cập `/admin/settings/auth/enterprise-mappings` → tải bình thường (không HTTP `500`), hiển thị cảnh báo sạch nếu Keycloak chưa chạy, có bộ chọn thân thiện và xác nhận `Popconfirm` khi xóa.
4. **Test 1.4 (Biểu mẫu công khai `/v/form/:slug`):** Mở `/v/form/yeu-cau-dich-vu-nhanh` ở Incognito → gửi trống báo lỗi inline tiếng Việt (`0` lỗi `401/403/404` cho logo/favicon); nhập chuỗi XSS `<img src=x onerror=alert(1)>` + đính kèm tệp rồi gửi → sinh **Mã tra cứu** + nút **Sao chép Mã** + **"Gửi hồ sơ khác"**, tuyệt đối không thực thi XSS; tra cứu thủ công chỉ hiển thị trạng thái Zero-PII.
5. **Test 1.5 (Tra cứu QR Ed25519 `/v/track/:code?verify=...`):** Tại `/p/logistics` → **WMS Ops** → bấm **In phiếu QR** cho đơn `ORD-V100-001` (đã xác nhận), mở link QR ở Incognito → hiển thị kết quả xác thực chữ ký **Ed25519** công khai hợp lệ nhưng vẫn giữ kín ePOD/PII cho tới khi nhập đúng `trackingToken` (có nút ẩn/hiện mã); trên mobile `390x844` toàn bộ nút rộng/cao `>= 44x44px`.
6. **Test 1.6 (Tương thích `/lattice/*`):** Mở `/lattice/workspace` (nếu bật bridge) → có breadcrumb **"Quay lại Workspace v2"**.

---

## 2. Miền 2 — Toàn bộ 7 Business Portals & 12 Native v2 BlockModels

Kiểm tra lần lượt trên cả độ phân giải **`1440x900`** và **`1280x800`**:

1. **`/p/logistics`:**
   - **WmsOpsBlock (`DxosWmsOpsBlockModel`):** Chọn `organizationId` (`native-ui-lab`), chạy **Phân bổ FEFO** (`0` lỗi `400`), thử **Tạm giữ MKT (`holdLotByMkt`)** rồi **Mở khóa QA (`releaseLotByQa`)**; bấm In phiếu trên đơn nháp báo lỗi tiếng Việt rõ ràng.
   - **Kanban & Lịch 7 ngày (`DxosKanbanScheduleBlockModel`):** Đổi chế độ, kiểm tra múi giờ `+07:00`, mở drawer chi tiết và CTA Phê duyệt.
   - **BiChartBlock (`DxosBiChartBlockModel`):** Chuyển đủ 5 chế độ **Bar / Line / Pie / KPI / Pivot**; mở **Cấu hình nội dung** (modal neo trên `top: 24px`, không cắt đỉnh, tên trường dễ hiểu).
   - **RecordWorkbenchBlock (`DxosRecordWorkbenchBlockModel`):** Kiểm tra Chatter, huy hiệu **Ed25519 PKI**, ngăn **Lineage**, **In chứng từ**, xuất **CSV / XLSX / PDF Unicode tiếng Việt**.
2. **`/p/incidents`:**
   - **WebGIS MapLibre (`DxosWebGisBlockModel`):** Hiển thị các điểm `COLD-CHILLER-CT-01`, `REEFER-TRUCK-HCM-02`, `COLD-HUB-DN-03`; mở ngăn **Điều khiển Digital Twin**, đặt nhiệt độ chênh `> 2.0°C` → tự đẩy sang hàng chờ HITL.
   - **AiProposalBlock & WorkflowTasksBlock:** Duyệt/từ chối trực tiếp hoạt động thật.
3. **`/p/services`:**
   - **ParaVaultBlock (`DxosParaVaultBlockModel`):** Mở tài liệu SOP hiển thị đầy đủ `contentMarkdown`, có phân trang, không lộ tài liệu `draft`/`archived`.
4. **`/p/procurement`, `/p/cmms`, `/p/partner-claims` (`CLM-V100-001`):** Tải mượt, Việt hóa 100%, không spam toast `503 local-9router`.
5. **Tiện ích Topbar & Negative RBAC (`ldx_employee`):**
   - Kiểm tra **`Ctrl+K`** (Command Palette), **Chuông thông báo (`Notification Bell`)**, và bật **UI Editor → `Add block`** xác nhận đủ **12 Native v2 BlockModels**.
   - Đăng nhập **`native.lab.employee@example.invalid` / `NativeLab-2026!`**: truy cập `/p/logistics` tự chuyển hướng về `/p/logistics-employee/...`; truy cập `/admin/settings/dxos-studio`, `/admin/settings/dxos-ai`, và `/admin/settings/workflow/automation` đều bị chặn **`403`**.

---

## 3. Miền 3 — Mobile Field PWA Ngoại tuyến (`/v/mobile`)

Mở Chrome/Edge DevTools ở chế độ Mobile **`390 x 844`** với tài khoản **`native.lab.driver@example.invalid` / `NativeLab-2026!`**:

1. **Manifest, Service Worker & ACL:** Xác nhận `<link rel="manifest">` (`/api/dxos:manifest`) có icon PNG `192x192` & `512x512`, Service Worker `/api/dxos:sw.js` đã đăng ký, nút chạm `>= 44x44px`, và tab **Digital Twin** được ẩn/khóa sạch theo ACL (không văng lỗi `403`).
2. **Offline ePOD & `gpsUnavailable`:** Chuyển Network sang **`Offline`**, vào tab ePOD nhập `ORD-V100-001`, tích **Kho lạnh mất GPS (`gpsUnavailable`)**, chụp/chọn ảnh + ký tay → lưu an toàn vào **IndexedDB Outbox**. Tạo thêm 1 báo sự cố offline.
3. **Quarantine (Chống mất dữ liệu lỗi `400/403/404/409/422`):** Tạo thêm 1 ePOD offline với mã đơn sai (ví dụ `ORD-KHONG-TON-TAI-999`), bật lại **`Online`** rồi bấm **Đồng bộ ngay** → đơn hợp lệ đồng bộ thành công; đơn sai chuyển sang **`quarantined`** (Cách ly / Cần sửa) cho phép **Sửa mã đơn gửi lại**, **Xuất JSON dự phòng**, hoặc **Xóa thủ công** — tuyệt đối không tự xóa mất ePOD.
4. **Hết phiên `401` & Chat LLM tắt:** Làm sai JWT trong `localStorage` rồi bấm đồng bộ → dừng ngay ở lỗi `401` đầu tiên, giữ nguyên Outbox và hiện banner **"Đăng nhập ngay"**. Gửi tin AI Chat khi `9router` tắt → hiện thẻ lỗi kèm nút **"Thử lại"**.

---

## 4. Miền 4 — Kho tri thức P.A.R.A., OCR-to-Record & Hybrid RAG

Với tài khoản `root` tại **`/admin/settings/dxos-para`**:

1. **CRUD, Lọc trạng thái & PII:** Tạo 1 tài liệu `status = active` và 1 tài liệu `status = draft`, bấm **Reindex**; tìm từ khóa của bản nháp không trả kết quả; tìm chuỗi vô nghĩa trả danh sách rỗng; `summary` tự động che CCCD/điện thoại.
2. **OCR-to-Record (`latticeStockLots` & `latticeOrders`):** Tải lên tệp `.txt`/`.docx`/`.xlsx`, bấm **Trích xuất OCR**, chọn bảng đích `latticeStockLots`, sửa trực tiếp `productName`, `qtyOnHand`, `lotCode` → bấm **"Tạo bản ghi từ OCR"** → bản ghi DB giữ đúng tuyệt đối giá trị người dùng đã sửa.

---

## 5. Miền 5 — DX-OS AI Studio (9 Tab), App Builder 2.0, MCP & Eval Lab

Truy cập **`/admin/settings/dxos-ai`**:

1. **Tab 1 (6 Phân hệ & Quick-Connect LLM):** Kiểm tra `dxosAi:listLlmServices`, thử nhập URL nội bộ (`http://127.0.0.1` hoặc `http://169.254.169.254`) → bị DNS SSRF guard & `redirect: 'error'` chặn an toàn.
2. **Tab 2 (Nhân sự AI):** Đủ **7 Starter Profiles** và 6 trường cấu hình.
3. **Tab 3 (MCP & A2A):** Danh mục **20 Unified Tools** hiển thị thực, bấm **Ping MCP**, kiểm tra `/.well-known/agent-card.json` hiển thị version **`0.4.2`**.
4. **Tab 6 (Duyệt AI HITL):** Đủ bộ lọc `pending`, `approved`, `rejected`, `executing`, `failed`, cột `executionResult` và `expiresAt`.
5. **Tab 7 (App Builder 2.0):** Chạy chu trình **`Plan`** (Visual ER Graph & Plan-Diff) → **`Build`** → **`Patch`** bằng tiếng Việt → **`Rollback`** (chỉ khôi phục đúng `blockUids` của app đó) → **`Teardown`** với hộp thoại `keepData` an toàn đa tenant.
6. **Tab 8 (Trace Waterfall & Eval Lab):** Chọn suite `vietnamese-nl-agent` (chế độ `router`) → chạy đủ **`163/163` ca (`100%`)**.
7. **Tab 9 (Quota Policy & Audit Log):** Lưu cấu hình hạn mức vào `latticeAiQuotaPolicies` (`FORCE RLS`), tải lại trang vẫn giữ giá trị; lọc Audit theo Trạng thái / Agent / Tổ chức đúng dữ liệu toàn cục và mốc giờ `+07:00`.

---

## 6. Miền 6 — Control Studio (11 Tab + 6 Governance Consoles)

Kiểm tra **`/admin/settings/dxos-studio`** ở cả **`1440x900`** và **`1280x800`**:

1. **Deep-link & Layout:** Truy cập `/admin/settings/dxos-studio?tab=dmn` mở đúng tab DMN; các tab `dmn`, `broker`, `automation`, `data-gov` ở `1280x800` không bị cắt nút thao tác.
2. **Thông báo Đa kênh (`dxosNotify`):** Kiểm tra danh sách kênh (SMTP / Telegram / Slack / Webhook), bấm **Gửi thử (`testSend`)** và xem bảng **Nhật ký gửi (`logs`)**.
3. **Public Form Builder (`dxosForms`):** Tạo form có trường `select` với `options`, `maxLength`/`pattern`, kiểm tra **Live Preview** và Drawer **`listSubmissions`**.
4. **Visual DMN Editor (`dxosDmn`):** Mở `cold_chain_approval_v1`, sửa rule chưa lưu rồi bấm **Mô phỏng (Simulate)** → tính theo bản nháp đang sửa; lưu được cả 4 Hit Policies (`FIRST`, `COLLECT`, `UNIQUE`, `PRIORITY`).
5. **Unified Approval Inbox (`dxosApprovals`):** Chuyển qua lại 4 nguồn (**Nghiệp vụ / AI HITL / Flow / Đề xuất AI**) → số badge các tab còn lại giữ nguyên; kiểm tra **Đã xem (`Review`)**, `diffPreview`, và Drawer cấu hình Approval Policy.
6. **Sổ cái PKI & Merkle (`dxosLedger`):** Bấm **Verify**, bấm **`rotateKey`** (khóa cũ chuyển `retired` nhưng chữ ký cũ dùng `expectedKeyId` vẫn xác thực hợp lệ), và **Xuất bằng chứng Merkle JSON**.
7. **PaaS PAT & Outbox/DLQ:** Cấp phát PAT mới kèm nút **Sao chép (Copy)**, thu hồi PAT; xem `payloadJson` và replay trên tab Outbox/DLQ.
8. **GitOps Solution Bundle v3:** Xuất JSON (`latticedx.solution-bundle/v3` đã che secret `latticeConnectors`), tải lại bằng `<input type="file">` hoặc JSON vừa xuất, bấm **Kiểm tra Diff (Dry-Run)** → **`HTTP 200 PASS`**.

---

## 7. Miền 7 — LatticeFlow v2 Workflow Automation Studio

Mở **`/admin/settings/workflow/automation`** bằng `root` hoặc `ldx_manager`:

1. **Phân quyền:** Xác nhận `ldx_employee` bị chặn `403` cả UI lẫn `listRules`/`listRuns`.
2. **Canvas-First Editor & 24 Node Types:** Xác nhận đủ **6 nhóm / 24 node types** (`trigger`: 5, `control`: 8, `data`: 3, `logic`: 2, `ai`: 2, `integration`: 4). Kéo 2 node Trigger vào canvas → validator client báo lỗi tiếng Việt ngay. Kiểm tra Inspector node `ai.agent` (`aiEmployee`, `model`, `temperature`, `maxTokens`, `memoryScope`), visual condition/mapping cho `control.if` / `control.switch` / `logic.transform`, và múi giờ `Asia/Ho_Chi_Minh` cho `trigger.schedule` + `toggleRule`.
3. **Dry Run, Versioning & Resume (`control.loop` / `control.merge`):** Chạy **Dry Run** xem Live Trace I/O JSON + **Copy-cURL**; **Publish** → sửa **Draft** → **Rollback**; kiểm thử `control.loop` chứa `control.approval` (HITL) xác nhận duyệt xong luồng chạy tiếp phần tử còn lại qua `loopCursor`; kiểm thử `control.merge` chế độ `first_completed` đi qua ngay không bị nhánh chậm giữ chân.

---

## 8. Miền 8 — Bộ Lệnh Kiểm thử Tự động, Nghiệm thu Live & Pure-OSI

Chạy trực tiếp tại thư mục gốc của kho `lattice-dx`:

```powershell
# 1. Typecheck + Vitest (152 file / 1,128 test) + Build đủ workspace
pnpm check
# (Nếu gặp Windows VirtualAlloc OOM khi chạy song song, tách riêng:
#  pnpm typecheck && pnpm test && pnpm -r --workspace-concurrency=1 build)

# 2. Toàn bộ kiểm thử 7 plugin NocoBase + scripts + externals (174 file / 1,381 test)
$files = @(
  Get-ChildItem -Path "plugins\nocobase\*\tests\*.test.cjs" -File | Select-Object -ExpandProperty FullName
  Get-ChildItem -Path "scripts\tests\*.test.mjs" -File | Select-Object -ExpandProperty FullName
  Get-ChildItem -Path "tests\*.test.mjs" -File | Select-Object -ExpandProperty FullName
)
node --test --test-concurrency=4 @files

# 3. Bộ đánh giá AI tiếng Việt tự nhiên (163/163 = 100%)
node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95

# 4. Kiểm toán Nguồn mở Pure-OSI, SPDX, SBOM CycloneDX 1.5 (257/257) & Bảo mật phụ thuộc (0 CVE)
node scripts/source-headers.mjs --check
pnpm pof:check
pnpm release:sbom -- --check
pnpm audit --prod --audit-level=low

# 5. Bộ nghiệm thu Live API/E2E (khi NocoBase đang chạy ở http://localhost:13014)
pnpm acceptance:headless-paas -- --origin=http://localhost:13014
pnpm acceptance:dxos-ai-mcp -- --origin=http://localhost:13014
pnpm acceptance:broker-automation-builder -- --origin=http://localhost:13014
pnpm acceptance:logistics-rbac -- "<path-to-report.json>"

# 6. Kiểm tra sao lưu & phục hồi toàn stack (không chạm dữ liệu thật)
pnpm backup:stack
pnpm backup:rehearse-stack -- "output/backups/stack/<bundle-id>"
```

### Dọn dẹp sau kiểm thử

```powershell
docker compose -f infra/compose/nocobase.yml down
```

Xem thêm: [Demo Pack, Kịch bản 15 phút Chung kết & Khắc phục Sự cố](/operations/demo-pack-troubleshooting) · [Giám sát OTel GenAI, Prometheus & Grafana 360°](/operations/observability)
