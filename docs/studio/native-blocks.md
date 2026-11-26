---
title: 12 Native v2 BlockModels
description: Tham chiếu kỹ thuật đầy đủ cho 12 lớp Dxos*BlockModel trong @latticedx/plugin-dxos-blocks, flow dxosBlockSettings, 11 widget và 5 theme của CreativeStudio, bộ lọc DANGEROUS_FILTER_KEYS và 8 block nền tảng.
---

# 12 Native v2 BlockModels

Plugin `@latticedx/plugin-dxos-blocks` cung cấp 12 lớp giao diện khai báo `Dxos*BlockModel` chạy trên FlowEngine v2 (`@nocobase/client-v2`) của NocoBase `2.2.50`. Toàn bộ 12 lớp được đăng ký ở client qua hàm `registerDxosBlockModels(client, React, antd, clientV2, flowEngine, app)` (`src/client/block-models.js`) và được kiểm soát danh sách cho phép ở phía máy chủ qua `ALLOWED_DXOS_BLOCK_USES` (`portal-composer.js`) cùng `ALLOWED_FLOW_MODEL_USES` (`solution-bundle.js`).

Mỗi block gắn kết trực tiếp với dữ liệu nghiệp vụ theo phạm vi tổ chức (`organizationId`), tuân thủ kiểm tra ACL ở tầng ứng dụng và `FORCE ROW LEVEL SECURITY` ở tầng PostgreSQL 16.

## Kiến trúc chung: `dxosBlockSettings`, Lưới Grid và 8 Block Nền tảng

Tất cả 12 `Dxos*BlockModel` kế thừa `BaseBlockModel` (`clientV2?.BlockModel || flowEngine?.getModelClass?.('BlockModel')`) và dùng chung một cơ chế cấu hình động:

| Cơ chế | Định danh / Điểm gắn | Hành vi kỹ thuật |
| :--- | :--- | :--- |
| Flow cấu hình | `dxosBlockSettings` (`on: 'beforeRender'`) | Mở hộp thoại bước `config` (`uiMode: { type: 'dialog' }`, `top: 24px`, `maxHeight: '78vh'`). Lưu gọi `ctx.model.setProps(params)` và `notifyModelListeners(ctx.model)`. |
| Hợp nhất cấu hình | `readModelConfig(model, defaults, liveConfig)` | Áp dụng thứ tự ưu tiên `{ ...defaults, ...(model?.props || {}), ...stepParams.dxosBlockSettings.config, ...(liveConfig || {}) }`. |
| Lưới bố cục | FlowEngine `Grid` (`PortalPageModel` / `RootPageModel`) | Hỗ trợ xếp cạnh nhiều cột qua `gridSettings` (`placeBesideOrInsertBlock`). |
| Metadata động | `dxosBlocks:collectionsMeta` | Nạp collection chuẩn và `latticeCustom*` theo quyền `view`, loại bỏ hơn 70 bảng `META_EXCLUDED_COLLECTIONS` và cột nhạy cảm (`password`, `secret`, `token`, `apiKey`, `privateKey`, `hash`, `salt`, `embedding`, `searchVector`). |

::: info Phân biệt với 8 Foundation Context BlockModels
Ngoài 12 DX-OS Native v2 `Dxos*BlockModel`, plugin `@latticedx/plugin-lattice-foundation` (`src/client/index.js`) đăng ký riêng 8 BlockModel ngữ cảnh nền tảng dùng flow `latticeBinding` (liên kết tới manifest trong `latticeApps:list`): `LatticeFormBlockModel`, `LatticeListBlockModel`, `LatticeTaskInboxBlockModel`, `LatticeApprovalBlockModel`, `LatticeAttachmentBlockModel`, `LatticeActivityTimelineBlockModel`, `LatticeContextEntityBlockModel` và `LatticeWorkflowFormBlockModel`.
:::

## Bảng tổng hợp 12 `Dxos*BlockModel`

