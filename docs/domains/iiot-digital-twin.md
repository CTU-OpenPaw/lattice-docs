---
title: IIoT & Digital Twin Hai chiều
description: Kiến trúc Mosquitto DynSec/LWT, FIWARE Orion-LD NGSI-LD, điều khiển downlink Node-RED, ngưỡng HITL 2.0°C và tính MKT Arrhenius.
---

<script setup>
const brokerSetupTabs = [
  {
    label: 'Cấp phát thiết bị (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosBroker:provisionDevice \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceKey": "freezer-ct-01",
    "name": "Cam bien kho lanh Can Tho 01",
    "assetId": 12
  }'`,
  },
  {
    label: 'Đăng ký Orion-LD (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosBroker:orionCreateSubscription \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "subscriptionKey": "coldroom-temp-watch",
    "entityTypes": ["Asset"],
    "watchedAttributes": ["temperature", "humidity"],
    "throttling": 5
  }'`,
  },
];

const twinCommandTabs = [
  {
    label: 'Gửi lệnh Twin (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosBlocks:twinSetDesired \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "assetEntityId": "urn:ngsi-ld:Asset:org1:native:12",
    "desiredPatch": {
      "targetTempC": -18.5,
      "defrostMode": "auto",
      "fanMode": "high"
    }
  }'`,
  },
  {
    label: 'Phản hồi cổng HITL (JSON)',
    lang: 'json',
    code: `{
  "data": {
    "gatedByHitl": true,
    "deltaTempC": -4.5,
    "approvalId": 31,
    "shadow": {
      "assetEntityId": "urn:ngsi-ld:Asset:org1:native:12",
      "commandStatus": "pending_hitl",
      "version": 4
    }
  }
}`,
  },
];
</script>

# IIoT & Digital Twin Hai chiều

Phân hệ IIoT và Digital Twin hai chiều kết nối thiết bị biên lạnh tại hiện trường với kho ngữ cảnh chuẩn ETSI NGSI-LD thông qua sự phối hợp giữa `@latticedx/plugin-dxos-blocks` (`broker-control.js`, `digital-twin.js`, `blocks-api.js`) và `@latticedx/plugin-lattice-foundation` (`native-context-delivery.js`, `data-governance.js`). Luồng dữ liệu đi lên (uplink) đồng bộ cảm biến qua Mosquitto MQTT, Node-RED và FIWARE Orion-LD về chuỗi thời gian `latticeTelemetryPoints`, trong khi luồng đi xuống (downlink) duy trì trạng thái `desired`/`reported` trên `latticeTwinShadows` với cổng phê duyệt con người (HITL) khi biên độ chỉnh nhiệt vượt `2.0°C`.

## Luồng dữ liệu IIoT và đồng bộ Digital Twin

<IiotDigitalTwinDiagram />

Toàn bộ dịch vụ biên (`mosquitto`, `nodered`) chạy trong mạng Docker cô lập `iiot-net` (`internal: true` trong `prod.yml`), chỉ giao tiếp với NocoBase thông qua token xác thực `X-Lattice-Edge-Token` (`>= 16` ký tự, cấu hình qua `DX_IIOT_INGEST_TOKEN`) và danh sách tên miền cho phép chống SSRF (`DX_ORION_HOST_ALLOWLIST`, `DX_ORION_CALLBACK_HOST_ALLOWLIST`, `DX_NODERED_HOST_ALLOWLIST`).

## Mosquitto Dynamic Security và giám sát LWT

Broker `eclipse-mosquitto:2.0.21` lắng nghe trên cổng nội bộ `1883` với `allow_anonymous false`, `persistence true`, `max_queued_messages 1000`, `max_packet_size 65536` và nạp plugin `/usr/lib/mosquitto_dynamic_security.so` đọc từ `/mosquitto/data/dynamic-security.json`. Chính sách mặc định của DynSec thiết lập `deny` cho cả `publishClientSend`, `publishClientReceive` và `subscribe`.

