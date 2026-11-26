---
title: Hồ sơ cài đặt và Compose
description: Danh mục 8 cấu hình Docker Compose, 5 profile sản xuất trong prod.yml, phân vùng 5 mạng nội bộ, 18 volume bền vững và định cỡ phần cứng LatticeDX 0.4.2.
---

# Hồ sơ cài đặt và Compose

LatticeDX (`0.4.2`) tổ chức hạ tầng container dưới thư mục `infra/compose/*.yml` thành từng khối mô-đun có thể ghép lớp theo môi trường phát triển cục bộ, diễn tập nâng cấp hoặc triển khai sản xuất Zero-Trust. Toàn bộ image container đều ghim cố định bằng digest `@sha256` bất biến và thiết lập `security_opt: [no-new-privileges:true]`.

## Danh mục 8 tệp Docker Compose

| Tệp cấu hình | Tên project (`name`) | Thành phần dịch vụ | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `infra/compose/core.yml` | `lattice-dx` | `postgres`, `keycloak`, `api`, `gateway`, `clamav` | Cụm API Fastify cục bộ, Keycloak OIDC dev và Apache APISIX trên `127.0.0.1:8080`. |
| `infra/compose/nocobase.yml` | `lattice-dx` | `nocobase-db`, `redis`, `nocobase` | Host `nocobase/nocobase:2.2.50` gắn 7 plugin `:ro`, `pgvector 0.8.1` và `Valkey 8.1` trên `127.0.0.1:13000`. |
| `infra/compose/iiot.yml` | `lattice-dx` | `mosquitto`, `nodered` | Lớp biên IIoT cô lập mạng `iiot-net` (`Eclipse Mosquitto 2.0.21` DynSec + `Node-RED 4.0.9`). |
| `infra/compose/integration.yml` | `lattice-dx` | `orion-mongo`, `orion-ld`, `n8n` | Broker ngữ cảnh NGSI-LD `FIWARE Orion-LD 1.12.0` và bộ điều phối `n8n 2.48.1`. |
| `infra/compose/native-files.yml` | *(overlay)* | Overlay env cho `api` và `nocobase` | Kích hoạt quét tệp đính kèm qua `api:4000` và `clamav` khi chạy chung `core.yml + nocobase.yml`. |
| `infra/compose/native-rehearsal.yml` | `lattice-native-rehearsal` | `nocobase-db`, `nocobase` | Diễn tập nâng cấp và chạy lab sạch `pnpm native:clean` trên `127.0.0.1:13001` (hoặc `13004..13999`). |
| `infra/compose/uc1-sample.yml` | *(overlay)* | `uc1-sample`, `uc1-broker-worker` | Dịch vụ mẫu tích hợp ứng dụng ngoài qua cổng `127.0.0.1:4100`. |
| `infra/compose/prod.yml` | `lattice-dx-prod` | `12` dịch vụ mặc định + `8` dịch vụ theo `5` profile | Cụm sản xuất Zero-Trust hoàn chỉnh với `Caddy 2.10`, `RustFS 1.0.6`, PITR WAL và `cap_drop: [ALL]`. |

## Năm profile tùy chọn trong `infra/compose/prod.yml`

Cụm sản xuất `prod.yml` khởi chạy `12` dịch vụ nền tảng mặc định và tách các phân hệ mở rộng thành `5` Compose profile độc lập:

<ParamGrid
  title="Các Compose profile trong infra/compose/prod.yml"
  :items="[
    { name: 'iam-sync', type: 'oneshot', default: 'keycloak-config-cli', description: 'Đồng bộ cấu hình realm Keycloak sản xuất (lattice-realm.prod.json) rồi thoát với mã 0 (restart: no).' },
    { name: 'n8n', type: 'service', default: 'n8n (2.48.1)', description: 'Bật máy chủ workflow n8n nối cơ sở dữ liệu n8n_app trên PostgreSQL 16 và định tuyến qua Caddy N8N_DOMAIN.' },
    { name: 'observability', type: '3 services', default: 'otel-collector, prometheus, grafana', description: 'Thu thập OTLP gRPC/HTTP (:4317/:4318), scrape Prometheus v3.3.0 (lưu 15 ngày) và bảng điều khiển Grafana 11.5.8.' },
    { name: 'pdf', type: 'service', default: 'gotenberg (8.20.1)', description: 'Xuất chứng từ PDF Unicode từ HTML với --chromium-disable-javascript=true trên hệ thống tệp read_only.' },
    { name: 'iiot', type: '2 services', default: 'mosquitto, nodered', description: 'Khởi chạy MQTT broker Dynamic Security trên mạng iiot-net và Node-RED mã hóa AES-256-CTR flows_cred.json.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'Sản xuất cốt lõi (12 dịch vụ)',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml up -d'
    },
    {
      label: 'Đồng bộ Realm Keycloak lần đầu',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml --profile iam-sync run --rm keycloak-config-cli'
    },
    {
      label: 'Cốt lõi + Giám sát & Xuất PDF',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile observability --profile pdf up -d'
    },
    {
      label: 'Đầy đủ doanh nghiệp (Tất cả profile)',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile n8n --profile observability --profile pdf --profile iiot up -d'
    }
  ]"
