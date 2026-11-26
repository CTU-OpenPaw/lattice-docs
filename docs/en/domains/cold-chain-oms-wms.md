---
title: Cold-Chain OMS, WMS & FEFO
description: Order lifecycle, lot-tracked inventory, temperature-band FEFO allocation, and SLA monitoring in LatticeDX.
---

# Cold-Chain OMS, WMS & FEFO

The cold-chain Order and Warehouse Management subsystem (`@latticedx/plugin-dxos-studio`) manages order fulfillment, lot-level inventory (`latticeStockLots`), First-Expired-First-Out (FEFO) allocation constrained by temperature bands, and automated Mean Kinetic Temperature (MKT) quarantine holds. Every stock mutation executes inside a PostgreSQL transaction using row-level `SELECT ... FOR UPDATE` locks, records `latticeDataLineage` edges, and appends an Ed25519-signed entry to `latticeCryptoLedger`.

## Data Model and State Machines

All cold-chain collections are isolated by `organizationId` under PostgreSQL 16 `FORCE ROW LEVEL SECURITY`. Direct REST CRUD mutations against these collections are blocked by `wms-direct-guard.js`; client portals and external integrations must invoke the `dxosWms` resource actions.

| Collection | Purpose | Primary Business Keys | Valid Lifecycle States |
| :--- | :--- | :--- | :--- |
| `latticeOrders` | Operational and fulfillment orders | `organizationId`, `code` | `draft`, `submitted`, `approved`, `in_progress`, `completed`, `cancelled` |
| `latticeOrderLines` | SKU and thermal-band line items | `organizationId`, `orderCode`, `lineNo` | `pending`, `partial`, `allocated`, `dispatched`, `delivered` |
| `latticeStockLots` | Inventory lots bound to locations and IIoT assets | `organizationId`, `lotCode`, `sku` | `available`, `reserved`, `depleted`, `hold_mkt`, `expired`, `quarantined` |
| `latticeSlaPolicies` | Priority-scoped SLA warning and breach thresholds | `organizationId`, `targetCollection`, `priority` | `active` (`warnAfterMinutes`, `breachAfterMinutes`) |
| `latticeIncidentCases` | Operational or thermal excursion incidents | `organizationId`, `fingerprint` (SHA-256) | `open`, `acknowledged`, `resolved`, `closed` |

Any lot whose status belongs to `BLOCKED_LOT_STATUSES` (`hold_mkt`, `expired`, `quarantined`) is excluded from FEFO allocation and rejected at physical stock issue with HTTP `409 WMS_LOT_ON_HOLD`.

<ParamGrid
  title="Core Fields on Cold-Chain Stock Lots (latticeStockLots)"
  :items="[
    { name: 'lotCode', type: 'string', required: true, description: 'Unique lot identifier within the organization.' },
    { name: 'sku', type: 'string', required: true, description: 'Product SKU matched against order lines during FEFO allocation.' },
    { name: 'assetEntityId', type: 'string', description: 'NGSI-LD URN of the cold room or refrigerated container, formatted as urn:ngsi-ld:Asset:<orgId>:native:<id>.' },
    { name: 'qtyOnHand', type: 'number', required: true, description: 'Total physical quantity currently stored in the warehouse.' },
    { name: 'qtyReserved', type: 'number', default: '0', description: 'Quantity reserved for pending or allocated order lines.' },
    { name: 'expiryDate', type: 'datetime', required: true, description: 'Expiration timestamp used as the primary ascending sort key in FEFO.' },
    { name: 'targetTempMinC', type: 'number', description: 'Minimum allowed storage temperature (°C).' },
    { name: 'targetTempMaxC', type: 'number', description: 'Maximum allowed storage temperature (°C); used as the default MKT threshold.' },
    { name: 'mktCelsius', type: 'number', description: 'Latest computed Arrhenius Mean Kinetic Temperature (°C).' }
  ]"
/>

## Receiving and Temperature-Band FEFO Allocation

Stock intake via `dxosWms:receiveStock` creates or updates a lot in `latticeStockLots` with warehouse placement, linked IIoT `assetEntityId`, and storage temperature limits. When fulfilling an order line, `allocateFefo` acquires pessimistic row locks (`findLockedLots` with `LOCK.UPDATE`) over all `available` lots matching the requested `sku`, filters out expired lots or incompatible thermal bands, and sorts candidates in ascending order of `(expiryDate, id)`.

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:allocateFefo"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, wms"
  summary="Reserves compatible non-blocked stock lots in FEFO order and writes data lineage edges."
/>

