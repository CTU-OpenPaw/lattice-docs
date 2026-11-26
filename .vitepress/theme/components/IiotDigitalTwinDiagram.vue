<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol } from 'vitepress';
import DiagramCanvas from './DiagramCanvas.vue';
import type {
  DiagramEdge,
  DiagramLocale,
  DiagramMode,
  DiagramNode,
  DiagramStep,
  DiagramZone,
} from './diagramTypes';

const props = defineProps<{ lang?: DiagramLocale }>();
const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const meta = computed(() =>
  resolvedLang.value === 'vi'
    ? {
        title: 'Digital Twin IIoT 2 Chiều & Động cơ Arrhenius MKT',
        caption:
          'Vòng kín cảm biến biên -> Mosquitto DynSec/LWT -> FIWARE Orion-LD NGSI-LD -> tính toán MKT Arrhenius -> cổng HITL 2.0 °C -> lệnh xuống qua Node-RED.',
      }
    : {
        title: '2-Way IIoT Digital Twin & Arrhenius MKT Engine',
        caption:
          'Closed-loop edge sensors -> Mosquitto DynSec/LWT -> FIWARE Orion-LD NGSI-LD -> Arrhenius MKT calculation -> 2.0 °C HITL delta guard -> Node-RED downlink.',
      },
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const twinZones: DiagramZone[] = [
    {
      id: 'iiot-edge',
      label: isVi ? 'Biên IIoT (iiot-net)' : 'IIoT Edge (iiot-net)',
      x: 16,
      y: 16,
      width: 200,
      height: 344,
      kind: 'external',
    },
    {
      id: 'context-plane',
      label: isVi ? 'Bản sao số NGSI-LD & Động cơ Arrhenius MKT' : 'NGSI-LD Context & Arrhenius MKT Engine',
      x: 232,
      y: 16,
      width: 408,
      height: 344,
      kind: 'admin',
    },
    {
      id: 'control-plane',
      label: isVi ? 'Cổng HITL & Lệnh xuống' : 'HITL Guard & Downlink',
      x: 656,
      y: 16,
      width: 208,
      height: 344,
      kind: 'traffic',
    },
  ];

  const twinNodes: DiagramNode[] = [
    {
      id: 'edge_sensors',
      title: isVi ? 'Cảm biến Biên' : 'Edge Sensors',
      sub: 'QoS 1 · LWT status',
      icon: 'radio',
      x: 28,
      y: 60,
      width: 176,
      height: 64,
      zoneId: 'iiot-edge',
      inspector: isVi
        ? {
            role: 'Cảm biến kho lạnh, xe vận tải và bộ điều khiển biên MQTT',
            packageOrPort: 'Field Devices · MQTT QoS 1',
            protocol: 'MQTT v3.1.1 / v5 · LWT',
            payloadOrSchema: 'latticedx/<orgId>/<deviceKey>/... | .../status | .../ack',
            responsibilities:
              'Phát số đo nhiệt độ/trạng thái theo chủ đề tenant, gửi gói Birth/Death LWT và phản hồi xác nhận lệnh điều khiển trên kênh ack.',
          }
        : {
            role: 'Cold-chain sensors, reefer gateways, and field actuators',
            packageOrPort: 'Field Devices · MQTT QoS 1',
            protocol: 'MQTT v3.1.1 / v5 · LWT',
            payloadOrSchema: 'latticedx/<orgId>/<deviceKey>/... | .../status | .../ack',
            responsibilities:
              'Publishes telemetry under tenant-scoped MQTT topics, emits Birth/Death LWT status, and returns command acknowledgments.',
          },
    },
    {
      id: 'mosquitto',
      title: isVi ? 'Mosquitto DynSec' : 'Mosquitto DynSec',
      sub: ':1883 · allow_anon false',
      icon: 'lock',
      x: 28,
      y: 224,
      width: 176,
      height: 64,
      zoneId: 'iiot-edge',
      focal: true,
      inspector: isVi
        ? {
            role: 'MQTT Broker nội bộ khóa xác thực ẩn danh với Dynamic Security',
            packageOrPort: 'eclipse-mosquitto:2.0.21 · :1883 (iiot-net)',
            protocol: 'MQTT · mosquitto_dynamic_security.so',
            payloadOrSchema: 'max_queued_messages=1000 | max_packet_size=65536 | default deny',
            responsibilities:
              'Chạy trong mạng cô lập iiot-net không mở cổng host; mặc định từ chối mọi ACL và chỉ cấp quyền từng thiết bị qua DynSec.',
          }
        : {
            role: 'Internal MQTT broker enforced by Dynamic Security ACLs',
            packageOrPort: 'eclipse-mosquitto:2.0.21 · :1883 (iiot-net)',
            protocol: 'MQTT · mosquitto_dynamic_security.so',
            payloadOrSchema: 'max_queued_messages=1000 | max_packet_size=65536 | default deny',
            responsibilities:
              'Isolated on internal iiot-net with allow_anonymous=false, default-deny ACLs, persistence enabled, and per-device roles.',
          },
    },
    {
      id: 'orion_ld',
      title: isVi ? 'FIWARE Orion-LD' : 'FIWARE Orion-LD',
      sub: ':1026 · NGSILD-Tenant',
      icon: 'globe',
      x: 248,
      y: 60,
      width: 168,
      height: 64,
      zoneId: 'context-plane',
      focal: true,
      inspector: isVi
        ? {
            role: 'Context Broker NGSI-LD đa tenant chuẩn ETSI',
            packageOrPort: 'fiware/orion-ld:1.12.0 · :1026 (MongoDB 8.0)',
            protocol: 'HTTP NGSI-LD · NGSILD-Tenant',
            payloadOrSchema: 'urn:ngsi-ld:Asset:<orgId>:native:<assetId>',
            responsibilities:
              'Quản lý thực thể Asset/Location/Vehicle/Shipment theo ngữ cảnh context.jsonld và đẩy thông báo chuẩn hóa (throttle 5s) về NocoBase.',
          }
        : {
            role: 'Multi-tenant ETSI NGSI-LD context broker',
            packageOrPort: 'fiware/orion-ld:1.12.0 · :1026 (MongoDB 8.0)',
            protocol: 'HTTP NGSI-LD · NGSILD-Tenant',
            payloadOrSchema: 'urn:ngsi-ld:Asset:<orgId>:native:<assetId>',
            responsibilities:
              'Maintains Asset, Location, Vehicle, and Shipment entities and dispatches normalized subscriptions (5s default throttle) to dxosBroker:orionNotify.',
          },
    },
    {
      id: 'mkt_engine',
      title: isVi ? 'Arrhenius MKT' : 'Arrhenius MKT',
      sub: 'R 0.008314472 · ΔH 83.14',
      icon: 'activity',
      x: 456,
      y: 60,
      width: 168,
      height: 64,
      zoneId: 'context-plane',
      focal: true,
      inspector: isVi
        ? {
            role: 'Bộ tính Mean Kinetic Temperature ổn định số học (Haynes / ICH Q1A)',
            packageOrPort: 'wms-engine.js · data-governance.js',
            protocol: 'Log-Sum-Exp · Kelvin Offset -273.15',
            payloadOrSchema: 'R = 0.008314472 kJ/(mol·K) | ΔH = 83.14472 kJ/mol',
            responsibilities:
              'Tính mktCelsius bằng biểu thức log-sum-exp tránh tràn số mũ (từ chối T <= -273.15 °C) và tự động kích hoạt hold_mkt khi vượt ngưỡng.',
          }
        : {
            role: 'Numerically stabilized Arrhenius MKT calculator',
            packageOrPort: 'wms-engine.js · data-governance.js',
            protocol: 'Log-Sum-Exp · Kelvin Offset -273.15',
            payloadOrSchema: 'R = 0.008314472 kJ/(mol·K) | ΔH = 83.14472 kJ/mol',
            responsibilities:
              'Evaluates mktKelvin = a / (-lnMean) via log-sum-exp with R=0.008314472 and deltaH=83.14472, flagging breached thresholds automatically.',
          },
    },
    {
      id: 'twin_shadow',
      title: isVi ? 'Twin Shadow & WMS' : 'Twin Shadow & WMS',
      sub: 'latticeTwinShadows',
      icon: 'database',
      x: 248,
      y: 224,
      width: 168,
      height: 64,
      zoneId: 'context-plane',
      inspector: isVi
        ? {
            role: 'Lưu trạng thái reported/desired của Digital Twin và lô hàng WMS',
            packageOrPort: 'digital-twin.js · latticeStockLots',
            protocol: 'PG16 FORCE RLS · app.current_org',
            payloadOrSchema: 'desiredPatch: targetTempC, maxTempC, minTempC, defrostMode, fanMode, doorLock',
            responsibilities:
              'Đồng bộ thuộc tính reported, giữ trạng thái lô hold_mkt khi vượt MKT và khởi tạo yêu cầu thay đổi desiredPatch từ WebGIS hoặc PWA.',
          }
        : {
            role: 'Digital Twin reported/desired state and WMS lot store',
            packageOrPort: 'digital-twin.js · latticeStockLots',
            protocol: 'PG16 FORCE RLS · app.current_org',
            payloadOrSchema: 'desiredPatch: targetTempC, maxTempC, minTempC, defrostMode, fanMode, doorLock',
            responsibilities:
              'Stores shadow states, applies hold_mkt quarantine to breached stock lots, and validates desiredPatch mutations from WebGIS or mobile PWA.',
          },
    },
    {
      id: 'alarm_engine',
      title: isVi ? 'Cảnh báo & Sự cố' : 'Alarm & Incident',
      sub: 'SHA-256 fingerprint',
      icon: 'bell',
      x: 456,
      y: 224,
      width: 168,
      height: 64,
      zoneId: 'context-plane',
      inspector: isVi
        ? {
            role: 'Khử trùng lặp cảnh báo quá nhiệt và mất kết nối LWT',
            packageOrPort: 'alarm-engine.js · latticeIncidentCases',
            protocol: 'POST dxosBlocks:alarmIngest · SLA',
            payloadOrSchema: 'sha256(orgId|assetEntityId|ruleCode|attribute)',
            responsibilities:
              'Gộp sự cố trùng lặp theo fingerprint SHA-256, gắn mức độ nghiêm trọng và kích hoạt chính sách leo thang SLA.',
          }
        : {
            role: 'Deduplicated excursion and offline incident engine',
            packageOrPort: 'alarm-engine.js · latticeIncidentCases',
            protocol: 'POST dxosBlocks:alarmIngest · SLA',
            payloadOrSchema: 'sha256(orgId|assetEntityId|ruleCode|attribute)',
            responsibilities:
              'Deduplicates thermal excursions and LWT disconnects by SHA-256 fingerprint and triggers latticeSlaPolicies escalations.',
          },
    },
    {
      id: 'hitl_guard',
      title: isVi ? 'Cổng HITL 2.0 °C' : 'HITL Delta Guard',
      sub: '|ΔT| > 2.0 °C -> hold',
      icon: 'shield',
      x: 672,
      y: 60,
      width: 176,
      height: 64,
      zoneId: 'control-plane',
      focal: true,
      inspector: isVi
        ? {
            role: 'Rào chắn an toàn nhiệt độ yêu cầu phê duyệt con người',
            packageOrPort: 'digital-twin.js · dxosBlocks:twinSetDesired',
            protocol: 'HITL_TEMP_THRESHOLD_C = 2.0',
            payloadOrSchema: '|desiredPatch.targetTempC - baselineTemp| > 2.0 -> pending_hitl',
            responsibilities:
              'Chặn gửi lệnh xuống thiết bị nếu biên độ đổi targetTempC vượt quá 2.0 °C mà chưa có hitlApproved=true; tạo đề xuất dxos_twin_set_desired.',
          }
        : {
            role: 'Safety interlock gating large setpoint shifts',
            packageOrPort: 'digital-twin.js · dxosBlocks:twinSetDesired',
            protocol: 'HITL_TEMP_THRESHOLD_C = 2.0',
            payloadOrSchema: '|desiredPatch.targetTempC - baselineTemp| > 2.0 -> pending_hitl',
            responsibilities:
              'Pauses setpoint changes exceeding 2.0 °C from baseline as pending_hitl and queues a dxos_twin_set_desired approval proposal.',
          },
    },
    {
      id: 'nodered',
      title: isVi ? 'Node-RED Downlink' : 'Node-RED Downlink',
      sub: ':1880 · /twin/command',
      icon: 'workflow',
      x: 672,
      y: 224,
      width: 176,
      height: 64,
      zoneId: 'control-plane',
      inspector: isVi
        ? {
            role: 'Cầu nối điều phối lệnh xuống MQTT QoS 1 và thu ack/LWT',
            packageOrPort: 'nodered/node-red:4.0.9 · :1880 (flows.json)',
            protocol: 'HTTP POST + X-Lattice-Edge-Token (>=16 chars)',
            payloadOrSchema: 'POST /twin/command -> latticedx/<org>/<asset>/command',
            responsibilities:
              'Xác thực token biên, phát hành lệnh MQTT QoS 1 xuống thiết bị qua tài khoản nodered_bridge và chuyển tiếp gói ack về dxosBlocks:twinAckCommand.',
          }
        : {
            role: 'IIoT downlink bridge and LWT/ack forwarder',
            packageOrPort: 'nodered/node-red:4.0.9 · :1880 (flows.json)',
            protocol: 'HTTP POST + X-Lattice-Edge-Token (>=16 chars)',
            payloadOrSchema: 'POST /twin/command -> latticedx/<org>/<asset>/command',
            responsibilities:
              'Validates DX_NODERED_COMMAND_URL requests, publishes QoS 1 commands over Mosquitto, and relays device acks to dxosBlocks:twinAckCommand.',
          },
    },
  ];

  const twinEdges: DiagramEdge[] = [
    { id: 't1', from: 'edge_sensors', to: 'mosquitto', label: 'MQTT QoS1', kind: 'primary' },
    {
      id: 't2',
      from: 'mosquitto',
      to: 'orion_ld',
      label: 'NGSI-LD',
      kind: 'primary',
      points: [
        [148, 224],
        [148, 176],
        [268, 176],
        [268, 124],
      ],
    },
    { id: 't3', from: 'orion_ld', to: 'mkt_engine', label: 'Notify', kind: 'primary' },
    {
      id: 't4',
      from: 'mkt_engine',
      to: 'twin_shadow',
      label: 'MKT',
      kind: 'flow',
      points: [
        [516, 124],
        [516, 168],
        [356, 168],
        [356, 224],
      ],
    },
    {
      id: 't5',
      from: 'mkt_engine',
      to: 'alarm_engine',
      label: 'Excursion',
      kind: 'flow',
      points: [
        [564, 124],
        [564, 224],
      ],
    },
    {
      id: 't6',
      from: 'twin_shadow',
      to: 'hitl_guard',
      label: 'ΔT <= 2.0C',
      kind: 'primary',
      points: [
        [332, 288],
        [332, 304],
        [648, 304],
        [648, 92],
        [672, 92],
      ],
    },
    { id: 't7', from: 'hitl_guard', to: 'nodered', label: 'Command', kind: 'primary' },
    {
      id: 't8',
      from: 'nodered',
      to: 'mosquitto',
      label: 'QoS1 Ack/LWT',
      kind: 'dashed',
      points: [
        [760, 288],
        [760, 336],
        [116, 336],
        [116, 288],
      ],
    },
  ];

  const twinSteps: DiagramStep[] = [
    {
      id: 'tw-s1',
      title: isVi ? 'Telemetry biên -> Orion-LD' : 'Edge Telemetry -> Orion-LD',
      activeNodes: ['edge_sensors', 'mosquitto', 'orion_ld'],
      activeEdges: ['t1', 't2'],
      description: isVi
        ? 'Cảm biến gửi bản tin QoS 1 qua Mosquitto DynSec để cập nhật thực thể urn:ngsi-ld:Asset:<orgId>:native:<assetId> trong FIWARE Orion-LD.'
        : 'Field sensors publish QoS 1 telemetry through Mosquitto DynSec into multi-tenant FIWARE Orion-LD NGSI-LD entities.',
      route: 'POST /api/dxosBroker:orionNotify',
      payload: 'NGSILD-Tenant: <orgId> | throttle: 5s',
      chips: ['MQTT QoS 1', 'NGSI-LD'],
    },
    {
      id: 'tw-s2',
      title: isVi ? 'Động cơ Arrhenius MKT & hold_mkt' : 'Arrhenius MKT & Quarantine',
      activeNodes: ['orion_ld', 'mkt_engine', 'twin_shadow', 'alarm_engine'],
      activeEdges: ['t3', 't4', 't5'],
      description: isVi
        ? 'Động cơ MKT dùng R=0.008314472 và ΔH=83.14472 để tính mktCelsius; nếu vượt ngưỡng, lô hàng tự động chuyển hold_mkt và mở sự cố.'
        : 'The MKT engine computes mktCelsius with R=0.008314472 and deltaH=83.14472; breaches auto-hold lots as hold_mkt and raise deduplicated incidents.',
      route: 'POST /api/dxosWms:holdLotByMkt',
      payload: 'R=0.008314472 | ΔH=83.14472 | T_K=T_C+273.15',
      chips: ['ICH Q1A', 'hold_mkt'],
    },
    {
      id: 'tw-s3',
      title: isVi ? 'Cổng an toàn HITL (2.0 °C)' : 'HITL Delta Guard (2.0 °C)',
      activeNodes: ['twin_shadow', 'hitl_guard'],
      activeEdges: ['t6'],
      description: isVi
        ? 'Khi chỉnh targetTempC chênh quá 2.0 °C so với baseline, lệnh tạm dừng ở trạng thái pending_hitl chờ phê duyệt trước khi xuống thiết bị.'
        : 'Setpoint changes where |targetTempC - baselineTemp| > 2.0 °C pause as pending_hitl until hitlApproved=true.',
      route: 'POST /api/dxosBlocks:twinSetDesired',
      payload: 'HITL_TEMP_THRESHOLD_C = 2.0',
      chips: ['pending_hitl', 'Safe Guard'],
    },
    {
      id: 'tw-s4',
      title: isVi ? 'Lệnh xuống Node-RED & phản hồi ack' : 'Node-RED Downlink & Ack',
      activeNodes: ['hitl_guard', 'nodered', 'mosquitto', 'edge_sensors'],
      activeEdges: ['t7', 't8', 't1'],
      description: isVi
        ? 'Node-RED xác thực X-Lattice-Edge-Token, phát lệnh MQTT .../command xuống thiết bị và chuyển tiếp bản tin ack/LWT về hệ thống.'
        : 'Node-RED validates X-Lattice-Edge-Token, publishes MQTT .../command downstream, and relays device ack and LWT updates.',
      route: 'POST /api/dxosBlocks:twinAckCommand',
      payload: 'latticedx/<orgId>/<assetKey>/command',
      chips: ['2-Way Twin', 'X-Lattice-Edge-Token'],
    },
  ];

  // Mode 2: DynSec Provisioning, LWT & SSRF Boundaries
  const dynZones: DiagramZone[] = [
    {
      id: 'dynsec-ctrl',
      label: isVi ? 'Cấp phát Mosquitto Dynamic Security ($CONTROL)' : 'Mosquitto Dynamic Security ($CONTROL)',
      x: 16,
      y: 16,
      width: 848,
      height: 152,
      kind: 'admin',
    },
    {
      id: 'lwt-ssrf',
      label: isVi ? 'Giám sát LWT Birth/Death & Kiểm soát SSRF' : 'LWT Presence & SSRF Allowlists',
      x: 16,
      y: 184,
      width: 848,
      height: 176,
      kind: 'traffic',
    },
  ];

  const dynNodes: DiagramNode[] = [
    {
      id: 'provision_api',
      title: isVi ? 'Cấp phát Thiết bị' : 'Provision Device',
      sub: ':provisionDevice',
      icon: 'key',
      x: 48,
      y: 68,
      width: 184,
      height: 64,
      zoneId: 'dynsec-ctrl',
      focal: true,
      inspector: isVi
        ? {
            role: 'API cấp chứng danh MQTT riêng biệt cho từng thiết bị theo org',
            packageOrPort: 'plugin-dxos-broker · broker-control.js',
            protocol: 'MQTT $CONTROL/dynamic-security/v1',
            payloadOrSchema: 'client: ldx_<orgId>_<deviceKey> | role: role_<orgId>_<deviceKey>',
            responsibilities:
              'Sinh client và role DynSec cô lập theo từng cặp tổ chức-thiết bị thay vì dùng chung mật khẩu toàn cục.',
          }
        : {
            role: 'Per-tenant MQTT client and role provisioning API',
            packageOrPort: 'plugin-dxos-broker · broker-control.js',
            protocol: 'MQTT $CONTROL/dynamic-security/v1',
            payloadOrSchema: 'client: ldx_<orgId>_<deviceKey> | role: role_<orgId>_<deviceKey>',
            responsibilities:
              'Creates isolated Mosquitto Dynamic Security clients and roles dynamically without restarting the broker.',
          },
    },
    {
      id: 'dynsec_broker',
      title: isVi ? 'ACL Tối thiểu' : 'Scoped DynSec ACL',
      sub: 'default deny · per-topic',
      icon: 'lock',
      x: 348,
      y: 68,
      width: 184,
      height: 64,
      zoneId: 'dynsec-ctrl',
      focal: true,
      inspector: isVi
        ? {
            role: 'Phân quyền chủ đề MQTT theo nguyên tắc từ chối mặc định',
            packageOrPort: '/mosquitto/data/dynamic-security.json',
            protocol: 'DynSec ACL · publish / subscribe',
            payloadOrSchema: 'send: latticedx/<org>/<dev>/# | recv: .../command & .../ack',
            responsibilities:
              'Đặt mặc định deny cho publishClientSend, publishClientReceive và subscribe; thiết bị chỉ được giao tiếp đúng prefix tổ chức của mình.',
          }
        : {
            role: 'Least-privilege topic ACLs with default deny',
            packageOrPort: '/mosquitto/data/dynamic-security.json',
            protocol: 'DynSec ACL · publish / subscribe',
            payloadOrSchema: 'send: latticedx/<org>/<dev>/# | recv: .../command & .../ack',
            responsibilities:
              'Locks default ACLs to deny so devices can only publish telemetry to their own prefix and subscribe to their own command/ack topics.',
          },
    },
    {
      id: 'nodered_bridge',
      title: isVi ? 'Vai trò Cầu nối' : 'Bridge Role',
      sub: 'nodered-bridge · #',
      icon: 'plug',
      x: 648,
      y: 68,
      width: 184,
      height: 64,
      zoneId: 'dynsec-ctrl',
      inspector: isVi
        ? {
            role: 'Tài khoản cầu nối riêng cho Node-RED 4.0.9',
            packageOrPort: 'init-dynsec.sh · nodered_bridge',
            protocol: 'AES-256-CTR flows_cred.json',
            payloadOrSchema: 'sub: latticedx/# | pub: latticedx/+/+/command',
            responsibilities:
              'Cho phép Node-RED đọc luồng sự kiện đa tenant và phát hành lệnh điều khiển downlink qua chứng danh mã hóa.',
          }
        : {
            role: 'Dedicated Mosquitto bridge role for Node-RED',
            packageOrPort: 'init-dynsec.sh · nodered_bridge',
            protocol: 'AES-256-CTR flows_cred.json',
            payloadOrSchema: 'sub: latticedx/# | pub: latticedx/+/+/command',
            responsibilities:
              'Authorizes Node-RED to subscribe across latticedx/# and publish downlink commands to latticedx/+/+/command.',
          },
    },
    {
      id: 'lwt_watcher',
      title: isVi ? 'Giám sát LWT' : 'LWT Presence',
      sub: 'BIRTH | DEATH -> QoS 1',
      icon: 'radio',
      x: 48,
      y: 236,
      width: 184,
      height: 64,
      zoneId: 'lwt-ssrf',
      inspector: isVi
        ? {
            role: 'Chuẩn hóa trạng thái trực tuyến và ngoại tuyến đột ngột từ LWT',
            packageOrPort: 'flows.json:301-347 · latticedx/+/+/status',
            protocol: 'MQTT QoS 1 -> HTTP',
            payloadOrSchema: 'BIRTH|ONLINE|CONNECTED -> online; DEATH|OFFLINE|LWT -> offline',
            responsibilities:
              'Theo dõi chủ đề status và gắn reason=mqtt_lwt_disconnect ngay khi broker phát gói Last Will and Testament.',
          }
        : {
            role: 'Normalizes MQTT Birth and Last Will Testament states',
            packageOrPort: 'flows.json:301-347 · latticedx/+/+/status',
            protocol: 'MQTT QoS 1 -> HTTP',
            payloadOrSchema: 'BIRTH|ONLINE|CONNECTED -> online; DEATH|OFFLINE|LWT -> offline',
            responsibilities:
              'Subscribes to latticedx/+/+/status at QoS 1 and emits reason=mqtt_lwt_disconnect when an unexpected disconnect occurs.',
          },
    },
    {
      id: 'status_ingest',
      title: isVi ? 'Cập nhật Trạng thái' : 'Status Ingest',
      sub: ':deviceStatusIngest',
      icon: 'bell',
      x: 348,
      y: 236,
      width: 184,
      height: 64,
      zoneId: 'lwt-ssrf',
      inspector: isVi
        ? {
            role: 'Endpoint tiếp nhận trạng thái thiết bị từ cầu nối biên',
            packageOrPort: 'broker-control.js · latticeIotDevices',
            protocol: 'POST /api/dxosBroker:deviceStatusIngest',
            payloadOrSchema: 'Header X-Lattice-Edge-Token (>= 16 chars)',
            responsibilities:
              'Xác thực Edge Token bằng so sánh hằng thời gian và cập nhật trạng thái thiết bị trong latticeIotDevices.',
          }
        : {
            role: 'Edge-authenticated device presence ingest endpoint',
            packageOrPort: 'broker-control.js · latticeIotDevices',
            protocol: 'POST /api/dxosBroker:deviceStatusIngest',
            payloadOrSchema: 'Header X-Lattice-Edge-Token (>= 16 chars)',
            responsibilities:
              'Validates X-Lattice-Edge-Token (>= 16 chars) and updates online/offline presence in latticeIotDevices.',
          },
    },
    {
      id: 'ssrf_allowlist',
      title: isVi ? 'Khóa SSRF IIoT' : 'SSRF Allowlists',
      sub: 'DX_ORION & NODERED',
      icon: 'shield',
      x: 648,
      y: 236,
      width: 184,
      height: 64,
      zoneId: 'lwt-ssrf',
      inspector: isVi
        ? {
            role: 'Danh sách tên miền nội bộ được phép cho Orion-LD và Node-RED',
            packageOrPort: 'broker-control.js · native-context-delivery.js',
            protocol: 'DNS + Host Allowlist Check',
            payloadOrSchema: 'DX_ORION_HOST_ALLOWLIST | DX_ORION_CALLBACK_HOST_ALLOWLIST | DX_NODERED_HOST_ALLOWLIST',
            responsibilities:
              'Chặn địa chỉ loopback, nội bộ riêng tư hoặc metadata đám mây ngoài danh sách trắng khi đăng ký callback Orion-LD hoặc gọi Node-RED.',
          }
        : {
            role: 'Host allowlist defense against IIoT SSRF callbacks',
            packageOrPort: 'broker-control.js · native-context-delivery.js',
            protocol: 'DNS + Host Allowlist Check',
            payloadOrSchema: 'DX_ORION_HOST_ALLOWLIST | DX_ORION_CALLBACK_HOST_ALLOWLIST | DX_NODERED_HOST_ALLOWLIST',
            responsibilities:
              'Restricts Orion-LD callbacks and Node-RED downlink targets exclusively to explicitly allowlisted internal IIoT hosts.',
          },
    },
  ];

  const dynEdges: DiagramEdge[] = [
    { id: 'd1', from: 'provision_api', to: 'dynsec_broker', label: '$CONTROL', kind: 'primary' },
    { id: 'd2', from: 'dynsec_broker', to: 'nodered_bridge', label: 'Sub #', kind: 'flow' },
    {
      id: 'd3',
      from: 'nodered_bridge',
      to: 'lwt_watcher',
      label: 'Status Topic',
      kind: 'flow',
      points: [
        [740, 132],
        [740, 164],
        [140, 164],
        [140, 236],
      ],
    },
    { id: 'd4', from: 'lwt_watcher', to: 'status_ingest', label: 'BIRTH/DEATH', kind: 'primary' },
    { id: 'd5', from: 'status_ingest', to: 'ssrf_allowlist', label: 'Verify', kind: 'dashed' },
  ];

  const dynSteps: DiagramStep[] = [
    {
      id: 'dyn-s1',
      title: isVi ? 'Cấp role DynSec theo thiết bị' : 'Provision Per-Device DynSec Role',
      activeNodes: ['provision_api', 'dynsec_broker', 'nodered_bridge'],
      activeEdges: ['d1', 'd2'],
      description: isVi
        ? 'dxosBroker:provisionDevice gửi lệnh tới $CONTROL/dynamic-security/v1 tạo role_<orgId>_<deviceKey> và client riêng dưới chính sách default deny.'
        : 'dxosBroker:provisionDevice provisions ldx_<orgId>_<deviceKey> and role_<orgId>_<deviceKey> via $CONTROL/dynamic-security/v1 under default-deny ACLs.',
      route: 'POST /api/dxosBroker:provisionDevice',
      payload: '$CONTROL/dynamic-security/v1',
      chips: ['Default Deny', 'DynSec'],
    },
    {
      id: 'dyn-s2',
      title: isVi ? 'Phát hiện mất kết nối LWT & khóa SSRF' : 'LWT Presence & SSRF Allowlist',
      activeNodes: ['lwt_watcher', 'status_ingest', 'ssrf_allowlist'],
      activeEdges: ['d3', 'd4', 'd5'],
      description: isVi
        ? 'Node-RED chuyển đổi gói LWT DEATH thành offline (mqtt_lwt_disconnect) tới :deviceStatusIngest kèm X-Lattice-Edge-Token và kiểm tra SSRF.'
        : 'Node-RED normalizes LWT DEATH packets to offline (mqtt_lwt_disconnect) at :deviceStatusIngest using X-Lattice-Edge-Token and SSRF host guards.',
      route: 'POST /api/dxosBroker:deviceStatusIngest',
      payload: 'reason: "mqtt_lwt_disconnect"',
      chips: ['LWT QoS 1', 'SSRF Guard'],
    },
  ];

  return [
    {
      id: 'telemetry-twin',
      label: isVi ? 'Digital Twin & MKT' : 'Digital Twin & MKT',
      summary: isVi ? 'Orion-LD · Arrhenius MKT · HITL 2.0 °C' : 'Orion-LD · Arrhenius MKT · HITL 2.0 °C',
      zones: twinZones,
      nodes: twinNodes,
      edges: twinEdges,
      steps: twinSteps,
    },
    {
      id: 'dynsec-provisioning',
      label: isVi ? 'DynSec & LWT' : 'DynSec & LWT',
      summary: isVi ? 'ACL theo thiết bị · Presence · SSRF' : 'Per-device ACL · Presence · SSRF',
      zones: dynZones,
      nodes: dynNodes,
      edges: dynEdges,
      steps: dynSteps,
    },
  ];
});
</script>

<template>
  <DiagramCanvas
    :title="meta.title"
    :caption="meta.caption"
    viewBox="0 0 880 376"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