| # | Tên lớp `Dxos*BlockModel` | Nhãn trên UI | API / Collection chính |
| :--- | :--- | :--- | :--- |
| 1 | `DxosPortalHeroBlockModel` | `DX-OS Portal Hero & Quick Actions` | Điều hướng client qua `filterHeroActions` và `isSafeAppPath` |
| 2 | `DxosKpiMetricBlockModel` | `DX-OS KPI Metric Grid` | `GET ${m.collection}:list` (`pageSize: 1`, đọc `meta.count`) |
| 3 | `DxosContextTelemetryBlockModel` | `DX-OS NGSI-LD Context & Telemetry` | `POST dxosBlocks:contextTelemetry` |
| 4 | `DxosAiProposalBlockModel` | `DX-OS AI Proposal & Evidence` | `POST dxosBlocks:proposals`, `POST dxosBlocks:decideProposal` |
| 5 | `DxosWorkflowTasksBlockModel` | `DX-OS Workflow & My Tasks` | `GET workflowManualTasks:list`, `POST workflowManualTasks:submit` |
| 6 | `DxosParaVaultBlockModel` | `DX-OS P.A.R.A. Knowledge Vault` | `latticeParaDocuments:list`, `latticeParaDocuments:create` |
| 7 | `DxosCreativeStudioBlockModel` | `DX-OS Creative Studio Micro-App` | Bộ thực thi truy vấn khai báo (`collection`, `telemetry`, `tasks`, `timeseries`) |
| 8 | `DxosRecordWorkbenchBlockModel` | `DX-OS Chatter, Chứng từ & Xuất báo cáo` | `latticeChatter:list`/`post`, `dxosBlocks:exportReport`, `dxosWms:printVoucher` |
| 9 | `DxosWebGisBlockModel` | `DX-OS Bản đồ Giám sát WebGIS [D]` | `dxosBlocks:twinShadow`, `dxosBlocks:twinSetDesired` |
| 10 | `DxosKanbanScheduleBlockModel` | `DX-OS Bảng Kanban & Lịch [H]` | `${collection}:list` / `:update` |
| 11 | `DxosWmsOpsBlockModel` | `DX-OS Vận hành Kho FEFO & Bulk Import [W]` | `dxosWms:*`, `dxosBlocks:bulkImportDryRun`, `dxosBlocks:bulkImportCommit` |
| 12 | `DxosBiChartBlockModel` | `DX-OS Biểu đồ & Phân tích BI [D]` | `POST dxosBlocks:aggregateQuery` |

---

## Chi tiết từng BlockModel

### 1. `DxosPortalHeroBlockModel`

Hiển thị dải tiêu đề đầu cổng kèm huy hiệu ngữ cảnh, màu nhấn và các nút thao tác nhanh được lọc theo quyền RBAC của người dùng hiện tại. Hàm `filterHeroActions(actionsJson, perms)` loại bỏ mọi nút trỏ tới đường dẫn không hợp lệ theo `isSafeAppPath` (chặn `javascript:`, URL ngoài domain hoặc đường dẫn studio với vai trò vận hành).

<ParamGrid
  title="Thuộc tính DxosPortalHeroBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Không gian Điều hành Doanh nghiệp DX-OS', description: 'Tiêu đề chính của banner cổng.' },
    { name: 'subtitle', type: 'string', default: 'Nền mở NocoBase 2.2.50 cho H–P–D–I', description: 'Mô tả ngắn hiển thị dưới tiêu đề.' },
    { name: 'badge', type: 'string', default: 'DX-OS', description: 'Nhãn nhận diện ngắn đặt cạnh tiêu đề.' },
    { name: 'accentColor', type: 'string', default: '#1677ff', description: 'Mã màu nhấn Hex cho đường viền và nút primary.' },
    { name: 'actionsJson', type: 'string (JSON)', default: 'DEFAULT_HERO_ACTIONS', description: 'Mảng đối tượng [{ label, path, primary? }] xác định nút thao tác nhanh.' }
  ]"
/>

### 2. `DxosKpiMetricBlockModel`

Hiển thị lưới thẻ chỉ số đếm bản ghi thời gian thực theo từng collection và bộ lọc JSON. Giá trị `columns` tự động kẹp trong khoảng `1..4`. Với mỗi thẻ trong `metricsJson`, block gọi `GET ${m.collection}:list` với `pageSize: 1` để lấy `meta.count` và điều hướng về `targetPath` khi người dùng nhấp vào thẻ.