<ParamGrid
  title="Input Parameters for dxosWms:allocateFefo"
  :items="[
    { name: 'sku', type: 'string', required: true, description: 'Target SKU to allocate (maximum 128 characters).' },
    { name: 'quantity', type: 'number', required: true, description: 'Quantity requested for allocation (> 0).' },
    { name: 'orderCode', type: 'string', description: 'Order code for line binding; may be paired with orderId.' },
    { name: 'lineNo', type: 'integer', default: '1', description: 'Positive integer order line sequence number.' },
    { name: 'minTempC', type: 'number', description: 'Minimum required transport/storage temperature (°C).' },
    { name: 'maxTempC', type: 'number', description: 'Maximum required transport/storage temperature (°C).' },
    { name: 'now', type: 'datetime', description: 'Reference timestamp for expiry checks (defaults to server time).' }
  ]"
/>

Within the same database transaction, the engine increments `qtyReserved` on each selected lot, creates or updates the `latticeOrderLines` row to `allocated` (or `partial` when `shortfall > 0`), appends `wms.fefo_allocated` to `latticeCryptoLedger`, and writes `allocated_to` edges into `latticeDataLineage`.

<CodeTabs
  :tabs='[
    {
      "label": "FEFO Request (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:allocateFefo \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"orderCode\": \"ORD-2026-0192\",\n    \"lineNo\": 1,\n    \"sku\": \"VAC-COLD-02\",\n    \"quantity\": 120,\n    \"minTempC\": 2,\n    \"maxTempC\": 8\n  }\u0027"
    },
    {
      "label": "Allocation Response (JSON)",
      "lang": "json",
      "code": "{\n  \"data\": {\n    \"allocatedTotal\": 120,\n    \"shortfall\": 0,\n    \"allocations\": [\n      {\n        \"lotId\": 41,\n        \"lotCode\": \"LOT-2026-A09\",\n        \"expiryDate\": \"2026-12-15T00:00:00.000Z\",\n        \"qtyAllocated\": 80\n      },\n      {\n        \"lotId\": 44,\n        \"lotCode\": \"LOT-2026-B02\",\n        \"expiryDate\": \"2027-01-10T00:00:00.000Z\",\n        \"qtyAllocated\": 40\n      }\n    ],\n    \"orderLine\": {\n      \"id\": 108,\n      \"orderCode\": \"ORD-2026-0192\",\n      \"lineNo\": 1,\n      \"status\": \"allocated\",\n      \"allocatedQty\": 120\n    }\n  }\n}"
    }
  ]'
/>

## Stock Issue and Lot Guardrails

Physical dispatch via `dxosWms:issueStock` locks the target lot row (`lotId` or `lotCode`) and re-verifies that the lot is not in `BLOCKED_LOT_STATUSES` and has not expired. The handler deducts `qtyOnHand` and adjusts `qtyReserved`; when `qtyOnHand` reaches `0`, the lot transitions to `depleted`, the linked order line moves to `dispatched`, and `wms.stock_issued` is recorded in the PKI ledger.

<ApiEndpoint
  method="POST"
  path="/api/dxosWms:issueStock"
  auth="Bearer JWT | ldx_pat_*"
  scope="write, wms"
  summary="Deducts physical stock from a valid lot, validates hold/expiry status, and marks order lines dispatched."
/>

| `dxosWms` Endpoint | Method | Required Scope | Responsibility |
| :--- | :--- | :--- | :--- |
| `/api/dxosWms:orderLines` | `GET` | `read`, `wms` | Lists order lines filtered by `orderCode` or `orderId`. |
| `/api/dxosWms:saveOrderLine` | `POST` | `write`, `wms` | Creates or updates SKU, requested quantity, and temperature band on a line. |
| `/api/dxosWms:receiveStock` | `POST` | `write`, `wms` | Receives a new lot with expiry date, IIoT asset URN, and target thermal band. |
| `/api/dxosWms:lots` | `GET` | `read`, `wms` | Lists lots with `qtyOnHand`, `qtyReserved`, and computed `qtyAvailable`. |
| `/api/dxosWms:allocateFefo` | `POST` | `write`, `wms` | Executes FEFO reservation across thermal-compatible lots. |
| `/api/dxosWms:issueStock` | `POST` | `write`, `wms` | Issues physical inventory and transitions order lines to `dispatched`. |
| `/api/dxosWms:holdLotByMkt` | `POST` | `write`, `wms` | Computes Arrhenius MKT and places lots into `hold_mkt` on threshold breach. |
| `/api/dxosWms:releaseLotByQa` | `POST` | `write`, `wms` | Releases `hold_mkt` or `quarantined` lots back to `available` after QA sign-off. |

## Arrhenius MKT Holds, QA Quarantine, and SLA Tracking

When IIoT telemetry or QA sampling checks lot exposure, `dxosWms:holdLotByMkt` reads `samplesC` from the request body or queries up to `500` recent `temperature` samples in `latticeTelemetryPoints` for the lot's `assetEntityId`. The threshold resolves in priority order: `maxAllowedC` -> `lot.targetTempMaxC` -> `-15°C` (when `coldChainProfile === 'frozen'` or `targetTempMinC <= -15`) -> `8°C`.

