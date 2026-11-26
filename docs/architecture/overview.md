---
title: Tổng quan Kiến trúc 6-Plane DX-OS
description: Mô hình 6 phân hệ điều phối, 5 vùng mạng Docker cô lập, cấu trúc Compose và hệ sinh thái 4 kho mã nguồn Apache-2.0 của LatticeDX v0.4.2.
---

# Tổng quan Kiến trúc 6-Plane DX-OS

LatticeDX `v0.4.2` tổ chức toàn bộ nền tảng số doanh nghiệp theo mô hình **6 phân hệ điều phối (6-Plane DX-OS)** kết hợp **5 vùng mạng container cô lập**. Kiến trúc này tách biệt lớp biên xác thực HTTP/TLS, tầng ứng dụng và quy trình nghiệp vụ, tầng tự động hóa IT/OT, lực lượng tác nhân AI và lõi lưu trữ PostgreSQL `16` áp dụng `FORCE ROW LEVEL SECURITY`.

<PlatformPlanesDiagram />

## 6 Phân hệ Điều phối (Planes 1–6)

Mỗi phân hệ đảm nhận một ranh giới trách nhiệm rõ ràng và giao tiếp với các phân hệ lân cận qua hợp đồng API, hàng đợi outbox hoặc bus sự kiện chuẩn hóa.

