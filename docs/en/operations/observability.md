---
title: Observability and Tracing
description: Configure OpenTelemetry HTTP and GenAI tracing, Prometheus metrics scraping, alerting rules, and Grafana dashboards in LatticeDX.
---

# Observability and Tracing

LatticeDX exports runtime telemetry from the NocoBase core through `plugin-lattice-foundation`, scrapes quantitative metrics with Prometheus, and visualizes operational state in Grafana. The pipeline combines W3C `traceparent` distributed tracing, OpenTelemetry GenAI semantic conventions with pre-export PII redaction, and isolated internal health endpoints across Docker networks.

## Telemetry Collection Architecture

Enabling `--profile observability` in `infra/compose/prod.yml` runs three observability services across the internal `app` and `data` networks:

1. `otel/opentelemetry-collector-contrib:0.123.0` ingests OTLP spans over gRPC (`:4317`) and HTTP (`:4318`), applies a `384 MiB` memory limiter, batches payloads every `5s`, and exposes OTLP-derived metrics on `:8889`.
2. `prom/prometheus:v3.3.0` scrapes 4 configured targets every `15s`, evaluates 5 alert rules in `alerts.yml`, and retains TSDB blocks for `15` days.
3. `grafana/grafana-oss:11.5.8` auto-provisions the Prometheus datasource (`uid: latticedx-prom`) and mounts the `latticedx-360.json` dashboard.

<CodeTabs
  :tabs="[
    {
      label: 'Start Production Stack',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml --profile observability up -d'
    },
    {
      label: 'Verify Collector & Prometheus',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml exec otel-collector /otelcol-contrib validate --config=/etc/otelcol-contrib/config.yaml\ndocker compose -f infra/compose/prod.yml exec prometheus wget -qO- http://127.0.0.1:9090/-/healthy'
    }
  ]"
/>

## Health and Prometheus Endpoints

`registerObservability` in `plugins/nocobase/plugin-lattice-foundation/src/server/observability.js` installs the HTTP timing middleware and registers diagnostic actions on the `dxos` resource.

<ApiEndpoint
  method="GET"
  path="/api/dxos:health"
  auth="Public"
  summary="Reports PostgreSQL connectivity, platform version (0.4.2), process uptime, and OTel exporter queue statistics."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:metrics"
  auth="Bearer DX_METRICS_TOKEN | Role root, ldx_admin"
  summary="Exports Prometheus 0.0.4 text metrics covering HTTP latency histograms, outbox queues, active incidents, and OTel counters."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Public"
  summary="Generates OpenAPI 3.1.0 JSON including dynamically introspected latticeCustom* runtime collections."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public"
  summary="Generates AsyncAPI 3.0.0 JSON covering MQTT, SSE surfaceEvents, Valkey PubSub, and context outbox channels."
/>

Access to `/api/dxos:metrics` supports two authentication paths: constant-time SHA-256 comparison (`timingSafeEqual`) against `DX_METRICS_TOKEN`, or a verified session JWT holding the `root` or `ldx_admin` role. In production Compose, the `prometheus` container writes `DX_METRICS_TOKEN` to `/tmp/dx_metrics_token` under `umask 077` at startup so credentials never reside inside `prometheus.yml`.

<CodeTabs
  :tabs="[
    {
      label: 'Query Health',
      lang: 'bash',
      code: 'curl -fsS http://127.0.0.1:13000/api/dxos:health | jq .'
    },
    {
      label: 'Scrape Metrics with Token',
      lang: 'bash',
      code: 'curl -fsS -H \x22Authorization: Bearer $DX_METRICS_TOKEN\x22 http://127.0.0.1:13000/api/dxos:metrics'
    }
  ]"
/>

## Observability Configuration Parameters

<ParamGrid
  title="OpenTelemetry, Prometheus, and Grafana Environment Variables"
  :items="[
    { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', type: 'string', default: 'http://otel-collector:4318', description: 'Base OTLP HTTP endpoint where trace batches are posted to /v1/traces.' },
    { name: 'OTEL_SERVICE_NAME', type: 'string', default: 'latticedx-nocobase', description: 'Value assigned to resource attribute service.name on exported OTLP spans.' },
    { name: 'DX_METRICS_TOKEN', type: 'string', required: true, description: 'Bearer token used by Prometheus to scrape /api/dxos:metrics.' },
    { name: 'DX_CORS_ALLOWED_ORIGINS', type: 'string', default: 'http://localhost:8080,http://127.0.0.1:8080', description: 'Comma-separated allowlist of trusted browser origins enforced by CORS middleware.' },
    { name: 'DX_CORS_STRICT', type: 'boolean', default: 'true', description: 'Strips Access-Control-Allow-* headers when requests arrive from untrusted origins.' },
    { name: 'GRAFANA_ADMIN_USER', type: 'string', default: 'admin', description: 'Initial administrator username for the Grafana container.' },
    { name: 'GRAFANA_ADMIN_PASSWORD', type: 'string', required: true, description: 'Administrator password for Grafana (public sign-up and telemetry reporting are disabled).' }
  ]"
