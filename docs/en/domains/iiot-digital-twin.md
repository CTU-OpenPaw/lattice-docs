---
title: IIoT & Two-Way Digital Twin
description: Mosquitto DynSec and LWT, FIWARE Orion-LD NGSI-LD, Node-RED downlink control, HITL 2.0°C gating, and Arrhenius MKT calculation.
---

<script setup>
const brokerSetupTabs = [
  {
    label: 'Provision Device (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosBroker:provisionDevice \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceKey": "freezer-ct-01",
    "name": "Can Tho Cold Room Sensor 01",
    "assetId": 12
  }'`,
  },
  {
    label: 'Create Orion-LD Subscription (cURL)',
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
    label: 'Send Twin Command (cURL)',
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
    label: 'HITL Gated Response (JSON)',
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

# IIoT & Two-Way Digital Twin

The IIoT and Two-Way Digital Twin subsystem connects cold-chain edge devices to an ETSI NGSI-LD context broker through `@latticedx/plugin-dxos-blocks` (`broker-control.js`, `digital-twin.js`, `blocks-api.js`) and `@latticedx/plugin-lattice-foundation` (`native-context-delivery.js`, `data-governance.js`). Uplink telemetry flows from Mosquitto MQTT and Node-RED through FIWARE Orion-LD into `latticeTelemetryPoints`, while downlink control tracks `desired` versus `reported` state on `latticeTwinShadows` with a Human-in-the-Loop (HITL) safety gate whenever temperature changes exceed `2.0°C`.

## IIoT Telemetry and Digital Twin Architecture

<IiotDigitalTwinDiagram />

Edge services (`mosquitto`, `nodered`) run inside the isolated `iiot-net` Docker network (`internal: true` in `prod.yml`) and authenticate callbacks to NocoBase using `X-Lattice-Edge-Token` (`>= 16` characters from `DX_IIOT_INGEST_TOKEN`) alongside SSRF host allowlists (`DX_ORION_HOST_ALLOWLIST`, `DX_ORION_CALLBACK_HOST_ALLOWLIST`, `DX_NODERED_HOST_ALLOWLIST`).

## Mosquitto Dynamic Security and LWT Monitoring

The `eclipse-mosquitto:2.0.21` broker listens internally on port `1883` with `allow_anonymous false`, `persistence true`, `max_queued_messages 1000`, `max_packet_size 65536`, and `/usr/lib/mosquitto_dynamic_security.so` backed by `/mosquitto/data/dynamic-security.json`. Default DynSec ACLs are locked to `deny` across `publishClientSend`, `publishClientReceive`, and `subscribe`.

When `dxosBroker:provisionDevice` registers a sensor, the server publishes JSON control commands to `$CONTROL/dynamic-security/v1` to create a tenant-scoped role `role_<orgId>_<deviceKey>` and client `ldx_<orgId>_<deviceKey>` restricted to the `latticedx/<orgId>/<deviceKey>` topic prefix:

| MQTT Component | Principal / Topic | DynSec Permissions & Behavior |
| :--- | :--- | :--- |
| Node-RED bridge | `nodered-bridge` (`nodered_bridge`) | Subscribes to `latticedx/#` and publishes downlink commands to `latticedx/+/+/command`. |
| Edge device | `role_<orgId>_<deviceKey>` | `publishClientSend` on `latticedx/<orgId>/<deviceKey>/#`; `subscribePattern` and `publishClientReceive` on `.../command` and `.../ack`. |
| LWT & Birth status | `latticedx/+/+/status` (QoS 1) | Node-RED normalizes `BIRTH`/`ONLINE`/`CONNECTED` to `online` and `DEATH`/`OFFLINE`/`LWT`/`DISCONNECTED` to `offline` (`reason: mqtt_lwt_disconnect`). |

<ApiEndpoint
  method="POST"
  path="/api/dxosBroker:provisionDevice"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, iot"
  summary="Registers an edge device in latticeIotDevices and provisions its scoped Mosquitto DynSec role and client."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosBroker:deviceStatusIngest"
  auth="X-Lattice-Edge-Token"
  summary="Ingests normalized MQTT Birth and LWT Death events from Node-RED to update device online status."
/>

## FIWARE Orion-LD (NGSI-LD) and Transactional Outbox

The semantic context (`infra/config/ngsi-ld/context.jsonld`) extends the ETSI NGSI-LD core context with `Asset`, `Department`, `Location`, `Vehicle`, `Shipment`, and `Warehouse` types under `https://latticedx.example/ns/*`. Cold-chain assets map to canonical URNs:

```text
urn:ngsi-ld:Asset:<orgId>:native:<assetId>
```

Every HTTP call to `orion-ld:1026` carries the `NGSILD-Tenant: <orgId>` header. On outbound sync, `latticeContextOutbox` drains every `10s` (`DX_NATIVE_CONTEXT_AUTO_SYNC=true`) using `FOR UPDATE OF o SKIP LOCKED` to preserve per-entity FIFO ordering and reclaim stale locks past `DX_OUTBOX_STALE_LOCK_MS` (`120000` ms). On inbound sync, `dxosBroker:orionCreateSubscription` creates `urn:ngsi-ld:Subscription:<orgId>:<subscriptionKey>` using `normalized` notification format (throttling `0..3600`s, default `5`s) targeting `/api/dxosBroker:orionNotify`.

<CodeTabs :tabs="brokerSetupTabs" />

## Digital Twin Shadow, `2.0°C` HITL Gate, and Node-RED Downlink

`latticeTwinShadows` tracks `desiredJson`, `reportedJson`, `lastDeltaJson`, `pendingCommandId`, and `commandStatus` (`synced`, `pending_hitl`, `dispatched`, `acked`, `failed`). Remote actuation keys (`ALLOWED_DESIRED_KEYS`) are strictly allowlisted:

<ParamGrid
  title="Allowlisted Keys in desiredPatch (digital-twin.js)"
  :items="[
    { name: 'targetTempC', type: 'number', description: 'Target setpoint temperature (°C); subject to HITL gating when delta exceeds 2.0°C.' },
    { name: 'minTempC / maxTempC', type: 'number', description: 'Lower and upper thermal bounds for the cold unit (validated minTempC <= maxTempC).' },
    { name: 'defrostMode', type: 'string', description: 'Defrost controller mode: auto, manual, or off.' },
    { name: 'fanMode', type: 'string', description: 'Evaporator fan mode: auto, high, low, or eco.' },
    { name: 'doorLock', type: 'string', description: 'Cold-room door actuator state: locked or unlocked.' },
    { name: 'reportingIntervalSec', type: 'number', description: 'Edge telemetry sampling interval in seconds.' }
  ]"