<ParamGrid
  title="Thuộc tính DxosKpiMetricBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Chỉ số vận hành', description: 'Tiêu đề nhóm thẻ KPI.' },
    { name: 'columns', type: 'number', default: '4', description: 'Số cột hiển thị trên lưới, tự động kẹp từ 1 đến 4.' },
    { name: 'metricsJson', type: 'string (JSON)', default: 'DEFAULT_KPI_METRICS', description: 'Mảng [{ label, collection, filter?, color, targetPath }] định nghĩa từng thẻ.' }
  ]"
/>

### 3. `DxosContextTelemetryBlockModel`

Kết nối trực tiếp `POST dxosBlocks:contextTelemetry` để hiển thị trạng thái thực thể NGSI-LD từ FIWARE Orion-LD, chuỗi giá trị cảm biến mới nhất và trạng thái hàng đợi `latticeContextOutbox`. Các giá trị số vượt `warningThreshold` được đánh dấu cảnh báo trực quan.

<ParamGrid
  title="Thuộc tính DxosContextTelemetryBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Ngữ cảnh NGSI-LD & Cảm biến', description: 'Tiêu đề khối giám sát ngữ cảnh.' },
    { name: 'assetEntityId', type: 'string', default: '\'\'', description: 'Mã tài sản hoặc URN NGSI-LD; để trống sẽ tự chọn thực thể đầu tiên trong tổ chức.' },
    { name: 'warningThreshold', type: 'string', default: '80', description: 'Ngưỡng số học làm nổi bật cảnh báo trên chỉ số.' },
    { name: 'showSyncStatus', type: 'boolean', default: 'true', description: 'Hiển thị số lượng bản ghi chờ đồng bộ trong Outbox.' }
  ]"
/>

### 4. `DxosAiProposalBlockModel`

Hiển thị hàng đợi đề xuất do tác nhân AI tạo ra qua `POST dxosBlocks:proposals` và cho phép người dùng thực hiện quyết định `approve`, `review` hoặc `reject` qua `POST dxosBlocks:decideProposal`. Quy trình phê duyệt áp dụng nguyên tắc Poka-yoke chống tự phê duyệt (`SELF_APPROVAL_FORBIDDEN`): tác nhân hoặc người đề xuất không thể tự duyệt đề xuất của chính mình.

<ParamGrid
  title="Thuộc tính DxosAiProposalBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Đề xuất AI & Bằng chứng', description: 'Tiêu đề danh sách đề xuất.' },
    { name: 'targetCollection', type: 'enum', default: 'latticeIncidentCases', description: 'Một trong 5 collection: latticeIncidentCases, latticeAssets, latticeRequests, latticeOrders, latticeServiceTickets.' },
    { name: 'state', type: 'all | proposed | reviewed', default: 'all', description: 'Lọc trạng thái đề xuất AI.' },
    { name: 'pageSize', type: 'number', default: '5', description: 'Số dòng tối đa trên mỗi trang.' },
    { name: 'showEvidence', type: 'boolean', default: 'true', description: 'Hiển thị trích dẫn dữ liệu và bằng chứng kèm theo.' }
  ]"
/>

### 5. `DxosWorkflowTasksBlockModel`

Tải danh sách tác vụ thủ công cần xử lý của tài khoản đang đăng nhập qua `GET workflowManualTasks:list` và gửi kết quả hoàn thành qua `POST workflowManualTasks:submit`.

<ParamGrid
  title="Thuộc tính DxosWorkflowTasksBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Hộp việc Quy trình Poka-yoke', description: 'Tiêu đề hộp tác vụ.' },
    { name: 'statusFilter', type: 'pending | resolved | all', default: 'pending', description: 'Lọc trạng thái tác vụ quy trình.' },
    { name: 'pageSize', type: 'number', default: '6', description: 'Số tác vụ hiển thị tối đa.' }
  ]"
/>

### 6. `DxosParaVaultBlockModel`

Hiển thị và cho phép tạo nhanh tài liệu tri thức trong kho P.A.R.A. (`latticeParaDocuments:list` và `:create`). Block tự đọc tham số `?paraDocId=` trên URL để mở trực tiếp tài liệu được liên kết từ trang khác.

