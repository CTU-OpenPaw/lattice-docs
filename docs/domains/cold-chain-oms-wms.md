---
title: Cold-Chain OMS, WMS & FEFO
description: Quản lý đơn hàng, tồn kho theo lô, phân bổ FEFO theo dải nhiệt và giám sát SLA nhiệt độ trong LatticeDX.
---

# Cold-Chain OMS, WMS & FEFO

Hệ thống quản lý đơn hàng và kho lạnh (OMS/WMS) thuộc plugin `@latticedx/plugin-dxos-studio` kiểm soát vòng đời đơn hàng, tồn kho theo từng lô (`latticeStockLots`), phân bổ xuất kho theo nguyên tắc hết hạn trước xuất trước (FEFO) và tự động tạm giữ lô khi vượt ngưỡng nhiệt độ động học trung bình (MKT). Mọi thao tác thay đổi tồn kho chạy trong PostgreSQL transaction với khóa hàng `SELECT ... FOR UPDATE`, đồng bộ dòng dõi dữ liệu (`latticeDataLineage`) và ghi nhận chữ ký Ed25519 vào sổ cái `latticeCryptoLedger`.

## Mô hình dữ liệu và máy trạng thái

Các collection cốt lõi của phân hệ kho lạnh được cô lập theo `organizationId` thông qua `FORCE ROW LEVEL SECURITY` trên PostgreSQL 16. Mọi truy cập ghi trực tiếp qua REST CRUD thông thường đều bị chặn bởi `wms-direct-guard.js`; ứng dụng và tích hợp ngoài bắt buộc đi qua tài nguyên `dxosWms`.

| Collection | Mục đích | Khóa nghiệp vụ chính | Trạng thái hợp lệ |
| :--- | :--- | :--- | :--- |
| `latticeOrders` | Đơn hàng vận hành và xuất nhập | `organizationId`, `code` | `draft`, `submitted`, `approved`, `in_progress`, `completed`, `cancelled` |
| `latticeOrderLines` | Dòng hàng chi tiết theo SKU và dải nhiệt | `organizationId`, `orderCode`, `lineNo` | `pending`, `partial`, `allocated`, `dispatched`, `delivered` |
| `latticeStockLots` | Lô tồn kho gắn vị trí kho và thiết bị IIoT | `organizationId`, `lotCode`, `sku` | `available`, `reserved`, `depleted`, `hold_mkt`, `expired`, `quarantined` |
| `latticeSlaPolicies` | Ngưỡng cảnh báo và vi phạm SLA theo mức ưu tiên | `organizationId`, `targetCollection`, `priority` | `active` (`warnAfterMinutes`, `breachAfterMinutes`) |
| `latticeIncidentCases` | Sự cố vận hành hoặc vượt ngưỡng nhiệt độ | `organizationId`, `fingerprint` (SHA-256) | `open`, `acknowledged`, `resolved`, `closed` |

Lô hàng rơi vào tập `BLOCKED_LOT_STATUSES` (`hold_mkt`, `expired`, `quarantined`) bị loại khỏi thuật toán phân bổ FEFO và bị từ chối khi xuất kho với mã lỗi HTTP `409 WMS_LOT_ON_HOLD`.

<ParamGrid
  title="Các trường cốt lõi của lô hàng lạnh (latticeStockLots)"
  :items="[
    { name: 'lotCode', type: 'string', required: true, description: 'Mã định danh lô duy nhất trong phạm vi tổ chức.' },
    { name: 'sku', type: 'string', required: true, description: 'Mã sản phẩm dùng để khớp với dòng đơn hàng khi phân bổ FEFO.' },
    { name: 'assetEntityId', type: 'string', description: 'URN NGSI-LD của kho lạnh hoặc container gắn với lô hàng, dạng urn:ngsi-ld:Asset:<orgId>:native:<id>.' },
    { name: 'qtyOnHand', type: 'number', required: true, description: 'Tổng số lượng thực tế hiện có trong kho.' },
    { name: 'qtyReserved', type: 'number', default: '0', description: 'Số lượng đã giữ chỗ cho các dòng đơn hàng đang chờ xuất.' },
    { name: 'expiryDate', type: 'datetime', required: true, description: 'Hạn sử dụng dùng làm khóa sắp xếp chính của thuật toán FEFO.' },
    { name: 'targetTempMinC', type: 'number', description: 'Ngưỡng nhiệt độ bảo quản tối thiểu cho phép (°C).' },
    { name: 'targetTempMaxC', type: 'number', description: 'Ngưỡng nhiệt độ bảo quản tối đa cho phép (°C); dùng làm ngưỡng MKT mặc định khi kiểm tra lô.' },
    { name: 'mktCelsius', type: 'number', description: 'Giá trị Nhiệt độ Động học Trung bình (MKT) gần nhất được tính theo phương trình Arrhenius.' }
  ]"