/>

## HTTP and OpenTelemetry GenAI Tracing

`createOtelExporter` in `otel-exporter.js` parses and propagates W3C `traceparent` headers (`00-<traceId>-<spanId>-<flags>`). Spans buffer in an in-memory queue capped at `256` entries, flushing batches of up to `64` spans every `5000ms` with a `2000ms` HTTP timeout. When the queue reaches capacity, new spans are dropped and counted via `latticedx_otel_spans_dropped_total` to bound Node.js memory usage.

For AI operations inside `plugin-dxos-ai`, `recordGenAiSpan` and `startGenAiSpan` emit spans following OpenTelemetry GenAI semantic conventions and optionally persist trace rows to `latticeAiTraces` inside the organization's `FORCE ROW LEVEL SECURITY` transaction context.

| Span Attribute | Type | Technical Description |
| :--- | :--- | :--- |
| `gen_ai.operation.name` | `string` | Operation stage (`chat`, `invoke_agent`, `execute_tool`). |
| `gen_ai.system` | `string` | AI runtime provider identifier (defaults to `latticedx`). |
| `gen_ai.request.model` | `string` | Target model identifier serving the inference request. |
| `gen_ai.usage.input_tokens` | `integer` | Prompt and context tokens consumed by the call. |
| `gen_ai.usage.output_tokens` | `integer` | Completion tokens returned by the model. |
| `gen_ai.agent.name` | `string` | Active profile name across the 7 AI Agent Profiles. |
| `gen_ai.tool.name` | `string` | Unified tool name executed during the ReAct loop. |
| `dxos.run_uid` | `string` | Correlation identifier linking multi-step agent runs. |
| `dxos.org` | `string` | Organization identifier matching tenant RLS isolation. |
| `dxos.pii.redacted_count` | `integer` | Number of sensitive substrings scrubbed prior to persistence or OTLP export. |

### Pre-Export PII and Secret Redaction

`redactPiiText` and `redactPiiDeep` scrub span attributes, error messages, input/output previews, and metadata fields before spans enter the OTLP queue or write to `latticeAiTraces`:

| Pattern Category | Replacement Token | Protected Data |
| :--- | :--- | :--- |
| JWT (`eyJ...`) | `[REDACTED_JWT]` | User session tokens and OIDC bearer tokens. |
| API Keys (`sk-...`, `ldx_pat_...`) | `[REDACTED_KEY]` | Model provider keys and scoped Personal Access Tokens. |
| National ID (`cccd`, `cmnd`, `0\d{11}`) | `[REDACTED_CCCD]` | 9-to-12-digit Vietnamese citizen identification numbers. |
| Vietnamese Phone (`+84`, `03/05/07/08/09`) | `[REDACTED_PHONE]` | 10-digit domestic mobile numbers. |
| Bank Accounts (`stk`, `iban`) | `[REDACTED_BANK]` | Account numbers and IBAN strings. |
| Tax ID (`mst`, 10 or 13 digits) | `[REDACTED_MST]` | Enterprise tax registration numbers. |
| Email Addresses | `[REDACTED_EMAIL]` | Any email address appearing in prompts, attributes, or errors. |