<ParamGrid
  title="Thuộc tính DxosParaVaultBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Kho tri thức P.A.R.A.', description: 'Tiêu đề khối tri thức.' },
    { name: 'paraSpace', type: 'all | projects | areas | resources | archives', default: 'all', description: 'Phân vùng P.A.R.A. mặc định khi mở trang.' },
    { name: 'pageSize', type: 'number', default: '6', description: 'Số tài liệu hiển thị mỗi trang (1..25).' },
    { name: 'enableQuickCreate', type: 'boolean', default: 'true', description: 'Cho phép tạo nhanh tài liệu Markdown ngay trên block.' },
    { name: 'defaultOrganizationId', type: 'string', default: '\'\'', description: 'Mã tổ chức mặc định áp dụng khi tài khoản root thao tác.' }
  ]"
/>

### 7. `DxosCreativeStudioBlockModel`

Micro-app dựng buồng điều hành theo DSL JSON khai báo (`blueprintJson` với mặc định `DEFAULT_CREATIVE_BLUEPRINT`) mà không dùng `eval()` hay `new Function()`. Parser `parseCreativeBlueprint` (`creative-studio-block.js`) giới hạn tối đa `6` truy vấn (`queries`) và `12` widget (`widgets`), đồng thời kẹp `columns` trong khoảng `1..4`.

<ParamGrid
  title="Thuộc tính DxosCreativeStudioBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Buồng Điều hành Thông minh', description: 'Tiêu đề hiển thị trên khung ngoài của block.' },
    { name: 'blueprintJson', type: 'string (JSON)', default: 'DEFAULT_CREATIVE_BLUEPRINT', description: 'Định nghĩa JSON gồm title, subtitle, theme, columns, queries và widgets.' }
  ]"
/>

#### Danh mục `CreativeStudio`: 4 Loại Truy vấn, 11 Widget và 5 Theme

| Nhóm DSL | Hằng số | Giá trị được hỗ trợ |
| :--- | :--- | :--- |
| Loại truy vấn (`4`) | `VALID_QUERY_KINDS` | `collection` (tối đa `limit: 50`), `telemetry`, `tasks`, `timeseries` (tối đa `limit: 200`). |
| Loại widget (`11`) | `VALID_WIDGET_TYPES` | `gauge`, `thermometer`, `timeseries-line`, `stage-pipeline`, `distribution-bars`, `rule-callout`, `status-matrix`, `quick-actions` (tối đa 6 nút `navigate` / `createRecord` / `askAi`), `export-bar`, `chatter`, `voucher-actions`. |
| Bảng màu (`5`) | `CREATIVE_THEMES` | `industrial-cockpit`, `emerald-ops`, `amber-alert`, `royal-indigo`, `clean-light`. |

<CodeTabs
  :tabs="[
    {
      label: 'Blueprint JSON mẫu',
      lang: 'json',
      code: '{\n  \x22title\x22: \x22Giám sát Kho lạnh Khu A\x22,\n  \x22subtitle\x22: \x22Theo dõi tồn kho và nhiệt độ chuỗi thời gian theo thời gian thực.\x22,\n  \x22theme\x22: \x22emerald-ops\x22,\n  \x22columns\x22: 2,\n  \x22queries\x22: [\n    { \x22id\x22: \x22lots\x22, \x22kind\x22: \x22collection\x22, \x22collection\x22: \x22latticeStockLots\x22, \x22limit\x22: 30 },\n    { \x22id\x22: \x22tempSeries\x22, \x22kind\x22: \x22timeseries\x22, \x22assetEntityId\x22: \x22urn:ngsi-ld:Asset:org1:native:1\x22, \x22attribute\x22: \x22temperature\x22, \x22limit\x22: 100 }\n  ],\n  \x22widgets\x22: [\n    { \x22type\x22: \x22gauge\x22, \x22title\x22: \x22Tổng lô hàng\x22, \x22queryId\x22: \x22lots\x22, \x22metric\x22: \x22count\x22, \x22max\x22: 50, \x22unit\x22: \x22lô\x22 },\n    { \x22type\x22: \x22thermometer\x22, \x22title\x22: \x22Nhiệt độ hiện tại\x22, \x22queryId\x22: \x22tempSeries\x22, \x22metric\x22: \x22latest\x22, \x22field\x22: \x22value\x22, \x22unit\x22: \x22°C\x22 },\n    { \x22type\x22: \x22distribution-bars\x22, \x22title\x22: \x22Trạng thái lô\x22, \x22queryId\x22: \x22lots\x22, \x22field\x22: \x22status\x22 },\n    { \x22type\x22: \x22quick-actions\x22, \x22title\x22: \x22Thao tác nhanh\x22, \x22buttons\x22: [{ \x22label\x22: \x22Mở Kho FEFO\x22, \x22kind\x22: \x22navigate\x22, \x22targetPath\x22: \x22/p/logistics\x22, \x22primary\x22: true }] }\n  ]\n}'
    }
  ]"
