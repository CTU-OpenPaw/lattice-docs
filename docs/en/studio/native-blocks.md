---
title: 12 Native v2 BlockModels
description: Complete technical reference for all 12 Dxos*BlockModel classes in @latticedx/plugin-dxos-blocks, dxosBlockSettings, CreativeStudio widgets and themes, DANGEROUS_FILTER_KEYS, and foundation blocks.
---

# 12 Native v2 BlockModels

The `@latticedx/plugin-dxos-blocks` plugin implements 12 declarative `Dxos*BlockModel` classes built on NocoBase `2.2.50` FlowEngine v2 (`@nocobase/client-v2`). All 12 models are registered on the client via `registerDxosBlockModels(client, React, antd, clientV2, flowEngine, app)` (`src/client/block-models.js`) and allowlisted on the server in `ALLOWED_DXOS_BLOCK_USES` (`portal-composer.js`) and `ALLOWED_FLOW_MODEL_USES` (`solution-bundle.js`).

Every block queries tenant-scoped data (`organizationId`), inheriting application ACL rules and PostgreSQL 16 `FORCE ROW LEVEL SECURITY` enforcement.

## Shared Architecture: `dxosBlockSettings`, Grid Placement, and 8 Foundation Blocks

All 12 `Dxos*BlockModel` classes extend `BaseBlockModel` (`clientV2?.BlockModel || flowEngine?.getModelClass?.('BlockModel')`) and share three core runtime mechanisms:

| Mechanism | Symbol / Hook | Runtime Behavior |
| :--- | :--- | :--- |
| Settings flow | `dxosBlockSettings` (`on: 'beforeRender'`) | Opens a scrollable `config` dialog (`uiMode: { type: 'dialog' }`, `top: 24px`, `maxHeight: '78vh'`). Saving invokes `ctx.model.setProps(params)` and `notifyModelListeners(ctx.model)`. |
| Config precedence | `readModelConfig(model, defaults, liveConfig)` | Merges `{ ...defaults, ...(model?.props || {}), ...stepParams.dxosBlockSettings.config, ...(liveConfig || {}) }`. |
| Grid placement | FlowEngine `Grid` (`PortalPageModel` / `RootPageModel`) | Supports side-by-side multi-column `gridSettings` via `placeBesideOrInsertBlock`. |
| Dynamic metadata | `dxosBlocks:collectionsMeta` | Fetches user-accessible business and `latticeCustom*` collections while filtering 70+ internal tables (`META_EXCLUDED_COLLECTIONS`) and sensitive columns (`password`, `secret`, `token`, `apiKey`, `privateKey`, `hash`, `salt`, `embedding`, `searchVector`). |

::: info Distinction from the 8 Foundation Context BlockModels
Separate from the 12 DX-OS Native v2 `Dxos*BlockModel` classes, `@latticedx/plugin-lattice-foundation` (`src/client/index.js`) registers 8 foundation context BlockModels bound via the `latticeBinding` flow (`latticeApps:list`): `LatticeFormBlockModel`, `LatticeListBlockModel`, `LatticeTaskInboxBlockModel`, `LatticeApprovalBlockModel`, `LatticeAttachmentBlockModel`, `LatticeActivityTimelineBlockModel`, `LatticeContextEntityBlockModel`, and `LatticeWorkflowFormBlockModel`.
:::

## Catalog of All 12 `Dxos*BlockModel` Classes