Token accounting attributes (`gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `total_tokens`) are exempted via `SAFE_TOKEN_COUNT_KEY_RE` so key-based secret scrubbing never masks usage counters.

## Prometheus Metric Families and Alert Rules

`infra/config/prometheus/prometheus.yml` defines 4 scrape jobs:

| Job Name | Target | Path | Authentication |
| :--- | :--- | :--- | :--- |
| `nocobase` | `nocobase:80` | `/api/dxos:metrics` | Bearer (`/tmp/dx_metrics_token`) |
| `caddy` | `caddy:2020` | `/metrics` | Internal `app` network |
| `keycloak` | `keycloak:9000` | `/metrics` | Internal `app` network |
| `otel-collector` | `otel-collector:8889` | `/metrics` | Internal `app` network |

### Metric Families Exported by `/api/dxos:metrics`

- `latticedx_http_requests_total{method, status_class}`: Counter partitioned by HTTP method and status class (`2xx`, `3xx`, `4xx`, `5xx`).
- `latticedx_http_request_duration_seconds`: Latency histogram with bucket bounds at `0.025`, `0.1`, `0.5`, and `2.0` seconds.
- `latticedx_ai_audit_logs_total`: Gauge of total rows stored in `latticeAiAuditLogs`.
- `latticedx_outbox_by_state{state}`: Gauge of `latticeContextOutbox` rows across 5 states (`pending`, `retry`, `processing`, `delivered`, `failed`).
- `latticedx_active_alarms_total`: Gauge of `open` or `acknowledged` incident records in `latticeIncidentCases`.
- `latticedx_unread_notifications_total`: Gauge of active unread rows in `latticeNotifications`.
- `latticedx_sla_policies_active`: Gauge of enabled SLA escalation policies.
- `latticedx_event_bus_by_status{status}`: Gauge of CloudEvents bus rows (`queued`, `dispatched`, `partial_failed`).
- `latticedx_webhook_deliveries_by_status{status}`: Gauge of outbound webhook deliveries (`pending`, `processing`, `delivered`, `retry_wait`, `dlq`).
- `latticedx_webhook_circuits_by_state{state}`: Gauge of webhook subscription circuit breakers (`closed`, `open`, `half_open`).
- `latticedx_uptime_seconds`: Gauge reporting Node.js process uptime in seconds.
- `latticedx_otel_spans_recorded_total`, `latticedx_otel_spans_exported_total`, `latticedx_otel_spans_dropped_total`, `latticedx_otel_export_failures_total`, `latticedx_otel_queue_size`: OTLP export pipeline counters and queue depth.

Database gauge collection (`collectDbGauges`) executes read-only counts inside `withSystemRlsBypass` (transaction-local `app.rls_bypass = 'on'`) so aggregate counts reflect platform-wide queue depths without exposing tenant row content.

### Configured Alert Rules (`alerts.yml`)

| Alert Name | PromQL Condition | For Duration | Severity |
| :--- | :--- | :--- | :--- |
| `LatticeDxNocoBaseDown` | `up{job="nocobase"} == 0` | `1m` | `critical` |
| `LatticeDxHigh5xxRate` | `5xx` request ratio `> 0.05` (with RPS `> 0.01`) | `2m` | `critical` |
| `LatticeDxOutboxBacklogHigh` | `sum(latticedx_outbox_by_state{state=~"pending\|retry\|failed"}) > 50` | `5m` | `warning` |
| `LatticeDxCriticalColdAlarmsActive` | `latticedx_active_alarms_total > 0` | `3m` | `critical` |
| `LatticeDxQuotaSpike` | `delta(latticedx_ai_audit_logs_total[15m]) > 200` | `5m` | `warning` |

## Grafana Dashboard (`latticedx-360`)

Grafana mounts `infra/config/grafana/provisioning` and `infra/config/grafana/dashboards/latticedx-360.json` read-only (`allowUiUpdates: false`). The dashboard refreshes every `15s` in the `Asia/Ho_Chi_Minh` timezone and includes 7 panels:

| # | Panel Title | Metrics & Visualization |
| :---: | :--- | :--- |
| `1` | HTTP Request Rate & 5xx Errors | Time series grouped by `status_class` alongside `5xx` error rates. |
| `2` | HTTP Latency p95 / p50 | `0.95` and `0.50` quantiles derived from `latticedx_http_request_duration_seconds_bucket`. |
| `3` | Active Critical / Total Alarms | Stat panel tracking `latticedx_active_alarms_total` and `latticedx_sla_policies_active`. |
| `4` | Notification Inbox Queue | Stat panel for `latticedx_unread_notifications_total` with an orange threshold at `25`. |
| `5` | Database & Engine Health | Scrape status (`up{job="nocobase"}`) paired with `latticedx_uptime_seconds`. |
| `6` | Context Outbox Backlog (Pending / Retry / Failed) | Time series tracking Orion-LD and webhook delivery queues. |
| `7` | AI / MCP Audit Volume & Stack Targets | Audit volume alongside `up` status for `caddy`, `keycloak`, and `otel-collector`. |

## Related

- [Production Deployment](/en/getting-started/production-deployment)
- [Events and Outbox](/en/architecture/events-and-outbox)
- [AI Evaluation and Guardrails](/en/ai/eval-and-guardrails)
- [Troubleshooting](/en/operations/troubleshooting)
