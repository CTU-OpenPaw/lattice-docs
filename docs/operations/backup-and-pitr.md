---
title: Sao lưu và Khôi phục Thời điểm (PITR)
description: Quy trình sao lưu cơ sở dữ liệu PostgreSQL 16, lưu trữ WAL nén .gz và khôi phục theo thời điểm trên LatticeDX.
---

# Sao lưu và Khôi phục Thời điểm (PITR)

Hệ thống dữ liệu của LatticeDX vận hành trên hai cụm PostgreSQL 16 độc lập (`postgres` cho lõi API, Keycloak, n8n và `nocobase-db` dùng `pgvector/pgvector:0.8.1-pg16`), kết hợp kho tệp S3 RustFS và MongoDB cho Orion-LD. Để đáp ứng mục tiêu RPO thấp và kiểm chứng tính toàn vẹn dữ liệu trước sự cố, nền tảng cung cấp cả lớp lưu trữ Write-Ahead Log (WAL) cho Point-in-Time Recovery (PITR) lẫn bộ công cụ sao lưu và diễn tập khôi phục tự động.

## Kiến trúc lưu trữ WAL và PITR trên PostgreSQL 16

Trong `infra/compose/prod.yml`, cả dịch vụ `postgres` và `nocobase-db` đều nạp tệp cấu hình `infra/config/postgres/pitr.conf` và gắn tập lệnh lưu trữ `infra/config/postgres/pitr-archive.sh` cùng volume riêng biệt (`postgres-wal-archive` và `nocobase-wal-archive`).

<ParamGrid
  title="Thông số PITR và Lưu trữ WAL (infra/config/postgres/pitr.conf)"
  :items="[
    { name: 'wal_level', type: 'string', default: 'replica', description: 'Ghi đủ thông tin WAL phục vụ lưu trữ liên tục và khôi phục PITR.' },
    { name: 'archive_mode', type: 'string', default: 'on', description: 'Bật tiến trình archiver gọi lệnh archive_command sau mỗi phân đoạn WAL.' },
    { name: 'PG_ARCHIVE_COMMAND', type: 'string', default: '/bin/sh /etc/postgresql/pitr-archive.sh %p %f', description: 'Lệnh lưu trữ WAL; có thể thay bằng wal-g hoặc pgbackrest.' },
    { name: 'archive_timeout', type: 'integer', default: '300', description: 'Ép chuyển phân đoạn WAL tối đa mỗi 300 giây ngay cả khi lưu lượng ghi thấp.' },
    { name: 'wal_compression', type: 'string', default: 'on', description: 'Nén bản ghi full-page write trong WAL để giảm dung lượng I/O.' },
    { name: 'wal_keep_size', type: 'string', default: '512MB', description: 'Giữ tối thiểu 512 MB WAL cục bộ trên pg_wal.' },
    { name: 'PITR_WAL_DIR', type: 'string', default: '/var/lib/postgresql/wal-archive', description: 'Thư mục đích chứa các tệp WAL nén <wal>.gz với quyền 0700.' },
    { name: 'PITR_WAL_RETENTION_DAYS', type: 'integer', default: '7', description: 'Số ngày lưu giữ tệp .gz tại chỗ trước khi pitr-archive.sh tự động dọn dẹp.' },
    { name: 'WALG_S3_PREFIX', type: 'string', description: 'Đường dẫn S3 (ví dụ s3://bucket/pitr) để pitr-archive.sh đẩy WAL qua wal-g wal-push.' }
  ]"
/>

### Cơ chế an toàn của `pitr-archive.sh`

