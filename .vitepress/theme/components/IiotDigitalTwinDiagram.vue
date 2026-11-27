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
          'Luồng đo từ xa (Uplink): Cảm biến -> Mosquitto DynSec (:1883) -> Node-RED (:1880) -> NocoBase :telemetryIngest (Arrhenius MKT & PG16 Outbox 10s) -> FIWARE Orion-LD (:1026 -> :orionNotify) -> Twin Shadow, WebGIS & hold_mkt. Luồng điều khiển (Downlink): :twinSetDesired -> Cổng HITL (|ΔT| > 2.0 °C) -> Node-RED /twin/command -> Mosquitto -> :twinAckCommand.',
      }
    : {
        title: '2-Way IIoT Digital Twin & Arrhenius MKT Engine',
        caption:
          'Uplink telemetry: Edge Sensors -> Mosquitto DynSec (:1883) -> Node-RED (:1880) -> NocoBase :telemetryIngest (Arrhenius MKT + PG16 10s Outbox) -> FIWARE Orion-LD (:1026 -> :orionNotify) -> Twin Shadow, WebGIS & hold_mkt. Downlink command: :twinSetDesired -> HITL Guard (|ΔT| > 2.0 °C) -> Node-RED /twin/command -> Mosquitto -> :twinAckCommand.',
      },
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const twinZones: DiagramZone[] = [
    {
      id: 'lane-uplink',
      label: isVi
        ? 'LUỒNG UPLINK TELEMETRY (MQTT -> MKT -> ORION-LD -> TWIN SHADOW & HOLD_MKT)'
        : 'UPLINK TELEMETRY (MQTT -> ARRHENIUS MKT -> ORION-LD -> TWIN SHADOW & HOLD_MKT)',
      x: 16,
      y: 16,
      width: 1172,
      height: 144,
      kind: 'band',
    },
    {
      id: 'lane-downlink',
      label: isVi
        ? 'LUỒNG DOWNLINK ĐIỀU KHIỂN & ACK (CỔNG HITL 2.0 °C -> /TWIN/COMMAND -> :TWINACKCOMMAND)'
        : 'DOWNLINK COMMAND & ACK (HITL 2.0 °C GUARD -> /TWIN/COMMAND -> :TWINACKCOMMAND)',
      x: 16,
      y: 184,
      width: 1172,
      height: 144,
      kind: 'band',
    },
  ];

  const twinNodes: DiagramNode[] = [
    // Top Lane: Uplink Telemetry
    {
      id: 'sensors',
      title: isVi ? 'Cảm biến Biên' : 'Edge Sensors',
      sub: ['MQTT QoS 1', 'LWT & Ack'],
      icon: 'radio',
      x: 28,
      y: 54,
      width: 132,
      height: 80,
      zoneId: 'lane-uplink',
      inspector: {
        role: isVi ? 'Cảm biến kho lạnh & bộ điều khiển biên MQTT' : 'Cold-chain sensors and field MQTT gateways',
        packageOrPort: 'Field Devices · MQTT QoS 1',
        protocol: 'MQTT v3.1.1 / v5 · LWT',
        payloadOrSchema: 'latticedx/<org>/<dev>/telemetry | status',
        responsibilities: isVi
          ? 'Phát số đo nhiệt độ/độ ẩm theo QoS 1 lên Mosquitto và gửi thông điệp trạng thái LWT.'
          : 'Publishes QoS 1 temperature/humidity readings to Mosquitto and emits Birth/Death LWT presence.',
      },
    },
    {
      id: 'mosquitto',
      title: 'Mosquitto DynSec',
      sub: [':1883 · DynSec', 'iiot-net'],
      icon: 'lock',
      x: 212,
      y: 54,
      width: 140,
      height: 80,
      zoneId: 'lane-uplink',
      inspector: {
        role: isVi ? 'MQTT Broker nội bộ với Dynamic Security ACL' : 'Internal MQTT broker enforced by Dynamic Security ACLs',
        packageOrPort: 'eclipse-mosquitto:2.0.21 · :1883 (iiot-net)',
        protocol: 'MQTT · mosquitto_dynamic_security.so',
        payloadOrSchema: 'allow_anonymous false · default deny ACL',
        responsibilities: isVi
          ? 'Cô lập trong mạng iiot-net (internal: true), xác thực từng thiết bị bằng DynSec; mọi dữ liệu đều đi qua Node-RED Bridge.'
          : 'Runs on isolated iiot-net with default-deny DynSec ACLs; telemetry is bridged via Node-RED rather than jumping directly to Orion-LD.',
      },
    },
    {
      id: 'nodered_up',
      title: isVi ? 'Cầu nối Node-RED' : 'Node-RED Bridge',
      sub: [':1880', 'flows.json'],
      icon: 'workflow',
      x: 404,
      y: 54,
      width: 140,
      height: 80,
      zoneId: 'lane-uplink',
      inspector: {
        role: isVi ? 'Cầu nối chuẩn hóa Telemetry MQTT -> HTTP' : 'MQTT -> HTTP telemetry normalization bridge',
        packageOrPort: 'nodered/node-red:4.0.9 · :1880 (flows.json)',
        protocol: 'MQTT Sub (QoS 1) -> HTTP POST + X-Lattice-Edge-Token',
        payloadOrSchema: 'POST /api/dxosBlocks:telemetryIngest',
        responsibilities: isVi
          ? 'Đăng ký chủ đề latticedx/+/+/telemetry trên Mosquitto, chuẩn hóa dữ liệu và đẩy vào NocoBase kèm token biên.'
          : 'Subscribes to Mosquitto latticedx/+/+/telemetry topics and POSTs normalized telemetry to NocoBase with X-Lattice-Edge-Token.',
      },
    },
    {
      id: 'noco_mkt',
      title: 'NocoBase :telemetryIngest',
      sub: ['Arrhenius MKT', 'PG16 10s Outbox'],
      icon: 'activity',
      x: 596,
      y: 54,
      width: 176,
      height: 80,
      zoneId: 'lane-uplink',
      focal: true,
      inspector: {
        role: isVi ? 'Tiếp nhận đo đạc, tính Arrhenius MKT & ghi PG16 Outbox' : 'Telemetry ingest, Arrhenius MKT & PG16 Context Outbox',
        packageOrPort: 'blocks-api.js · alarm-engine.js · latticeContextOutbox',
        protocol: 'POST :telemetryIngest · 10s FOR UPDATE SKIP LOCKED',
        payloadOrSchema: 'R=0.008314472, ΔH=83.14472 · latticeTelemetryPoints',
        responsibilities: isVi
          ? 'Lưu chuỗi thời gian, đánh giá Arrhenius MKT (ingestTelemetryPoint) và xếp hàng đợi latticeContextOutbox đồng bộ Orion-LD mỗi 10s.'
          : 'Persists telemetryPoints, evaluates Arrhenius MKT via ingestTelemetryPoint, and enqueues latticeContextOutbox for 10s Orion-LD sync.',
      },
    },
    {
      id: 'orion_ld',
      title: 'FIWARE Orion-LD',
      sub: [':1026 · NGSI-LD', '-> :orionNotify'],
      icon: 'globe',
      x: 828,
      y: 54,
      width: 144,
      height: 80,
      zoneId: 'lane-uplink',
      inspector: {
        role: isVi ? 'Context Broker NGSI-LD đa tenant chuẩn ETSI' : 'Multi-tenant ETSI NGSI-LD context broker',
        packageOrPort: 'fiware/orion-ld:1.12.0 · :1026 (MongoDB 8.0)',
        protocol: 'HTTP NGSI-LD · NGSILD-Tenant',
        payloadOrSchema: 'urn:ngsi-ld:Asset:<orgId>:native:<assetId>',
        responsibilities: isVi
          ? 'Nhận cập nhật thực thể NGSI-LD từ PG16 Outbox và phát thông báo đăng ký (throttle 5s) tới POST /api/dxosBroker:orionNotify.'
          : 'Receives NGSI-LD entity updates from PG16 Context Outbox and dispatches subscription notifications (5s throttle) to :orionNotify.',
      },
    },
    {
      id: 'twin_hold',
      title: isVi ? 'Twin Shadow & hold_mkt' : 'Twin Shadow & WebGIS',
      sub: ['WebGIS · Alarm', 'hold_mkt'],
      icon: 'database',
      x: 1028,
      y: 54,
      width: 148,
      height: 80,
      zoneId: 'lane-uplink',
      focal: true,
      inspector: {
        role: isVi ? 'Đồng bộ Shadow, WebGIS, cảnh báo SHA-256 & khóa lô hold_mkt' : 'Digital Twin shadow, MapLibre WebGIS & hold_mkt quarantine',
        packageOrPort: 'broker-control.js · digital-twin.js · dxosWms:holdLotByMkt',
        protocol: 'POST :orionNotify · SSE surfaceEvents · PG16 FORCE RLS',
        payloadOrSchema: 'latticeTwinShadows · latticeIncidentCases · hold_mkt',
        responsibilities: isVi
          ? 'Cập nhật trạng thái reported từ Orion-LD lên WebGIS, khử trùng lặp cảnh báo theo SHA-256 và khóa phân bổ FEFO (hold_mkt) khi vượt MKT.'
          : 'Updates reported twin state on WebGIS, deduplicates alerts by SHA-256, and quarantines breached WMS stock lots as hold_mkt.',
      },
    },

    // Bottom Lane: Downlink Command & Ack
    {
      id: 'op_desired',
      title: isVi ? 'Vận hành / WebGIS' : 'Operator / WebGIS',
      sub: [':twinSetDesired', 'Setpoint Patch'],
      icon: 'terminal',
      x: 28,
      y: 222,
      width: 180,
      height: 80,
      zoneId: 'lane-downlink',
      inspector: {
        role: isVi ? 'Yêu cầu chỉnh điểm đặt nhiệt độ từ WebGIS / Flow' : 'Operator or LatticeFlow desired setpoint request',
        packageOrPort: 'DxosWebGisBlockModel · POST /api/dxosBlocks:twinSetDesired',
        protocol: 'HTTPS · Bearer JWT | ldx_pat_* · PG16 FORCE RLS',
        payloadOrSchema: '{ assetId, desiredPatch: { targetTempC } }',
        responsibilities: isVi
          ? 'Gửi yêu cầu thay đổi trạng thái mong muốn (desiredPatch) trên Digital Twin để chuyển qua cổng kiểm tra biên độ HITL.'
          : 'Submits desired setpoint updates (desiredPatch) for a Digital Twin asset into the HITL safety validation gate.',
      },
    },
    {
      id: 'hitl_guard',
      title: isVi ? 'Cổng HITL 2.0 °C' : 'HITL Temp Guard',
      sub: ['|ΔT| > 2.0 °C', '-> pending_hitl'],
      icon: 'shield',
      x: 270,
      y: 222,
      width: 184,
      height: 80,
      zoneId: 'lane-downlink',
      focal: true,
      inspector: {
        role: isVi ? 'Rào chắn an toàn nhiệt độ yêu cầu phê duyệt con người' : 'Safety interlock gating large setpoint shifts',
        packageOrPort: 'digital-twin.js · HITL_TEMP_THRESHOLD_C = 2.0',
        protocol: 'Policy Gate -> dxosApprovals / hitlApproved=true',
        payloadOrSchema: '|desiredPatch.targetTempC - baselineTemp| > 2.0 -> pending_hitl',
        responsibilities: isVi
          ? 'Tạm giữ lệnh ở trạng thái pending_hitl nếu biên độ thay đổi vượt 2.0 °C so với baseline cho đến khi người vận hành phê duyệt.'
          : 'Pauses setpoint deltas exceeding 2.0 °C from baseline as pending_hitl until an operator approves dispatch.',
      },
    },
    {
      id: 'nodered_cmd',
      title: 'POST Node-RED',
      sub: ['/twin/command', ':1880 Bridge'],
      icon: 'workflow',
      x: 516,
      y: 222,
      width: 176,
      height: 80,
      zoneId: 'lane-downlink',
      inspector: {
        role: isVi ? 'Xuất bản lệnh Downlink tới Node-RED Bridge' : 'Downlink HTTP dispatch to Node-RED Bridge',
        packageOrPort: 'digital-twin.js -> nodered:1880/twin/command',
        protocol: 'HTTP POST · DX_NODERED_HOST_ALLOWLIST',
        payloadOrSchema: '{ orgId, deviceKey, commandId, desiredPatch }',
        responsibilities: isVi
          ? 'Sau khi qua cổng HITL, NocoBase kiểm tra allowlist host và gửi lệnh điều khiển sang Node-RED /twin/command.'
          : 'Once cleared by the HITL gate, NocoBase validates the allowlisted Node-RED host and posts the command to /twin/command.',
      },
    },
    {
      id: 'mosquitto_ack',
      title: isVi ? 'Mosquitto Lệnh & Ack' : 'Mosquitto Command & Ack',
      sub: ['.../command -> Edge', '.../ack -> Bridge'],
      icon: 'radio',
      x: 754,
      y: 222,
      width: 188,
      height: 80,
      zoneId: 'lane-downlink',
      inspector: {
        role: isVi ? 'Phát lệnh MQTT xuống Thiết bị & Nhận Phản hồi Ack' : 'MQTT downlink command delivery & device ack relay',
        packageOrPort: 'mosquitto:1883 · nodered:1880',
        protocol: 'MQTT QoS 1 · DynSec Per-Device ACL',
        payloadOrSchema: 'latticedx/<org>/<dev>/command & .../ack',
        responsibilities: isVi
          ? 'Node-RED xuất bản lệnh xuống chủ đề .../command theo ACL DynSec của thiết bị và hứng gói xác nhận .../ack trả về.'
          : 'Node-RED publishes commands to the device-scoped .../command topic under DynSec ACLs and consumes .../ack confirmations.',
      },
    },
    {
      id: 'noco_ack',
      title: 'NocoBase :twinAckCommand',
      sub: ['Twin Shadow', 'Audit & State'],
      icon: 'check-circle',
      x: 1004,
      y: 222,
      width: 172,
      height: 80,
      zoneId: 'lane-downlink',
      inspector: {
        role: isVi ? 'Xác nhận hoàn tất lệnh Downlink & Ghi Nhật ký' : 'Downlink command acknowledgment & shadow audit',
        packageOrPort: 'blocks-api.js · POST /api/dxosBlocks:twinAckCommand',
        protocol: 'HTTP POST + X-Lattice-Edge-Token · PG16 FORCE RLS',
        payloadOrSchema: 'latticeTwinShadows (commandStatus=acked) · Audit Log',
        responsibilities: isVi
          ? 'Cập nhật trạng thái commandStatus và reported trên latticeTwinShadows, khép kín vòng lặp điều khiển 2 chiều có kiểm toán.'
          : 'Marks commandStatus acknowledged and updates twin shadow state in PG16 FORCE RLS to close the audited 2-way control loop.',
      },
    },
  ];

  const twinEdges: DiagramEdge[] = [
    // Top Lane Uplink (strict L->R)
    {
      id: 'u1',
      from: 'sensors',
      to: 'mosquitto',
      label: 'MQTT',
      kind: 'primary',
      points: [
        [160, 94],
        [212, 94],
      ],
    },
    {
      id: 'u2',
      from: 'mosquitto',
      to: 'nodered_up',
      label: 'Sub',
      kind: 'primary',
      points: [
        [352, 94],
        [404, 94],
      ],
    },
    {
      id: 'u3',
      from: 'nodered_up',
      to: 'noco_mkt',
      label: 'POST',
      kind: 'primary',
      points: [
        [544, 94],
        [596, 94],
      ],
    },
    {
      id: 'u4',
      from: 'noco_mkt',
      to: 'orion_ld',
      label: '10s',
      kind: 'primary',
      points: [
        [772, 94],
        [828, 94],
      ],
    },
    {
      id: 'u5',
      from: 'orion_ld',
      to: 'twin_hold',
      label: 'Notify',
      kind: 'flow',
      points: [
        [972, 94],
        [1028, 94],
      ],
    },

    // Bottom Lane Downlink (strict L->R)
    {
      id: 'd1',
      from: 'op_desired',
      to: 'hitl_guard',
      label: 'Target',
      kind: 'primary',
      points: [
        [208, 262],
        [270, 262],
      ],
    },
    {
      id: 'd2',
      from: 'hitl_guard',
      to: 'nodered_cmd',
      label: 'Gate',
      kind: 'primary',
      points: [
        [454, 262],
        [516, 262],
      ],
    },
    {
      id: 'd3',
      from: 'nodered_cmd',
      to: 'mosquitto_ack',
      label: 'Cmd',
      kind: 'flow',
      points: [
        [692, 262],
        [754, 262],
      ],
    },
    {
      id: 'd4',
      from: 'mosquitto_ack',
      to: 'noco_ack',
      label: 'Ack',
      kind: 'flow',
      points: [
        [942, 262],
        [1004, 262],
      ],
    },
  ];

  const twinSteps: DiagramStep[] = [
    {
      id: 'tw-s1',
      title: isVi ? 'Uplink MQTT -> :telemetryIngest' : 'Uplink MQTT -> :telemetryIngest',
      activeNodes: ['sensors', 'mosquitto', 'nodered_up', 'noco_mkt'],
      activeEdges: ['u1', 'u2', 'u3'],
      description: isVi
        ? 'Cảm biến phát MQTT QoS 1 vào Mosquitto DynSec; Node-RED chuẩn hóa và POST tới NocoBase :telemetryIngest để tính Arrhenius MKT.'
        : 'Edge sensors publish QoS 1 telemetry to Mosquitto DynSec; Node-RED bridges readings to :telemetryIngest for Arrhenius MKT calculation.',
      route: 'MQTT :1883 -> Node-RED :1880 -> POST /api/dxosBlocks:telemetryIngest',
      payload: 'X-Lattice-Edge-Token | R=0.008314472, ΔH=83.14472',
      chips: ['Arrhenius MKT', 'PG16 Outbox'],
    },
    {
      id: 'tw-s2',
      title: isVi ? 'Orion-LD -> Twin Shadow & hold_mkt' : 'Orion-LD -> Twin Shadow & hold_mkt',
      activeNodes: ['noco_mkt', 'orion_ld', 'twin_hold'],
      activeEdges: ['u4', 'u5'],
      description: isVi
        ? 'PG16 Context Outbox (10s SKIP LOCKED) đẩy thực thể NGSI-LD sang Orion-LD; :orionNotify cập nhật Twin Shadow, WebGIS và khóa lô hold_mkt.'
        : 'The 10s PG16 Context Outbox syncs NGSI-LD entities to Orion-LD, firing :orionNotify to update Twin Shadow, WebGIS, and hold_mkt.',
      route: 'orion-ld:1026 -> POST /api/dxosBroker:orionNotify',
      payload: 'NGSILD-Tenant: <orgId> · throttle: 5s',
      chips: ['NGSI-LD', 'hold_mkt'],
    },
    {
      id: 'tw-s3',
      title: isVi ? 'Cổng HITL (|ΔT| > 2.0 °C)' : 'HITL Temp Guard (|ΔT| > 2.0 °C)',
      activeNodes: ['op_desired', 'hitl_guard'],
      activeEdges: ['d1'],
      description: isVi
        ? 'Mọi thay đổi targetTempC vượt 2.0 °C so với baseline bị giữ tại pending_hitl chờ người vận hành duyệt trước khi xuất lệnh.'
        : 'Desired setpoint changes with |ΔT| > 2.0 °C pause as pending_hitl until operator approval before downlink dispatch.',
      route: 'POST /api/dxosBlocks:twinSetDesired',
      payload: 'HITL_TEMP_THRESHOLD_C = 2.0',
      chips: ['pending_hitl', 'Safety Guard'],
    },
    {
      id: 'tw-s4',
      title: isVi ? 'Downlink /twin/command & :twinAckCommand' : 'Downlink /twin/command & :twinAckCommand',
      activeNodes: ['hitl_guard', 'nodered_cmd', 'mosquitto_ack', 'noco_ack'],
      activeEdges: ['d2', 'd3', 'd4'],
      description: isVi
        ? 'Lệnh đã duyệt đi qua Node-RED /twin/command -> Mosquitto .../command tới thiết bị, sau đó .../ack quay về NocoBase :twinAckCommand.'
        : 'Approved commands flow via Node-RED /twin/command -> Mosquitto .../command to the edge, returning .../ack to :twinAckCommand.',
      route: 'POST /twin/command -> Mosquitto -> POST :twinAckCommand',
      payload: 'latticedx/<org>/<dev>/command & .../ack',
      chips: ['2-Way Twin', 'Audited Ack'],
    },
  ];

  // Mode 2: Strict 5-step L->R Mosquitto DynSec & LWT Presence (zero filler)
  const dynZones: DiagramZone[] = [
    {
      id: 'dynsec-lwt-pipeline',
      label: isVi
        ? 'CẤP PHÁT MOSQUITTO DYNSEC & GIÁM SÁT HIỆN DIỆN LWT -> LATTICEIOTDEVICES'
        : 'MOSQUITTO DYNSEC PROVISIONING & LWT PRESENCE -> LATTICEIOTDEVICES',
      x: 16,
      y: 16,
      width: 1148,
      height: 180,
      kind: 'admin',
    },
  ];

  const dynNodes: DiagramNode[] = [
    {
      id: 'prov_api',
      title: isVi ? 'Cấp phát Thiết bị' : 'Device Provisioning',
      sub: ['POST /api/dxosBroker', ':provisionDevice'],
      icon: 'key',
      x: 32,
      y: 72,
      width: 176,
      height: 88,
      zoneId: 'dynsec-lwt-pipeline',
      inspector: {
        role: isVi ? 'API cấp chứng danh MQTT riêng cho từng thiết bị' : 'Per-tenant MQTT client and role provisioning API',
        packageOrPort: 'plugin-dxos-broker · broker-control.js',
        protocol: 'POST /api/dxosBroker:provisionDevice',
        payloadOrSchema: 'client: ldx_<orgId>_<deviceKey> | role: role_<orgId>_<deviceKey>',
        responsibilities: isVi
          ? 'Đăng ký thiết bị vào latticeIotDevices và phát hành chứng danh MQTT cô lập theo tổ chức mà không dùng mật khẩu chung.'
          : 'Registers the device in latticeIotDevices and issues tenant-isolated MQTT credentials without shared global passwords.',
      },
    },
    {
      id: 'dynsec_acl',
      title: isVi ? 'ACL Mosquitto DynSec' : 'Mosquitto DynSec ACL',
      sub: ['$CONTROL/dynamic-security/v1', 'Default Deny · Per-Org'],
      icon: 'lock',
      x: 256,
      y: 72,
      width: 216,
      height: 88,
      zoneId: 'dynsec-lwt-pipeline',
      focal: true,
      inspector: {
        role: isVi ? 'Phân quyền chủ đề MQTT từ chối mặc định' : 'Least-privilege topic ACLs with default deny',
        packageOrPort: '/mosquitto/data/dynamic-security.json',
        protocol: 'MQTT $CONTROL/dynamic-security/v1',
        payloadOrSchema: 'send: latticedx/<org>/<dev>/# | recv: .../command & .../ack',
        responsibilities: isVi
          ? 'Áp dụng default deny cho publishClientSend/Receive và subscribe; giới hạn mỗi thiết bị chỉ giao tiếp đúng prefix tổ chức.'
          : 'Enforces default-deny ACLs so each device can only publish/subscribe inside its own latticedx/<orgId>/<deviceKey> prefix.',
      },
    },
    {
      id: 'lwt_watch',
      title: isVi ? 'Giám sát LWT Node-RED' : 'Node-RED LWT Watcher',
      sub: ['latticedx/+/+/status', 'BIRTH | DEATH · QoS 1'],
      icon: 'radio',
      x: 520,
      y: 72,
      width: 176,
      height: 88,
      zoneId: 'dynsec-lwt-pipeline',
      inspector: {
        role: isVi ? 'Chuẩn hóa trạng thái trực tuyến và LWT ngoại tuyến' : 'MQTT Birth and Last Will Testament normalizer',
        packageOrPort: 'flows.json:301-347 · latticedx/+/+/status',
        protocol: 'MQTT QoS 1 -> HTTP',
        payloadOrSchema: 'BIRTH|ONLINE -> online; DEATH|OFFLINE|LWT -> offline',
        responsibilities: isVi
          ? 'Theo dõi kênh status QoS 1 trên Mosquitto và gắn reason=mqtt_lwt_disconnect ngay khi broker phát gói Last Will.'
          : 'Monitors latticedx/+/+/status at QoS 1 and tags unexpected broker disconnects with reason=mqtt_lwt_disconnect.',
      },
    },
    {
      id: 'status_in',
      title: isVi ? 'Nhận Trạng thái LWT' : 'Status Ingest Endpoint',
      sub: ['POST :deviceStatusIngest', 'X-Lattice-Edge-Token'],
      icon: 'bell',
      x: 744,
      y: 72,
      width: 196,
      height: 88,
      zoneId: 'dynsec-lwt-pipeline',
      inspector: {
        role: isVi ? 'Endpoint tiếp nhận trạng thái thiết bị từ cầu nối biên' : 'Edge-authenticated device presence ingest endpoint',
        packageOrPort: 'broker-control.js:1509-1580',
        protocol: 'POST /api/dxosBroker:deviceStatusIngest',
        payloadOrSchema: 'Header X-Lattice-Edge-Token (>= 16 chars)',
        responsibilities: isVi
          ? 'Xác thực X-Lattice-Edge-Token theo hằng thời gian và chuyển tiếp trạng thái online/offline vào cơ sở dữ liệu.'
          : 'Validates X-Lattice-Edge-Token in constant time and persists device online/offline status transitions.',
      },
    },
    {
      id: 'iot_db',
      title: isVi ? 'PG16 Thiết bị & Sự cố' : 'PG16 Device & Incident',
      sub: ['latticeIotDevices', 'MQTT-LWT-OFFLINE'],
      icon: 'database',
      x: 988,
      y: 72,
      width: 160,
      height: 88,
      zoneId: 'dynsec-lwt-pipeline',
      focal: true,
      inspector: {
        role: isVi ? 'Lưu hiện diện thiết bị & mở sự cố mất kết nối LWT' : 'Persists device presence & raises LWT offline incidents',
        packageOrPort: 'latticeIotDevices · latticeIncidentCases',
        protocol: 'PG16 FORCE RLS · app.current_org',
        payloadOrSchema: 'lastSeenAt · status · MQTT-LWT-OFFLINE incident',
        responsibilities: isVi
          ? 'Cập nhật trạng thái thiết bị trong latticeIotDevices và tự động mở sự cố MQTT-LWT-OFFLINE trong latticeIncidentCases.'
          : 'Updates online/offline presence in latticeIotDevices and raises MQTT-LWT-OFFLINE incidents in latticeIncidentCases.',
      },
    },
  ];

  const dynEdges: DiagramEdge[] = [
    {
      id: 'l1',
      from: 'prov_api',
      to: 'dynsec_acl',
      label: 'ACL',
      kind: 'primary',
      points: [
        [208, 116],
        [256, 116],
      ],
    },
    {
      id: 'l2',
      from: 'dynsec_acl',
      to: 'lwt_watch',
      label: 'LWT',
      kind: 'flow',
      points: [
        [472, 116],
        [520, 116],
      ],
    },
    {
      id: 'l3',
      from: 'lwt_watch',
      to: 'status_in',
      label: 'POST',
      kind: 'primary',
      points: [
        [696, 116],
        [744, 116],
      ],
    },
    {
      id: 'l4',
      from: 'status_in',
      to: 'iot_db',
      label: 'RLS',
      kind: 'primary',
      points: [
        [940, 116],
        [988, 116],
      ],
    },
  ];

  const dynSteps: DiagramStep[] = [
    {
      id: 'dyn-s1',
      title: isVi ? 'Cấp phát DynSec & ACL Tối thiểu' : 'DynSec Provisioning & Default-Deny ACL',
      activeNodes: ['prov_api', 'dynsec_acl'],
      activeEdges: ['l1'],
      description: isVi
        ? 'dxosBroker:provisionDevice gửi lệnh tới $CONTROL/dynamic-security/v1 để tạo client và role giới hạn theo prefix tổ chức.'
        : 'dxosBroker:provisionDevice sends $CONTROL/dynamic-security/v1 commands to isolate per-org client credentials and topic ACLs.',
      route: 'POST /api/dxosBroker:provisionDevice -> $CONTROL/dynamic-security/v1',
      payload: 'role_<orgId>_<deviceKey> · default deny ACL',
      chips: ['DynSec', 'Default Deny'],
    },
    {
      id: 'dyn-s2',
      title: isVi ? 'Giám sát LWT -> :deviceStatusIngest -> PG16' : 'LWT Watcher -> :deviceStatusIngest -> PG16',
      activeNodes: ['lwt_watch', 'status_in', 'iot_db'],
      activeEdges: ['l3', 'l4'],
      description: isVi
        ? 'Node-RED chuyển gói BIRTH/DEATH QoS 1 tới :deviceStatusIngest (X-Lattice-Edge-Token) để cập nhật latticeIotDevices và tạo sự cố MQTT-LWT-OFFLINE.'
        : 'Node-RED posts QoS 1 BIRTH/DEATH presence to :deviceStatusIngest, updating latticeIotDevices and opening MQTT-LWT-OFFLINE incidents.',
      route: 'latticedx/+/+/status -> POST :deviceStatusIngest -> PG16 FORCE RLS',
      payload: 'reason: "mqtt_lwt_disconnect" -> MQTT-LWT-OFFLINE',
      chips: ['LWT QoS 1', 'MQTT-LWT-OFFLINE'],
    },
  ];

  return [
    {
      id: 'closed-loop-twin',
      label: isVi ? 'Digital Twin IIoT 2 Chiều' : 'Closed-Loop 2-Way IIoT Digital Twin',
      viewBox: '0 0 1204 344',
      zones: twinZones,
      nodes: twinNodes,
      edges: twinEdges,
      steps: twinSteps,
    },
    {
      id: 'dynsec-lwt',
      label: isVi ? 'Mosquitto DynSec & LWT' : 'Mosquitto DynSec & LWT Presence',
      viewBox: '0 0 1180 212',
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
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