/>

## Nhập kho và phân bổ FEFO theo dải nhiệt

Quy trình nhập kho (`dxosWms:receiveStock`) tạo hoặc cập nhật lô trên `latticeStockLots` kèm thông tin vị trí kho, thực thể IIoT và dải nhiệt yêu cầu. Khi có đơn hàng cần xuất, hàm `allocateFefo` thực hiện khóa bi quan (`findLockedLots` dùng `LOCK.UPDATE`) đối với toàn bộ lô có trạng thái `available` của `sku` yêu cầu, lọc theo dải nhiệt tương thích và hạn sử dụng còn hiệu lực, sau đó sắp xếp tăng dần theo `(expiryDate, id)`.

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:allocateFefo"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, wms"
  summary="Phân bổ giữ chỗ tồn kho theo nguyên tắc FEFO, tương thích dải nhiệt và ghi vết lineage."
/>

<ParamGrid
  title="Tham số đầu vào cho dxosWms:allocateFefo"
  :items="[
    { name: 'sku', type: 'string', required: true, description: 'Mã SKU cần phân bổ tồn kho (tối đa 128 ký tự).' },
    { name: 'quantity', type: 'number', required: true, description: 'Số lượng cần phân bổ (> 0).' },
    { name: 'orderCode', type: 'string', description: 'Mã đơn hàng gắn với dòng đơn; có thể truyền kèm orderId.' },
    { name: 'lineNo', type: 'integer', default: '1', description: 'Số thứ tự dòng đơn hàng (số nguyên dương).' },
    { name: 'minTempC', type: 'number', description: 'Nhiệt độ tối thiểu yêu cầu của đơn hàng (°C).' },
    { name: 'maxTempC', type: 'number', description: 'Nhiệt độ tối đa yêu cầu của đơn hàng (°C).' },
    { name: 'now', type: 'datetime', description: 'Mốc thời gian tham chiếu kiểm tra hạn sử dụng (mặc định là thời điểm hiện tại).' }
  ]"
/>

Trong cùng một giao dịch PostgreSQL, hệ thống cập nhật `qtyReserved` trên từng lô được chọn, tạo hoặc cập nhật trạng thái `allocated` (hoặc `partial` nếu `shortfall > 0`) trên `latticeOrderLines`, ghi sự kiện `wms.fefo_allocated` vào `latticeCryptoLedger`, đồng thời chèn cạnh quan hệ `allocated_to` vào `latticeDataLineage`.

<CodeTabs
  :tabs='[
    {
      "label": "Yêu cầu FEFO (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:allocateFefo \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"orderCode\": \"ORD-2026-0192\",\n    \"lineNo\": 1,\n    \"sku\": \"VAC-COLD-02\",\n    \"quantity\": 120,\n    \"minTempC\": 2,\n    \"maxTempC\": 8\n  }\u0027"
    },
    {
      "label": "Phản hồi phân bổ (JSON)",
      "lang": "json",
      "code": "{\n  \"data\": {\n    \"allocatedTotal\": 120,\n    \"shortfall\": 0,\n    \"allocations\": [\n      {\n        \"lotId\": 41,\n        \"lotCode\": \"LOT-2026-A09\",\n        \"expiryDate\": \"2026-12-15T00:00:00.000Z\",\n        \"qtyAllocated\": 80\n      },\n      {\n        \"lotId\": 44,\n        \"lotCode\": \"LOT-2026-B02\",\n        \"expiryDate\": \"2027-01-10T00:00:00.000Z\",\n        \"qtyAllocated\": 40\n      }\n    ],\n    \"orderLine\": {\n      \"id\": 108,\n      \"orderCode\": \"ORD-2026-0192\",\n      \"lineNo\": 1,\n      \"status\": \"allocated\",\n      \"allocatedQty\": 120\n    }\n  }\n}"
    }
  ]'
/>

## Xuất kho thực tế và kiểm soát trạng thái lô

