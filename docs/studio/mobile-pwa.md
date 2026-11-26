---
title: Mobile Field PWA
description: Kiến trúc PWA ngoại tuyến tại /v/mobile với Service Worker, hàng đợi IndexedDB latticedx-mobile-outbox, cơ chế cách ly xung đột và thu thập ePOD.
---

# Mobile Field PWA

Mobile Field PWA tại `/v/mobile` cung cấp giao diện vận hành hiện trường ưu tiên ngoại tuyến cho tài xế, thủ kho và kỹ thuật viên bảo trì khi làm việc trong kho lạnh hoặc khu vực mất kết nối mạng. Thay vì lưu trữ dữ liệu nhạy cảm trong bộ nhớ đệm trình duyệt, ứng dụng tách riêng lớp vỏ tĩnh qua Service Worker và đẩy toàn bộ thao tác đột biến trạng thái vào hàng đợi IndexedDB có kiểm soát.

## Kiến trúc cung cấp và vòng đời Service Worker

Gateway của LatticeDX phục vụ tuyến `/v/mobile` trực tiếp qua `createMobilePwaGatewayHandler` và cấu hình Nginx công khai (`10-lattice-public-routes.sh`). Khi nhận yêu cầu `GET` hoặc `HEAD /v/mobile`, gateway chèn thẻ `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, liên kết manifest, biểu tượng chạm và đoạn mã đăng ký Service Worker vào tài liệu HTML gốc.

Ngay sau khi đăng ký `/api/dxos:sw.js` với phạm vi `/`, trình duyệt gửi thông điệp `PRECACHE_ASSETS` chứa danh sách tài nguyên tĩnh đã trích xuất từ HTML (`/assets/*`, `/v/assets/*`, `/v/global.css`, `/v/browser-checker.js`). Hàm `sanitizePrecacheAssets` loại bỏ mọi đường dẫn chứa `..` hoặc `%2f` để ngăn chặn tấn công duyệt thư mục.

<ApiEndpoint
  method="GET"
  path="/api/dxos:manifest"
  auth="Public"
  summary="Trả về Web App Manifest tĩnh (application/manifest+json) cho shell /v/mobile, không chứa dữ liệu tenant hoặc PII."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:sw.js"
  auth="Public"
  summary="Phục vụ Service Worker với header Service-Worker-Allowed: / và Cache-Control: no-cache, no-store, must-revalidate."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:icon-192.png"
  auth="Public"
  summary="Trả về biểu tượng PNG 192x192 (cache 86400s) dùng cho manifest và apple-touch-icon; hỗ trợ thêm kích thước /api/dxos:icon-512.png."
/>

### Quy tắc bộ nhớ đệm và ranh giới bảo mật

Service Worker (`CACHE_NAME = latticedx-field-pwa-v0.4.2`) chỉ áp dụng chiến lược network-first kèm fallback cache cho chính shell `/v/mobile`, manifest, hai tệp icon PNG và các tài nguyên tĩnh khớp biểu thức `STATIC_ASSET_RE`.

Mọi yêu cầu tới `/api/*` ngoài ba đường dẫn tĩnh nêu trên đều đi qua chế độ `NetworkOnly` để tránh lưu nhầm phản hồi API có ngữ cảnh tenant. Hàm `isCacheableResponse` từ chối lưu bất kỳ phản hồi nào chuyển hướng (`redirected`), không thuộc kiểu `basic`, có header `Cache-Control: no-store` hoặc `private`, hoặc đính kèm `Set-Cookie`.

<ParamGrid
  title="Tài nguyên và chính sách cache PWA"
  :items="[
    { name: '/v/mobile', type: 'text/html', default: 'no-cache', description: 'Shell ứng dụng hiện trường được chèn metadata PWA và script đăng ký Service Worker.' },
    { name: '/api/dxos:manifest', type: 'application/manifest+json', default: 'max-age=300', description: 'Khai báo start_url=/v/mobile, display=standalone, orientation=portrait-primary.' },
    { name: '/api/dxos:sw.js', type: 'application/javascript', default: 'no-store', description: 'Service Worker (cũng có alias /api/dxos:sw) luôn kiểm tra phiên bản mới từ máy chủ.' },
    { name: '/api/dxos:icon-192.png', type: 'image/png', default: 'max-age=86400', description: 'Biểu tượng ứng dụng 192x192 phục vụ chuẩn cài đặt PWA và iOS home screen.' },
    { name: '/api/dxos:icon-512.png', type: 'image/png', default: 'max-age=86400', description: 'Biểu tượng ứng dụng 512x512 cho màn hình khởi động thiết bị di động.' }
  ]"
/>

## Hàng đợi ngoại tuyến IndexedDB (`latticedx-mobile-outbox`)

Module `mobile-offline-db.js` quản lý hàng đợi giao dịch ngoại tuyến theo cơ chế lưu trữ phân tầng: ưu tiên **IndexedDB** (`latticedx-mobile-outbox`, phiên bản `1`, object store `outbox` với khóa chính `id` và hai chỉ mục `status`, `createdAt`), tự động chuyển sang `localStorage` (khóa `latticedx:mobile:offline-queue`) khi IndexedDB bị chặn, và dùng `Map` trong bộ nhớ làm lớp dự phòng cuối cùng.

Trước khi ghi vào bất kỳ tầng lưu trữ nào, `stripForbiddenKeys` loại bỏ đệ quy các khóa `__proto__`, `constructor`, `prototype` tối đa 16 cấp độ sâu để ngăn chặn ô nhiễm prototype. Nếu trình duyệt ném lỗi `QuotaExceededError`, hệ thống trả về mã lỗi `OFFLINE_STORAGE_QUOTA_EXCEEDED`.

<ParamGrid
  title="Giới hạn dung lượng và trạng thái hàng đợi"
  :items="[
    { name: 'MAX_OUTBOX_ITEMS', type: 'number', default: '50', description: 'Số lượng tác vụ tối đa được phép xếp hàng đồng thời; vượt ngưỡng ném OFFLINE_QUEUE_FULL.' },
    { name: 'MAX_OUTBOX_PAYLOAD_BYTES', type: 'number', default: '327680 (320 KB)', description: 'Kích thước JSON tối đa cho một tác vụ ngoại tuyến không kèm ảnh minh chứng.' },
    { name: 'MAX_PHOTO_DATA_URL_BYTES', type: 'number', default: '524288 (512 KB)', description: 'Giới hạn chuỗi data URL ảnh raster (PNG, JPEG, WebP) cho evidencePhotoDataUrl.' },
    { name: 'MAX_OUTBOX_TOTAL_BYTES_WITH_PHOTO', type: 'number', default: '786432 (768 KB)', description: 'Tổng kích thước JSON tối đa của tác vụ khi đính kèm ảnh minh chứng hiện trường.' },
    { name: 'VALID_OUTBOX_STATUSES', type: 'enum', default: 'pending', description: 'Vòng đời gồm 5 trạng thái: pending, syncing, failed, quarantined và synced.' }
  ]"
/>

<ParamGrid
  title="Cấu trúc một phần tử trong outbox"
  :items="[
    { name: 'id', type: 'string', required: true, description: 'Định danh dạng mq-<ts36>-<seq36>-<uuid8>, tối đa 128 ký tự.' },
    { name: 'actionType', type: 'string', required: true, description: 'Một trong 4 khóa ALLOWED_OFFLINE_ACTIONS được phép.' },
    { name: 'endpoint', type: 'string', required: true, description: 'Resource action NocoBase ánh xạ tự động từ actionType.' },
    { name: 'payload', type: 'object', required: true, description: 'Dữ liệu JSON đã loại bỏ khóa prototype và kiểm tra kích thước.' },
    { name: 'status', type: 'enum', default: 'pending', description: 'pending | syncing | failed | quarantined | synced.' },
    { name: 'attempts', type: 'integer', default: '0', description: 'Số lần thử đồng bộ; tăng sau mỗi lỗi mạng hoặc lỗi 4xx/5xx.' },
    { name: 'httpStatus / lastError', type: 'integer | string', description: 'Mã HTTP gần nhất và thông báo lỗi rút gọn tối đa 240 ký tự.' },
    { name: 'conflictData', type: 'object | null', description: 'Bản ghi máy chủ khi gặp HTTP 409; ảnh và chữ ký base64 được che trước khi lưu.' }
  ]"
/>

### Danh sách 4 thao tác ngoại tuyến được phép (`ALLOWED_OFFLINE_ACTIONS`)

Để giữ ranh giới quyền hạn chặt chẽ khi thiết bị mất kết nối, hàng đợi chỉ chấp nhận bốn loại tác vụ thuộc danh sách `ALLOWED_OFFLINE_ACTIONS`. Mọi giá trị `actionType` khác bị từ chối với mã `UNSUPPORTED_OFFLINE_ACTION` ngay lúc xếp hàng hoặc bị chuyển sang cách ly (`400`) khi đồng bộ.

| Mã `actionType` | Endpoint đích | Phương thức | Mục đích nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `wms.epodCapture` | `/api/dxosWms:epodCapture` | `POST` | Xác nhận giao nhận điện tử (ePOD) kèm tọa độ GPS, chữ ký và ảnh hiện trường. |
| `iot.twinSetDesired` | `/api/dxosBlocks:twinSetDesired` | `POST` | Cập nhật ngưỡng mục tiêu mong muốn cho Digital Twin của thiết bị kho lạnh. |
| `service.ticketCreate` | `/api/latticeServiceTickets:create` | `POST` | Tạo phiếu yêu cầu dịch vụ hoặc bảo trì thiết bị ngay tại hiện trường. |
| `iot.incidentCreate` | `/api/dxosBlocks:alarmIngest` | `POST` | Gửi cảnh báo sự cố vận hành từ cảm biến hoặc nhân sự hiện trường. |

## Đồng bộ hàng đợi và cơ chế cách ly xung đột

Khi thiết bị có kết nối trở lại (`navigator.onLine === true`), hàm `flushOfflineQueue` duyệt các bản ghi chưa ở trạng thái `quarantined` theo thứ tự thời gian `createdAt` và số thứ tự `seq`. Hệ thống phân loại mã trạng thái HTTP trả về từ máy chủ thành ba nhóm xử lý rõ ràng:

| Nhóm mã HTTP | Trạng thái mới | Hành vi xử lý của `flushOfflineQueue` |
| :--- | :--- | :--- |
| `2xx` | `synced` (xóa khỏi hàng đợi) | Tăng bộ đếm `synced`, xóa bản ghi khỏi IndexedDB/storage để giải phóng dung lượng. |
| `401` | `failed` (tạm dừng toàn hàng đợi) | Đặt cờ `unauthorized: true`, dừng đồng bộ và đánh dấu các tác vụ còn lại là `deferred` chờ đăng nhập lại (`NOCOBASE_TOKEN`). |
| `400`, `403`, `404`, `409`, `422` | `quarantined` | Không tự động xóa; giữ lại trong kho cách ly kèm `lastError` và `httpStatus` để người dùng kiểm tra hoặc chỉnh sửa. |
| `408`, `429`, `5xx`, lỗi mạng | `failed` | Tăng `attempts` và giữ nguyên trong hàng đợi để thử lại ở chu kỳ đồng bộ kế tiếp. |

Đối với lỗi xung đột phiên bản `409`, hàm `extractConflictData` trích xuất bản ghi phía máy chủ (`serverRecord`) và áp dụng `maskConflictMediaFields` để thay thế mọi trường ảnh/chữ ký base64 bằng chuỗi `[Ảnh/Chữ ký base64 đã ẩn]`. Dữ liệu `conflictData` được giới hạn tối đa `4096` byte nhằm tránh làm phình bộ nhớ cục bộ.

<CodeTabs
  :tabs="[
    {
      label: 'Kết quả flushOfflineQueue',
      lang: 'json',
      code: '{\n  &quot;total&quot;: 4,\n  &quot;synced&quot;: 2,\n  &quot;failed&quot;: 0,\n  &quot;quarantined&quot;: 1,\n  &quot;conflicts&quot;: 1,\n  &quot;deferred&quot;: 1,\n  &quot;unauthorized&quot;: false,\n  &quot;results&quot;: [\n    { &quot;id&quot;: &quot;mq-0001&quot;, &quot;actionType&quot;: &quot;wms.epodCapture&quot;, &quot;status&quot;: &quot;synced&quot; },\n    { &quot;id&quot;: &quot;mq-0002&quot;, &quot;actionType&quot;: &quot;iot.twinSetDesired&quot;, &quot;status&quot;: &quot;quarantined&quot;, &quot;httpStatus&quot;: 409, &quot;error&quot;: &quot;Version conflict&quot; }\n  ]\n}'
    },
    {
      label: 'Kiểm tra trạng thái outbox (JS)',
      lang: 'js',
      code: 'import { listOutboxItems, flushOfflineQueue } from \'./mobile-field-pwa\';\nconst quarantined = await listOutboxItems({ status: \'quarantined\' });\nif (quarantined.length > 0) {\n  console.warn(\'Quarantined:\', quarantined.map((item) => item.id));\n}\nconst summary = await flushOfflineQueue({ apiClient });'
    }
  ]"
/>

## Trình phân tích mã QR và hàm dựng payload ePOD

Trình quét hiện trường dùng hàm `parseFieldQrPayload` để chuẩn hóa đầu vào từ camera hoặc máy quét mã vạch. Hàm giới hạn độ dài chuỗi tối đa `2048` ký tự (`MAX_QR_PAYLOAD_LENGTH`), chặn ký tự điều khiển, `<`, `>`, `\`, `..` và các lược đồ nguy hiểm (`javascript:`, `data:`, `vbscript:`). Chuỗi JSON cũng bị từ chối trước khi `JSON.parse` nếu chứa khóa `__proto__`, `constructor` hoặc `prototype`.

<CodeTabs
  :tabs="[
    {
      label: 'Định dạng QR hỗ trợ',
      lang: 'text',
      code: '1. JSON object: {&quot;trackingCode&quot;:&quot;LDX-TRK-2026-001&quot;,&quot;orderId&quot;:42,&quot;targetTempC&quot;:-18}\n2. NGSI-LD URN đầy đủ: urn:ngsi-ld:Asset:org-a:native:104\n3. NGSI-LD URN rút gọn: urn:ngsi-ld:Asset:104\n4. Mã vận đơn: LDX-TRK-2026-001\n5. Mã lô hàng: LOT-2026-CC-09\n6. Mã đơn hàng: ORD-2026-8841'
    },
    {
      label: 'Payload buildEpodPayload',
      lang: 'json',
      code: '{\n  &quot;recipientName&quot;: &quot;Nguyen Van A&quot;,\n  &quot;deliveredQty&quot;: 24,\n  &quot;gpsLat&quot;: 10.0309,\n  &quot;gpsLng&quot;: 105.7689,\n  &quot;signatureDataUrl&quot;: &quot;data:image/png;base64,...&quot;,\n  &quot;evidencePhotoDataUrl&quot;: &quot;data:image/jpeg;base64,...&quot;,\n  &quot;orderCode&quot;: &quot;ORD-2026-8841&quot;,\n  &quot;gpsAccuracyM&quot;: 8.5,\n  &quot;notes&quot;: &quot;Giao đủ tại cửa kho lạnh số 2&quot;,\n  &quot;deliveredAt&quot;: &quot;2026-11-26T09:15:00.000Z&quot;\n}'
    }
  ]"
/>

Hàm trả về đối tượng `{ valid: true, kind, ... }` với các trường được trích xuất tùy theo định dạng: `urn`, `entityType`, `organizationId`, `source`, `entityId`, `assetId`, `trackingCode`, `trackingToken` (`ldx_trk_*`), `lotCode`, `orderCode`, `orderId` và `targetTempC` (chấp nhận `targetTempC` hoặc `setpointC` trong khoảng `[-80, 120] °C`).

Hàm `buildEpodPayload` kiểm tra chặt chẽ dữ liệu trước khi đẩy vào `dxosWms:epodCapture` hoặc xếp vào `latticedx-mobile-outbox`:

<ParamGrid
  title="Quy tắc kiểm tra dữ liệu của buildEpodPayload"
  :items="[
    { name: 'recipientName', type: 'string', required: true, description: 'Tên người nhận hàng (cắt gọn tối đa 128 ký tự, không được rỗng).' },
    { name: 'deliveredQty', type: 'number', default: '0', description: 'Số lượng thực giao; phải là số hữu hạn không âm (>= 0).' },
    { name: 'gpsLat / gpsLng', type: 'number', description: 'Tọa độ hợp lệ (Lat [-90..90], Lng [-180..180]); bắt buộc nếu gpsUnavailable khác true.' },
    { name: 'gpsUnavailableReason', type: 'string', description: 'Bắt buộc (tối đa 240 ký tự) khi gpsUnavailable=true, ví dụ mất tín hiệu trong kho ngầm.' },
    { name: 'signatureDataUrl', type: 'string', required: true, description: 'Chữ ký ePOD định dạng data:image/*, dung lượng tối đa 256 KB.' },
    { name: 'evidencePhotoDataUrl', type: 'string', description: 'Tùy chọn; ảnh raster PNG/JPEG/WebP tối đa 512 KB. Hệ thống từ chối data:image/svg+xml.' },
    { name: 'targetTempC', type: 'number', description: 'Nếu đọc từ QR JSON, giá trị nhiệt độ mục tiêu phải nằm trong [-80, 120] °C.' }
  ]"
/>

## Lưu ý vận hành

- Khi cập nhật phiên bản nền tảng, Service Worker mới xóa toàn bộ cache cũ không khớp `latticedx-field-pwa-v0.4.2` trong sự kiện `activate` và gọi `self.clients.claim()` để đồng bộ ngay lập tức.
- Nếu người dùng đăng xuất hoặc token `NOCOBASE_TOKEN` hết hạn (`isJwtTokenExpired`), các bản ghi `pending` vẫn an toàn trong IndexedDB và chỉ được gửi lại sau khi xác thực mới thành công.
- Ảnh minh chứng chụp tại hiện trường nên nén xuống JPEG/WebP dưới `400 KB` trước khi mã hóa base64 để bảo đảm tổng kích thước item không vượt trần `768 KB`.

## Tài liệu liên quan

- [Kiến trúc Multi-Portal](/studio/multi-portal)
- [Xác thực ePOD và QR công khai](/domains/epod-and-qr-verification)
- [Quản lý kho lạnh OMS/WMS & FEFO](/domains/cold-chain-oms-wms)
- [Bản sao số IIoT Digital Twin](/domains/iiot-digital-twin)
