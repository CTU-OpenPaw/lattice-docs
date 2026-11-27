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
          'Uplink chuẩn: Cảm biến -> Mosquitto DynSec -> Node-RED (:telemetryIngest) -> NocoBase MKT & PG16 Context Outbox -> FIWARE Orion-LD -> :orionNotify -> Twin Shadow & Alarm / hold_mkt; Downlink qua cổng HITL 2.0 °C.',
      }
    : {
        title: '2-Way IIoT Digital Twin & Arrhenius MKT Engine',
        caption:
          'Verified uplink: Sensors -> Mosquitto DynSec -> Node-RED (:telemetryIngest) -> NocoBase MKT & PG16 Context Outbox -> FIWARE Orion-LD -> :orionNotify -> Twin Shadow & Alarm / hold_mkt; HITL-guarded downlink via Node-RED.',
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
      width: 224,
      height: 368,
      kind: 'external',
    },
    {
      id: 'context-plane',
      label: isVi ? 'Node-RED Bridge, NocoBase MKT Outbox & Orion-LD' : 'Node-RED Bridge, NocoBase MKT Outbox & Orion-LD',
      x: 260,
      y: 16,
      width: 540,
      height: 368,
      kind: 'admin',
    },
    {
      id: 'control-plane',
      label: isVi ? 'WebGIS, hold_mkt & Cổng HITL' : 'WebGIS, hold_mkt & HITL Guard',
      x: 820,
      y: 16,
      width: 268,
      height: 368,
      kind: 'traffic',
    },
  ];

  const twinNodes: DiagramNode[] = [
    {
      id: 'edge_sensors',
      title: isVi ? 'Cảm biến Biên' : 'Edge Sensors',
      sub: 'QoS 1 · LWT & ack',
      icon: 'radio',
      x: 28,
      y: 60,
      width: 200,
      height: 64,
      zoneId: 'iiot-edge',
      inspector: isVi
        ? {
            role: 'Cảm biến kho lạnh, xe vận tải và bộ điều khiển biên MQTT',
            packageOrPort: 'Field Devices · MQTT QoS 1',
            protocol: 'MQTT v3.1.1 / v5 · LWT',
            payloadOrSchema: 'latticedx/<org>/<dev>/telemetry | status | command | ack',
            responsibilities:
              'Phát số đo telemetry lên Mosquitto, gửi gói Birth/Death LWT và phản hồi xác nhận lệnh điều khiển trên kênh .../ack.',
          }
        : {
            role: 'Cold-chain sensors, reefer gateways, and field actuators',
            packageOrPort: 'Field Devices · MQTT QoS 1',
            protocol: 'MQTT v3.1.1 / v5 · LWT',
            payloadOrSchema: 'latticedx/<org>/<dev>/telemetry | status | command | ack',
            responsibilities:
              'Publishes telemetry to Mosquitto, emits Birth/Death LWT status, and returns command acknowledgments on .../ack.',
          },
    },
    {
      id: 'mosquitto',
      title: 'Mosquitto DynSec',
      sub: ':1883 · allow_anon false',
      icon: 'lock',
      x: 28,
      y: 244,
      width: 200,
      height: 64,
      zoneId: 'iiot-edge',
      focal: true,
      inspector: isVi
        ? {
            role: 'MQTT Broker nội bộ khóa xác thực ẩn danh với Dynamic Security',
            packageOrPort: 'eclipse-mosquitto:2.0.21 · :1883 (iiot-net)',
            protocol: 'MQTT · mosquitto_dynamic_security.so',
            payloadOrSchema: 'max_queued_messages=1000 | default deny ACL',
            responsibilities:
              'Chạy trong mạng cô lập iiot-net không mở cổng host; mọi thông điệp đều đi qua Node-RED Bridge chứ không kết nối tắt tới Orion-LD.',
          }
        : {
            role: 'Internal MQTT broker enforced by Dynamic Security ACLs',
            packageOrPort: 'eclipse-mosquitto:2.0.21 · :1883 (iiot-net)',
            protocol: 'MQTT · mosquitto_dynamic_security.so',
            payloadOrSchema: 'max_queued_messages=1000 | default deny ACL',
            responsibilities:
              'Isolated on internal iiot-net with default-deny ACLs; telemetry is consumed by Node-RED rather than jumping directly to Orion-LD.',
          },
    },
    {
      id: 'nodered',
      title: isVi ? 'Cầu nối Node-RED' : 'Node-RED Bridge',
      sub: ':1880 · Sub & /twin/cmd',
      icon: 'workflow',
      x: 304,
      y: 244,
      width: 204,
      height: 64,
      zoneId: 'context-plane',
      focal: true,
      inspector: isVi
        ? {
            role: 'Cầu nối 2 chiều MQTT <-> HTTP của hạ tầng IIoT',
            packageOrPort: 'nodered/node-red:4.0.9 · :1880 (flows.json)',
            protocol: 'MQTT Sub (QoS 1) · HTTP POST + X-Lattice-Edge-Token',
            payloadOrSchema: 'POST :telemetryIngest | /twin/command | :twinAckCommand',
            responsibilities:
              'Đăng ký latticedx/+/+/telemetry trên Mosquitto để POST về NocoBase :telemetryIngest, phát lệnh downlink /twin/command và chuyển tiếp ack.',
          }
        : {
            role: 'Bidirectional MQTT <-> HTTP IIoT edge bridge',
            packageOrPort: 'nodered/node-red:4.0.9 · :1880 (flows.json)',
            protocol: 'MQTT Sub (QoS 1) · HTTP POST + X-Lattice-Edge-Token',
            payloadOrSchema: 'POST :telemetryIngest | /twin/command | :twinAckCommand',
            responsibilities:
              'Subscribes to Mosquitto telemetry to POST dxosBlocks:telemetryIngest, publishes /twin/command downlinks, and relays device acks to :twinAckCommand.',
          },
    },
    {
      id: 'noco_mkt_outbox',
      title: isVi ? 'NocoBase MKT & Outbox' : 'NocoBase MKT & Outbox',
      sub: ':telemetryIngest · PG16',
      icon: 'activity',
      x: 304,
      y: 60,
      width: 212,
      height: 64,
      zoneId: 'context-plane',
      focal: true,
      inspector: isVi
        ? {
            role: 'Tiếp nhận đo đạc, tính Arrhenius MKT & ghi PG16 Context Outbox',
            packageOrPort: 'blocks-api.js · alarm-engine.js · latticeContextOutbox',
            protocol: 'POST :telemetryIngest · 10s SKIP LOCKED Outbox',
            payloadOrSchema: 'R=0.008314472, ΔH=83.14472 · FOR UPDATE SKIP LOCKED',
            responsibilities:
              'Ghi telemetryPoints, chạy ingestTelemetryPoint (Arrhenius MKT) và xếp hàng đợi latticeContextOutbox để đồng bộ sang Orion-LD mỗi 10s.',
          }
        : {
            role: 'Telemetry ingest, Arrhenius MKT & PG16 Context Outbox',
            packageOrPort: 'blocks-api.js · alarm-engine.js · latticeContextOutbox',
            protocol: 'POST :telemetryIngest · 10s SKIP LOCKED Outbox',
            payloadOrSchema: 'R=0.008314472, ΔH=83.14472 · FOR UPDATE SKIP LOCKED',
            responsibilities:
              'Persists telemetryPoints, evaluates Arrhenius MKT via ingestTelemetryPoint, and enqueues latticeContextOutbox for 10s Orion-LD sync.',
          },
    },
    {
      id: 'orion_ld',
      title: 'FIWARE Orion-LD',
      sub: ':1026 · NGSILD-Tenant',
      icon: 'globe',
      x: 600,
      y: 60,
      width: 192,
      height: 64,
      zoneId: 'context-plane',
      inspector: {
        role: isVi ? 'Context Broker NGSI-LD đa tenant chuẩn ETSI' : 'Multi-tenant ETSI NGSI-LD context broker',
        packageOrPort: 'fiware/orion-ld:1.12.0 · :1026 (MongoDB 8.0)',
        protocol: 'HTTP NGSI-LD · NGSILD-Tenant',
        payloadOrSchema: 'urn:ngsi-ld:Asset:<orgId>:native:<assetId>',
        responsibilities: isVi
          ? 'Nhận cập nhật thực thể NGSI-LD từ PG16 Context Outbox và phát thông báo đăng ký (throttle 5s) tới POST /api/dxosBroker:orionNotify.'
          : 'Receives NGSI-LD entity updates from PG16 Context Outbox and dispatches subscription notifications (5s throttle) to dxosBroker:orionNotify.',
      },
    },
    {
      id: 'twin_shadow',
      title: isVi ? 'Twin Shadow & Sự cố' : 'Twin Shadow & Alarm',
      sub: 'hold_mkt · :orionNotify',
      icon: 'database',
      x: 592,
      y: 244,
      width: 192,
      height: 64,
      zoneId: 'context-plane',
      focal: true,
      inspector: isVi
        ? {
            role: 'Cập nhật Digital Twin Shadow, cảnh báo SHA-256 & giữ lô hold_mkt',
            packageOrPort: 'broker-control.js · digital-twin.js · alarm-engine.js',
            protocol: 'POST :orionNotify · PG16 FORCE RLS',
            payloadOrSchema: 'latticeTwinShadows · latticeIncidentCases · hold_mkt',
            responsibilities:
              'Đồng bộ thuộc tính reported từ Orion-LD, khử trùng lặp cảnh báo theo SHA-256 và khóa lô hold_mkt khi vượt MKT.',
          }
        : {
            role: 'Digital Twin shadow state, SHA-256 alarms & hold_mkt',
            packageOrPort: 'broker-control.js · digital-twin.js · alarm-engine.js',
            protocol: 'POST :orionNotify · PG16 FORCE RLS',
            payloadOrSchema: 'latticeTwinShadows · latticeIncidentCases · hold_mkt',
            responsibilities:
              'Updates reported twin shadow state from :orionNotify, deduplicates alerts by SHA-256, and quarantines breached lots as hold_mkt.',
          },
    },
    {
      id: 'webgis_ops',
      title: isVi ? 'WebGIS & Cảnh báo' : 'WebGIS & Incident SLA',
      sub: 'holdLotByMkt · MapLibre',
      icon: 'bell',
      x: 868,
      y: 60,
      width: 204,
      height: 64,
      zoneId: 'control-plane',
      inspector: isVi
        ? {
            role: 'Hiển thị bản đồ WebGIS, giữ lô WMS & leo thang SLA',
            packageOrPort: 'DxosWebGisBlockModel · dxosWms:holdLotByMkt',
            protocol: 'SSE surfaceEvents · SLA Escalation',
            payloadOrSchema: 'latticeStockLots (hold_mkt) · latticeSlaPolicies',
            responsibilities:
              'Cập nhật trạng thái thiết bị theo thời gian thực trên WebGIS, khóa phân bổ FEFO cho lô quá nhiệt và thông báo vận hành.',
          }
        : {
            role: 'Live WebGIS telemetry view, WMS lot hold & SLA alerts',
            packageOrPort: 'DxosWebGisBlockModel · dxosWms:holdLotByMkt',
            protocol: 'SSE surfaceEvents · SLA Escalation',
            payloadOrSchema: 'latticeStockLots (hold_mkt) · latticeSlaPolicies',
            responsibilities:
              'Visualizes twin health on MapLibre WebGIS, blocks FEFO allocation via hold_mkt, and dispatches SLA escalation alerts.',
          },
    },
    {
      id: 'hitl_guard',
      title: isVi ? 'Cổng HITL 2.0 °C' : 'HITL Delta Guard',
      sub: '|ΔT| > 2.0 °C -> hold',
      icon: 'shield',
      x: 868,
      y: 244,
      width: 204,
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
              'Chặn gửi lệnh xuống Node-RED nếu biên độ đổi targetTempC vượt quá 2.0 °C mà chưa có hitlApproved=true.',
          }
        : {
            role: 'Safety interlock gating large setpoint shifts',
            packageOrPort: 'digital-twin.js · dxosBlocks:twinSetDesired',
            protocol: 'HITL_TEMP_THRESHOLD_C = 2.0',
            payloadOrSchema: '|desiredPatch.targetTempC - baselineTemp| > 2.0 -> pending_hitl',
            responsibilities:
              'Pauses setpoint changes exceeding 2.0 °C from baseline as pending_hitl until operator approval before Node-RED dispatch.',
          },
    },
  ];

  const twinEdges: DiagramEdge[] = [
    {
      id: 't1',
      from: 'edge_sensors',
      to: 'mosquitto',
      label: 'MQTT QoS 1',
      kind: 'primary',
      points: [
        [84, 124],
        [84, 244],
      ],
    },
    {
      id: 't2',
      from: 'mosquitto',
      to: 'nodered',
      label: 'MQTT Sub',
      kind: 'primary',
      points: [
        [228, 260],
        [304, 260],
      ],
    },
    {
      id: 't3',
      from: 'nodered',
      to: 'noco_mkt_outbox',
      label: ':telemetryIngest',
      kind: 'primary',
      points: [
        [356, 244],
        [356, 124],
      ],
    },
    {
      id: 't4',
      from: 'noco_mkt_outbox',
      to: 'orion_ld',
      label: '10s Outbox',
      kind: 'primary',
      points: [
        [516, 92],
        [600, 92],
      ],
    },
    {
      id: 't5',
      from: 'orion_ld',
      to: 'twin_shadow',
      label: ':orionNotify',
      kind: 'flow',
      points: [
        [696, 124],
        [696, 244],
      ],
    },
    {
      id: 't6',
      from: 'twin_shadow',
      to: 'webgis_ops',
      label: 'hold_mkt',
      kind: 'flow',
      points: [
        [784, 260],
        [826, 260],
        [826, 92],
        [868, 92],
      ],
    },
    {
      id: 't7',
      from: 'twin_shadow',
      to: 'hitl_guard',
      label: '|ΔT|>2.0C',
      kind: 'primary',
      points: [
        [784, 292],
        [868, 292],
      ],
    },
    {
      id: 't8',
      from: 'hitl_guard',
      to: 'nodered',
      label: '/twin/command',
      kind: 'primary',
      points: [
        [970, 308],
        [970, 352],
        [416, 352],
        [416, 308],
      ],
    },
    {
      id: 't9',
      from: 'nodered',
      to: 'mosquitto',
      label: 'command',
      kind: 'flow',
      points: [
        [304, 294],
        [228, 294],
      ],
    },
    {
      id: 't10',
      from: 'mosquitto',
      to: 'edge_sensors',
      label: 'cmd / ack',
      kind: 'dashed',
      points: [
        [180, 244],
        [180, 124],
      ],
    },
    {
      id: 't11',
      from: 'nodered',
      to: 'noco_mkt_outbox',
      label: ':twinAck',
      kind: 'dashed',
      points: [
        [476, 244],
        [476, 124],
      ],
    },
  ];

  const twinSteps: DiagramStep[] = [
    {
      id: 'tw-s1',
      title: isVi ? 'Uplink MQTT -> Node-RED -> :telemetryIngest' : 'Uplink MQTT -> Node-RED -> :telemetryIngest',
      activeNodes: ['edge_sensors', 'mosquitto', 'nodered', 'noco_mkt_outbox'],
      activeEdges: ['t1', 't2', 't3'],
      description: isVi
        ? 'Cảm biến phát MQTT QoS 1 vào Mosquitto DynSec; Node-RED đăng ký chủ đề và POST về NocoBase :telemetryIngest kèm tính Arrhenius MKT.'
        : 'Sensors publish QoS 1 telemetry to Mosquitto DynSec; Node-RED consumes it and POSTs sanitized readings to NocoBase :telemetryIngest.',
      route: 'MQTT :1883 -> Node-RED :1880 -> POST /api/dxosBlocks:telemetryIngest',
      payload: 'X-Lattice-Edge-Token | R=0.008314472, ΔH=83.14472',
      chips: ['No Direct Mosquitto->Orion Shortcut', 'Arrhenius MKT'],
    },
    {
      id: 'tw-s2',
      title: isVi ? 'Context Outbox 10s -> Orion-LD -> :orionNotify' : '10s Context Outbox -> Orion-LD -> :orionNotify',
      activeNodes: ['noco_mkt_outbox', 'orion_ld', 'twin_shadow', 'webgis_ops'],
      activeEdges: ['t4', 't5', 't6'],
      description: isVi
        ? 'latticeContextOutbox đồng bộ thực thể NGSI-LD sang Orion-LD mỗi 10 giây; Orion-LD gọi :orionNotify cập nhật Twin Shadow, cảnh báo và hold_mkt.'
        : 'The 10s PG16 Context Outbox syncs NGSI-LD entities to Orion-LD, which fires :orionNotify back to Twin Shadow, Alarm Engine, and hold_mkt.',
      route: 'POST /api/dxosBroker:orionNotify -> dxosWms:holdLotByMkt',
      payload: 'NGSILD-Tenant: <orgId> | throttle: 5s',
      chips: ['NGSI-LD Outbox', 'hold_mkt'],
    },
    {
      id: 'tw-s3',
      title: isVi ? 'Cổng an toàn HITL (|ΔT| > 2.0 °C)' : 'HITL Delta Guard (|ΔT| > 2.0 °C)',
      activeNodes: ['twin_shadow', 'hitl_guard'],
      activeEdges: ['t7'],
      description: isVi
        ? 'Thay đổi targetTempC vượt 2.0 °C so với baseline bị giữ ở pending_hitl chờ người vận hành duyệt trước khi xuất lệnh xuống Node-RED.'
        : 'Desired setpoint changes with |ΔT| > 2.0 °C pause as pending_hitl until approved before any downlink command is dispatched.',
      route: 'POST /api/dxosBlocks:twinSetDesired',
      payload: 'HITL_TEMP_THRESHOLD_C = 2.0',
      chips: ['pending_hitl', 'Safe Guard'],
    },
    {
      id: 'tw-s4',
      title: isVi ? 'Downlink /twin/command & Phản hồi :twinAckCommand' : 'Downlink /twin/command & :twinAckCommand',
      activeNodes: ['hitl_guard', 'nodered', 'mosquitto', 'edge_sensors', 'noco_mkt_outbox'],
      activeEdges: ['t8', 't9', 't10', 't11'],
      description: isVi
        ? 'Node-RED nhận /twin/command, phát MQTT .../command xuống thiết bị, rồi chuyển tiếp gói .../ack quay lại NocoBase :twinAckCommand.'
        : 'Node-RED posts /twin/command over Mosquitto .../command to Edge Sensors and relays device .../ack back to :twinAckCommand.',
      route: 'POST /twin/command -> Mosquitto -> POST /api/dxosBlocks:twinAckCommand',
      payload: 'latticedx/<org>/<asset>/command & .../ack',
      chips: ['2-Way Twin', 'Ack Verified'],
    },
  ];

  // Mode 2: DynSec Provisioning, LWT (Inbound) & SSRF Allowlists (Outbound)
  const dynZones: DiagramZone[] = [
    {
      id: 'dynsec-ctrl',
      label: isVi ? 'Cấp phát Mosquitto Dynamic Security ($CONTROL)' : 'Mosquitto Dynamic Security ($CONTROL)',
      x: 16,
      y: 16,
      width: 1088,
      height: 148,
      kind: 'admin',
    },
    {
      id: 'lwt-inbound',
      label: isVi ? 'Luồng Vào: Giám sát LWT -> latticeIotDevices' : 'Inbound: LWT Presence -> latticeIotDevices',
      x: 16,
      y: 188,
      width: 752,
      height: 192,
      kind: 'traffic',
    },
    {
      id: 'ssrf-outbound',
      label: isVi ? 'Luồng Ra: Kiểm soát SSRF Outbound' : 'Outbound: SSRF Host Allowlists',
      x: 784,
      y: 188,
      width: 320,
      height: 192,
      kind: 'external',
    },
  ];

  const dynNodes: DiagramNode[] = [
    {
      id: 'provision_api',
      title: isVi ? 'Cấp phát Thiết bị' : 'Provision Device',
      sub: ':provisionDevice',
      icon: 'key',
      x: 36,
      y: 64,
      width: 204,
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
      x: 428,
      y: 64,
      width: 204,
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
      x: 820,
      y: 64,
      width: 224,
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
      sub: 'BIRTH | DEATH · QoS 1',
      icon: 'radio',
      x: 32,
      y: 248,
      width: 192,
      height: 64,
      zoneId: 'lwt-inbound',
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
      x: 320,
      y: 248,
      width: 176,
      height: 64,
      zoneId: 'lwt-inbound',
      inspector: isVi
        ? {
            role: 'Endpoint tiếp nhận trạng thái thiết bị từ cầu nối biên (chỉ chiều vào)',
            packageOrPort: 'broker-control.js:1509-1580',
            protocol: 'POST /api/dxosBroker:deviceStatusIngest',
            payloadOrSchema: 'Header X-Lattice-Edge-Token (>= 16 chars)',
            responsibilities:
              'Xác thực Edge Token bằng so sánh hằng thời gian và ghi trực tiếp vào bảng thiết bị; không gọi kiểm tra SSRF outbound.',
          }
        : {
            role: 'Edge-authenticated inbound device presence endpoint',
            packageOrPort: 'broker-control.js:1509-1580',
            protocol: 'POST /api/dxosBroker:deviceStatusIngest',
            payloadOrSchema: 'Header X-Lattice-Edge-Token (>= 16 chars)',
            responsibilities:
              'Validates X-Lattice-Edge-Token in constant time and updates device state directly; never invokes outbound SSRF allowlists.',
          },
    },
    {
      id: 'iot_devices_db',
      title: 'latticeIotDevices',
      sub: 'PG16 RLS · Incident',
      icon: 'database',
      x: 576,
      y: 248,
      width: 180,
      height: 64,
      zoneId: 'lwt-inbound',
      inspector: isVi
        ? {
            role: 'Lưu trạng thái hiện diện thiết bị và mở sự cố mất kết nối LWT',
            packageOrPort: 'latticeIotDevices · latticeIncidentCases',
            protocol: 'PG16 FORCE RLS · app.current_org',
            payloadOrSchema: 'MQTT-LWT-OFFLINE incident on unexpected disconnect',
            responsibilities:
              'Cập nhật lastSeenAt/status và tự động tạo sự cố MQTT-LWT-OFFLINE trong latticeIncidentCases khi thiết bị rớt LWT.',
          }
        : {
            role: 'Persists device presence and raises LWT offline incidents',
            packageOrPort: 'latticeIotDevices · latticeIncidentCases',
            protocol: 'PG16 FORCE RLS · app.current_org',
            payloadOrSchema: 'MQTT-LWT-OFFLINE incident on unexpected disconnect',
            responsibilities:
              'Records online/offline presence in latticeIotDevices and raises MQTT-LWT-OFFLINE incidents on unexpected disconnects.',
          },
    },
    {
      id: 'nocobase_outbound',
      title: isVi ? 'NocoBase Outbound' : 'NocoBase Outbound',
      sub: 'dxosBroker · digital-twin',
      icon: 'server',
      x: 800,
      y: 220,
      width: 288,
      height: 56,
      zoneId: 'ssrf-outbound',
      inspector: isVi
        ? {
            role: 'Các lời gọi HTTP hướng ra từ NocoBase tới Orion-LD và Node-RED',
            packageOrPort: 'broker-control.js · digital-twin.js',
            protocol: 'Outbound HTTP(S) · DNS Validation',
            payloadOrSchema: 'Orion-LD Entity Upsert | Node-RED /twin/command',
            responsibilities:
              'Mọi yêu cầu mạng hướng ra từ NocoBase đều phải qua danh sách trắng tên miền nội bộ trước khi mở kết nối.',
          }
        : {
            role: 'Outbound NocoBase calls toward Orion-LD and Node-RED',
            packageOrPort: 'broker-control.js · digital-twin.js',
            protocol: 'Outbound HTTP(S) · DNS Validation',
            payloadOrSchema: 'Orion-LD Entity Upsert | Node-RED /twin/command',
            responsibilities:
              'Every outbound HTTP request from NocoBase to IIoT infrastructure passes through explicit host allowlist validation.',
          },
    },
    {
      id: 'ssrf_allowlist',
      title: isVi ? 'Khóa SSRF Outbound' : 'SSRF Host Allowlists',
      sub: 'Orion-LD & Node-RED',
      icon: 'shield',
      x: 800,
      y: 312,
      width: 288,
      height: 56,
      zoneId: 'ssrf-outbound',
      focal: true,
      inspector: isVi
        ? {
            role: 'Danh sách tên miền được phép cho Orion-LD và Node-RED (chỉ chiều ra)',
            packageOrPort: 'DX_ORION_HOST_ALLOWLIST · DX_NODERED_HOST_ALLOWLIST',
            protocol: 'DNS + Host Allowlist Check',
            payloadOrSchema: 'Orion-LD (:1026) | Orion Callback | Node-RED (:1880)',
            responsibilities:
              'Chặn địa chỉ loopback, nội bộ trái phép hoặc metadata đám mây ngoài danh sách trắng khi NocoBase gọi Orion-LD hoặc Node-RED.',
          }
        : {
            role: 'Host allowlist defense for outbound Orion-LD & Node-RED calls',
            packageOrPort: 'DX_ORION_HOST_ALLOWLIST · DX_NODERED_HOST_ALLOWLIST',
            protocol: 'DNS + Host Allowlist Check',
            payloadOrSchema: 'Orion-LD (:1026) | Orion Callback | Node-RED (:1880)',
            responsibilities:
              'Restricts outbound Orion-LD queries, subscription callbacks, and Node-RED downlink targets exclusively to allowlisted hosts.',
          },
    },
  ];

  const dynEdges: DiagramEdge[] = [
    {
      id: 'd1',
      from: 'provision_api',
      to: 'dynsec_broker',
      label: '$CONTROL',
      kind: 'primary',
      points: [
        [240, 96],
        [428, 96],
      ],
    },
    {
      id: 'd2',
      from: 'dynsec_broker',
      to: 'nodered_bridge',
      label: 'Sub #',
      kind: 'flow',
      points: [
        [632, 96],
        [820, 96],
      ],
    },
    {
      id: 'd3',
      from: 'nodered_bridge',
      to: 'lwt_watcher',
      label: 'Status Topic',
      kind: 'flow',
      points: [
        [932, 128],
        [932, 160],
        [120, 160],
        [120, 248],
      ],
    },
    {
      id: 'd4',
      from: 'lwt_watcher',
      to: 'status_ingest',
      label: 'BIRTH/DEATH',
      kind: 'primary',
      points: [
        [224, 280],
        [320, 280],
      ],
    },
    {
      id: 'd5',
      from: 'status_ingest',
      to: 'iot_devices_db',
      label: 'Write RLS',
      kind: 'primary',
      points: [
        [496, 280],
        [576, 280],
      ],
    },
    {
      id: 'd6',
      from: 'nocobase_outbound',
      to: 'ssrf_allowlist',
      label: 'Allowlist',
      kind: 'dashed',
      points: [
        [944, 276],
        [944, 312],
      ],
    },
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
      title: isVi ? 'Luồng vào: LWT -> :deviceStatusIngest -> latticeIotDevices' : 'Inbound: LWT -> :deviceStatusIngest -> latticeIotDevices',
      activeNodes: ['lwt_watcher', 'status_ingest', 'iot_devices_db'],
      activeEdges: ['d3', 'd4', 'd5'],
      description: isVi
        ? 'Node-RED chuyển gói LWT DEATH thành offline tới :deviceStatusIngest (xác thực X-Lattice-Edge-Token) và ghi trực tiếp vào latticeIotDevices.'
        : 'Node-RED posts LWT BIRTH/DEATH presence to :deviceStatusIngest (verified by X-Lattice-Edge-Token) and writes directly to latticeIotDevices.',
      route: 'POST /api/dxosBroker:deviceStatusIngest',
      payload: 'reason: "mqtt_lwt_disconnect" -> MQTT-LWT-OFFLINE',
      chips: ['Inbound Only', 'LWT QoS 1'],
    },
    {
      id: 'dyn-s3',
      title: isVi ? 'Luồng ra: Kiểm soát SSRF tới Orion-LD / Node-RED' : 'Outbound: SSRF Host Allowlists for Orion-LD / Node-RED',
      activeNodes: ['nocobase_outbound', 'ssrf_allowlist'],
      activeEdges: ['d6'],
      description: isVi
        ? 'Riêng các kết nối hướng ra từ NocoBase tới Orion-LD và Node-RED phải đi qua kiểm tra DNS + DX_ORION_HOST_ALLOWLIST / DX_NODERED_HOST_ALLOWLIST.'
        : 'Separately from inbound status ingest, outbound NocoBase calls to Orion-LD and Node-RED enforce DNS + SSRF host allowlists.',
      route: 'DX_ORION_HOST_ALLOWLIST & DX_NODERED_HOST_ALLOWLIST',
      payload: 'Blocks loopback, private IPs & cloud metadata',
      chips: ['Outbound SSRF Guard'],
    },
  ];

  return [
    {
      id: 'telemetry-twin',
      label: isVi ? 'Digital Twin & MKT' : 'Digital Twin & MKT',
      summary: isVi ? 'Node-RED -> Outbox -> Orion-LD · HITL 2.0 °C' : 'Node-RED -> Outbox -> Orion-LD · HITL 2.0 °C',
      zones: twinZones,
      nodes: twinNodes,
      edges: twinEdges,
      steps: twinSteps,
    },
    {
      id: 'dynsec-provisioning',
      label: isVi ? 'DynSec, LWT & SSRF' : 'DynSec, LWT & SSRF',
      summary: isVi ? 'Inbound LWT vs Outbound SSRF' : 'Inbound LWT vs Outbound SSRF',
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
    viewBox="0 0 1120 404"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