Thao tác xuất kho qua `dxosWms:issueStock` thực hiện khóa hàng lô mục tiêu (`lotId` hoặc `lotCode`), kiểm tra lại lần cuối trạng thái lô không thuộc `hold_mkt`, `expired`, `quarantined` và chưa quá hạn sử dụng tại thời điểm xuất. Hệ thống trừ trực tiếp `qtyOnHand` và điều chỉnh `qtyReserved` tương ứng; khi `qtyOnHand` về `0`, lô tự động chuyển trạng thái thành `depleted`, dòng đơn hàng chuyển sang `dispatched` và ghi nhận sự kiện `wms.stock_issued` vào sổ cái PKI.

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:issueStock"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, wms"
  summary="Xuất kho vật lý từ lô đã giữ chỗ, kiểm tra trạng thái an toàn và chuyển dòng đơn sang dispatched."
/>

| Endpoint `dxosWms` | Phương thức | Quyền / Scope | Chức năng chính |
| :--- | :--- | :--- | :--- |
| `/api/dxosWms:orderLines` | `GET` | `read`, `wms` | Truy vấn danh sách dòng đơn hàng theo `orderCode` hoặc `orderId`. |
| `/api/dxosWms:saveOrderLine` | `POST` | `write`, `wms` | Tạo mới hoặc cập nhật thông số SKU, số lượng và dải nhiệt cho dòng đơn. |
| `/api/dxosWms:receiveStock` | `POST` | `write`, `wms` | Nhập lô hàng mới vào kho với hạn dùng, thiết bị cảm biến và dải nhiệt bảo quản. |
| `/api/dxosWms:lots` | `GET` | `read`, `wms` | Liệt kê tồn kho thực tế, tồn giữ chỗ (`qtyReserved`) và `qtyAvailable` theo lô. |
| `/api/dxosWms:allocateFefo` | `POST` | `write`, `wms` | Phân bổ tự động theo FEFO kết hợp kiểm tra dải nhiệt tương thích. |
| `/api/dxosWms:issueStock` | `POST` | `write`, `wms` | Xuất kho thực tế, giảm tồn và cập nhật trạng thái `dispatched`. |
| `/api/dxosWms:holdLotByMkt` | `POST` | `write`, `wms` | Tính MKT Arrhenius và khóa lô ở trạng thái `hold_mkt` nếu vượt ngưỡng. |
| `/api/dxosWms:releaseLotByQa` | `POST` | `write`, `wms` | Mở khóa lô từ `hold_mkt` hoặc `quarantined` về `available` sau thẩm định QA. |

## Kiểm soát nhiệt độ MKT, cách ly QA và SLA

Khi cảm biến IIoT ghi nhận chuỗi nhiệt độ bảo quản hoặc QA chạy kiểm tra định kỳ, endpoint `dxosWms:holdLotByMkt` thu thập mảng `samplesC` truyền trực tiếp hoặc truy vấn tối đa `500` điểm đo gần nhất từ `latticeTelemetryPoints` (`metricName = 'temperature'`) gắn với `assetEntityId` của lô. Ngưỡng tối đa được suy diễn theo thứ tự `maxAllowedC` -> `lot.targetTempMaxC` -> `-15°C` (nếu `coldChainProfile === 'frozen'` hoặc `targetTempMinC <= -15`) -> `8°C`.

Hệ thống tính giá trị MKT bằng phương trình Arrhenius với hằng số khí `R = 0.008314472` `kJ/(mol·K)` và năng lượng hoạt hóa `ΔH = 83.14472` `kJ/mol`. Nếu `mktCelsius > thresholdCelsius` hoặc `forceHold === true`, quy trình tự động thực hiện bốn tác vụ đồng bộ:

1. Chuyển trạng thái lô sang `hold_mkt` kèm `holdReason`, `heldAt` và `heldBy`.
2. Tạo bản ghi cách ly trong `latticeDataQuarantine` với `reasonCode: 'MKT_THRESHOLD_EXCEEDED'`.
3. Ghi sự kiện `wms.lot_mkt_hold` vào sổ cái chữ ký số `latticeCryptoLedger`.
4. Phát CloudEvent `lot.held_mkt` lên `latticeEventBus` để kích hoạt luồng xử lý sự cố hoặc thông báo cho bộ phận QA.

<CodeTabs
  :tabs='[
    {
      "label": "Kiểm tra MKT (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:holdLotByMkt \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"lotCode\": \"LOT-2026-A09\",\n    \"samplesC\": [4.2, 5.1, 9.8, 10.4, 8.9]\n  }\u0027"
    },
    {
      "label": "Mở khóa QA (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:releaseLotByQa \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"lotCode\": \"LOT-2026-A09\",\n    \"releaseReason\": \"Kiểm định ổn định đạt chuẩn sau đánh giá QA-2026-14\"\n  }\u0027"
    }
  ]'