/>

### 8. `DxosRecordWorkbenchBlockModel`

Bàn làm việc chứng từ tích hợp 6 chức năng trên cùng một panel: thanh vòng đời chứng từ, nhật ký trao đổi (`latticeChatter:list`/`post`), huy hiệu xác thực chữ ký Ed25519 PKI, phả hệ dữ liệu (`latticeDataLineage`), nút in phiếu QR (`dxosWms:printVoucher`) và xuất báo cáo CSV/XLSX/PDF có lọc cột nhạy cảm (`dxosBlocks:exportReport`). Danh sách `WORKBENCH_COLLECTION_ENUM` gồm `latticeRequests`, `latticeOrders`, `latticeServiceTickets`, `latticeAssets`, `latticeIncidentCases`, `latticeParaDocuments` và tự mở rộng thêm các bảng `latticeCustom*`.

<ParamGrid
  title="Thuộc tính DxosRecordWorkbenchBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Trao đổi Chatter, Chứng từ & Xuất báo cáo', description: 'Tiêu đề bàn làm việc.' },
    { name: 'collection', type: 'string', default: 'latticeRequests', description: 'Collection nghiệp vụ hoặc collection mở rộng latticeCustom*.' },
    { name: 'recordId', type: 'string', default: '\'\'', description: 'ID bản ghi cố định (tùy chọn); để trống sẽ tự chọn hoặc theo ngữ cảnh.' },
    { name: 'showExport', type: 'boolean', default: 'true', description: 'Hiển thị thanh xuất báo cáo CSV/XLSX/PDF.' },
    { name: 'showVoucherActions', type: 'boolean', default: 'true', description: 'Hiển thị thanh chuyển trạng thái chứng từ.' },
    { name: 'showChatter', type: 'boolean', default: 'true', description: 'Hiển thị luồng bình luận gắn với bản ghi.' },
    { name: 'showPkiBadge', type: 'boolean', default: 'true', description: 'Hiển thị trạng thái chữ ký Ed25519 trên sổ cái PKI.' },
    { name: 'showLineage', type: 'boolean', default: 'true', description: 'Hiển thị ngăn phả hệ dữ liệu liên kết.' },
    { name: 'showPrintVoucher', type: 'boolean', default: 'true', description: 'Hiển thị nút in chứng từ kèm mã QR.' }
  ]"
/>

### 9. `DxosWebGisBlockModel`

Hiển thị bản đồ giám sát địa lý dùng `maplibre-gl` kèm bản đồ SVG dự phòng vùng Việt Nam (`lat: 8.0..23.8`, `lng: 102.0..110.2`) với các hub mặc định (`HUB-CT`, `HUB-HCM`, `HUB-DN`, `HUB-HN`). Khi bật `showTwinOverlay`, block gọi `dxosBlocks:twinShadow` và cho phép điều chỉnh setpoint qua `dxosBlocks:twinSetDesired`. Mọi thay đổi nhiệt độ vượt ngưỡng `HITL_DELTA_THRESHOLD_C = 2.0` °C tự động chuyển trạng thái `pending_hitl` chờ phê duyệt thủ công.