/>

## Chi tiết 12 dịch vụ mặc định và 8 dịch vụ theo profile (`prod.yml`)

Bảng dưới đây ghi nhận đầy đủ image đã ghim phiên bản, giới hạn RAM/CPU và cơ chế kiểm tra sức khỏe của từng dịch vụ trong `infra/compose/prod.yml`:

| Dịch vụ | Profile | Image gốc | RAM / CPU | Mạng | Cơ chế healthcheck |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `caddy` | *(mặc định)* | `caddy:2.10-alpine` | `256m` / `0.5` | `edge`, `app` | `http://127.0.0.1:2019/metrics` |
| `postgres` | *(mặc định)* | `postgres:16.16-alpine` | `1536m` / `1.5` | `data` | `pg_isready -U "$POSTGRES_USER" -d postgres` |
| `nocobase-db` | *(mặc định)* | `pgvector/pgvector:0.8.1-pg16` | `2048m` / `2.0` | `data` | `pg_isready -U "$POSTGRES_USER" -d nocobase` |
| `redis` | *(mặc định)* | `valkey/valkey:8.1-alpine` | `640m` / `0.5` | `app`, `data` | `valkey-cli ping \| grep -q PONG` |
| `rustfs` | *(mặc định)* | `rustfs/rustfs:1.0.6` | `1024m` / `1.0` | `data` | TCP `127.0.0.1:9000` |
| `keycloak` | *(mặc định)* | `quay.io/keycloak/keycloak:26.8.2` | `1536m` / `1.5` | `edge`, `app`, `data` | `/health/ready` trên cổng `9000` |
| `clamav` | *(mặc định)* | `clamav/clamav:1.5.5` | `2048m` / `1.0` | `scanner` | `clamdcheck.sh` |
| `file-scanner` | *(mặc định)* | `apps/file-scanner/Dockerfile` | `256m` / `0.5` | `app`, `data`, `scanner` | `http://127.0.0.1:4010/health` |
| `gateway` | *(mặc định)* | `apache/apisix:3.19.0-debian` | `512m` / `1.0` | `edge`, `app` | `http://127.0.0.1:9080/health` |
| `orion-mongo` | *(mặc định)* | `mongo:8.0` | `1024m` / `1.0` | `data` | `mongosh` ping có SCRAM auth |
| `orion-ld` | *(mặc định)* | `fiware/orion-ld:1.12.0` | `768m` / `1.0` | `app`, `data` | `http://127.0.0.1:1026/version` |
| `nocobase` | *(mặc định)* | `nocobase/nocobase:2.2.50` | `2048m` / `2.0` | `edge`, `app`, `data`, `iiot-net` | `http://127.0.0.1/api/app:getLang` |
| `keycloak-config-cli` | `iam-sync` | `adorsys/keycloak-config-cli:6.5.1-26` | `512m` | `app` | Tác vụ oneshot (`restart: "no"`) |
| `n8n` | `n8n` | `n8nio/n8n:2.48.1` | `1024m` / `1.0` | `app`, `data` | `http://127.0.0.1:5678/healthz` |
| `otel-collector` | `observability` | `otel/opentelemetry-collector-contrib:0.123.0` | `512m` / `0.5` | `app`, `data` | `/otelcol-contrib validate` |
| `prometheus` | `observability` | `prom/prometheus:v3.3.0` | `512m` / `0.5` | `app`, `data` | `http://127.0.0.1:9090/-/healthy` |
| `grafana` | `observability` | `grafana/grafana-oss:11.5.8` | `512m` / `0.5` | `app`, `data` | `http://127.0.0.1:3000/api/health` |
| `gotenberg` | `pdf` | `gotenberg/gotenberg:8.20.1` | `768m` / `1.0` | `app` | `http://127.0.0.1:3000/health` |
| `mosquitto` | `iiot` | `eclipse-mosquitto:2.0.21` | `256m` / `0.5` | `iiot-net` | `nc -z 127.0.0.1 1883` |
| `nodered` | `iiot` | `nodered/node-red:4.0.9` | `512m` / `0.5` | `iiot-net`, `app` | `http://127.0.0.1:1880/` |