Tập lệnh `/etc/postgresql/pitr-archive.sh` kiểm tra chặt chẽ tên phân đoạn WAL (chặn ký tự `/`, `\`, `..`, tiền tố `-`), sử dụng `umask 077` và ghi qua tệp tạm `${dest}.tmp.$$` trước khi `mv` nguyên tử sang `<wal_name>.gz`. Nếu tệp đích đã tồn tại, tập lệnh giải nén kiểm tra bằng `gzip -t` và so sánh byte-for-byte với nguồn qua `cmp -s`; khi trùng khớp sẽ trả về mã `0` (idempotent), còn nếu khác nội dung sẽ trả lỗi để PostgreSQL không xóa phân đoạn gốc.

Khi biến `WALG_S3_PREFIX` được thiết lập và công cụ `wal-g` có mặt trong PATH, `pitr-archive.sh` chuyển thẳng luồng thực thi sang `wal-g wal-push "$wal_path"`. Với môi trường sử dụng `pgBackRest`, có thể ghi đè `PG_ARCHIVE_COMMAND="pgbackrest --stanza=latticedx archive-push %p"` mà không cần sửa cấu trúc container.

## Bộ công cụ sao lưu và diễn tập theo từng phạm vi

Bên cạnh WAL liên tục, thư mục `scripts/` cung cấp bốn kịch bản Node.js kiểm tra tính toàn vẹn SHA-256, xác thực cấu trúc archive và diễn tập khôi phục trên cơ sở dữ liệu hoặc container tách biệt.

| Lệnh `package.json` | Tập lệnh nguồn | Phạm vi sao lưu | Cơ chế diễn tập (`rehearse`) |
| :--- | :--- | :--- | :--- |
| `pnpm backup:core` | `scripts/backup-core.mjs` | Cơ sở dữ liệu `lattice` (`pg_dump --format=custom`) | Khôi phục vào `dx_restore_*`, kiểm đếm bảng cốt lõi (`records`, `foundation_tasks`, `enterprise_entities`, `workflow_runs`). |
| `pnpm backup:full` | `scripts/full-backup-core.mjs` | CSDL `lattice` + tệp đính kèm `foundation_files` | Xác minh SHA-256 từng object trong `objects/` và kiểm thử tải tệp qua API nội bộ. |
| `pnpm backup:native` | `scripts/native-database-recovery.mjs` | Cơ sở dữ liệu `nocobase` (`pg_dump --format=custom`) | Kiểm tra 16 bảng bắt buộc, đối chiếu MD5 fingerprint từng bảng trong `dx_restore_*`. |
| `pnpm backup:stack` | `scripts/stack-recovery.mjs` | Toàn bộ 7 thành phần của hệ thống | Hỗ trợ `--ephemeral` dựng container Postgres tạm và kiểm tra `verifyWalArchiveReadiness`. |

<CodeTabs
  :tabs="[
    {
      label: 'Sao lưu toàn stack',
      lang: 'bash',
      code: 'pnpm backup:stack\n# Tùy chọn chỉ sao lưu một số thành phần\nnode scripts/stack-recovery.mjs backup --components=nocobase-db,keycloak,lattice-db'
    },
    {
      label: 'Diễn tập trên Container tạm',
      lang: 'bash',
      code: 'node scripts/stack-recovery.mjs rehearse output/backups/stack/stack-<bundle_id> --ephemeral'
    },
    {
      label: 'Sao lưu NocoBase DB',
      lang: 'bash',
      code: 'pnpm backup:native\nnode scripts/native-database-recovery.mjs rehearse output/backups/native/core-<id>.dump'
    }
  ]"
/>

### Cấu trúc gói sao lưu Stack và Thành phần được bảo vệ

Bảy thành phần được `scripts/stack-recovery.mjs` đóng gói vào thư mục `output/backups/stack/stack-<32hex>/` gồm:

| Thành phần | Định dạng tệp trong gói | Cơ chế kiểm tra toàn vẹn |
| :--- | :--- | :--- |
| `nocobase-db` | `nocobase/core-<id>.dump` | Kiểm tra header `PGDMP`, SHA-256, 16 bảng bắt buộc và MD5 row fingerprint. |
| `uploads` | `uploads.tar.gz` | Kiểm tra header Gzip, liệt kê danh mục tar chống path traversal và giải nén thử vào thư mục tạm. |
| `keycloak` | `keycloak.dump` + `keycloak-realm.json` | Kiểm tra `PGDMP` và xác thực JSON hợp lệ của tệp cấu hình realm. |
| `orion-mongo` | `orion-mongo.archive.gz` | Kiểm tra header Gzip và chạy `mongorestore --archive --gzip --dryRun`. |
| `n8n` | `n8n-workflows.json` + `n8n-credentials.json` | Kiểm đếm số lượng workflow và credentials khớp với `manifest.json`. |
| `lattice-db` | `lattice.dump` | Kiểm tra `PGDMP`, khôi phục thử vào `dx_restore_*` và xác nhận các bảng lõi. |
| `engine-objects` | `engine-objects.tar.gz` | Kiểm tra tar gzip của `FILE_STORAGE_ROOT` và đếm số lượng object entry. |

Kịch bản từ chối mọi đường dẫn symlink để tránh ghi đè ngoài vùng lưu trữ cho phép, đồng thời kiểm tra sự hiện diện của các biến môi trường khóa (`APP_KEY`, `ENCRYPTION_FIELD_KEY`, `DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `AGENT_API_KEY`) vào mục `envPresence` trong `manifest.json` mà không lưu giá trị bí mật ra đĩa.