| # | Class Name | UI Label | Primary Data Bindings / API Calls |
| :--- | :--- | :--- | :--- |
| 1 | `DxosPortalHeroBlockModel` | `DX-OS Portal Hero & Quick Actions` | Client navigation via `filterHeroActions` & `isSafeAppPath` |
| 2 | `DxosKpiMetricBlockModel` | `DX-OS KPI Metric Grid` | `GET ${m.collection}:list` (`pageSize: 1`, reads `meta.count`) |
| 3 | `DxosContextTelemetryBlockModel` | `DX-OS NGSI-LD Context & Telemetry` | `POST dxosBlocks:contextTelemetry` |
| 4 | `DxosAiProposalBlockModel` | `DX-OS AI Proposal & Evidence` | `POST dxosBlocks:proposals`, `POST dxosBlocks:decideProposal` |
| 5 | `DxosWorkflowTasksBlockModel` | `DX-OS Workflow & My Tasks` | `GET workflowManualTasks:list`, `POST workflowManualTasks:submit` |
| 6 | `DxosParaVaultBlockModel` | `DX-OS P.A.R.A. Knowledge Vault` | `latticeParaDocuments:list`, `latticeParaDocuments:create` |
| 7 | `DxosCreativeStudioBlockModel` | `DX-OS Creative Studio Micro-App` | Declarative query runner (`collection`, `telemetry`, `tasks`, `timeseries`) |
| 8 | `DxosRecordWorkbenchBlockModel` | `DX-OS Chatter, Chứng từ & Xuất báo cáo` | `latticeChatter:list`/`post`, `dxosBlocks:exportReport`, `dxosWms:printVoucher` |
| 9 | `DxosWebGisBlockModel` | `DX-OS Bản đồ Giám sát WebGIS [D]` | `dxosBlocks:twinShadow`, `dxosBlocks:twinSetDesired` |
| 10 | `DxosKanbanScheduleBlockModel` | `DX-OS Bảng Kanban & Lịch [H]` | `${collection}:list` / `:update` |
| 11 | `DxosWmsOpsBlockModel` | `DX-OS Vận hành Kho FEFO & Bulk Import [W]` | `dxosWms:*`, `dxosBlocks:bulkImportDryRun`, `dxosBlocks:bulkImportCommit` |
| 12 | `DxosBiChartBlockModel` | `DX-OS Biểu đồ & Phân tích BI [D]` | `POST dxosBlocks:aggregateQuery` |

---

## BlockModel Reference

### 1. `DxosPortalHeroBlockModel`

Renders the portal header banner with a context badge, hex accent color, and role-filtered quick-action buttons. `filterHeroActions(actionsJson, perms)` strips any action failing `isSafeAppPath` (blocking `javascript:`, external origins, or studio paths for operational roles).

<ParamGrid
  title="DxosPortalHeroBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Không gian Điều hành Doanh nghiệp DX-OS', description: 'Primary hero heading.' },
    { name: 'subtitle', type: 'string', default: 'Nền mở NocoBase 2.2.50 cho H–P–D–I', description: 'Secondary description displayed beneath the title.' },
    { name: 'badge', type: 'string', default: 'DX-OS', description: 'Short context pill rendered next to the heading.' },
    { name: 'accentColor', type: 'string', default: '#1677ff', description: 'Hex accent color applied to the banner trim and primary CTA.' },
    { name: 'actionsJson', type: 'string (JSON)', default: 'DEFAULT_HERO_ACTIONS', description: 'JSON array of [{ label, path, primary? }] button definitions.' }
  ]"
/>

### 2. `DxosKpiMetricBlockModel`

Renders a responsive 1–4 column KPI grid (`columns` clamped to `1..4`). Each card defined in `metricsJson` executes `GET ${m.collection}:list` (`pageSize: 1`) to display `meta.count` and navigates to `targetPath` on click.

<ParamGrid
  title="DxosKpiMetricBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Chỉ số vận hành', description: 'Section heading for the KPI grid.' },
    { name: 'columns', type: 'number', default: '4', description: 'Grid column count, clamped to 1..4.' },
    { name: 'metricsJson', type: 'string (JSON)', default: 'DEFAULT_KPI_METRICS', description: 'JSON array of [{ label, collection, filter?, color, targetPath }] metric cards.' }
  ]"
/>

### 3. `DxosContextTelemetryBlockModel`

Queries `POST dxosBlocks:contextTelemetry` to display FIWARE Orion-LD NGSI-LD entity context, live sensor readings, and `latticeContextOutbox` delivery status. Numeric attributes exceeding `warningThreshold` are highlighted.

