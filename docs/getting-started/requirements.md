# Yêu cầu Hệ thống (Requirements — `v0.4.2`)

Trang này tổng hợp đầy đủ yêu cầu về chuỗi công cụ phần mềm (100% phần mềm nguồn mở chuẩn OSI), cổng mạng mặc định và tài nguyên phần cứng khuyến nghị để biên dịch từ mã nguồn, chạy phòng lab cục bộ hoặc triển khai **LatticeDX `v0.4.2`** ở môi trường production.

---

## 1. Chuỗi công cụ Phần mềm (100% OSS Toolchain)

LatticeDX không yêu cầu bất kỳ trình biên dịch hay SDK độc quyền nào. Toàn bộ mã nguồn (`apps/`, `packages/`, `plugins/nocobase/`, `solutions/`, `scripts/`) được kiểm chứng với phiên bản chính xác như sau:

| Thành phần | Phiên bản yêu cầu / kiểm chứng | Vai trò | Ghi chú nền tảng |
| --- | --- | --- | --- |
| **Node.js** | `24.x` (`>=24 <25`) | Runtime cho `@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`, script build/kiểm toán PoF và 7 plugin | Kèm sẵn `npm` để khôi phục lockfile cho `plugin-enterprise-auth` |
| **pnpm** | `10.23.0` (`packageManager` trong `package.json`) | Quản lý monorepo workspace và khóa phụ thuộc `pnpm-lock.yaml` | Hỗ trợ cài đặt `--frozen-lockfile` và `--offline` |
| **Git** & **tar** | Git 2.x+ và GNU/BSD `tar` | Clone kho mã hoặc giải nén gói phát hành nguồn `latticedx-0.4.2-src.tar.gz` | `pnpm native:clean` dùng `git archive` để xuất `HEAD` sạch |
| **Docker Engine & Compose** | Docker Engine + Docker Compose `v2+` | Chạy host OCI `nocobase/nocobase:2.2.50` và các dịch vụ hạ tầng (`infra/compose/*.yml`) | Trên Windows dùng **Docker Desktop** với context `desktop-linux` |

::: info Kho mã nguồn 100% thuần chuẩn OSI
Khi clone từ `https://github.com/CTU-OpenPaw/lattice-dx.git` hoặc giải nén từ `latticedx-0.4.2-src.tar.gz`, bạn **không cần** chạy `git submodule`. Kho mã nguồn không chứa `upstream/nocobase` hay `.gitmodules`; runtime host `nocobase/nocobase:2.2.50` được nạp độc lập dưới dạng OCI container khi khởi chạy stack. Xem thêm tại [Chính sách Pure-OSI](/oss/pure-osi-policy) và [SBOM & Build từ Mã nguồn](/oss/sbom-and-build-from-source).
:::

---

## 2. Yêu cầu Tài nguyên Phần cứng (RAM, CPU & Lưu trữ)

Nhu cầu phần cứng phụ thuộc vào cấu hình triển khai bạn lựa chọn. Các con số dưới đây được đối chiếu trực tiếp từ `mem_limit` và `cpus` khai báo trong `infra/compose/native-rehearsal.yml` và `infra/compose/prod.yml`.

| Chế độ triển khai | Thành phần khởi chạy | Tổng giới hạn container (`mem_limit` / `cpus`) | Khuyến nghị máy host tối thiểu | Ổ cứng SSD trống |
| --- | --- | --- | --- | --- |
| **Build & Test Offline (không Docker)** | `pnpm install`, `pnpm check` (`typecheck`, `vitest`, `build`), `node --test`, `pof:check` | — | **4 vCPU**, **8 GB RAM** | **10 GB** |
| **Local Clean-Lab (`pnpm native:clean`)** | `nocobase-db` (`512m`) + `nocobase` (`1536m`) | `2,048 MiB` (~2 GiB RAM) | **4 vCPU**, **8 GB RAM** | **20 GB** |
| **Local Full Stack (`local:up --integration`)** | `core.yml` + `nocobase.yml` + `integration.yml` (Keycloak, Postgres, Valkey, NocoBase, Orion-LD, MongoDB, n8n, API) | ~`5.5 GiB` container limits | **6–8 vCPU**, **16 GB RAM** | **30 GB** |
| **Production Core (`prod.yml` mặc định)** | 12 dịch vụ lõi Zero-Trust (`caddy`, `postgres`, `nocobase-db`, `redis`, `rustfs`, `keycloak`, `clamav`, `file-scanner`, `gateway`, `orion-mongo`, `orion-ld`, `nocobase`) | `13,696 MiB` (~13.4 GiB), `13.5` vCPU | **8–12 vCPU**, **16 GB RAM** | **60 GB+ NVMe** (tính cả PITR WAL & ClamAV DB) |
| **Production Full Profiles** | Lõi + `--profile n8n` + `--profile observability` + `--profile pdf` + `--profile iiot` (thêm `n8n`, `otel-collector`, `prometheus`, `grafana`, `gotenberg`, `mosquitto`, `nodered`) | `17,792 MiB` (~17.4 GiB), `18.0` vCPU | **16 vCPU**, **24–32 GB RAM** | **100 GB+ NVMe** |