| Phân hệ | Vai trò điều phối | Thành phần & Dịch vụ cốt lõi | Giao diện & Tuyến API chính |
| :--- | :--- | :--- | :--- |
| **Plane 1** | Danh tính, Biên Zero-Trust & Lưu trữ Đa Tenant | Caddy `2.10`, Apache APISIX `3.19.0`, Keycloak `26.8.2` (OIDC/PKCE S256), Valkey `8.1`, `@latticedx/plugin-enterprise-auth`, PaaS API Keys (`ldx_pat_*`), Sổ cái Ed25519/Merkle (`dxosLedger`), `file-scanner` + ClamAV `1.5.5` + RustFS `1.0.6`, Vault AES-256-GCM (`dxosVault`), 56 bảng tĩnh `FORCE RLS` với role `nocobase_app` | `/enterprise-login`, `/api/dxosApiKeys:*`, `/api/dxosLedger:*`, `/api/dxosVault:*`, `/api/dxosDataGov:*` |
| **Plane 2** | Digital Twin IT/OT & Chuỗi thời gian | Eclipse Mosquitto `2.0.21` Dynamic Security (`allow_anonymous false`, `$CONTROL/dynamic-security/v1`, LWT `device.offline`), Node-RED `4.0.9` downlink, FIWARE Orion-LD `1.12.0` + MongoDB `8.0`, bảng `latticeTelemetryPoints`, `latticeTwinShadows`, tính toán Arrhenius MKT, ngưỡng HITL `2.0°C` | `/api/dxosBroker:*`, `/api/dxosBroker:orionNotify`, `/api/dxosBlocks:twin*`, `/api/dxosBlocks:telemetry*`, `/api/dxosBlocks:alarm*` |
| **Plane 3** | Event Bus, LatticeFlow v2, Phê duyệt & Stock `n8n` | `dxosEvents` (CloudEvents `1.0`, Standard Webhooks `whsec_`, PG Outbox `FOR UPDATE SKIP LOCKED`, circuit breaker `5` lỗi/`120s`, DLQ), LatticeFlow v2 DAG (`dxosAutomations`: 24 node / 6 nhóm, `loopCursor`, HITL pause/resume), `dxosApprovals` (`M-of-N` + `dxosDelegations`), `dxosNotify`, Visual DMN (`dxosDmn`), OMS/WMS/FEFO/ePOD (`dxosWms`), cầu nối tùy chọn Stock `n8n` `2.48.1` (`dxosN8n`) | `/admin/settings/workflow/automation`, `/api/dxosEvents:*`, `/api/dxosAutomations:*`, `/api/dxosApprovals:*`, `/api/dxosDmn:*`, `/api/dxosWms:*`, `/v/track/:code`, `/api/dxosN8n:*` |
| **Plane 4** | Đa Cổng, Field PWA, Biểu mẫu & GitOps v3 | Cổng vai trò `/p/*` (`procurement`, `incidents`, `logistics`, `services`, `cmms`, `partner-claims`), Mobile Field PWA (`/v/mobile` dùng IndexedDB outbox và hàng đợi `quarantined`), Public Forms (`/v/form/:slug` không rò rỉ PII), 12 Native v2 `BlockModel`s (`maplibre-gl`, WebGIS, BI Chart, WMS Ops, Creative Studio), `dxosBuilder` cho `latticeCustom*`, P.A.R.A. + OCR + Hybrid RAG (`pgvector` `0.8.1` HNSW + RRF), Solution Bundle `v3` | `/p/<slug>`, `/v/mobile`, `/v/form/:slug`, `/admin/settings/dxos-studio`, `/admin/settings/dxos-para`, `/api/dxosBlocks:*`, `/api/latticePara:*`, `/api/dxosBuilder:*` |
| **Plane 5** | AI Workforce, App Builder 2.0, MCP & A2A | 7 Starter AI Profiles (`dxos-coordinator` đến `dxos-analyst`), 20 Unified Tools + 4 IT/OT MCP Tools, App Builder 2.0 (`plan`, `build`, `patch`, `rollback`, `teardown` an toàn), Streamable HTTP MCP (`/api/dxos-mcp`, `/api/dxos-mcp/it-ot`), Google/LF A2A (`/.well-known/agent-card.json`, `/api/dxos-a2a`), Eval Lab, che PII (CCCD, MST, STK, SĐT), hạn mức token/chi phí trên PostgreSQL | `/admin/settings/dxos-ai`, `/.well-known/agent-card.json`, `/api/dxos-a2a`, `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `/api/dxosAi:*` |
| **Plane 6** | Tầng Runtime Ứng dụng, Truy vết OTel & PITR | Container runtime ngoài `nocobase/nocobase:2.2.50` nạp 7 plugin Apache-2.0 (`sdkProvidedByHost: true`), Fastify `5` (`/v1/*`), đặc tả sống OpenAPI `3.1.0` & AsyncAPI `3.0.0`, OTel Collector Contrib `0.123.0` (W3C `traceparent` + OTel GenAI), Prometheus `v3.3.0`, Grafana OSS `11.5.8`, Gotenberg `8.20.1` (`pdf`), sao lưu PostgreSQL PITR WAL `.gz` | `/api/dxos:health`, `/api/dxos:metrics`, `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/v1/*` |

## 5 Luồng Tương tác Xuyên Phân hệ

Mọi nghiệp vụ thực tế đều đi qua một chuỗi ranh giới nhất quán giữa các phân hệ, không cho phép truy cập tắt trực tiếp vào tầng dữ liệu nội bộ:

| Luồng | Chuỗi xử lý xuyên phân hệ |
| :---: | :--- |
| `1` | **Biên Zero-Trust & Phiên OIDC:** người dùng đi qua Caddy `2.10` (chấm dứt TLS, thêm `Strict-Transport-Security`, gỡ header `Server`) tới Apache APISIX `3.19.0` (gắn `X-Request-Id`, giới hạn tốc độ bằng Valkey) và xác thực qua Keycloak `26.8.2` (`PKCE S256`) hoặc khóa `ldx_pat_*` trước khi `latticeNativeScope` mở giao dịch PostgreSQL với `app.current_org`. |
| `2` | **Cổng Công khai & Field PWA Ngoại tuyến:** tuyến `/v/form/*`, `/v/track/*` và `/v/mobile` được phục vụ qua cấu hình Nginx `10-lattice-public-routes.sh` với CSP sinh nonce riêng cho từng phản hồi (`default-src 'none'; script-src 'nonce-<n>'`). Thiết bị hiện trường xếp hàng thao tác vào IndexedDB `latticedx-mobile-outbox` và cô lập xung đột HTTP `4xx` sang trạng thái `quarantined`. |
| `3` | **Digital Twin IIoT 2 chiều:** cảm biến gửi bản tin qua Eclipse Mosquitto `2.0.21` (DynSec/LWT), Node-RED `4.0.9` chuẩn hóa về `dxosBlocks:telemetryIngest`, ghi vào `latticeTelemetryPoints` và đẩy vào outbox `latticeContextOutbox` để đồng bộ sang FIWARE Orion-LD `1.12.0`. Lệnh điều khiển từ WebGIS hoặc AI agent đi qua ngưỡng HITL `2.0°C` trước khi xuống Node-RED. |
| `4` | **Bus Sự kiện & Hàng đợi Bền vững:** thay đổi dữ liệu hoặc sự cố tạo sự kiện CloudEvents `1.0` trong `latticeEventBus`, được trình quét nền `10s` ký Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<b64>`) gửi tới webhook ngoài hoặc Stock `n8n` `2.48.1`, kèm circuit breaker mở `120s` sau `5` lần lỗi liên tiếp. |
| `5` | **Tác nhân AI, MCP & Quan sát OTel:** yêu cầu từ Studio AI hoặc client ngoài qua `/api/dxos-mcp` và `/api/dxos-a2a` chạy qua `createAuditedTool` để kiểm tra quyền RBAC, che PII tiếng Việt, ghi nhận hạn mức trên PostgreSQL và phát span OTel GenAI (`gen_ai.system`, `gen_ai.request.model`) về `otel-collector:4318`. |

## 5 Vùng Mạng Cô lập trong Production (`prod.yml`)

Trong cấu hình triển khai sản xuất `infra/compose/prod.yml`, toàn bộ image được ghim cố định theo digest `@sha256` bất biến và phân tách vào **5 mạng Docker** riêng biệt. Bốn mạng bên trong đặt `internal: true` để ngăn mọi kết nối ra hoặc vào trực tiếp từ Internet.

<ParamGrid
  title="Phân vùng Mạng Docker (infra/compose/prod.yml)"
  :items="[
    { name: 'edge', type: 'bridge (public)', required: true, default: '80, 443', description: 'Mạng tiếp nhận lưu lượng TLS từ bên ngoài. Gồm caddy (TLS + HSTS), keycloak, gateway (APISIX 3.19.0) và nocobase.' },
    { name: 'app', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Mạng liên lạc HTTP/gRPC nội bộ giữa gateway, nocobase, file-scanner, orion-ld, nodered, n8n, gotenberg, otel-collector, prometheus và grafana.' },
    { name: 'data', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Mạng lưu trữ dữ liệu cô lập cho postgres (16.16), nocobase-db (pgvector 0.8.1-pg16), redis (Valkey 8.1), rustfs (1.0.6), orion-mongo (8.0) và lớp thu thập số liệu.' },
    { name: 'scanner', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Vùng cách ly quét mã độc tệp tải lên giữa file-scanner (4010) và clamd (ClamAV 1.5.5 tại cổng 3310) chạy với read_only: true.' },
    { name: 'iiot-net', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Mạng thiết bị biên IT/OT cô lập giữa Eclipse Mosquitto (1883), Node-RED (1880) và NocoBase Digital Twin broker.' }
  ]"
/>

### Phân hoạch Dữ liệu Cache & PubSub trên Valkey 8.1

Thay vì dùng một không gian khóa chung, LatticeDX tách **Valkey `8.1`** (`valkey/valkey:8.1-alpine`, BSD-3-Clause) thành các database logic tách biệt theo vai trò:

| Phân vùng Valkey | Biến / Thành phần | Dữ liệu lưu trữ & giới hạn |
| :--- | :--- | :--- |
| DB `0` | `CACHE_REDIS_URL` | Bộ nhớ đệm ứng dụng NocoBase (`CACHE_DEFAULT_STORE=redis`). |
| DB `1` | `PUBSUB_ADAPTER_REDIS_URL` | Kênh PubSub `latticedx:surface-updates` chuyển tiếp biến động bản ghi và quy trình tới luồng SSE `GET /api/dxosAi:surfaceEvents` (tối đa `1000` kết nối đồng thời, heartbeat `25s`). |
| DB `2` | `DX_NATIVE_AUTH_SESSION_REDIS_URL` | Lưu `state:` PKCE (`300s`), `ticket:` đăng nhập dùng một lần (`60s`), và khóa thu hồi phiên `revoked:` / `revoked_sid:` (`24h`). |
| Bộ đếm APISIX | `limit-count` (`policy: redis`) | Cụm bộ đếm giới hạn tốc độ theo IP với ngưỡng `120` / `240` / `300` yêu cầu mỗi `60s`. |

::: info Phân tách Hàng đợi Bền vững và PubSub
LatticeDX **không** sử dụng Redis/Valkey Streams cho tác vụ bền vững. Toàn bộ transactional outbox (`latticeContextOutbox` cho NGSI-LD và `latticeEventBus` cho webhook) nằm trong các bảng PostgreSQL `16` bảo vệ bởi `FORCE ROW LEVEL SECURITY` và khóa hàng `FOR UPDATE SKIP LOCKED`, giúp trạng thái đồng bộ luôn nằm trong cùng giao dịch ACID với dữ liệu nghiệp vụ.
:::

## Cấu trúc Compose & Profile Triển khai (`infra/compose/*`)

Môi trường phát triển cục bộ gán toàn bộ cổng dịch vụ vào `127.0.0.1` (`postgres`, `nocobase-db`, `redis`, `clamav`, `orion-mongo` và `mosquitto` không mở cổng ra máy chủ). Môi trường sản xuất `prod.yml` cung cấp 5 profile tùy chọn (`iam-sync`, `n8n`, `observability`, `pdf`, `iiot`) bên cạnh cụm dịch vụ mặc định.

| Tệp Compose | Project Name | Thành phần & Cổng Local (`127.0.0.1`) |
| :--- | :--- | :--- |
| `infra/compose/core.yml` | `lattice-dx` | Core API stack: `postgres`, `keycloak` (`:8081`), `api` (`:4000` nội bộ), `gateway` (`:8080`), `clamav` |
| `infra/compose/nocobase.yml` | `lattice-dx` | Host `nocobase` (`:13000`), `nocobase-db` (`pgvector`), `redis` (Valkey `8.1`) |
| `infra/compose/iiot.yml` | `lattice-dx` | Mạng `iiot-net`: `mosquitto` (`1883` nội bộ) và `nodered` (`:1880`) |
| `infra/compose/integration.yml` | `lattice-dx` | Tích hợp ngoài: `orion-mongo`, `orion-ld` (`:1026`), `n8n` (`:5678`) |
| `infra/compose/native-files.yml` | *(overlay)* | Gắn sidecar quét tệp `file-scanner` (`:4010`) và `clamav` scanning cho tệp đính kèm |
| `infra/compose/native-rehearsal.yml` | `lattice-native-rehearsal` | Cụm diễn tập nâng cấp cô lập (`nocobase-db` + `nocobase` trên `:13001`) |
| `infra/compose/uc1-sample.yml` | *(overlay)* | Dịch vụ mẫu `uc1-sample` (`:4100`) và `uc1-broker-worker` |
| `infra/compose/prod.yml` | `lattice-dx-prod` | Stack Zero-Trust sản xuất (`80`/`443` qua Caddy) và 5 profile bật thêm theo nhu cầu |

### 5 Profile Tùy chọn trong `prod.yml`

| Profile | Dịch vụ kích hoạt | Chức năng bổ sung |
| :--- | :--- | :--- |
| `iam-sync` | `keycloak-config-cli` (`6.5.1-26`) | Đồng bộ cấu hình realm `lattice-realm.prod.json` một lần lúc khởi tạo |
| `n8n` | `n8n` (`2.48.1`) | Động cơ workflow ngoài kết nối `n8n_app` trên PostgreSQL |
| `observability` | `otel-collector` (`0.123.0`), `prometheus` (`v3.3.0`), `grafana` (`11.5.8`) | Thu thập OTLP, cảnh báo 5 rule và dashboard `latticedx-360.json` |
| `pdf` | `gotenberg` (`8.20.1`) | Kết xuất chứng từ HTML sang PDF với `--chromium-disable-javascript=true` |
| `iiot` | `mosquitto` (`2.0.21`), `nodered` (`4.0.9`) | Broker MQTT DynSec và Node-RED chuyển đổi downlink trên `iiot-net` |

## Hệ sinh thái 4 Kho mã nguồn `CTU-OpenPaw`

Dự án duy trì cấu trúc 4 kho độc lập theo giấy phép Pure-OSI (`Apache-2.0`), tách biệt mã nguồn mở lõi, cổng tài liệu, thư viện mẫu GitOps và hồ sơ quản trị tổ chức.

<EcosystemTopologyDiagram />

| Kho mã nguồn | Giấy phép | Vai trò kỹ thuật | Liên kết |
| :--- | :--- | :--- | :--- |
| **`CTU-OpenPaw/lattice-dx`** | `Apache-2.0` | Mã nguồn lõi nền tảng `v0.4.2`: 7 plugin `@latticedx/*`, dịch vụ Fastify API `/v1/*`, AI worker, sidecar `file-scanner`, cấu hình Compose và tập lệnh sao lưu/khôi phục | [GitHub `lattice-dx`](https://github.com/CTU-OpenPaw/lattice-dx) |
| **`CTU-OpenPaw/lattice-docs`** | `Apache-2.0` / `MIT` | Cổng tài liệu kỹ thuật song ngữ Việt (`/`) và Anh (`/en/`) xây dựng bằng VitePress với hệ thống sơ đồ tương tác và tham chiếu API | [Trang chủ Docs](/) |
| **`CTU-OpenPaw/lattice-templates`** | `Apache-2.0` | Kho mẫu chuẩn hóa gồm 43 cấu phần JSON đã kiểm duyệt: LatticeFlow blueprints, n8n workflows, bảng DMN, Business Packs, Public Forms và Solution Bundle v3 | [GitHub `lattice-templates`](https://github.com/CTU-OpenPaw/lattice-templates) |
| **`CTU-OpenPaw/.github`** | `Apache-2.0` | Hồ sơ tổ chức GitHub, chuẩn đóng góp cộng đồng, chính sách bảo mật và thông tin điều phối hệ sinh thái | [GitHub `.github`](https://github.com/CTU-OpenPaw/.github) |

## Kiểm chứng Hạ tầng & Đặc tả Sống

Tầng Plane 6 cung cấp các điểm cuối HTTP chuẩn hóa để kiểm tra tình trạng runtime, trích xuất đặc tả API tự động (bao gồm cả collection động `latticeCustom*`) và thu thập metric Prometheus.

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Public | Bearer JWT | ldx_pat_*"
  summary="Trả về đặc tả OpenAPI 3.1.0 sinh tự động theo metadata hiện hành, bao gồm cả các collection động latticeCustom*."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public | Bearer JWT | ldx_pat_*"
  summary="Trả về đặc tả AsyncAPI 3.0.0 mô tả 3 server (mqttBroker, httpGateway, redisPubSub) và 5 kênh bất đồng bộ."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:metrics"
  auth="Bearer DX_METRICS_TOKEN | root | ldx_admin"
  summary="Xuất 12 nhóm metric Prometheus cho độ trễ HTTP, lỗi RLS, tồn đọng outbox/DLQ, AI tokens và kết nối SSE."
/>

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra Health & Specs (bash)',
      lang: 'bash',
      code: '# Kiểm tra sức khỏe runtime NocoBase + 7 plugins\ncurl -fsS http://127.0.0.1:8080/api/dxos:health\n\n# Tải đặc tả sống OpenAPI 3.1.0 (gồm cả bảng latticeCustom*)\ncurl -fsS http://127.0.0.1:8080/api/dxos:openapi | jq \x22.openapi, .info.version\x22\n\n# Tải đặc tả AsyncAPI 3.0.0 (MQTT, SSE, Valkey PubSub, Webhooks)\ncurl -fsS http://127.0.0.1:8080/api/dxos:asyncapi | jq \x22.asyncapi, (.channels | keys)\x22'
    },
    {
      label: 'Metrics Prometheus (bash)',
      lang: 'bash',
      code: '# Truy xuất 12 nhóm metric Prometheus của LatticeDX\ncurl -fsS -H \x22Authorization: Bearer $DX_METRICS_TOKEN\x22 \\\n  http://127.0.0.1:8080/api/dxos:metrics'
    },
    {
      label: 'Cấu trúc AsyncAPI 3.0 Channels (json)',
      lang: 'json',
      code: '{\n  \x22asyncapi\x22: \x223.0.0\x22,\n  \x22servers\x22: {\n    \x22mqttBroker\x22: { \x22protocol\x22: \x22mqtt\x22 },\n    \x22httpGateway\x22: { \x22protocol\x22: \x22http\x22 },\n    \x22redisPubSub\x22: { \x22protocol\x22: \x22redis\x22 }\n  },\n  \x22channels\x22: {\n    \x22iotTelemetry\x22: {},\n    \x22iotDownlinkCommand\x22: {},\n    \x22surfaceEventsSse\x22: {},\n    \x22redisSurfaceUpdates\x22: {},\n    \x22contextOutboxWebhooks\x22: {}\n  }\n}'
    }
  ]"
/>

## Ranh giới Vận hành & Nguyên tắc Fail-Closed

| Nguyên tắc | Ranh giới kỹ thuật |
| :--- | :--- |
| Không gắn mã nguồn NocoBase vào kho Git | Kho `lattice-dx` không chứa `.gitmodules` hay thư mục `upstream/nocobase`. Host `nocobase/nocobase:2.2.50` chạy dưới dạng container OCI độc lập và nạp 7 plugin ở chế độ chỉ đọc (`:ro`). |
| Từ chối mặc định tại mọi lớp ranh giới | Nếu thiếu ngữ cảnh `app.current_org`, truy vấn PostgreSQL chỉ thấy `0` bản ghi; nếu tắt `DX_ALLOW_PUBLIC_SIGNUP`, biểu mẫu tự đăng ký bị khóa; mọi URL tích hợp ngoài bị chặn dải IP nội bộ/metadata (`169.254.*`) trừ khi khai báo rõ trong allowlist. |
| Bảo toàn nhận diện nguồn gốc | Chân trang `Powered by NocoBase`, phiên bản `v2.2.50` và `License settings` được giữ nguyên theo Điều 5.2 giấy phép NocoBase trên cả UI điều hành lẫn các cổng `/admin/*` và `/lattice/*`. |

## Tài liệu liên quan

- [Kiến trúc Hệ thống 7 Plugin & Hợp đồng Host](/architecture/plugin-system)
- [Kiến trúc Đa Tenant & PostgreSQL 16 FORCE RLS](/architecture/multi-tenancy-rls)
- [Mô hình Bảo mật Zero-Trust & Phân vùng Mạng](/architecture/security-model)
- [Triển khai Production Zero-Trust](/getting-started/production-deployment)