<ParamGrid
  title="DxosContextTelemetryBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Ngữ cảnh NGSI-LD & Cảm biến', description: 'Block header title.' },
    { name: 'assetEntityId', type: 'string', default: '\'\'', description: 'Asset code or NGSI-LD URN; leaves auto-selection active when empty.' },
    { name: 'warningThreshold', type: 'string', default: '80', description: 'Numeric threshold used to flag elevated readings.' },
    { name: 'showSyncStatus', type: 'boolean', default: 'true', description: 'Displays pending and synced outbox counts.' }
  ]"
/>

### 4. `DxosAiProposalBlockModel`

Displays AI-generated operational proposals via `POST dxosBlocks:proposals` and submits human decisions (`approve`, `review`, `reject`) through `POST dxosBlocks:decideProposal`. Self-approval is blocked (`SELF_APPROVAL_FORBIDDEN`).

<ParamGrid
  title="DxosAiProposalBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Đề xuất AI & Bằng chứng', description: 'Block header title.' },
    { name: 'targetCollection', type: 'enum', default: 'latticeIncidentCases', description: 'Allowlisted collection: latticeIncidentCases, latticeAssets, latticeRequests, latticeOrders, or latticeServiceTickets.' },
    { name: 'state', type: 'all | proposed | reviewed', default: 'all', description: 'Proposal lifecycle filter.' },
    { name: 'pageSize', type: 'number', default: '5', description: 'Maximum rows per page.' },
    { name: 'showEvidence', type: 'boolean', default: 'true', description: 'Renders supporting evidence snippets on each proposal card.' }
  ]"
/>

### 5. `DxosWorkflowTasksBlockModel`

Lists manual human tasks assigned to the authenticated user via `GET workflowManualTasks:list` and submits completions through `POST workflowManualTasks:submit`.

<ParamGrid
  title="DxosWorkflowTasksBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Hộp việc Quy trình Poka-yoke', description: 'Task inbox title.' },
    { name: 'statusFilter', type: 'pending | resolved | all', default: 'pending', description: 'Task status filter.' },
    { name: 'pageSize', type: 'number', default: '6', description: 'Maximum tasks displayed per page.' }
  ]"
/>

### 6. `DxosParaVaultBlockModel`

Browses and creates P.A.R.A. knowledge records (`latticeParaDocuments:list` and `:create`). Reads `?paraDocId=` from the browser query string to deep-link directly to a specific document.

<ParamGrid
  title="DxosParaVaultBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Kho tri thức P.A.R.A.', description: 'Vault block heading.' },
    { name: 'paraSpace', type: 'all | projects | areas | resources | archives', default: 'all', description: 'Default P.A.R.A. space filter.' },
    { name: 'pageSize', type: 'number', default: '6', description: 'Documents per page (1..25).' },
    { name: 'enableQuickCreate', type: 'boolean', default: 'true', description: 'Enables inline Markdown document creation.' },
    { name: 'defaultOrganizationId', type: 'string', default: '\'\'', description: 'Default organization ID override for root administrators.' }
  ]"
/>

### 7. `DxosCreativeStudioBlockModel`

Renders a declarative micro-app cockpit from `blueprintJson` (defaulting to `DEFAULT_CREATIVE_BLUEPRINT`) with zero `eval()` or `new Function()`. The `parseCreativeBlueprint` parser (`creative-studio-block.js`) caps blueprints at `6` queries, `12` widgets, and `1..4` grid columns.

<ParamGrid
  title="DxosCreativeStudioBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Buồng Điều hành Thông minh', description: 'Outer block title.' },
    { name: 'blueprintJson', type: 'string (JSON)', default: 'DEFAULT_CREATIVE_BLUEPRINT', description: 'Declarative DSL JSON containing title, subtitle, theme, columns, queries, and widgets.' }
  ]"
/>

#### `CreativeStudio` Capabilities: 4 Query Kinds, 11 Widget Types, and 5 Themes

