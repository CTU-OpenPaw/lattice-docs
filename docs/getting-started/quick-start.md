# Cài đặt Nhanh 1 Lệnh (Quick Start — `v0.4.2`)

LatticeDX `v0.4.2` cung cấp lệnh **`pnpm native:clean`** (`scripts/native-clean-install.mjs`) cho phép tái tạo toàn bộ môi trường NocoBase `2.2.50` sạch từ mã nguồn đã commit, tự động biên dịch 7 plugin Apache-2.0, chạy toàn bộ database migrations và kiểm chứng API trong một lệnh duy nhất.

---

## 1. Lấy mã nguồn & Cài phụ thuộc Workspace

Đảm bảo máy đáp ứng đủ [Yêu cầu Hệ thống](/getting-started/requirements) (`Node >=24 <25`, `pnpm 10.23.0`, `Git`, `tar` và Docker đang chạy).

```sh
git clone https://github.com/CTU-OpenPaw/lattice-dx.git
cd lattice-dx
pnpm install --frozen-lockfile
```

::: tip Tùy chọn build từ gói phát hành `.tar.gz`
Nếu làm việc trong môi trường không có Git remote hoặc kiểm toán gói phát hành nguồn, bạn có thể giải nén `latticedx-0.4.2-src.tar.gz` sau khi đối chiếu `sha256sum -c latticedx-0.4.2-src.tar.gz.sha256` rồi chạy `pnpm install --frozen-lockfile`.
:::

---

## 2. Dựng môi trường Sạch với `pnpm native:clean`

Script `scripts/native-clean-install.mjs` hỗ trợ **2 chế độ** rõ ràng tùy theo mục đích kiểm thử hoặc phát triển:

### Chế độ A: Clean-Lab đầy đủ kèm Seed & Nghiệm thu (Khuyên dùng)

```sh
pnpm native:clean --port=13014
```

- Chỉ nhận cổng trong dải **`13004–13999`** (mặc định `13004`) và bind an toàn về **`127.0.0.1`**.
- Mỗi lần chạy tạo một Docker Compose project độc lập `lattice-native-clean-<id>` (với `<id>` gồm 12 ký tự hex ngẫu nhiên) và các volume mới (`clean-db`, `clean-storage`) dưới `output/native-clean/<id>/`, không đụng vào lab cũ hay dữ liệu production.
- Tự động chạy kiểm chứng `acceptance-native-foundation.mjs`, `acceptance-native-documents.mjs` và `setup-native-ui-lab.mjs`, đồng thời **giữ container tiếp tục chạy** để bạn mở trình duyệt kiểm tra.
- Khi hoàn tất, màn hình in ra JSON chứa `pageUrl` và `reportPath` (ví dụ `output/native-clean/<id>/report.json`).

### Chế độ B: Cài trắng Blank-Slate (`--blank-slate` với `LATTICE_SKIP_DEMO_SEED=1`)

Dùng khi bạn muốn xác minh hệ thống ở trạng thái hoàn toàn trống dữ liệu nghiệp vụ mẫu (chỉ có khung nền tảng, vai trò và AI Architect):

```sh
# Tự động dọn container & volume ngay sau khi chạy xong vòng kiểm tra App Builder 2.0
pnpm native:clean --port=13014 --blank-slate

# Giữ container & volume lại sau khi chạy blank-slate để mở trình duyệt kiểm tra
pnpm native:clean --port=13014 --blank-slate --keep
```

Khi bật `--blank-slate`, script chèn biến `LATTICE_SKIP_DEMO_SEED: "1"` vào `overlay.yml` và thực hiện các kiểm chứng sau:

| Hạng mục kiểm chứng (`blankSlateDbProof`) | Giá trị xác nhận |
| --- | --- |
| Dữ liệu đơn hàng & sự cố mẫu (`latticeOrders`, `latticeIncidentCases`) | `0` bản ghi |
| Bộ vai trò nghiệp vụ (`ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_operator`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver`, `ldx_employee`) | Đủ `8` vai trò `ldx_*` |
| AI Architect (`dxos-architect` trong `latticeAiProfiles` & `aiEmployees`) | Đã khởi tạo (`1` / `1`) |
| Chính sách bảo vệ đa tổ chức trên `latticeBuiltApps` | Bật `ENABLE` + `FORCE ROW LEVEL SECURITY` |
| Vòng đời App Builder 2.0 (`runBlankSlateLifecycleCheck`) | Tạo app qua `/api/dxos-mcp`, kiểm tra thứ tự topological, `rebuildBuiltApp` v2, export `latticedx.solution-bundle/v3`, `teardownBuiltApp` |

::: warning Hành vi dọn dẹp của `--blank-slate` và `--keep`
Theo `finally` trong `scripts/native-clean-install.mjs`, khi truyền `--blank-slate` **mà không có** `--keep`, script sẽ tự động gọi `docker compose down -v --remove-orphans` sau khi kiểm tra xong. Nếu muốn giữ lab trắng để trải nghiệm trên trình duyệt (như kiểm tra Onboarding Checklist), hãy luôn thêm cờ `--keep`.
:::

---

## 3. Quá trình Build 7 Plugin & Khởi tạo Bên trong

Khi chạy `pnpm native:clean`, hệ thống thực hiện tuần tự chuỗi bước tự động từ `scripts/native-clean-install.mjs` và `scripts/install-workspace.mjs`:

1. **Xuất `HEAD` sạch**: Dùng `git archive` xuất mã nguồn đã commit vào `output/native-clean/<id>/source` (loại trừ file chưa commit và `.env` cục bộ).
2. **Xác nhận DB trắng**: Khởi động `nocobase-db` (`pgvector/pgvector:0.8.1-pg16`) và khẳng định `pg_tables` trong schema `public` có **0 bảng** trước khi bật NocoBase.
3. **Bootstrap Host & Backup**: Khởi động `nocobase/nocobase:2.2.50`, đợi `/api/app:getLang` sẵn sàng, sau đó thực hiện `pg_dump --format=custom` lưu vào `output/native-clean/<id>/backups/`.
4. **Build 7 Plugin Apache-2.0 (`0.4.2`)**:
   - Khôi phục lockfile cho `@latticedx/plugin-enterprise-auth` bằng `npm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund`.
   - Chạy lần lượt 7 script build:
     - `node plugins/nocobase/action-bridge/build.mjs` (`@latticedx/plugin-action-bridge`)
     - `node plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs` (`@latticedx/plugin-lattice-foundation`)
     - `node plugins/nocobase/plugin-enterprise-auth/build.mjs` (`@latticedx/plugin-enterprise-auth`)
     - `node plugins/nocobase/plugin-dxos-para/build.mjs` (`@latticedx/plugin-dxos-para`)
     - `node plugins/nocobase/plugin-dxos-blocks/build.mjs` (`@latticedx/plugin-dxos-blocks`)
     - `node plugins/nocobase/plugin-dxos-studio/build.mjs` (`@latticedx/plugin-dxos-studio`)
     - `node plugins/nocobase/plugin-dxos-ai/build.mjs` (`@latticedx/plugin-dxos-ai`)
5. **Đóng gói, Cài đặt & Migrate**: Thực thi `npm pack --offline --ignore-scripts`, `yarn nocobase pm add`, `yarn nocobase pm enable`, `yarn nocobase upgrade`, rồi đối chiếu toàn bộ tên migration `/@latticedx/` và danh sách plugin đã bật.

---

## 4. Nạp Dữ liệu Trình diễn Multi-Portal & AI Workforce (Tùy chọn)

Sau khi `pnpm native:clean --port=13014` hoàn tất và in ra `<path-to-report.json>`, bạn có thể nạp đầy đủ 7 cổng nghiệp vụ, 7 nhân sự AI, dữ liệu chuỗi lạnh, WMS FEFO, PKI và P.A.R.A. để trải nghiệm trọn bộ hệ thống:

```powershell
# 1. Thiết lập Multi-Portal & Workspace phân quyền theo vai trò
node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"

# 2. Nạp 7 Starter AI Workforce, 20 Unified Tools, MCP Gateway & A2A
pnpm setup:dxos-ai -- --origin=http://localhost:13014

# 3. Nạp dữ liệu trình diễn chuỗi lạnh, OMS/WMS/FEFO, PKI, DMN, P.A.R.A., Public Forms
$env:NOCOBASE_ADMIN_PASSWORD = "admin123"
node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
pnpm seed:v100-showcase -- --origin=http://localhost:13014
```

*(Trên bash/zsh, thay `$env:NOCOBASE_ADMIN_PASSWORD = "admin123"` bằng `NOCOBASE_ADMIN_PASSWORD="admin123"` trước lệnh `node`/`pnpm`.)*

---

## 5. Các URL Đăng nhập & Tài khoản Kiểm thử

Mở trình duyệt tại `http://localhost:13014/signin`. Khi đăng nhập với tài khoản quản trị, hệ thống chuyển hướng trực tiếp vào **`/admin/lattice-workspace`** (không rơi vào trang `/admin` trống).

### 5.1. Danh sách Đường dẫn Chính

| Đường dẫn | Mục đích sử dụng |
| --- | --- |
| `/signin` | Màn hình đăng nhập (và `/enterprise-login` cho OIDC/PKCE) |
| `/admin/lattice-workspace` | Không gian làm việc trung tâm, lối tắt tới các cổng `/p/*` và hộp thư phê duyệt |
| `/admin/lattice-builder` | Công cụ cấu hình ứng dụng & nút thao tác nhanh trên Workspace |
| `/p/logistics` | Cổng điều hành Logistics, OMS/WMS, phân bổ FEFO, BI & chứng từ PKI |
| `/p/incidents` | Cổng Sự cố & Chuỗi lạnh: bản đồ WebGIS, Digital Twin 2 chiều, AI Proposals |
| `/p/services` | Cổng Dịch vụ nội bộ & Kho tri thức P.A.R.A. Vault (`contentMarkdown`, OCR/RAG) |
| `/p/procurement` | Cổng Mua sắm & Đề xuất nội bộ |
| `/p/cmms` | Cổng Quản lý Bảo trì Thiết bị (CMMS) |
| `/p/partner-claims` | Cổng Đối soát & Khiếu nại Đối tác |
| `/admin/settings/dxos-ai` | **DX-OS AI Studio** (9 tab: Profiles, Workforce, Tools, MCP, A2A, App Builder 2.0, Eval Lab 163 ca, Traces, Quota & PII) |
| `/admin/settings/dxos-studio` | **DX-OS Control Studio** (11 tab + 6 console quản trị nền tảng) |
| `/admin/settings/workflow/automation` | **LatticeFlow v2 DAG Studio** (24 node, cũng truy cập qua `/admin/settings/dxos-flow-studio`) |
| `/admin/settings/dxos-para` | Cấu hình Kho tri thức P.A.R.A. & chỉ mục Hybrid RAG |
| `/admin/settings/multi-portal` | Quản lý cổng & phân quyền Portal |
| `/admin/settings/auth/enterprise-mappings` | Cấu hình ánh xạ đăng nhập Enterprise OIDC/Keycloak |
| `/v/mobile` | **Mobile Field PWA** (giao diện hiện trường `390x844`, hàng đợi IndexedDB offline) |
| `/v/form/<slug>` | Biểu mẫu công khai Zero-PII (hỗ trợ đính kèm tệp & tra cứu mã hồ sơ) |
| `/v/track/<code>` | Tra cứu vận đơn công khai & xác thực chữ ký QR Ed25519 |

### 5.2. Tài khoản Fixture Cục bộ (`127.0.0.1` / `localhost`)

| Vai trò | Email / Tài khoản | Mật khẩu fixture | Phạm vi kiểm thử |
| --- | --- | --- | --- |
| `root` (Quản trị tối cao) | `admin@nocobase.com` | `admin123` | Toàn quyền Studio, AI Studio, Flow Studio, P.A.R.A., đa tổ chức |
| `ldx_manager` | `native.lab.manager@example.invalid` | `NativeLab-2026!` | Phê duyệt, WMS FEFO, xử lý sự cố, portal quản lý |
| `ldx_employee` | `native.lab.employee@example.invalid` | `NativeLab-2026!` | Cổng nhân viên (`/p/logistics-employee`), bị chặn `403` vào Studio |
| `ldx_dispatcher` | `native.lab.dispatcher@example.invalid` | `NativeLab-2026!` | Điều phối vận tải, phân bổ lô hàng & ePOD |
| `ldx_driver` | `native.lab.driver@example.invalid` | `NativeLab-2026!` | Mobile Field PWA `/v/mobile`, ký/chụp ePOD offline |

::: danger Chỉ sử dụng trên Loopback (`127.0.0.1` / `localhost`)
Tất cả mật khẩu trên là **fixture công khai phục vụ lab cục bộ**. Tuyệt đối không mở các cổng lab ra Internet hoặc sử dụng các giá trị mặc định này trong môi trường production. Xem thêm cảnh báo tại [Cấu hình Biến môi trường](/getting-started/configuration).
:::

---

## 6. Dừng hoặc Dọn sạch Lab

Để tạm dừng lab mà vẫn giữ volume dữ liệu (dùng đúng `<id>` trong `report.json`):

```sh
docker compose -p lattice-native-clean-<id> -f output/native-clean/<id>/source/infra/compose/native-rehearsal.yml -f output/native-clean/<id>/overlay.yml stop
```

Để xóa toàn bộ container, network và volume của lab sau khi kiểm thử xong:

```sh
docker compose -p lattice-native-clean-<id> -f output/native-clean/<id>/source/infra/compose/native-rehearsal.yml -f output/native-clean/<id>/overlay.yml down -v --remove-orphans
```

Bước tiếp theo: tham khảo [Hướng dẫn Kiểm thử E2E](/operations/testing-e2e-guide) để đi qua trọn vẹn 8 miền kiểm thử, hoặc xem [Triển khai Production Zero-Trust](/getting-started/production-deployment) để đưa hệ thống lên hạ tầng thực tế.