### Khôi phục Stack có xác nhận an toàn

Thao tác ghi đè dữ liệu thật qua `stack-recovery.mjs restore` áp dụng cơ chế khóa an toàn hai lớp: bắt buộc truyền đúng mã thư mục qua `--confirm-restore=<bundle-id>` và hỗ trợ cờ `--dry-run` để kiểm định chữ ký SHA-256 cùng cấu trúc tệp trước khi tác động đến container đích.

```bash
# Kiểm tra toàn vẹn trước khi khôi phục (không ghi dữ liệu)
node scripts/stack-recovery.mjs restore output/backups/stack/stack-<bundle_id> \
  --confirm-restore=stack-<bundle_id> --dry-run

# Thực thi khôi phục chọn lọc thành phần
node scripts/stack-recovery.mjs restore output/backups/stack/stack-<bundle_id> \
  --confirm-restore=stack-<bundle_id> \
  --components=nocobase-db,uploads
```

## Quy trình tạo Base Backup và Khôi phục Point-in-Time (PITR)

Để phục hồi chính xác về một mốc thời gian trước khi phát sinh lỗi thao tác hoặc hỏng dữ liệu logic, vận hành viên cần có bản sao lưu vật lý cơ sở (`pg_basebackup`) kết hợp chuỗi tệp `.gz` trong volume `*-wal-archive`.

### Bước 1: Kiểm tra sẵn sàng WAL và tạo Base Backup định kỳ

```bash
# 1. Xác minh trạng thái archive_mode và archive_command trên nocobase-db
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  psql -U "$NOCOBASE_DB_USER" -d nocobase -c "SHOW wal_level; SHOW archive_mode; SHOW archive_command;"

# 2. Kiểm tra các phân đoạn WAL nén .gz đang được ghi nhận trong volume
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  ls -lh /var/lib/postgresql/wal-archive | tail -n 10

# 3. Tạo bản sao lưu vật lý nền từ nocobase-db (định dạng tar nén)
mkdir -p ./backups/base/nocobase-$(date -u +%Y%m%dT%H%M%SZ)
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  pg_basebackup -U "$NOCOBASE_DB_USER" -D - -Ft -z -Xs -P \
  > ./backups/base/nocobase-base.tar.gz

# 4. Ép chuyển phân đoạn WAL hiện tại để đẩy nốt giao dịch mới nhất vào kho lưu trữ
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  psql -U "$NOCOBASE_DB_USER" -d postgres -c "SELECT pg_switch_wal();"
```