| DSL Group | Constant | Supported Values |
| :--- | :--- | :--- |
| Query kinds (`4`) | `VALID_QUERY_KINDS` | `collection` (max `limit: 50`), `telemetry`, `tasks`, `timeseries` (max `limit: 200`). |
| Widget types (`11`) | `VALID_WIDGET_TYPES` | `gauge`, `thermometer`, `timeseries-line`, `stage-pipeline`, `distribution-bars`, `rule-callout`, `status-matrix`, `quick-actions` (up to 6 `navigate` / `createRecord` / `askAi` buttons), `export-bar`, `chatter`, `voucher-actions`. |
| Built-in themes (`5`) | `CREATIVE_THEMES` | `industrial-cockpit`, `emerald-ops`, `amber-alert`, `royal-indigo`, `clean-light`. |

<CodeTabs
  :tabs="[
    {
      label: 'Sample Blueprint JSON',
      lang: 'json',
      code: '{\n  \x22title\x22: \x22Cold Room A Cockpit\x22,\n  \x22subtitle\x22: \x22Live stock lot distribution and temperature telemetry.\x22,\n  \x22theme\x22: \x22emerald-ops\x22,\n  \x22columns\x22: 2,\n  \x22queries\x22: [\n    { \x22id\x22: \x22lots\x22, \x22kind\x22: \x22collection\x22, \x22collection\x22: \x22latticeStockLots\x22, \x22limit\x22: 30 },\n    { \x22id\x22: \x22tempSeries\x22, \x22kind\x22: \x22timeseries\x22, \x22assetEntityId\x22: \x22urn:ngsi-ld:Asset:org1:native:1\x22, \x22attribute\x22: \x22temperature\x22, \x22limit\x22: 100 }\n  ],\n  \x22widgets\x22: [\n    { \x22type\x22: \x22gauge\x22, \x22title\x22: \x22Active Stock Lots\x22, \x22queryId\x22: \x22lots\x22, \x22metric\x22: \x22count\x22, \x22max\x22: 50, \x22unit\x22: \x22lots\x22 },\n    { \x22type\x22: \x22thermometer\x22, \x22title\x22: \x22Latest Probe Temp\x22, \x22queryId\x22: \x22tempSeries\x22, \x22metric\x22: \x22latest\x22, \x22field\x22: \x22value\x22, \x22unit\x22: \x22C\x22 },\n    { \x22type\x22: \x22distribution-bars\x22, \x22title\x22: \x22Lot Status Mix\x22, \x22queryId\x22: \x22lots\x22, \x22field\x22: \x22status\x22 },\n    { \x22type\x22: \x22quick-actions\x22, \x22title\x22: \x22Operations\x22, \x22buttons\x22: [{ \x22label\x22: \x22Open FEFO Console\x22, \x22kind\x22: \x22navigate\x22, \x22targetPath\x22: \x22/p/logistics\x22, \x22primary\x22: true }] }\n  ]\n}'
    }
  ]"
/>

### 8. `DxosRecordWorkbenchBlockModel`

Combines voucher lifecycle controls, `latticeChatter:list`/`post` comments, Ed25519 PKI verification badges, `latticeDataLineage` inspection, QR voucher printing (`dxosWms:printVoucher`), and governed CSV/XLSX/PDF export (`dxosBlocks:exportReport`). `WORKBENCH_COLLECTION_ENUM` includes `latticeRequests`, `latticeOrders`, `latticeServiceTickets`, `latticeAssets`, `latticeIncidentCases`, `latticeParaDocuments`, and dynamic `latticeCustom*` collections.

<ParamGrid
  title="DxosRecordWorkbenchBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Trao đổi Chatter, Chứng từ & Xuất báo cáo', description: 'Workbench panel heading.' },
    { name: 'collection', type: 'string', default: 'latticeRequests', description: 'Target business or latticeCustom* collection.' },
    { name: 'recordId', type: 'string', default: '\'\'', description: 'Optional pinned record ID.' },
    { name: 'showExport', type: 'boolean', default: 'true', description: 'Displays governed CSV/XLSX/PDF export controls.' },
    { name: 'showVoucherActions', type: 'boolean', default: 'true', description: 'Displays voucher submit, approve, reject, and cancel actions.' },
    { name: 'showChatter', type: 'boolean', default: 'true', description: 'Displays record-scoped collaboration chatter.' },
    { name: 'showPkiBadge', type: 'boolean', default: 'true', description: 'Displays Ed25519 PKI ledger verification badge.' },
    { name: 'showLineage', type: 'boolean', default: 'true', description: 'Displays upstream/downstream data lineage drawer.' },
    { name: 'showPrintVoucher', type: 'boolean', default: 'true', description: 'Displays QR-verified voucher print button.' }
  ]"
