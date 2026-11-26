---
title: Kiến trúc Multi-Portal
description: Định tuyến đa cổng theo vai trò kinh doanh, quy tắc đặt slug, API latticePortals với khóa giao dịch PostgreSQL và hệ thống 8 vai trò ldx_*.
---

# Kiến trúc Multi-Portal

LatticeDX phân tách không gian làm việc theo vai trò nghiệp vụ trên một máy chủ NocoBase `2.2.50` duy nhất thay vì triển khai nhiều ứng dụng frontend tách rời. Plugin `@latticedx/plugin-lattice-foundation` quản lý vòng đời layout, ánh xạ route theo vai trò và metadata cổng, trong khi `@latticedx/plugin-dxos-studio` khởi tạo các cổng tổng quan mặc định và cockpit miền nghiệp vụ.

Mô hình này gắn mỗi đường dẫn `/p/<slug>` với một bản ghi `uiLayouts`, một cây route trong `desktopRoutes` được liên kết qua `desktopRoutesUiLayouts`, danh sách cấp quyền `rolesDesktopRoutes` và đối tượng cấu hình lưu trong `applicationPlugins.options.portals`. Mọi truy vấn bảng dữ liệu bên trong từng cổng đều đi qua lớp cô lập đa tổ chức `FORCE ROW LEVEL SECURITY` của PostgreSQL 16.

## Built-in Layouts và các Portal khởi tạo sẵn

Hệ thống định nghĩa hai layout nền tảng bất biến (`BUILTIN_UIDS`) không thể xóa qua API quản trị và bốn cổng tổng quan mặc định (`OVERVIEW_SPECS` trong `portal-composer.js`) cùng các cổng chuyên biệt được nạp qua Business Pack.