Khi cấp phát thiết bị qua `dxosBroker:provisionDevice`, máy chủ gửi lệnh JSON tới topic điều khiển `$CONTROL/dynamic-security/v1` để tạo vai trò `role_<orgId>_<deviceKey>` và tài khoản `ldx_<orgId>_<deviceKey>` với quyền giới hạn theo tiền tố topic `latticedx/<orgId>/<deviceKey>`:

| Thành phần MQTT | Chủ thể / Topic | Quyền hạn DynSec / Hành vi |
| :--- | :--- | :--- |
| Cầu nối Node-RED | `nodered-bridge` (`nodered_bridge`) | Đăng ký `latticedx/#` và xuất bản lệnh xuống `latticedx/+/+/command`. |
| Thiết bị biên | `role_<orgId>_<deviceKey>` | `publishClientSend` trên `latticedx/<orgId>/<deviceKey>/#`; `subscribePattern` và `publishClientReceive` trên `.../command` và `.../ack`. |
| Trạng thái kết nối LWT | `latticedx/+/+/status` (QoS 1) | Node-RED chuẩn hóa `BIRTH`/`ONLINE`/`CONNECTED` thành `online` và `DEATH`/`OFFLINE`/`LWT`/`DISCONNECTED` thành `offline` (`reason: mqtt_lwt_disconnect`). |

<ApiEndpoint
  method="POST"
  path="/api/dxosBroker:provisionDevice"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, iot"
  summary="Đăng ký thiết bị vào latticeIotDevices và cấp phát client/role Mosquitto DynSec theo phạm vi tổ chức."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosBroker:deviceStatusIngest"
  auth="X-Lattice-Edge-Token"
  summary="Tiếp nhận thông điệp LWT hoặc Birth từ Node-RED để cập nhật trạng thái trực tuyến của thiết bị."
/>

## FIWARE Orion-LD (NGSI-LD) và Outbox giao dịch

Ngữ cảnh ngữ nghĩa (`infra/config/ngsi-ld/context.jsonld`) mở rộng chuẩn cốt lõi ETSI NGSI-LD với các thực thể `Asset`, `Department`, `Location`, `Vehicle`, `Shipment` và `Warehouse` dưới không gian tên `https://latticedx.example/ns/*`. Mọi tài sản lạnh dùng định danh URN chuẩn:

```text
urn:ngsi-ld:Asset:<orgId>:native:<assetId>
```

Mọi truy vấn HTTP tới `orion-ld:1026` bắt buộc mang header `NGSILD-Tenant: <orgId>`. Theo chiều từ NocoBase sang Orion-LD, bảng `latticeContextOutbox` chạy tiến trình rút hàng đợi mỗi `10` giây (`DX_NATIVE_CONTEXT_AUTO_SYNC=true`) sử dụng câu lệnh `FOR UPDATE OF o SKIP LOCKED` để đảm bảo thứ tự FIFO trên từng thực thể và tự thu hồi khóa treo quá `DX_OUTBOX_STALE_LOCK_MS` (`120000` ms). Theo chiều ngược lại, `dxosBroker:orionCreateSubscription` đăng ký `urn:ngsi-ld:Subscription:<orgId>:<subscriptionKey>` ở định dạng `normalized` (throttling `0..3600` giây, mặc định `5` giây) để đẩy thông báo thay đổi về `/api/dxosBroker:orionNotify`.

<CodeTabs :tabs="brokerSetupTabs" />

## Digital Twin Shadow, cổng HITL `2.0°C` và Downlink Node-RED

Bảng `latticeTwinShadows` lưu đồng thời cấu hình mục tiêu (`desiredJson`), trạng thái thiết bị báo cáo (`reportedJson`), sai lệch (`lastDeltaJson`), mã lệnh chờ (`pendingCommandId`) và trạng thái đồng bộ (`synced`, `pending_hitl`, `dispatched`, `acked`, `failed`). Tập thuộc tính được phép điều khiển từ xa (`ALLOWED_DESIRED_KEYS`) được khóa chặt gồm:

<ParamGrid
  title="Các khóa hợp lệ trong desiredPatch (digital-twin.js)"
  :items="[
    { name: 'targetTempC', type: 'number', description: 'Nhiệt độ đặt mục tiêu (°C); chịu kiểm soát cổng an toàn HITL nếu độ lệch vượt 2.0°C.' },
    { name: 'minTempC / maxTempC', type: 'number', description: 'Ngưỡng cảnh báo dưới và trên của buồng lạnh (kiểm tra minTempC <= maxTempC).' },
    { name: 'defrostMode', type: 'string', description: 'Chế độ xả đá: auto, manual hoặc off.' },
    { name: 'fanMode', type: 'string', description: 'Tốc độ quạt dàn lạnh: auto, high, low hoặc eco.' },
    { name: 'doorLock', type: 'string', description: 'Trạng thái khóa cửa kho lạnh: locked hoặc unlocked.' },
    { name: 'reportingIntervalSec', type: 'number', description: 'Chu kỳ gửi telemetry từ thiết bị biên tính bằng giây.' }
  ]"
/>

Trên cả giao diện WebGIS (`HITL_DELTA_THRESHOLD_C = 2.0` trong `webgis-block.js`) và tầng máy chủ (`HITL_TEMP_THRESHOLD_C = 2.0` trong `digital-twin.js`), nếu `|desiredPatch.targetTempC - baselineTemp| > 2.0` và cờ `hitlApproved` chưa được xác nhận (`true` chỉ từ quy trình HITL hoặc `root`), lệnh điều khiển qua `dxosBlocks:twinSetDesired` sẽ tạm dừng:

1. Trạng thái shadow chuyển sang `pending_hitl`.
2. Hệ thống tạo yêu cầu rủi ro `high` trong `latticeAiApprovalQueue` với `toolName: 'dxos_twin_set_desired'` kèm `diffPreview` (`before`, `after`, `delta`).
3. Sự kiện `iot.twin_hitl_required` được ký số và ghi vào `latticeCryptoLedger`.

Khi lệnh nằm trong ngưỡng an toàn hoặc đã được phê duyệt HITL, NocoBase gửi HTTP POST tới `DX_NODERED_COMMAND_URL` (`http://nodered:1880/twin/command`) kèm header `X-Lattice-Edge-Token`. Node-RED xác thực tải trọng và xuất bản MQTT QoS 1 tới `latticedx/<orgId>/<assetKey>/command`; khi thiết bị phản hồi trên `latticedx/+/+/ack`, Node-RED chuyển tiếp về `POST /api/dxosBlocks:twinAckCommand` để cập nhật `reportedJson` và chuyển `commandStatus` sang `acked`.

<ApiEndpoint
  method="POST"
  path="/api/dxosBlocks:twinSetDesired"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, iot"
  summary="Cập nhật setpoint Digital Twin; kích hoạt cổng phê duyệt HITL nếu độ lệch targetTempC > 2.0°C."
/>

<CodeTabs :tabs="twinCommandTabs" />

## Công thức Nhiệt độ Động học Trung bình (Arrhenius MKT)

Để đánh giá tác động tích lũy của dao động nhiệt độ lên hàng hóa nhạy nhiệt theo chuẩn ICH Q1A / Haynes, cả `wms-engine.js` và `data-governance.js` sử dụng cùng bộ hằng số vật lý và phép tính log-sum-exp ổn định số học:

| Hằng số / Biến | Giá trị chính xác | Ý nghĩa |
| :--- | :--- | :--- |
| `R_KJ_MOL_K` (`R`) | `0.008314472` `kJ/(mol·K)` | Hằng số khí lý tưởng dùng trong phương trình Arrhenius. |
| `DEFAULT_DELTA_H_KJ_MOL` (`ΔH`) | `83.14472` `kJ/mol` | Năng lượng hoạt hóa mặc định (`a = ΔH / R = 10000 K`). |
| `ABSOLUTE_ZERO_C` | `-273.15` `°C` | Độ lệch chuyển đổi Kelvin (`T_K = T_C + 273.15`, từ chối mọi mẫu `<= -273.15`). |

```text
a         = deltaH / 0.008314472
e_i       = -a / (T_C,i + 273.15)
m         = max_i(e_i)
lnMean    = m + ln((1 / n) * sum_i(exp(e_i - m)))
mktKelvin = a / (-lnMean)
mktC      = round3(mktKelvin - 273.15)
```

Phép dịch cực đại `m = max_i(e_i)` loại bỏ nguy cơ tràn số dấu phẩy động (`underflow` / `overflow`) khi tính hàm mũ `exp(-ΔH / RT)` trên chuỗi telemetry dài. Kết quả trả về gồm `mktCelsius`, `minTempCelsius`, `maxTempCelsius`, `avgTempCelsius`, `sampleCount`, `excursionCount` và cờ `breached` dùng để tự động cách ly lô sang `hold_mkt` hoặc sinh sự cố `latticeIncidentCases`.

## Bảng tham chiếu API IIoT (`dxosBroker` và `dxosBlocks`)

| Endpoint | Phương thức | Xác thực | Chức năng |
| :--- | :---: | :--- | :--- |
| `/api/dxosBroker:listDevices` | `GET` / `POST` | JWT / `ldx_pat_*` | Liệt kê thiết bị IoT đã đăng ký theo `organizationId` và trạng thái. |
| `/api/dxosBroker:provisionDevice` | `POST` | JWT / `ldx_pat_*` | Tạo thiết bị và gửi lệnh DynSec tới `$CONTROL/dynamic-security/v1`. |
| `/api/dxosBroker:revokeDevice` | `POST` | JWT / `ldx_pat_*` | Thu hồi quyền xuất bản/đăng ký MQTT của thiết bị trên Mosquitto. |
| `/api/dxosBroker:deviceStatusIngest` | `POST` | `X-Lattice-Edge-Token` | Tiếp nhận trạng thái `BIRTH`/`LWT` từ Node-RED để cập nhật `online`/`offline`. |
| `/api/dxosBroker:orionEntities` | `GET` / `POST` | JWT / `ldx_pat_*` | Truy vấn thực thể NGSI-LD hiện hành trên `orion-ld:1026`. |
| `/api/dxosBroker:orionCreateSubscription` | `POST` | JWT / `ldx_pat_*` | Tạo subscription NGSI-LD đẩy thông báo về `/api/dxosBroker:orionNotify`. |
| `/api/dxosBroker:orionNotify` | `POST` | `X-Lattice-Edge-Token` | Nhận dữ liệu `normalized` từ Orion-LD, lưu telemetry và kích hoạt cảnh báo. |
| `/api/dxosBlocks:twinShadow` | `GET` / `POST` | JWT / `ldx_pat_*` | Đọc cặp trạng thái `desiredJson` / `reportedJson` và `lastDeltaJson`. |
| `/api/dxosBlocks:twinSetDesired` | `POST` | JWT / `ldx_pat_*` | Cập nhật `desiredJson`, kiểm tra ngưỡng HITL `2.0°C` và gửi lệnh Node-RED. |
| `/api/dxosBlocks:twinAckCommand` | `POST` | `X-Lattice-Edge-Token` / JWT | Xác nhận hoàn tất lệnh từ thiết bị và đồng bộ `reportedJson` sang `acked`. |

## Tài liệu liên quan

- [Cold-Chain OMS, WMS & FEFO](/domains/cold-chain-oms-wms)
- [Sự kiện CloudEvents và Transactional Outbox](/architecture/events-and-outbox)
- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [12 Native v2 BlockModels](/studio/native-blocks)