/>

Across both the WebGIS UI (`HITL_DELTA_THRESHOLD_C = 2.0` in `webgis-block.js`) and server validation (`HITL_TEMP_THRESHOLD_C = 2.0` in `digital-twin.js`), whenever `|desiredPatch.targetTempC - baselineTemp| > 2.0` without `hitlApproved === true` (permitted only via HITL approval or `root`), `dxosBlocks:twinSetDesired` pauses actuation:

1. Sets the shadow `commandStatus` to `pending_hitl`.
2. Queues a `high`-risk approval request in `latticeAiApprovalQueue` (`toolName: 'dxos_twin_set_desired'`) with `diffPreview` (`before`, `after`, `delta`).
3. Appends an `iot.twin_hitl_required` entry to the Ed25519-signed `latticeCryptoLedger`.

When within the `2.0°C` threshold or after HITL sign-off, NocoBase posts the validated command to `DX_NODERED_COMMAND_URL` (`http://nodered:1880/twin/command`) with `X-Lattice-Edge-Token`. Node-RED publishes QoS 1 MQTT to `latticedx/<orgId>/<assetKey>/command`, and device acknowledgments on `latticedx/+/+/ack` are forwarded to `POST /api/dxosBlocks:twinAckCommand` to update `reportedJson` and transition `commandStatus` to `acked`.

<ApiEndpoint
  method="POST"
  path="/api/dxosBlocks:twinSetDesired"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, iot"
  summary="Updates Digital Twin desired setpoints; pauses for HITL approval if targetTempC delta exceeds 2.0°C."
