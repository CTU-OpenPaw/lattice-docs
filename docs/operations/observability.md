---
title: Giám sát và Truy vết Hệ thống
description: Cấu hình OpenTelemetry OTLP cho HTTP và GenAI, thu thập metric Prometheus và bảng điều khiển Grafana trong LatticeDX.
---

# Giám sát và Truy vết Hệ thống

LatticeDX xuất dữ liệu quan sát từ nhân thực thi NocoBase thông qua `plugin-lattice-foundation`, thu thập nhật ký định lượng qua Prometheus và hiển thị trạng thái vận hành trên Grafana. Kiến trúc này kết hợp truy vết phân tán theo chuẩn W3C `traceparent`, quy ước ngữ nghĩa OpenTelemetry GenAI kèm cơ chế ẩn danh PII trước khi xuất, và các điểm cuối kiểm tra sức khỏe độc lập theo từng mạng nội bộ Docker.

## Kiến trúc thu thập dữ liệu quan sát

Khi kích hoạt hồ sơ `--profile observability` trong `infra/compose/prod.yml`, ba thành phần hạ tầng chạy trên mạng nội bộ `app` và `data`:

1. `otel/opentelemetry-collector-contrib:0.123.0` nhận span OTLP qua gRPC (`:4317`) và HTTP (`:4318`), áp dụng bộ giới hạn bộ nhớ `384 MiB`, gom lô mỗi `5s` và xuất metric OTLP ra `:8889`.
2. `prom/prometheus:v3.3.0` thu thập định kỳ mỗi `15s` từ 4 nguồn mục tiêu, đánh giá 5 quy tắc cảnh báo trong `alerts.yml` và lưu trữ TSDB trong `15` ngày.
3. `grafana/grafana-oss:11.5.8` tự động nạp nguồn dữ liệu Prometheus (`uid: latticedx-prom`) và bảng điều khiển `latticedx-360.json`.

<CodeTabs
  :tabs="[
    {
      label: 'Khởi chạy Production Stack',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml --profile observability up -d'
    },
    {
      label: 'Kiểm tra sức khỏe Collector & Prometheus',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml exec otel-collector /otelcol-contrib validate --config=/etc/otelcol-contrib/config.yaml\ndocker compose -f infra/compose/prod.yml exec prometheus wget -qO- http://127.0.0.1:9090/-/healthy'
    }
  ]"
/>

## Điểm cuối Health và Prometheus Metrics

`registerObservability` trong `plugins/nocobase/plugin-lattice-foundation/src/server/observability.js` đăng ký middleware đo thời gian phản hồi HTTP và gắn các action công khai thuộc tài nguyên `dxos`.

<ApiEndpoint
  method="GET"
  path="/api/dxos:health"
  auth="Public"
  summary="Kiểm tra kết nối PostgreSQL, phiên bản nền tảng (0.4.2), thời gian hoạt động và bộ đếm hàng đợi OTel."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:metrics"
  auth="Bearer DX_METRICS_TOKEN | Role root, ldx_admin"
  summary="Trả về dữ liệu văn bản Prometheus format 0.0.4 gồm HTTP histogram, hàng đợi outbox, sự cố và chỉ số OTel."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Public"
  summary="Xuất đặc tả OpenAPI 3.1.0 tự động nhận diện cả các collection động latticeCustom*."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public"
  summary="Xuất đặc tả AsyncAPI 3.0.0 cho các kênh MQTT, SSE surfaceEvents, Valkey PubSub và webhook outbox."
/>

Xác thực vào `/api/dxos:metrics` hỗ trợ hai cơ chế: so khớp thời gian hằng (`timingSafeEqual` trên băm SHA-256) với `DX_METRICS_TOKEN`, hoặc phiên JWT thuộc vai trò `root` hoặc `ldx_admin`. Ở môi trường production, container `prometheus` ghi `DX_METRICS_TOKEN` vào `/tmp/dx_metrics_token` với `umask 077` lúc khởi động để không lưu secret dạng văn bản thuần trong `prometheus.yml`.