<ParamGrid
  title="Thuộc tính DxosWebGisBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Bản đồ Giám sát Chuỗi lạnh WebGIS', description: 'Tiêu đề bản đồ.' },
    { name: 'defaultOrganizationId', type: 'string', default: '\'\'', description: 'Mã tổ chức mặc định (chỉ dành cho admin/root).' },
    { name: 'centerLat', type: 'number', default: '15.8', description: 'Vĩ độ tâm bản đồ mặc định.' },
    { name: 'centerLng', type: 'number', default: '106.5', description: 'Kinh độ tâm bản đồ mặc định.' },
    { name: 'showTwinOverlay', type: 'boolean', default: 'true', description: 'Bật lớp trạng thái Digital Twin và điều khiển setpoint.' },
    { name: 'collection', type: 'string', default: '\'\'', description: 'Tên collection tùy chọn chứa dữ liệu tọa độ.' },
    { name: 'latField', type: 'string', default: '\'\'', description: 'Tên trường vĩ độ trong collection.' },
    { name: 'lngField', type: 'string', default: '\'\'', description: 'Tên trường kinh độ trong collection.' },
    { name: 'labelField', type: 'string', default: '\'\'', description: 'Tên trường nhãn điểm trên bản đồ.' },
    { name: 'statusField', type: 'string', default: '\'\'', description: 'Tên trường trạng thái để tô màu điểm đánh dấu.' }
  ]"
/>

### 10. `DxosKanbanScheduleBlockModel`

Cung cấp hai chế độ hiển thị chuyển đổi trực tiếp giữa bảng Kanban theo cột trạng thái (`kanban`) và lịch biểu theo tuần (`schedule`). Thứ tự cột chuẩn cho chứng từ theo `KANBAN_STAGE_ORDER` gồm `draft`, `submitted`, `approved`, `in_progress`, `completed`, `cancelled`; riêng `latticeStockLots` dùng `STOCK_LOT_STAGE_ORDER` gồm `available`, `reserved`, `hold_mkt`, `expired`. Danh sách `KANBAN_COLLECTION_ENUM` hỗ trợ `latticeOrders`, `latticeRequests`, `latticeServiceTickets`, `latticeStockLots` và `latticeCustom*`.

<ParamGrid
  title="Thuộc tính DxosKanbanScheduleBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Bảng Kanban & Lịch vận hành', description: 'Tiêu đề bảng.' },
    { name: 'collection', type: 'string', default: 'latticeOrders', description: 'Collection nguồn cho thẻ Kanban và lịch.' },
    { name: 'viewMode', type: 'kanban | schedule', default: 'kanban', description: 'Chế độ hiển thị mặc định.' },
    { name: 'pageSize', type: 'number', default: '40', description: 'Số bản ghi tối đa tải về mỗi lần.' },
    { name: 'statusField', type: 'string', default: '\'\'', description: 'Trường phân cột Kanban (tự suy diễn nếu để trống).' },
    { name: 'dateField', type: 'string', default: '\'\'', description: 'Trường ngày hiển thị trên lịch biểu.' },
    { name: 'titleField', type: 'string', default: '\'\'', description: 'Trường tiêu đề hiển thị trên từng thẻ.' }
  ]"
/>

### 11. `DxosWmsOpsBlockModel`

Bảng điều hành kho lạnh gồm hai thẻ chức năng: quản lý xuất kho FEFO / giữ lô MKT / mở khóa QA (`dxosWms:*`) và trình nhập dữ liệu hàng loạt 2 pha `dxosBlocks:bulkImportDryRun` → `dxosBlocks:bulkImportCommit`. Dung lượng tệp CSV/JSON đầu vào bị giới hạn ở `MAX_BULK_IMPORT_BYTES = 2MB`, áp dụng cho bốn collection trong `IMPORT_COLLECTIONS`: `latticeStockLots`, `latticeAssets`, `latticeOrders` và `latticeRequests`.

<ParamGrid
  title="Thuộc tính DxosWmsOpsBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Vận hành Kho FEFO & Nhập lô hàng loạt', description: 'Tiêu đề bảng điều hành WMS.' },
    { name: 'defaultOrganizationId', type: 'string', default: '\'\'', description: 'Mã tổ chức mặc định (dành cho admin).' },
    { name: 'defaultTab', type: 'fefo | import', default: 'fefo', description: 'Thẻ hiển thị mặc định khi mở block.' },
    { name: 'defaultImportCollection', type: 'enum', default: 'latticeStockLots', description: 'Collection mặc định trên trình nhập lô: latticeStockLots, latticeAssets, latticeOrders, latticeRequests.' },
    { name: 'showBulkImport', type: 'boolean', default: 'true', description: 'Bật hoặc ẩn thẻ Wizard Nhập lô 2 pha.' }
  ]"