/>

<CodeTabs :tabs="twinCommandTabs" />

## Arrhenius Mean Kinetic Temperature (MKT) Calculation

To quantify cumulative thermal stress on temperature-sensitive inventory per ICH Q1A / Haynes guidelines, both `wms-engine.js` and `data-governance.js` evaluate MKT using identical physical constants and a numerically stabilized log-sum-exp formulation:

| Constant / Variable | Exact Value | Physical Meaning |
| :--- | :--- | :--- |
| `R_KJ_MOL_K` (`R`) | `0.008314472` `kJ/(mol·K)` | Universal gas constant used in the Arrhenius equation. |
| `DEFAULT_DELTA_H_KJ_MOL` (`ΔH`) | `83.14472` `kJ/mol` | Default activation energy (`a = ΔH / R = 10000 K`). |
| `ABSOLUTE_ZERO_C` | `-273.15` `°C` | Kelvin conversion offset (`T_K = T_C + 273.15`; rejects samples `<= -273.15`). |

```text
a         = deltaH / 0.008314472
e_i       = -a / (T_C,i + 273.15)
m         = max_i(e_i)
lnMean    = m + ln((1 / n) * sum_i(exp(e_i - m)))
mktKelvin = a / (-lnMean)
mktC      = round3(mktKelvin - 273.15)
```

Shifting by `m = max_i(e_i)` prevents floating-point underflow and overflow across long telemetry series. The function returns `mktCelsius`, `minTempCelsius`, `maxTempCelsius`, `avgTempCelsius`, `sampleCount`, `excursionCount`, and `breached` to drive automated `hold_mkt` quarantines and `latticeIncidentCases` alerts.

## IIoT API Reference (`dxosBroker` and `dxosBlocks`)

| Endpoint | Method | Authentication | Responsibility |
| :--- | :---: | :--- | :--- |
| `/api/dxosBroker:listDevices` | `GET` / `POST` | JWT / `ldx_pat_*` | Lists registered IoT devices scoped by `organizationId` and status. |
| `/api/dxosBroker:provisionDevice` | `POST` | JWT / `ldx_pat_*` | Registers a device and publishes DynSec commands to `$CONTROL/dynamic-security/v1`. |
| `/api/dxosBroker:revokeDevice` | `POST` | JWT / `ldx_pat_*` | Revokes MQTT publish and subscribe credentials on Mosquitto. |
| `/api/dxosBroker:deviceStatusIngest` | `POST` | `X-Lattice-Edge-Token` | Ingests normalized `BIRTH`/`LWT` events from Node-RED to update device state. |
| `/api/dxosBroker:orionEntities` | `GET` / `POST` | JWT / `ldx_pat_*` | Queries live NGSI-LD entities from `orion-ld:1026`. |
| `/api/dxosBroker:orionCreateSubscription` | `POST` | JWT / `ldx_pat_*` | Creates an NGSI-LD subscription targeting `/api/dxosBroker:orionNotify`. |
| `/api/dxosBroker:orionNotify` | `POST` | `X-Lattice-Edge-Token` | Ingests `normalized` Orion-LD callbacks, persists points, and triggers alarms. |
| `/api/dxosBlocks:twinShadow` | `GET` / `POST` | JWT / `ldx_pat_*` | Reads `desiredJson`, `reportedJson`, and computed `lastDeltaJson`. |
| `/api/dxosBlocks:twinSetDesired` | `POST` | JWT / `ldx_pat_*` | Updates `desiredJson`, enforces the `2.0°C` HITL gate, and calls Node-RED. |
| `/api/dxosBlocks:twinAckCommand` | `POST` | `X-Lattice-Edge-Token` / JWT | Confirms device execution and updates `reportedJson` to `acked`. |

## Related

- [Cold-Chain OMS, WMS & FEFO](/en/domains/cold-chain-oms-wms)
- [Events & Transactional Outbox](/en/architecture/events-and-outbox)
- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [12 Native v2 BlockModels](/en/studio/native-blocks)