<CodeTabs
  :tabs="[
    {
      label: 'Truy vấn Health',
      lang: 'bash',
      code: 'curl -fsS http://127.0.0.1:13000/api/dxos:health | jq .'
    },
    {
      label: 'Thu thập Metrics bằng Bearer Token',
      lang: 'bash',
      code: 'curl -fsS -H \x22Authorization: Bearer $DX_METRICS_TOKEN\x22 http://127.0.0.1:13000/api/dxos:metrics'
    }
  ]"
/>

## Tham số cấu hình quan sát

<ParamGrid
  title="Biến môi trường OpenTelemetry, Prometheus và Grafana"
  :items="[
    { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', type: 'string', default: 'http://otel-collector:4318', description: 'Điểm cuối OTLP HTTP nhận span tại đường dẫn /v1/traces.' },
    { name: 'OTEL_SERVICE_NAME', type: 'string', default: 'latticedx-nocobase', description: 'Thuộc tính service.name gắn trên resourceSpans của OTLP.' },
    { name: 'DX_METRICS_TOKEN', type: 'string', required: true, description: 'Mã Bearer dùng cho Prometheus scrape /api/dxos:metrics.' },
    { name: 'DX_CORS_ALLOWED_ORIGINS', type: 'string', default: 'http://localhost:8080,http://127.0.0.1:8080', description: 'Danh sách origin hợp lệ khi middleware kiểm soát header CORS.' },
    { name: 'DX_CORS_STRICT', type: 'boolean', default: 'true', description: 'Loại bỏ header Access-Control-Allow-* nếu request đến từ origin không tin cậy.' },
    { name: 'GRAFANA_ADMIN_USER', type: 'string', default: 'admin', description: 'Tên tài khoản quản trị mặc định cho Grafana.' },
    { name: 'GRAFANA_ADMIN_PASSWORD', type: 'string', required: true, description: 'Mật khẩu đăng nhập Grafana (tắt đăng ký công khai và báo cáo phân tích).' }
  ]"
/>

## Truy vết HTTP và OpenTelemetry GenAI

Bộ xuất `createOtelExporter` trong `otel-exporter.js` đọc và lan truyền header W3C `traceparent` (`00-<traceId>-<spanId>-<flags>`). Mọi span được lưu tạm trong hàng đợi bộ nhớ tối đa `256` phần tử, gom theo lô `64` span và đẩy ra OTLP mỗi `5000ms` với timeout `2000ms`. Khi hàng đợi đạt giới hạn, span mới bị loại bỏ và ghi nhận vào `latticedx_otel_spans_dropped_total` nhằm bảo vệ bộ nhớ tiến trình Node.js.

Đối với tác vụ AI trong `plugin-dxos-ai`, `recordGenAiSpan` và `startGenAiSpan` chuẩn hóa thuộc tính theo quy ước OpenTelemetry GenAI và ghi đồng thời bản ghi kiểm toán vào bảng `latticeAiTraces` dưới ngữ cảnh `FORCE ROW LEVEL SECURITY` của từng tổ chức (`organizationId`).

| Thuộc tính Span | Kiểu dữ liệu | Ý nghĩa kỹ thuật |
| :--- | :--- | :--- |
| `gen_ai.operation.name` | `string` | Thao tác thực thi (`chat`, `invoke_agent`, `execute_tool`). |
| `gen_ai.system` | `string` | Hệ thống cung cấp mô hình (mặc định `latticedx`). |
| `gen_ai.request.model` | `string` | Định danh mô hình ngôn ngữ đang xử lý yêu cầu. |
| `gen_ai.usage.input_tokens` | `integer` | Số lượng token đầu vào được tính cho phiên gọi. |
| `gen_ai.usage.output_tokens` | `integer` | Số lượng token đầu ra từ mô hình. |
| `gen_ai.agent.name` | `string` | Tên hồ sơ tác nhân AI (ví dụ trong 7 Agent Profiles). |
| `gen_ai.tool.name` | `string` | Tên công cụ hợp nhất được gọi trong vòng lặp ReAct. |
| `dxos.run_uid` | `string` | Mã định danh phiên chạy để gom nhóm toàn bộ chuỗi tool call. |
| `dxos.org` | `string` | Mã tổ chức sở hữu span, khớp với chính sách cách ly tenant. |
| `dxos.pii.redacted_count` | `integer` | Tổng số chuỗi nhạy cảm đã được che trước khi lưu hoặc xuất OTLP. |