## Phân vùng 5 mạng trong cụm sản xuất

Tệp `prod.yml` định nghĩa `5` mạng bridge riêng biệt, trong đó `4` mạng được gắn cờ `internal: true` để chặn mọi lưu lượng ra vào Internet trực tiếp từ tầng ứng dụng, dữ liệu và thiết bị biên:

| Tên mạng | Cờ cô lập | Dịch vụ tham gia | Mục đích phân tách |
| :--- | :--- | :--- | :--- |
| `edge` | Bridge công khai | `caddy`, `keycloak`, `gateway`, `nocobase` | Tiếp nhận TLS `80/443` tại Caddy và định tuyến HTTP tới gateway hoặc host. |
| `app` | `internal: true` | `caddy`, `redis`, `keycloak`, `keycloak-config-cli`, `file-scanner`, `gateway`, `orion-ld`, `nocobase`, `n8n`, `otel-collector`, `prometheus`, `grafana`, `gotenberg`, `nodered` | Giao tiếp HTTP/OTLP nội bộ giữa gateway, host, bộ quét tệp, Orion-LD và giám sát. |
| `data` | `internal: true` | `postgres`, `nocobase-db`, `redis`, `rustfs`, `keycloak`, `file-scanner`, `orion-mongo`, `orion-ld`, `nocobase`, `n8n`, `otel-collector`, `prometheus`, `grafana` | Cô lập cơ sở dữ liệu PostgreSQL 16, Valkey 8.1, RustFS S3 và MongoDB khỏi `edge`. |
| `scanner` | `internal: true` | `clamav`, `file-scanner` | Cô lập daemon `clamd` (`:3310`); chỉ `@dx/file-scanner` được quyền gửi luồng quét virus. |
| `iiot-net` | `internal: true` | `nocobase`, `mosquitto`, `nodered` | Cô lập broker MQTT `:1883` khỏi các container khác; `mosquitto` không mở cổng ra host. |

## Hạn mức tài nguyên và định cỡ phần cứng

Bảng định cỡ dưới đây tính trực tiếp từ thông số `mem_limit` và `cpus` khai báo trong từng tệp Compose:

| Cấp độ triển khai | Cấu hình áp dụng | Tổng giới hạn container | Khuyến nghị máy chủ (CPU / RAM / Đĩa) |
| :--- | :--- | :--- | :--- |
| **Lab cô lập một lệnh** | `native-rehearsal.yml` (`nocobase-db` + `nocobase`) | `2.0 GB` RAM | `2–4` vCPU, `4–8 GB` RAM, `10 GB` trống |
| **Cụm phát triển cục bộ** | `core.yml` + `nocobase.yml` | `6.66 GB` RAM | `4–6` vCPU, `12–16 GB` RAM, `25 GB` SSD |
| **Phát triển kèm Integration & IIoT** | `core.yml` + `nocobase.yml` + `integration.yml` + `iiot.yml` | `9.22 GB` RAM | `6–8` vCPU, `16 GB` RAM, `35 GB` SSD |
| **Sản xuất cốt lõi (Mặc định)** | `prod.yml` (`12` dịch vụ mặc định) | `13.4 GB` RAM / `12.5+` CPU | `8–16` vCPU, `16–24 GB` RAM, `60+ GB` NVMe |
| **Sản xuất đầy đủ (Mọi profile)** | `prod.yml` + `n8n`, `observability`, `pdf`, `iiot` | `17.3 GB` RAM / `16+` CPU | `12–16+` vCPU, `24–32+ GB` RAM, `100+ GB` NVMe |

Lưu ý vận hành đối với `clamav/clamav:1.5.5`: daemon quét mã độc nạp toàn bộ cơ sở dữ liệu chữ ký vào bộ nhớ khi khởi động (`start_period: 120s`, `mem_limit: 1536m` ở `core.yml` và `2048m` ở `prod.yml`). Trên máy trạm có dưới `8 GB` RAM khả dụng cho Docker, sử dụng `pnpm native:clean` (`native-rehearsal.yml`) thay vì khởi động đồng thời `core.yml` và `nocobase.yml`.

## Danh mục 18 volume lưu trữ bền vững (`prod.yml`)