MKT is calculated using the stabilized Arrhenius formulation with gas constant `R = 0.008314472` `kJ/(mol·K)` and activation energy `ΔH = 83.14472` `kJ/mol`. If `mktCelsius > thresholdCelsius` or `forceHold === true`, the handler executes four atomic actions:

1. Transitions the lot to `hold_mkt` with `holdReason`, `heldAt`, and `heldBy`.
2. Writes a quarantine entry in `latticeDataQuarantine` with `reasonCode: 'MKT_THRESHOLD_EXCEEDED'`.
3. Appends `wms.lot_mkt_hold` to the Ed25519-signed `latticeCryptoLedger`.
4. Emits a `lot.held_mkt` CloudEvent to `latticeEventBus` for downstream incident escalation.

<CodeTabs
  :tabs='[
    {
      "label": "MKT Hold Check (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:holdLotByMkt \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"lotCode\": \"LOT-2026-A09\",\n    \"samplesC\": [4.2, 5.1, 9.8, 10.4, 8.9]\n  }\u0027"
    },
    {
      "label": "QA Release (cURL)",
      "lang": "bash",
      "code": "curl -X POST https://app.example.com/api/dxosWms:releaseLotByQa \\\n  -H \"Authorization: Bearer ldx_pat_a1b2c3d4_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d \u0027{\n    \"lotCode\": \"LOT-2026-A09\",\n    \"releaseReason\": \"Stability re-evaluation passed under QA-2026-14\"\n  }\u0027"
    }
  ]'
/>

In parallel, `latticeSlaPolicies` defines warning (`warnAfterMinutes`, default `240`) and breach (`breachAfterMinutes`, default `1440`) windows for orders and incident cases. When `DX_SLA_CRON_ENABLED=true`, the SLA evaluator runs every `DX_SLA_INTERVAL_MS` (`60000` ms default) and escalates overdue records to `escalateToRole` (`ldx_manager` default) over configured `notifyChannels`. Inside portals, `DxosWmsOpsBlockModel` exposes interactive FEFO reservation and bulk import (`MAX_BULK_IMPORT_BYTES = 2 MB`), paired with `DxosKanbanScheduleBlockModel` for lot status boards.

## Operational Controls, Error Codes, and Failure Modes

| Control | Runtime Behavior | Error Code / Outcome |
| :--- | :--- | :--- |
| Pessimistic row locking | FEFO allocation and stock issue acquire `SELECT ... FOR UPDATE` locks inside a transaction. | Prevents concurrent orders from over-allocating beyond `qtyOnHand - qtyReserved`. |
| Multi-tenant isolation | `resolveTenantActor` binds `app.current_org` from user session or `ldx_pat_*` API key. | Returns `404 WMS_ORDER_NOT_FOUND` or `404 WMS_LOT_NOT_FOUND` on cross-org access. |
| QA release state check | `dxosWms:releaseLotByQa` only accepts lots in `hold_mkt` or `quarantined`. | Returns `409 WMS_LOT_INVALID_STATE` for other states; requires an explicit `releaseReason`. |

The following error codes from `wms-engine.js` enable deterministic error handling in client portals and automated flows:

| Error Code | HTTP | Trigger Condition | Remediation |
| :--- | :---: | :--- | :--- |
| `WMS_SKU_REQUIRED` / `WMS_QTY_INVALID` | `400` | Missing `sku` or non-positive quantity (`<= 0`). | Validate line item fields prior to calling `allocateFefo`. |
| `WMS_ORDER_LINE_SKU_MISMATCH` | `400` | Target `orderLine` already exists with a different `sku`. | Use a new `lineNo` or match the existing line's `sku`. |
| `WMS_LOT_ON_HOLD` | `409` | Target lot is in `hold_mkt`, `expired`, `quarantined`, or past `expiryDate`. | Release via QA (`releaseLotByQa`) or allocate an alternative lot. |
| `WMS_INSUFFICIENT_STOCK` | `409` | Issue quantity exceeds current `qtyOnHand` on the locked lot. | Split the dispatch quantity or re-run FEFO allocation. |
| `MKT_INVALID_SAMPLE` | `400` | Sample is non-finite, `<= -273.15°C`, or `deltaH <= 0`. | Filter out malformed sensor readings before computing MKT. |
| `WMS_MKT_SAMPLES_REQUIRED` | `400` | Empty `samplesC`, no asset telemetry, and `forceHold !== true`. | Supply `samplesC` or bind a valid `assetEntityId` to the lot. |

## Related

- [ePOD & Public QR Verification](/en/domains/epod-and-qr-verification)
- [IIoT & Two-Way Digital Twin](/en/domains/iiot-digital-twin)
- [12 Native v2 BlockModels](/en/studio/native-blocks)
- [PKI Ed25519 & Merkle Ledger](/en/reference/pki-merkle-ledger)