/>

### 9. `DxosWebGisBlockModel`

Renders an interactive geographic map powered by `maplibre-gl` with a Vietnam SVG fallback (`lat 8.0..23.8`, `lng 102.0..110.2`, default hubs `HUB-CT`, `HUB-HCM`, `HUB-DN`, `HUB-HN`). When `showTwinOverlay` is enabled, it queries `dxosBlocks:twinShadow` and dispatches setpoints via `dxosBlocks:twinSetDesired`. Temperature changes exceeding `HITL_DELTA_THRESHOLD_C = 2.0` °C pause in `pending_hitl` until approved.

<ParamGrid
  title="DxosWebGisBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Bản đồ Giám sát Chuỗi lạnh WebGIS', description: 'Map header title.' },
    { name: 'defaultOrganizationId', type: 'string', default: '\'\'', description: 'Optional organization ID for admin scoping.' },
    { name: 'centerLat', type: 'number', default: '15.8', description: 'Initial map center latitude.' },
    { name: 'centerLng', type: 'number', default: '106.5', description: 'Initial map center longitude.' },
    { name: 'showTwinOverlay', type: 'boolean', default: 'true', description: 'Enables Digital Twin shadow overlay and setpoint controls.' },
    { name: 'collection', type: 'string', default: '\'\'', description: 'Optional custom collection providing map coordinates.' },
    { name: 'latField', type: 'string', default: '\'\'', description: 'Optional latitude field name.' },
    { name: 'lngField', type: 'string', default: '\'\'', description: 'Optional longitude field name.' },
    { name: 'labelField', type: 'string', default: '\'\'', description: 'Optional marker label field name.' },
    { name: 'statusField', type: 'string', default: '\'\'', description: 'Optional status field name for marker coloring.' }
  ]"
/>

### 10. `DxosKanbanScheduleBlockModel`

Switches between a stage-grouped Kanban board (`kanban`) and a weekly calendar view (`schedule`). Voucher collections follow `KANBAN_STAGE_ORDER` (`draft`, `submitted`, `approved`, `in_progress`, `completed`, `cancelled`), while `latticeStockLots` follows `STOCK_LOT_STAGE_ORDER` (`available`, `reserved`, `hold_mkt`, `expired`). `KANBAN_COLLECTION_ENUM` covers `latticeOrders`, `latticeRequests`, `latticeServiceTickets`, `latticeStockLots`, and `latticeCustom*`.

<ParamGrid
  title="DxosKanbanScheduleBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Bảng Kanban & Lịch vận hành', description: 'Board heading.' },
    { name: 'collection', type: 'string', default: 'latticeOrders', description: 'Source collection for cards and schedule entries.' },
    { name: 'viewMode', type: 'kanban | schedule', default: 'kanban', description: 'Default layout mode.' },
    { name: 'pageSize', type: 'number', default: '40', description: 'Maximum records fetched per view.' },
    { name: 'statusField', type: 'string', default: '\'\'', description: 'Optional Kanban stage field override.' },
    { name: 'dateField', type: 'string', default: '\'\'', description: 'Optional date field used in schedule mode.' },
    { name: 'titleField', type: 'string', default: '\'\'', description: 'Optional card title field override.' }
  ]"
/>

### 11. `DxosWmsOpsBlockModel`

Provides a two-tab cold-chain warehouse console: FEFO lot allocation, stock issue, MKT hold, and QA release (`dxosWms:*`), plus a two-phase bulk import wizard (`dxosBlocks:bulkImportDryRun` and `dxosBlocks:bulkImportCommit`). Input CSV/JSON payloads are capped at `MAX_BULK_IMPORT_BYTES = 2MB` across the four `IMPORT_COLLECTIONS`: `latticeStockLots`, `latticeAssets`, `latticeOrders`, and `latticeRequests`.