/>

### 12. `DxosBiChartBlockModel`

Thực thi truy vấn tổng hợp ở phía máy chủ qua `POST dxosBlocks:aggregateQuery` với `x-reactions` tự lọc danh sách trường và trường số theo collection được chọn (`BI_COLLECTION_ENUM` gồm 12 collection nghiệp vụ cùng các bảng `latticeCustom*`).

Để chống chèn toán tử truy vấn nguy hiểm từ cấu hình JSON, hàm `sanitizeClientFilterNode` (`bi-chart-block.js`) kiểm tra đệ quy tối đa `10` tầng (`depth <= 10`), chặn các khóa prototype (`__proto__`, `constructor`, `prototype`), chặn đường dẫn lồng dấu chấm và từ chối toàn bộ 6 khóa trong `DANGEROUS_FILTER_KEYS`:

```text
$where, $raw, $sql, $eval, $function, $expr
```

<ParamGrid
  title="Thuộc tính DxosBiChartBlockModel"
  :items="[
    { name: 'title', type: 'string', default: 'Phân tích & Biểu đồ BI', description: 'Tiêu đề biểu đồ.' },
    { name: 'collection', type: 'string', default: 'latticeOrders', description: 'Collection nguồn cho truy vấn tổng hợp.' },
    { name: 'chartType', type: 'bar | line | pie | kpi | pivot', default: 'bar', description: 'Dạng biểu đồ hiển thị.' },
    { name: 'groupBy', type: 'string', default: 'status', description: 'Trường nhóm dữ liệu chính.' },
    { name: 'secondaryGroupBy', type: 'string', default: '\'\'', description: 'Trường nhóm thứ hai dùng cho dạng bảng chéo pivot.' },
    { name: 'metricOp', type: 'count | sum | avg | min | max', default: 'count', description: 'Phép tính tổng hợp.' },
    { name: 'metricField', type: 'string', default: '\'\'', description: 'Trường số học áp dụng cho sum, avg, min, max.' },
    { name: 'limit', type: 'number', default: '20', description: 'Số nhóm tối đa trả về (1..500).' },
    { name: 'filterJson', type: 'string (JSON)', default: '\'\'', description: 'Bộ lọc JSON tùy chọn; từ chối khóa thuộc DANGEROUS_FILTER_KEYS.' }
  ]"
/>

## Resource `dxosBlocks` và Hàng rào `dxosTelemetryDirectGuard`

Toàn bộ các khối dữ liệu giao tiếp với máy chủ thông qua 17 action trên resource `dxosBlocks` (`blocks-api.js`): 15 action `loggedIn` (`proposals`, `decideProposal`, `contextTelemetry`, `telemetrySeries`, `alarmIngest`, `alarmAck`, `alarmClear`, `exportReport`, `globalSearch`, `twinShadow`, `twinSetDesired`, `bulkImportDryRun`, `bulkImportCommit`, `collectionsMeta`, `aggregateQuery`) và 2 action `public` xác thực fail-closed (`telemetryIngest`, `twinAckCommand` yêu cầu header `X-Lattice-Edge-Token` dài tối thiểu 16 ký tự khớp hằng thời gian với `DX_IIOT_INGEST_TOKEN` hoặc JWT có quyền ACL hợp lệ).

Middleware `dxosTelemetryDirectGuard` chặn mọi yêu cầu CRUD trực tiếp hoặc `charts:queryData` từ vai trò không phải `root` nhắm vào `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices` và `latticeBrokerSubscriptions` (trả về HTTP `403`), buộc luồng dữ liệu đi qua `dxosBlocks` và `dxosBroker`.

## Tài liệu liên quan

- [Kiến trúc Multi-Portal](/studio/multi-portal)
- [Collection Tùy biến & Công thức AST](/studio/custom-collections-formulas)
- [Vận hành Kho lạnh OMS/WMS & FEFO](/domains/cold-chain-oms-wms)
- [IIoT Digital Twin 2 chiều](/domains/iiot-digital-twin)