### Cơ chế che dữ liệu nhạy cảm trước khi xuất

Hàm `redactPiiText` và `redactPiiDeep` chạy bắt buộc trên toàn bộ thuộc tính span, thông báo lỗi, bản xem trước đầu vào/đầu ra và tên mô hình trước khi đưa vào hàng đợi OTLP hoặc lưu `latticeAiTraces`:

| Mẫu nhận diện | Chuỗi thay thế | Phạm vi bảo vệ |
| :--- | :--- | :--- |
| JWT (`eyJ...`) | `[REDACTED_JWT]` | Token phiên người dùng hoặc OIDC. |
| Khóa API (`sk-...`, `ldx_pat_...`) | `[REDACTED_KEY]` | Khóa nhà cung cấp AI và Personal Access Token. |
| Thẻ căn cước (`cccd`, `cmnd`, `0\d{11}`) | `[REDACTED_CCCD]` | Số định danh công dân Việt Nam 9 đến 12 chữ số. |
| Số điện thoại Việt Nam (`+84`, `03/05/07/08/09`) | `[REDACTED_PHONE]` | Số di động 10 chữ số theo đầu số nội địa. |
| Tài khoản ngân hàng (`stk`, `iban`) | `[REDACTED_BANK]` | Chuỗi số tài khoản và mã IBAN. |
| Mã số thuế (`mst`, 10 hoặc 13 chữ số) | `[REDACTED_MST]` | Mã số thuế doanh nghiệp Việt Nam. |
| Địa chỉ thư điện tử | `[REDACTED_EMAIL]` | Mọi địa chỉ email trong payload và lỗi. |

Các khóa đếm token như `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` và `total_tokens` nằm trong danh sách ngoại lệ `SAFE_TOKEN_COUNT_KEY_RE` nên không bị bộ lọc từ khóa `token` che nhầm.

## Danh mục Metric Prometheus và Quy tắc Cảnh báo

Prometheus thu thập dữ liệu từ 4 job cấu hình trong `infra/config/prometheus/prometheus.yml`:

| Job Name | Target | Đường dẫn | Xác thực |
| :--- | :--- | :--- | :--- |
| `nocobase` | `nocobase:80` | `/api/dxos:metrics` | Bearer (`/tmp/dx_metrics_token`) |
| `caddy` | `caddy:2020` | `/metrics` | Mạng nội bộ `app` |
| `keycloak` | `keycloak:9000` | `/metrics` | Mạng nội bộ `app` |
| `otel-collector` | `otel-collector:8889` | `/metrics` | Mạng nội bộ `app` |

### Các họ Metric xuất từ `/api/dxos:metrics`

- `latticedx_http_requests_total{method, status_class}`: Counter phân tách theo phương thức HTTP và nhóm mã trạng thái (`2xx`, `3xx`, `4xx`, `5xx`).
- `latticedx_http_request_duration_seconds`: Histogram độ trễ HTTP với các ngưỡng bucket `0.025`, `0.1`, `0.5`, `2.0` giây.
- `latticedx_ai_audit_logs_total`: Gauge tổng số bản ghi kiểm toán AI và MCP trong `latticeAiAuditLogs`.
- `latticedx_outbox_by_state{state}`: Gauge số lượng bản ghi `latticeContextOutbox` theo 5 trạng thái (`pending`, `retry`, `processing`, `delivered`, `failed`).
- `latticedx_active_alarms_total`: Gauge số lượng sự cố đang `open` hoặc `acknowledged` trong `latticeIncidentCases`.
- `latticedx_unread_notifications_total`: Gauge thông báo đang kích hoạt nhưng chưa đọc trong `latticeNotifications`.
- `latticedx_sla_policies_active`: Gauge số chính sách leo thang SLA đang bật.
- `latticedx_event_bus_by_status{status}`: Gauge phân bố sự kiện CloudEvents (`queued`, `dispatched`, `partial_failed`).
- `latticedx_webhook_deliveries_by_status{status}`: Gauge trạng thái gửi webhook (`pending`, `processing`, `delivered`, `retry_wait`, `dlq`).
- `latticedx_webhook_circuits_by_state{state}`: Gauge trạng thái bộ ngắt mạch webhook (`closed`, `open`, `half_open`).
- `latticedx_uptime_seconds`: Gauge thời gian chạy tiến trình Node.js tính bằng giây.
- `latticedx_otel_spans_recorded_total`, `latticedx_otel_spans_exported_total`, `latticedx_otel_spans_dropped_total`, `latticedx_otel_export_failures_total`, `latticedx_otel_queue_size`: Nhóm chỉ số theo dõi đường ống xuất OTLP.