| Nhóm phân hệ | Tên volume | Dữ liệu lưu giữ |
| :--- | :--- | :--- |
| **Biên mạng** | `caddy-data`, `caddy-config` | Chứng chỉ TLS ACME và trạng thái cấu hình Caddy. |
| **PostgreSQL Core & PITR** | `postgres-data`, `postgres-wal-archive` | Dữ liệu `lattice`, `keycloak`, `n8n` và phân đoạn WAL `.gz` phục vụ PITR (`7` ngày mặc định). |
| **NocoBase DB & Storage** | `nocobase-db-data`, `nocobase-wal-archive`, `nocobase-storage` | Cơ sở dữ liệu `pgvector`, WAL archive của NocoBase và tệp tải lên nội bộ. |
| **Cache & Object Storage** | `redis-data`, `rustfs-data`, `engine-objects` | Nhật ký AOF của Valkey 8.1, bucket S3 trên RustFS và đối tượng tệp tạm của `file-scanner`. |
| **Quét mã độc & NGSI-LD** | `clamav-signatures`, `orion-mongo-data` | Chữ ký ClamAV cập nhật và cơ sở dữ liệu thực thể MongoDB 8.0 của Orion-LD. |
| **Mở rộng theo profile** | `n8n-data`, `prometheus-data`, `grafana-data`, `mosquitto-data`, `mosquitto-log`, `nodered-data` | Workflow/credential `n8n`, chuỗi thời gian Prometheus (giữ `15` ngày), dashboard Grafana, DB DynSec của Mosquitto và dòng chảy Node-RED. |

## Ma trận cổng mạng và lệnh kiểm tra Compose

Trong chế độ phát triển cục bộ, chỉ các cổng sau được ánh xạ vào `127.0.0.1` (`postgres`, `nocobase-db`, `redis`, `clamav`, `orion-mongo`, `mosquitto` hoàn toàn không mở cổng ra host):

| Cổng | Phạm vi cục bộ (`*.yml`) | Phạm vi sản xuất (`prod.yml`) | Dịch vụ đích |
| :--- | :--- | :--- | :--- |
| `80`, `443` (TCP/UDP) | Không dùng | Công khai trên `edge` | `caddy` (chuyển tiếp `LATTICE_DOMAIN`, `KEYCLOAK_DOMAIN`, `N8N_DOMAIN`) |
| `13000` / `13001` | `127.0.0.1` | Nội bộ cổng `80` qua Caddy/APISIX | `nocobase` (`nocobase.yml` / `native-rehearsal.yml`) |
| `13004`–`13999` | `127.0.0.1` | Không dùng | `nocobase` do `pnpm native:clean` cấp phát |
| `8080` | `127.0.0.1` | Nội bộ `:9080` trên `edge`/`app` | `gateway` (Apache APISIX 3.19.0) |
| `8081` | `127.0.0.1` | Qua Caddy `KEYCLOAK_DOMAIN` | `keycloak` (Keycloak 26.8.2) |
| `1026` | `127.0.0.1` (`integration.yml`) | Nội bộ `:1026` trên `app`/`data` | `orion-ld` (FIWARE Orion-LD 1.12.0) |
| `5678` | `127.0.0.1` (`integration.yml`) | Qua Caddy `N8N_DOMAIN` (`--profile n8n`) | `n8n` (n8n 2.48.1) |
| `1880` | `127.0.0.1` (`iiot.yml`) | Nội bộ `:1880` (`--profile iiot`) | `nodered` (Node-RED 4.0.9) |
| `1883` | Nội bộ `iiot-net` | Nội bộ `iiot-net` (`--profile iiot`) | `mosquitto` (Eclipse Mosquitto 2.0.21) |

Kiểm tra tính hợp lệ của tệp cấu hình Compose hoặc dọn dẹp theo profile trước khi bảo trì:

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra cú pháp Compose',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile n8n --profile observability --profile pdf --profile iiot config --quiet'
    },
    {
      label: 'Xem trạng thái healthcheck',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml ps'
    },
    {
      label: 'Dừng toàn bộ profile (Giữ volume)',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml \\\n  --profile n8n --profile observability --profile pdf --profile iiot down'
    }
  ]"
/>

## Tài liệu liên quan

- [Cài đặt nhanh](/getting-started/quickstart) — Khởi chạy lab cô lập `pnpm native:clean` hoặc cụm phát triển `pnpm local:up`.
- [Cấu hình biến môi trường](/getting-started/configuration) — Chi tiết các biến bắt buộc cho từng profile trong `prod.yml`.
- [Triển khai sản xuất Zero-Trust](/getting-started/production-deployment) — Quy trình khởi tạo vai trò `nocobase_app`, khóa bí mật và chứng chỉ TLS.
- [Sao lưu và khôi phục PITR](/operations/backup-and-pitr) — Quy trình sao lưu volume và phục hồi theo mốc thời gian cho PostgreSQL 16.