::: tip Lưu ý về ClamAV & Bộ nhớ trên Windows
Trong `infra/compose/prod.yml`, container `clamav` (`clamav/clamav:1.5.5`) được cấp `mem_limit: 2048m` và `start_period: 120s` để nạp cơ sở dữ liệu chữ ký mã độc. Nếu chạy toàn bộ stack trên Windows qua WSL2 / Docker Desktop, hãy đảm bảo cấp đủ bộ nhớ trong `.wslconfig` để tránh OOM khi vừa chạy `apps/api` build vừa khởi động container.
:::

---

## 3. Bảng Cổng Mạng Mặc định (Default Ports)

Các cấu hình cục bộ luôn ràng buộc về **`127.0.0.1` (loopback)** để không phơi bày dịch vụ thử nghiệm ra mạng ngoài. Trong môi trường production (`infra/compose/prod.yml`), duy nhất `caddy` mở cổng công khai; toàn bộ cơ sở dữ liệu, Valkey, RustFS, ClamAV và broker nằm trên các Docker network nội bộ (`internal: true`).

### 3.1. Cổng trên Môi trường Cục bộ / Clean-Lab

| Cổng (`127.0.0.1`) | Dịch vụ / Lệnh | Tệp Compose / Script | Mục đích |
| --- | --- | --- | --- |
| `13004–13999` (mặc định `13004`, khuyến nghị E2E: `13014`) | `nocobase` (Clean-Lab) | `scripts/native-clean-install.mjs` | Cổng cô lập sinh ngẫu nhiên `overlay.yml` cho từng lần `pnpm native:clean` |
| `13000` | `nocobase` | `infra/compose/nocobase.yml` | Giao diện NocoBase + 7 plugin LatticeDX `0.4.2` |
| `13001` | `nocobase` (Rehearsal) | `infra/compose/native-rehearsal.yml` | Phiên bản rehearsal nâng cấp cục bộ |
| `4000` | `@dx/api` | `.env.example` (`API_PORT`) | Companion Fastify REST API (`/v1/*`) |
| `4001` | `@dx/agent-worker` | `.env.example` (`WORKER_PORT`) | Worker xử lý tác vụ nền (`WORKER_URL`) |
| `8080` | `gateway` (APISIX `3.19.0`) | `infra/compose/core.yml` | API Gateway cục bộ định tuyến về `api` |
| `8081` | `keycloak` (`26.8.2`) | `infra/compose/core.yml` | Identity Provider OIDC/PKCE cục bộ |
| `1026` | `orion-ld` (`1.12.0`) | `infra/compose/integration.yml` | FIWARE NGSI-LD Context Broker |
| `5678` | `n8n` (`2.48.1`) | `infra/compose/integration.yml` | Stock `n8n` workflow engine |
| `1880` | `nodered` (`4.0.9`) | `infra/compose/iiot.yml` | Node-RED IIoT flow & Digital Twin downlink |
| `1883` *(nội bộ)* | `mosquitto` (`2.0.21`) | `infra/compose/iiot.yml` | Chỉ `expose` trên `iiot-net`, không mở ra host |

### 3.2. Cổng trên Môi trường Production (`infra/compose/prod.yml`)

| Cổng | Dịch vụ | Giao thức | Mô tả |
| --- | --- | --- | --- |
| `80` | `caddy` (`2.10-alpine`) | TCP | HTTP chuyển hướng sang HTTPS / ACME challenge |
| `443` | `caddy` (`2.10-alpine`) | TCP & UDP | HTTPS (TLS + HTTP/3 QUIC) cho `LATTICE_DOMAIN`, `KEYCLOAK_DOMAIN`, `N8N_DOMAIN` |
| Toàn bộ cổng khác (`5432`, `6379`, `9000`, `1026`, `1883`, `1880`, `3000`, `9090`, `4010`, `3310`) | Các service nội bộ | Nội bộ Docker | **Không publish ra host**; chỉ giao tiếp qua mạng cô lập `app`, `data`, `scanner`, `iiot-net` |

---

## 4. Các bước tiếp theo

- Nếu bạn muốn dựng nhanh môi trường hoàn chỉnh để trải nghiệm hoặc kiểm thử trên máy cá nhân, xem [Cài đặt Nhanh 1 Lệnh](/getting-started/quick-start).
- Nếu bạn chuẩn bị triển khai lên máy chủ thật, xem [Triển khai Production Zero-Trust](/getting-started/production-deployment) và [Hướng dẫn Cấu hình Biến môi trường](/getting-started/configuration).