<ParamGrid
  title="DxosWmsOpsBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Vận hành Kho FEFO & Nhập lô hàng loạt', description: 'WMS console title.' },
    { name: 'defaultOrganizationId', type: 'string', default: '\'\'', description: 'Default organization ID override for admin callers.' },
    { name: 'defaultTab', type: 'fefo | import', default: 'fefo', description: 'Initial active tab.' },
    { name: 'defaultImportCollection', type: 'enum', default: 'latticeStockLots', description: 'Target collection: latticeStockLots, latticeAssets, latticeOrders, or latticeRequests.' },
    { name: 'showBulkImport', type: 'boolean', default: 'true', description: 'Toggles visibility of the 2-phase bulk import tab.' }
  ]"
/>

### 12. `DxosBiChartBlockModel`

Executes server-side aggregations via `POST dxosBlocks:aggregateQuery` with `x-reactions` dynamic field pickers across `BI_COLLECTION_ENUM` (12 core collections) and `latticeCustom*` tables.

To prevent unsafe query operator injection in `filterJson`, `sanitizeClientFilterNode` (`bi-chart-block.js`) enforces a maximum nesting depth of `10`, blocks prototype keys (`__proto__`, `constructor`, `prototype`), rejects dotted field paths, and rejects all 6 keys in `DANGEROUS_FILTER_KEYS`:

```text
$where, $raw, $sql, $eval, $function, $expr
```

<ParamGrid
  title="DxosBiChartBlockModel Props"
  :items="[
    { name: 'title', type: 'string', default: 'Phân tích & Biểu đồ BI', description: 'Chart heading.' },
    { name: 'collection', type: 'string', default: 'latticeOrders', description: 'Source collection for aggregation.' },
    { name: 'chartType', type: 'bar | line | pie | kpi | pivot', default: 'bar', description: 'Chart visualization type.' },
    { name: 'groupBy', type: 'string', default: 'status', description: 'Primary grouping field.' },
    { name: 'secondaryGroupBy', type: 'string', default: '\'\'', description: 'Secondary column grouping field for pivot mode.' },
    { name: 'metricOp', type: 'count | sum | avg | min | max', default: 'count', description: 'Aggregation function.' },
    { name: 'metricField', type: 'string', default: '\'\'', description: 'Numeric field used by sum, avg, min, and max.' },
    { name: 'limit', type: 'number', default: '20', description: 'Maximum groups returned (1..500).' },
    { name: 'filterJson', type: 'string (JSON)', default: '\'\'', description: 'Optional filter object; rejects any key in DANGEROUS_FILTER_KEYS.' }
  ]"
/>

## `dxosBlocks` Server Resource and `dxosTelemetryDirectGuard`

All block server operations route through 17 actions on `dxosBlocks` (`blocks-api.js`): 15 `loggedIn` actions (`proposals`, `decideProposal`, `contextTelemetry`, `telemetrySeries`, `alarmIngest`, `alarmAck`, `alarmClear`, `exportReport`, `globalSearch`, `twinShadow`, `twinSetDesired`, `bulkImportDryRun`, `bulkImportCommit`, `collectionsMeta`, `aggregateQuery`) and 2 `public` fail-closed edge actions (`telemetryIngest`, `twinAckCommand`, requiring either `X-Lattice-Edge-Token` of at least 16 characters matched in constant time against `DX_IIOT_INGEST_TOKEN` or a valid ACL-authorized user JWT).

The `dxosTelemetryDirectGuard` middleware blocks direct non-`root` CRUD or `charts:queryData` requests against `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices`, and `latticeBrokerSubscriptions` (`403`), forcing callers through `dxosBlocks` and `dxosBroker`.

## Related

- [Multi-Portal Architecture](/en/studio/multi-portal)
- [Custom Collections & AST Formulas](/en/studio/custom-collections-formulas)
- [Cold-Chain OMS/WMS & FEFO](/en/domains/cold-chain-oms-wms)
- [2-Way IIoT Digital Twin](/en/domains/iiot-digital-twin)