Lưu ý về truy vấn cơ sở dữ liệu: hàm `collectDbGauges` thực hiện đếm trên các bảng bảo vệ bởi RLS thông qua `withSystemRlsBypass` (đặt `app.rls_bypass = 'on'` cục bộ trong giao dịch chỉ đọc) để tổng hợp số liệu toàn cục mà không làm rò rỉ dữ liệu bản ghi ra ngoài endpoint metrics.

### Năm quy tắc cảnh báo trong `alerts.yml`

| Tên Alert | Biểu thức PromQL / Điều kiện | Ngưỡng duy trì | Mức độ |
| :--- | :--- | :--- | :--- |
| `LatticeDxNocoBaseDown` | `up{job="nocobase"} == 0` | `1m` | `critical` |
| `LatticeDxHigh5xxRate` | Tỷ lệ `5xx` trên tổng request `> 0.05` (khi RPS `> 0.01`) | `2m` | `critical` |
| `LatticeDxOutboxBacklogHigh` | `sum(latticedx_outbox_by_state{state=~"pending\|retry\|failed"}) > 50` | `5m` | `warning` |
| `LatticeDxCriticalColdAlarmsActive` | `latticedx_active_alarms_total > 0` | `3m` | `critical` |
| `LatticeDxQuotaSpike` | `delta(latticedx_ai_audit_logs_total[15m]) > 200` | `5m` | `warning` |

## Bảng điều khiển Grafana `latticedx-360`

Grafana gắn sẵn thư mục `infra/config/grafana/provisioning` và `infra/config/grafana/dashboards/latticedx-360.json` ở chế độ chỉ đọc (`allowUiUpdates: false`). Bảng điều khiển làm mới mỗi `15s` theo múi giờ `Asia/Ho_Chi_Minh` với 7 panel chính:

| # | Tên Panel | Metric & Chức năng hiển thị |
| :---: | :--- | :--- |
| `1` | HTTP Request Rate & 5xx Errors | Biểu đồ chuỗi thời gian theo `status_class` và tốc độ lỗi `5xx`. |
| `2` | HTTP Latency p95 / p50 | Phân vị `0.95` và `0.50` tính từ `latticedx_http_request_duration_seconds_bucket`. |
| `3` | Active Critical / Total Alarms | Thẻ trạng thái hiển thị `latticedx_active_alarms_total` và `latticedx_sla_policies_active`. |
| `4` | Notification Inbox Queue | Theo dõi `latticedx_unread_notifications_total` (chuyển cảnh báo màu cam khi `>= 25`). |
| `5` | Database & Engine Health | Trạng thái `up{job="nocobase"}` kết hợp `latticedx_uptime_seconds`. |
| `6` | Context Outbox Backlog (Pending / Retry / Failed) | Giám sát tắc nghẽn đồng bộ NGSI-LD Orion-LD và webhook. |
| `7` | AI / MCP Audit Volume & Stack Targets | Tổng lưu lượng AI/MCP kèm trạng thái `up` của `caddy`, `keycloak` và `otel-collector`. |

## Tài liệu liên quan

- [Triển khai Production](/getting-started/production-deployment)
- [Kiến trúc Sự kiện và Outbox](/architecture/events-and-outbox)
- [Đánh giá AI và Hàng rào Bảo vệ](/ai/eval-and-guardrails)
- [Xử lý Sự cố Hệ thống](/operations/troubleshooting)