/>

Song song với kiểm soát nhiệt độ theo lô, bảng `latticeSlaPolicies` định nghĩa thời hạn cảnh báo (`warnAfterMinutes`, mặc định `240` phút) và vi phạm (`breachAfterMinutes`, mặc định `1440` phút) cho đơn hàng và sự cố. Bộ lập lịch SLA chạy theo chu kỳ `DX_SLA_INTERVAL_MS` (mặc định `60000` ms, bật qua `DX_SLA_CRON_ENABLED=true`) để nâng cấp cảnh báo tới vai trò `escalateToRole` (mặc định `ldx_manager`) qua các kênh cấu hình trong `notifyChannels`. Trên giao diện portal, hai khối `DxosWmsOpsBlockModel` và `DxosKanbanScheduleBlockModel` hiển thị trực tiếp bảng giữ chỗ FEFO, nhập liệu hàng loạt (`MAX_BULK_IMPORT_BYTES = 2 MB`) và luồng trạng thái lô.

## Lưu ý vận hành, mã lỗi và giới hạn bảo mật

| Cơ chế kiểm soát | Hành vi thực thi | Mã lỗi / Hậu quả |
| :--- | :--- | :--- |
| Khóa hàng bi quan | Giữ chỗ FEFO và xuất kho khóa hàng bằng `SELECT ... FOR UPDATE` trong transaction. | Ngăn hai đơn hàng đồng thời phân bổ vượt quá `qtyOnHand - qtyReserved`. |
| Cô lập tenant đa tầng | `resolveTenantActor` gắn `app.current_org` theo người dùng hoặc API key `ldx_pat_*`. | Trả về `404 WMS_ORDER_NOT_FOUND` hoặc `404 WMS_LOT_NOT_FOUND` nếu truy cập chéo tổ chức. |
| Rào chắn mở khóa QA | `dxosWms:releaseLotByQa` chỉ chấp nhận lô ở trạng thái `hold_mkt` hoặc `quarantined`. | Trả về `409 WMS_LOT_INVALID_STATE` nếu lô đang ở trạng thái khác; bắt buộc có `releaseReason`. |

Bảng dưới đây tổng hợp các mã lỗi nghiệp vụ từ `wms-engine.js` để client và workflow tự động xử lý chính xác:

| Mã lỗi | HTTP | Nguyên nhân kích hoạt | Hướng xử lý |
| :--- | :---: | :--- | :--- |
| `WMS_SKU_REQUIRED` / `WMS_QTY_INVALID` | `400` | Thiếu `sku` hoặc số lượng `<= 0`. | Kiểm tra dữ liệu dòng đơn trước khi gọi `allocateFefo`. |
| `WMS_ORDER_LINE_SKU_MISMATCH` | `400` | Dòng đơn hàng hiện có mang `sku` khác với yêu cầu phân bổ. | Tạo `lineNo` mới hoặc truyền đúng `sku` của dòng đơn. |
| `WMS_LOT_ON_HOLD` | `409` | Lô đang ở trạng thái `hold_mkt`, `expired`, `quarantined` hoặc quá `expiryDate`. | Chờ QA thẩm định (`releaseLotByQa`) hoặc chọn lô khác. |
| `WMS_INSUFFICIENT_STOCK` | `409` | Số lượng xuất kho vượt quá `qtyOnHand` thực tế của lô. | Tách số lượng xuất hoặc phân bổ bổ sung qua FEFO. |
| `MKT_INVALID_SAMPLE` | `400` | Mẫu nhiệt độ không hữu hạn, `<= -273.15°C` hoặc `deltaH <= 0`. | Loại bỏ giá trị cảm biến lỗi trước khi tính MKT. |
| `WMS_MKT_SAMPLES_REQUIRED` | `400` | Không có `samplesC`, không có telemetry và `forceHold !== true`. | Truyền mảng `samplesC` hoặc gắn `assetEntityId` hợp lệ. |

## Tài liệu liên quan

- [ePOD và xác thực QR công khai](/domains/epod-and-qr-verification)
- [IIoT và Digital Twin hai chiều](/domains/iiot-digital-twin)
- [12 Native v2 BlockModels](/studio/native-blocks)
- [Sổ cái PKI Ed25519 và Merkle](/reference/pki-merkle-ledger)