### Bước 2: Khôi phục về mốc thời gian mục tiêu (`recovery_target_time`)

Thực hiện trên cụm dừng ghi để tránh xung đột dữ liệu giữa `nocobase` và các phiên nền đang chạy:

<CodeTabs
  :tabs="[
    {
      label: '1. Dừng dịch vụ ứng dụng',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml stop nocobase n8n'
    },
    {
      label: '2. Nạp Base Backup & Cấu hình PITR',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml stop nocobase-db\n\ndocker run --rm \\\n  -v lattice-dx-prod_nocobase-db-data:/var/lib/postgresql/data \\\n  -v lattice-dx-prod_nocobase-wal-archive:/wal-archive:ro \\\n  -v \x22$(pwd)/backups/base:/backup:ro\x22 \\\n  pgvector/pgvector:0.8.1-pg16 sh -ec \x27\n    rm -rf /var/lib/postgresql/data/*\n    tar -xzf /backup/nocobase-base.tar.gz -C /var/lib/postgresql/data\n    chmod 700 /var/lib/postgresql/data\n    touch /var/lib/postgresql/data/recovery.signal\n    cat <<EOF >> /var/lib/postgresql/data/postgresql.auto.conf\nrestore_command = \x22gzip -dc /wal-archive/%f.gz > %p\x22\nrecovery_target_time = \x222026-11-26 14:30:00+07\x22\nrecovery_target_action = \x22pause\x22\nEOF\n  \x27'
    },
    {
      label: '3. Khởi động, kiểm tra và Promote',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml start nocobase-db\n\n# Kiểm tra dữ liệu tại mốc mục tiêu trước khi mở ghi\ndocker compose -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U \x22$NOCOBASE_DB_USER\x22 -d nocobase -c \x22SELECT now(), pg_is_in_recovery();\x22\n\n# Hoàn tất khôi phục và chuyển sang chế độ đọc/ghi chính\ndocker compose -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U \x22$NOCOBASE_DB_USER\x22 -d nocobase -c \x22SELECT pg_wal_replay_resume();\x22'
    }
  ]"
/>

Sau khi `pg_is_in_recovery()` trả về `f`, kiểm tra lại quyền hạn vai trò ứng dụng `nocobase_app` (`NOBYPASSRLS`) và trạng thái `FORCE ROW LEVEL SECURITY` trước khi khởi động lại dịch vụ `nocobase`.

## Lưu ý vận hành và Giới hạn an toàn

- Đặt `recovery_target_action = 'pause'` khi khôi phục sự cố logic để xác nhận đúng trạng thái dữ liệu trước khi gọi `pg_wal_replay_resume()`, tránh trường hợp PostgreSQL tự mở ghi và sinh timeline mới ngay lập tức.
- Luôn kiểm tra tệp báo cáo `stack-rehearsal-*.json` sinh ra bởi `stack-recovery.mjs rehearse`: trường `walArchiveReady` xác nhận cả `archiveMode === 'on'`, lệnh `archiveCommand` hợp lệ (không phải `/bin/true`), thư mục WAL sẵn sàng và tập lệnh `pitr-archive.sh` tồn tại.
- Sao chép định kỳ cả `NOCOBASE_ENCRYPTION_FIELD_KEY` và `NOCOBASE_APP_KEY` vào trình quản lý bí mật ngoại vi; nếu thiếu khóa này, các khóa Ed25519 trong `latticePkiKeys` và thông tin kết nối đã mã hóa AES-256-GCM không thể giải mã sau khi phục hồi cơ sở dữ liệu.

## Tài liệu liên quan

- [Nâng cấp Phiên bản](/getting-started/upgrading)
- [Đa tổ chức và PostgreSQL RLS](/architecture/multi-tenancy-rls)
- [Kiểm thử và Xác minh](/operations/testing-and-verification)
- [Xử lý Sự cố Hệ thống](/operations/troubleshooting)