| Đường dẫn | Layout UID | Loại | Vai trò mặc định | Phạm vi vận hành |
| :--- | :--- | :--- | :--- | :--- |
| `/admin` | `admin-layout-model` | `desktop` | `root`, `admin` | Không gian quản trị hệ thống, cấu hình plugin và trình dựng giao diện |
| `/mobile` | `mobile-layout-model` | `mobile` | Vai trò vận hành hiện trường | Giao diện nền cho Field Mobile PWA và thao tác ngoài hiện trường |
| `/p/procurement` | `ldx-portal-procurement` | `desktop` | `ldx_employee`, `ldx_manager`, `ldx_director`, `ldx_admin` | Yêu cầu mua sắm (`latticeRequests`), sổ cái tài sản (`latticeAssets`) |
| `/p/incidents` | `ldx-portal-incidents` | `desktop` | `ldx_manager`, `ldx_dispatcher`, `ldx_warehouse`, `ldx_director`, `ldx_admin` | Sự cố IoT (`latticeIncidentCases`), luật cảm biến (`latticeIncidentRules`), WebGIS |
| `/p/logistics` | `ldx-portal-logistics` | `desktop` | `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver`, `ldx_manager`, `ldx_admin` | Đơn vận chuyển (`latticeOrders`), kho lạnh (`latticeLocations`), FEFO và ePOD |
| `/p/services` | `ldx-portal-services` | `desktop` | `ldx_employee`, `ldx_manager`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver`, `ldx_director`, `ldx_admin` | Phiếu dịch vụ (`latticeServiceTickets`), nhân sự, kho tri thức P.A.R.A. |

Các gói giải pháp (`dxosBuilder:installBusinessPack`) có thể khởi tạo thêm cổng miền nghiệp vụ như `/p/cmms` (bảo trì CMMS) hoặc `/p/partner-claims` (đối soát đối tác). Ở phía giao diện quản trị và studio, client đăng ký các route cố định gồm `/admin/lattice-workspace`, `/admin/lattice-builder`, `/admin/settings/multi-portal`, `/lattice`, `/lattice/console`, `/lattice/studio` và `/lattice/systems`.

::: tip Điều hướng dự phòng theo tiền tố cổng
Hàm `resolvePortalRedirect` tự động chuyển hướng người dùng truy cập `/p/<slug>` về trang đầu tiên (`firstPagePath`) mà vai trò đó có quyền xem. Khi một tài khoản không có quyền trên cổng chính nhưng có quyền trên cổng anh em cùng tiền tố (ví dụ `ldx_employee` truy cập `/p/logistics` sẽ chuyển về cổng phạm vi cá nhân), bộ định tuyến chuyển thẳng sang cổng hợp lệ thay vì hiển thị lỗi trắng trang.
:::

## Quy ước Slug và Ràng buộc Tên Cổng

Mọi cổng tùy biến tạo qua `latticePortals:save` đều được chuẩn hóa tại `normalizePortalInput` (`native-portal-helpers.js`) trước khi ghi xuống cơ sở dữ liệu.

<ParamGrid
  title="Quy tắc chuẩn hóa cấu hình Portal"
  :items="[
    { name: 'slug', type: 'string', required: true, description: 'Khớp biểu thức SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,35}[a-z0-9])$/ (2 đến 37 ký tự chữ thường, số hoặc dấu gạch nối ở giữa) và không thuộc RESERVED_SLUGS.' },
    { name: 'uid', type: 'string', description: 'Tự sinh theo mẫu ldx-portal-<slug> với cổng tùy biến. Nếu truyền uid khi tạo hoặc sửa, giá trị phải khớp ldx-portal-<slug> (trừ 2 built-in UID).' },
    { name: 'title', type: 'string', required: true, description: 'Tên hiển thị của cổng trên thanh chuyển cổng, độ dài từ 1 đến 80 ký tự.' },
    { name: 'layoutType', type: 'desktop | mobile', default: 'desktop', description: 'Chế độ hiển thị của layout trong uiLayouts.' },
    { name: 'routeName', type: 'string', description: 'Tự sinh theo mẫu p_<slug_underscored> (thay dấu gạch nối bằng gạch dưới) hoặc admin cho admin-layout-model.' },
    { name: 'routePath', type: 'string', description: 'Tự sinh theo mẫu /p/<slug> (hoặc /admin cho admin-layout-model).' },
    { name: 'icon', type: 'string', default: 'AppstoreOutlined', description: 'Tên icon hợp lệ khớp /^[a-zA-Z0-9_-]{1,64}$/.' },
    { name: 'color', type: 'string', default: '#1677ff', description: 'Mã màu Hex khớp /^#[0-9a-fA-F]{3,8}$/.' },
    { name: 'description', type: 'string', default: '\'\'', description: 'Mô tả ngắn về mục đích cổng, tự động cắt ở 300 ký tự.' },
    { name: 'isDefault', type: 'boolean', default: 'false', description: 'Đặt làm cổng mặc định; khi bật true, mọi cổng khác được đặt lại isDefault: false trong cùng transaction.' },
    { name: 'sort', type: 'integer', default: '0', description: 'Thứ tự sắp xếp trong danh sách chuyển cổng.' },
    { name: 'enabled', type: 'boolean', default: 'true', description: 'Bật hoặc tắt hiển thị cổng cho người dùng cuối.' },
    { name: 'roles', type: 'string[]', default: 'null', description: 'Danh sách tên vai trò kinh doanh được cấp quyền xem các route gắn với layout này.' }
  ]"
/>

### Danh sách Slug dành riêng (`RESERVED_SLUGS`)

Để tránh xung đột định tuyến với cổng quản trị, route công khai và tệp tĩnh, 11 từ khóa sau bị chặn vĩnh viễn khi tạo cổng mới:

```text
admin, settings, signin, signup, p, v, api, static, storage, files, lattice
```

## API `latticePortals` và Cơ chế Khóa Tuần tự PostgreSQL

Resource `latticePortals` (`native-portals.js`) cung cấp 5 action yêu cầu đăng nhập (`loggedIn`). Ngoại trừ `listAccessible`, bốn action quản trị (`list`, `save`, `destroy`, `exportBlueprint`) kiểm tra `isPortalAdmin`: người dùng phải mang vai trò `root`, có `allowConfigure: true`, hoặc sở hữu snippet `pm` / `pm.*`.

<ApiEndpoint
  method="GET"
  path="/api/latticePortals:list"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Trả về toàn bộ danh sách cổng (kể cả cổng đang tắt), số lượng route, danh sách vai trò hợp lệ và firstPagePath."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePortals:listAccessible?includeMobile=false"
  auth="Bearer JWT | Session"
  scope="loggedIn"
  summary="Lọc các cổng đang bật mà người dùng hiện tại có ít nhất một route khả dụng; mặc định ẩn admin-layout-model và mobile-layout-model với non-admin."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePortals:save"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Tạo mới hoặc cập nhật cổng trong transaction PostgreSQL, đồng bộ rolesDesktopRoutes và ghi metadata dưới khóa advisory."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePortals:destroy"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Xóa cổng tùy biến theo uid, gỡ liên kết desktopRoutesUiLayouts và xóa entry khỏi metadata cổng. Từ chối xóa built-in UID với mã 400."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePortals:exportBlueprint?uid=ldx-portal-logistics"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Xuất cây route đã làm sạch và danh sách vai trò theo chuẩn latticedx.portal-blueprint.v1."
/>

### Khóa Giao dịch `pg_advisory_xact_lock(741209551)` và Đồng bộ Quyền Route

Metadata mở rộng của các cổng (`icon`, `color`, `description`, `isDefault`, `sort`, `roles`) được lưu chung dưới khóa `options.portals` của bản ghi plugin `@latticedx/plugin-lattice-foundation` trong bảng `applicationPlugins`. Vì nhiều yêu cầu quản trị đồng thời có thể gây ghi đè chéo lên cột JSON này, hàm `createPortalMetaStore.write` thực thi câu lệnh:

```sql
SELECT pg_advisory_xact_lock(741209551);
```

Khóa giao dịch cấp phiên PostgreSQL bảo đảm chỉ một transaction cập nhật `options.portals` tại một thời điểm và tự giải phóng khi transaction commit hoặc rollback. Song song đó, hàm `syncPortalRoles` cập nhật bảng `rolesDesktopRoutes` cho các `desktopRouteId` gắn với `uiLayoutUid`:

- Chỉ các vai trò thỏa điều kiện `isBusinessPortalRole` mới được cấp hoặc thu hồi qua màn hình Multi-Portal.
- Trước khi thu hồi quyền của một vai trò không được chọn trên một route, hệ thống kiểm tra `protectedByOtherPortal`: nếu route đó vẫn đang thuộc `admin-layout-model` hoặc được một cổng anh em khác cấp cho vai trò tương ứng, quyền truy cập route của vai trò đó được giữ nguyên.

<CodeTabs
  :tabs="[
    {
      label: 'Tạo Portal mới',
      lang: 'bash',
      code: 'curl -X POST https://localhost:8443/api/latticePortals:save \\\n  -H \x22Authorization: Bearer $TOKEN\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \'{\n    \x22slug\x22: \x22quality-qa\x22,\n    \x22title\x22: \x22Kiểm soát Chất lượng QA\x22,\n    \x22layoutType\x22: \x22desktop\x22,\n    \x22icon\x22: \x22SafetyCertificateOutlined\x22,\n    \x22color\x22: \x22#D94E1F\x22,\n    \x22sort\x22: 35,\n    \x22roles\x22: [\x22ldx_warehouse\x22, \x22ldx_manager\x22, \x22ldx_admin\x22]\n  }\''
    },
    {
      label: 'Phản hồi exportBlueprint',
      lang: 'json',
      code: '{\n  \x22format\x22: \x22latticedx.portal-blueprint.v1\x22,\n  \x22license\x22: \x22Apache-2.0\x22,\n  \x22exportedAt\x22: \x222026-11-26T08:30:00.000Z\x22,\n  \x22portal\x22: {\n    \x22uid\x22: \x22ldx-portal-quality-qa\x22,\n    \x22slug\x22: \x22quality-qa\x22,\n    \x22title\x22: \x22Kiểm soát Chất lượng QA\x22,\n    \x22layoutType\x22: \x22desktop\x22,\n    \x22routeName\x22: \x22p_quality_qa\x22,\n    \x22routePath\x22: \x22/p/quality-qa\x22,\n    \x22enabled\x22: true,\n    \x22builtin\x22: false,\n    \x22icon\x22: \x22SafetyCertificateOutlined\x22,\n    \x22color\x22: \x22#D94E1F\x22,\n    \x22isDefault\x22: false,\n    \x22sort\x22: 35\n  },\n  \x22routes\x22: [],\n  \x22roles\x22: [\x22ldx_admin\x22, \x22ldx_manager\x22, \x22ldx_warehouse\x22]\n}'
    }
  ]"
/>

## Hệ thống 8 Vai trò Nghiệp vụ `ldx_*` và Bộ lọc Vai trò Portal

Plugin `@latticedx/plugin-lattice-foundation` khởi tạo sẵn 8 vai trò nghiệp vụ (`native-roles.js`) với cấu hình `allowConfigure: false`, `allowNewMenu: false`, `allowNewAiEmployee: false` và ACL chi tiết theo từng collection và trường dữ liệu.

| Tên vai trò | Nhãn tiếng Việt | Phạm vi mặc định trên Chứng từ (`latticeRequests`, `latticeOrders`) | Quyền ghi / hành động đặc thù |
| :--- | :--- | :--- | :--- |
| `ldx_employee` | Nhân viên | Chỉ xem bản ghi có `requester.userId` hoặc `assignee.userId` là chính mình | Tạo mới và sửa bản nháp (`status: 'draft'`) của chính mình |
| `ldx_manager` | Quản lý | Xem toàn bộ chứng từ thuộc tổ chức hiện tại | Tạo, sửa bản nháp của mình, duyệt/từ chối/phân công; quản lý sự cố IoT |
| `ldx_operator` | Vận hành | Phạm vi bản ghi liên quan (`requester` / `assignee`) | Thực thi tác vụ vận hành và hoàn tất công việc được giao |
| `ldx_warehouse` | Kho | Phạm vi bản ghi liên quan | Thao tác tồn kho FEFO, nhận/xuất lô hàng và theo dõi sự cố kho |
| `ldx_dispatcher` | Điều phối | Xem toàn bộ chứng từ thuộc tổ chức hiện tại | Tạo, sửa bản nháp, phân công điều phối và hoàn tất vận đơn |
| `ldx_driver` | Tài xế | Phạm vi bản ghi liên quan | Hoàn tất giao vận và ghi nhận ePOD hiện trường |
| `ldx_director` | Giám đốc (chỉ đọc) | Xem toàn bộ chứng từ thuộc tổ chức hiện tại | Chỉ đọc (`view`), không cấp quyền `create` hoặc `update` |
| `ldx_admin` | Quản trị nghiệp vụ | Xem toàn bộ chứng từ thuộc tổ chức hiện tại | Toàn quyền thao tác nghiệp vụ và xử lý sự cố trong tổ chức |

Hàm `isBusinessPortalRole` (`src/shared/portal-roles.js`) xác định danh sách vai trò được phép gán trên Multi-Portal Manager:

1. Tên vai trò phải khớp `BUSINESS_ROLE_NAME_RE = /^[a-z][a-z0-9_]{1,40}$/`.
2. Loại trừ bốn vai trò hệ thống trong `SYSTEM_PORTAL_EXCLUDED_ROLES`: `root`, `admin`, `anonymous`, `member`.
3. Loại trừ mọi vai trò có `allowConfigure === true` hoặc có snippet quản trị `pm` / `pm.*`.

## Thương hiệu Công khai `/v/lattice-brand.svg` và Gateway Định tuyến

Trong môi trường bảo mật không tin cậy mặc định, các tệp tải lên dưới đường dẫn `/files/*` yêu cầu phiên đăng nhập hợp lệ. Để màn hình đăng nhập, cổng tra cứu `/v/track/:code` và biểu mẫu `/v/form/:slug` hiển thị biểu tượng nhận diện mà không để lộ endpoint tệp nội bộ, `public-branding.js` cung cấp hai lớp xử lý:

- **`createPublicBrandingGatewayHandler`:** Phục vụ trực tiếp `GET` và `HEAD` tại `/v/lattice-brand.svg` (cùng đường dẫn dự phòng `/v/favicon_no_exist.ico`) với `Content-Type: image/svg+xml; charset=utf-8`, `Cache-Control: public, max-age=86400` và `X-Content-Type-Options: nosniff`.
- **`createSystemSettingsBrandingMiddleware`:** Bọc sau action `systemSettings:get`. Khi người dùng chưa đăng nhập hoặc logo đang trỏ tới đường dẫn hạt giống mặc định `/files/main/main/attachments/1.png` (`nocobase-logo`), middleware tự động viết lại `logo.url` và `logo.preview` thành `/v/lattice-brand.svg` và đặt `logo.title` thành `LatticeDX`.

Ở tầng reverse proxy (`infra/config/nginx/10-lattice-public-routes.sh`), Nginx chuyển tiếp các đường dẫn công khai `/.well-known/agent-card.json`, `/v/form`, `/v/track`, `/v/mobile`, `/track` về máy chủ ứng dụng và chuyển hướng `302` từ `/form` sang `/v/form`. Cả `BuilderShell` lẫn `MultiPortalSettingsPage` đều duy trì dòng ghi nhận `Powered by NocoBase` trỏ tới `https://www.nocobase.com` theo điều khoản Clause 5.2 của NocoBase `2.2.50`.

## Xử lý Sự cố và Mã Lỗi Thường Gặp

| Mã HTTP | Thông điệp / Nguyên nhân | Hướng xử lý |
| :--- | :--- | :--- |
| `400` | `Portal slug must match /^[a-z0-9](?:[a-z0-9-]{0,35}[a-z0-9])$/` hoặc `Portal slug is reserved` | Dùng slug 2–37 ký tự chữ thường/số/gạch nối và tránh 11 từ khóa trong `RESERVED_SLUGS`. |
| `400` | `Cannot delete built-in portal` | Không gọi `latticePortals:destroy` lên `admin-layout-model` hoặc `mobile-layout-model`; có thể tắt hiển thị qua `enabled: false` trên cổng tùy biến. |
| `403` | `Portal administration permission required` | Tài khoản gọi API không có vai trò `root`, `allowConfigure: true` hoặc snippet `pm` / `pm.*`. |
| `409` | `Portal with this slug already exists` hoặc `Portal route already exists` | `uid`, `routeName` hoặc `routePath` đã tồn tại trong `uiLayouts`; truyền đúng `uid` để cập nhật thay vì tạo mới. |

## Tài liệu liên quan

- [12 Native v2 BlockModels](/studio/native-blocks)
- [Biểu mẫu Công khai (/v/form/:slug)](/studio/public-forms)
- [Ứng dụng Hiện trường Mobile PWA](/studio/mobile-pwa)
- [Cô lập Đa tổ chức với PostgreSQL FORCE RLS](/architecture/multi-tenancy-rls)
