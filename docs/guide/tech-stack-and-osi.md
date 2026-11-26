# Tech Stack & Ranh giới Pure-OSI (`v0.4.2`)

**LatticeDX `v0.4.2`** được xây dựng với cam kết tuyệt đối về tính minh bạch chuỗi cung ứng phần mềm nguồn mở (**Pure-OSI**): mọi dòng mã nguồn thuộc dự án đều mang giấy phép **Apache-2.0**, mọi thư viện phụ thuộc trong kho Git đều đạt chuẩn OSI, và mọi container hạ tầng bên ngoài đều khóa phiên bản bằng digest `@sha256:` bất biến trong `infra/compose/*.yml`.

---

## 1. Runtime, Ngôn ngữ & Thư viện Trực tiếp

| Thành phần | Phiên bản (`v0.4.2`) | Giấy phép (SPDX) | Vai trò trong LatticeDX |
| --- | :---: | :---: | --- |
| **Node.js** | `24.x` (`>=24 <25`) | `MIT` | Runtime chính cho toàn bộ monorepo, 7 plugins và công cụ CLI/eval |
| **pnpm** | `10.23.0` | `MIT` | Trình quản lý workspace & lockfile (`pnpm-lock.yaml`) |
| **TypeScript** | `7.0.2` | `Apache-2.0` | Kiểm tra kiểu & biên dịch `apps/api`, `apps/agent-worker`, `apps/file-scanner`, `packages/contracts` |
| **tsx / Vitest** | `4.23.15` / `5.0.3` | `MIT` | Chạy kịch bản TS & `1,128` ca kiểm thử Vitest (152 tệp) |
| **Fastify** | `5.12.8` | `MIT` | Companion Headless API (`apps/api`, cổng `/v1/*`) |
| **node-postgres (`pg`)** | `8.23.1` | `MIT` | Trình điều khiển kết nối PostgreSQL `16` & giao dịch RLS |
| **jose** | `6.2.12` / `6.2.15` | `MIT` | Xác thực JWT/JWK ở API & trong `plugin-enterprise-auth` |
| **openid-client / oauth4webapi** | `6.8.9` / `3.8.8` | `MIT` | Đóng gói trong `plugin-enterprise-auth` cho Keycloak OIDC/PKCE |
| **@xyflow/react** | `12.12.1` | `MIT` | Canvas kéo-thả đồ thị DAG cho LatticeFlow v2 Studio (`plugin-dxos-studio`) |
| **@dagrejs/dagre** | `3.1.3` | `MIT` | Thuật toán tự động căn bố cục DAG trong LatticeFlow v2 Studio |
| **maplibre-gl** | `6.19.0` | `BSD-3-Clause` | Bản đồ WebGIS cho `DxosWebGisBlockModel` (`plugin-dxos-blocks`) |
| **esbuild** | `0.28.2` | `MIT` | Đóng gói client UMD tại build-time cho `plugin-dxos-blocks` & `plugin-dxos-studio` |

---

## 2. Toàn bộ 19 OCI Images Khóa Digest `@sha256:` (`infra/compose/*.yml`)

Mọi container dịch vụ được định nghĩa trong `infra/compose/*.yml` (`core.yml`, `nocobase.yml`, `iiot.yml`, `integration.yml`, `native-rehearsal.yml`, `prod.yml`) đều khóa digest `@sha256:` và đồng bộ 1–1 với `docs/sbom-cyclonedx.json`:

| Nhóm dịch vụ | Image & Phiên bản | Giấy phép | Vai trò & Ranh giới Mạng |
| --- | --- | :---: | --- |
| **Host Runtime** | `nocobase/nocobase:2.2.50` | `NocoBase License Agreement` (`2026-02-24`) | Host runtime độc lập ngoài kho Git; nạp 7 plugin `0.4.2` qua `sdkProvidedByHost: true` |
| **Cơ sở dữ liệu & Vector** | `pgvector/pgvector:0.8.1-pg16` | `PostgreSQL` | PostgreSQL `16` + `pgvector 0.8.1` lưu **56 bảng `FORCE RLS`**, vector P.A.R.A. và chuỗi thời gian IIoT `latticeTelemetryPoints` |
| **Cơ sở dữ liệu lõi** | `postgres:16.16-alpine` | `PostgreSQL` | PostgreSQL `16.16` cho các dịch vụ lõi (`core.yml`, `prod.yml`) + PITR WAL |
| **Cache & Pub/Sub** | `valkey/valkey:8.1-alpine` | `BSD-3-Clause` | Thay thế Redis non-OSI; lưu session cache, rate-limit APISIX và pub/sub (`PUBSUB_ADAPTER=redis`) |
| **TLS Edge Proxy** | `caddy:2.10-alpine` | `Apache-2.0` | Chấm dứt TLS và chèn HTTP security headers tại mạng `edge` |
| **API Gateway** | `apache/apisix:3.19.0-debian` | `Apache-2.0` | Định tuyến `/api/*`, `/.well-known/agent-card.json`, OIDC JWKS & rate-limit qua Valkey `8.1` |
| **Định danh SSO** | `quay.io/keycloak/keycloak:26.8.2` | `Apache-2.0` | Identity Provider OIDC + PKCE + Backchannel Logout |
| **Cấu hình SSO** | `adorsys/keycloak-config-cli:6.5.1-26` | `Apache-2.0` | Khởi tạo realm, client và role Keycloak tự động (IaC) |
| **Lưu trữ S3** | `rustfs/rustfs:1.0.6` | `Apache-2.0` | Kho lưu trữ đối tượng S3-compatible cho tệp đính kèm sau quét sạch |
| **Quét mã độc** | `clamav/clamav:1.5.5` | `GPL-2.0-only` | Sidecar quét tệp độc lập qua TCP `clamd` trên mạng `scanner` |
| **IIoT MQTT Broker** | `eclipse-mosquitto:2.0.21` | `EPL-2.0 OR BSD-3-Clause` | Broker MQTT thuần OSI thay thế EMQX; Dynamic Security (`$CONTROL/dynamic-security/v1`) & LWT |
| **IIoT Edge Flow** | `nodered/node-red:4.0.9` | `Apache-2.0` | Chuẩn hóa bản tin cảm biến, cầu nối LWT & downlink lệnh Digital Twin |
| **Context Broker** | `fiware/orion-ld:1.12.0` | `AGPL-3.0-only` | Quản lý ngữ cảnh NGSI-LD & subscription 2 chiều với `/api/dxosBroker:orionNotify` |
| **Orion-LD Store** | `mongo:8.0` | `SSPL-1.0` | Cơ sở dữ liệu nội bộ tách biệt dành riêng cho `orion-ld` |
| **Tích hợp ngoài** | `n8nio/n8n:2.48.1` | `Sustainable Use License` | **Container tích hợp tùy chọn độc lập bên ngoài** qua REST v1 (`dxosN8n`); không thuộc lõi LatticeFlow v2 |
| **Telemetry Collector** | `otel/opentelemetry-collector-contrib:0.123.0` | `Apache-2.0` | Thu nhận OTLP/HTTP JSON + W3C `traceparent` + OTel GenAI spans |
| **Metrics Store** | `prom/prometheus:v3.3.0` | `Apache-2.0` | Thu thập `/api/dxos:metrics` & đánh giá 5 rule cảnh báo trong `alerts.yml` |
| **Dashboard 360°** | `grafana/grafana-oss:11.5.8` | `AGPL-3.0-only` | Dịch vụ dashboard quan sát độc lập (profile `observability`) qua HTTP tới Prometheus |
| **PDF Renderer** | `gotenberg/gotenberg:8.20.1` | `MIT` | Dịch vụ kết xuất PDF tách biên container tùy chọn (profile `pdf`) |

---

## 3. Ranh giới Pure-OSI: Zero `BSL-1.1`, Zero `ThingsBoard`, Zero `EMQX`

Từ nhánh `v0.3.0` đến `v0.4.2`, nhóm **CTU-OpenPaw** thực thi chính sách **Pure-OSI Guarantee** nhằm bảo đảm quyền tự do sử dụng, sửa đổi và triển khai thương mại không vướng giới hạn của **Business Source License (`BSL-1.1`)**:

1. **Loại bỏ triệt để BSL-1.1 / ThingsBoard / EMQX / Redis non-OSI / TimescaleDB:**
   - **Thay EMQX & ThingsBoard** bằng **Eclipse Mosquitto `2.0.21`** (`EPL-2.0 OR BSD-3-Clause`) + **Node-RED `4.0.9`** (`Apache-2.0`) + **FIWARE Orion-LD `1.12.0`** + Digital Twin & WebGIS `Apache-2.0` do nhóm tự phát triển.
   - **Thay Redis** bằng **Valkey `8.1`** (`BSD-3-Clause` thuần OSI, tương thích giao thức `PUBSUB_ADAPTER=redis`).
   - **Không dùng container TimescaleDB (TSL):** Dữ liệu chuỗi thời gian IIoT ghi trực tiếp vào bảng PostgreSQL `16` (`latticeTelemetryPoints`), giúp `infra/compose/iiot.yml` tinh gọn và thuần OSI.
   - **Chặn cứng tự động trong CI:** Script `scripts/generate-sbom.mjs` từ chối build và báo lỗi ngay lập tức nếu bất kỳ dependency hoặc OCI image nào chứa từ khóa `BSL-1.1`, `thingsboard` hoặc `emqx`.

2. **Ranh giới Sạch giữa Kho Git (`Apache-2.0`) và Host Container (`NocoBase 2.2.50`):**
   - Kho mã nguồn Git `CTU-OpenPaw/lattice-dx` và gói nguồn phát hành `latticedx-0.4.2-src.tar.gz` **không chứa** thư mục `upstream/`, **không chứa** `.gitmodules`, và **không nhúng** mã nguồn NocoBase.
   - 7 plugin khai báo `"sdkProvidedByHost": true`, gọi SDK của host tại thời điểm chạy và bảo toàn tuyệt đối **Điều 5.2 NocoBase** (`Powered by NocoBase`, `v2.2.50`, `https://www.nocobase.com`, `License settings`).

3. **Ranh giới Tách biệt Dịch vụ Container Ngoài (`n8n`, `Grafana`, `Orion-LD`, `ClamAV`, `MongoDB`):**
   - Các dịch vụ có giấy phép copyleft mạnh (`AGPL-3.0-only`, `GPL-2.0-only`), `SSPL-1.0` hoặc `Sustainable Use License` (như **Stock `n8n` `2.48.1`**) chỉ chạy trong container OCI độc lập bên ngoài, giao tiếp với LatticeDX qua giao thức mạng chuẩn (HTTP/REST, NGSI-LD, TCP `clamd`) và **không bao giờ** bị copy, đóng gói tĩnh hoặc liên kết vào mã nguồn `Apache-2.0` của LatticeDX.
   - Lõi tự động hóa gốc của LatticeDX là **LatticeFlow v2** (`Apache-2.0`), hoạt động hoàn toàn độc lập ngay cả khi không bật container `n8n`.

---

## 4. Kiểm chứng Chuỗi cung ứng OSS (`257/257` SBOM & PoF Gates)

Toàn bộ kho mã nguồn `v0.4.2` được kiểm chứng tự động trước mỗi lần hợp nhất PR vào `main`:

- **Kiểm tra header bản quyền & SPDX (`1,098` tệp):**
  ```sh
  node scripts/source-headers.mjs --check
  ```
- **Kiểm toán 6 tiêu chí PoF (`spdx-headers`, `governance-files`, `plugin-isolation`, `compose-digests`, `upstream-clean`, `no-secrets`):**
  ```sh
  pnpm pof:check
  ```
- **Đối chiếu CycloneDX 1.5 SBOM (`257` thành phần: `workspace=12, npm=226, oci=19`, `0` `NONE`, `0` `BSL-1.1`):**
  ```sh
  pnpm release:sbom -- --check
  ```
- **Kiểm kê giấy phép npm (`153` nhóm package: `MIT` 115, `ISC` 21, `BSD-3-Clause` 8, `Apache-2.0` 4, `BSD-2-Clause` 2, `MPL-2.0` 2, `(MIT OR Apache-2.0)` 1) & kiểm tra lỗ hổng bảo mật (`0` CVEs):**
  ```sh
  pnpm licenses list --json
  pnpm audit --prod --audit-level=low
  ```
