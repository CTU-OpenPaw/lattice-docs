---
title: Nâng cấp, Diễn tập PITR và Chuyển đổi Bundle v3
description: Quy trình sao lưu PITR trước khi nâng cấp, cập nhật 7 plugin @latticedx/* trên host NocoBase 2.2.50, diễn tập cô lập, tương thích nhánh 0.4.x và tính di động của Solution Bundle v3.
---

# Nâng cấp, Diễn tập PITR và Chuyển đổi Bundle v3

Mọi thao tác nâng cấp LatticeDX trên nhánh `0.4.x` (`0.4.2`) đều tuân theo nguyên tắc sao lưu kiểm chứng toàn vẹn trước khi thay đổi runtime, chạy diễn tập khôi phục cô lập và giữ nguyên tính di động cấu hình giữa các môi trường qua chuẩn `latticedx.solution-bundle/v3`.

## 1. Sao lưu Bắt buộc và Tích hợp PITR Trước khi Nâng cấp

Không thực hiện build lại plugin, cập nhật image hay chạy migration khi chưa tạo bản sao lưu có chữ ký kiểm tra `sha256` và xác nhận tính sẵn sàng của chuỗi WAL Point-in-Time Recovery (PITR). Hệ thống cung cấp ba lớp công cụ sao lưu đồng bộ theo phạm vi từ đơn lẻ đến toàn stack:

<ParamGrid
  title="Công cụ Sao lưu và Kiểm tra Trước Nâng cấp"
  :items="[
    { name: 'scripts/stack-recovery.mjs', type: 'Full Stack', default: 'output/backups/stack/stack-<id>', description: 'Sao lưu toàn bộ 7 thành phần (nocobase-db, uploads, keycloak, orion-mongo, n8n, lattice-db, engine-objects) và kiểm tra WAL archive readiness.' },
    { name: 'scripts/pitr-backup.mjs', type: 'PITR / WAL', default: 'wal-g | pgbackrest | local-gz', description: 'Kiểm tra cấu hình PITR (check-config), tạo base-backup, liệt kê mốc khôi phục và lập kế hoạch restore-plan theo mốc thời gian ISO-8601.' },
    { name: 'scripts/native-database-recovery.mjs', type: 'nocobase-db', default: 'output/backups/native/', description: 'Kết xuất pg_dump định dạng custom của database nocobase kèm bảng kiểm kê MD5 từng bảng và diễn tập khôi phục sang DB tạm.' },
    { name: 'scripts/backup-core.mjs', type: 'lattice-db', default: 'output/backups/', description: 'Sao lưu và diễn tập khôi phục database lõi lattice (cổng Fastify API) sang database kiểm thử tạm thời.' }
  ]"
/>

Chạy kiểm tra PITR và tạo bản sao lưu toàn stack trước khi bắt đầu cửa sổ bảo trì:

<CodeTabs
  :tabs="[
    {
      label: 'PITR Check & Base Backup',
      lang: 'bash',
      code: '# 1. Kiểm tra trạng thái lưu trữ WAL PITR (wal-g / pgbackrest / local-gz)\nnode scripts/pitr-backup.mjs check-config --backend=local-gz --allow-unencrypted-local\n\n# 2. Xem trước lệnh tạo base backup hoặc thêm --execute để chạy thực tế\nnode scripts/pitr-backup.mjs base-backup --backend=wal-g\n\n# 3. Sao lưu toàn bộ 7 thành phần stack và ghi manifest SHA-256\npnpm backup:stack'
    },
    {
      label: 'Diễn tập Khôi phục Cô lập',
      lang: 'bash',
      code: '# Diễn tập khôi phục trên container PostgreSQL 16 tạm thời (không chạm DB chạy thật)\nnode scripts/stack-recovery.mjs rehearse output/backups/stack/stack-<bundle-id> --ephemeral\n\n# Lập kế hoạch khôi phục PITR về đúng thời điểm trước khi nâng cấp\nnode scripts/pitr-backup.mjs restore-plan --backend=local-gz --allow-unencrypted-local --target-time=2026-11-26T16:00:00Z'
    }
  ]"
/>

::: warning Điều kiện Fail-Closed của PITR Backup
Script `scripts/pitr-backup.mjs` từ chối backend `wal-g` hoặc `pgbackrest` nếu thiếu khóa mã hóa (`WALG_LIBSODIUM_KEY` / `WALG_PGP_KEY` hoặc `PGBACKREST_REPO1_CIPHER_PASS`), trừ khi chỉ định tường minh cờ `--allow-unencrypted-local` trong môi trường kiểm thử cục bộ. Thư mục WAL cục bộ `PITR_WAL_DIR` yêu cầu quyền `0700` và nén từng phân đoạn bằng `umask 077`.
:::

---

## 2. Diễn tập Nâng cấp Cô lập (`native-rehearsal.yml`)

Trước khi áp dụng thay đổi lên `infra/compose/prod.yml`, sử dụng `infra/compose/native-rehearsal.yml` (`name: lattice-native-rehearsal`) để kiểm tra quá trình build 7 plugin và chạy migration trên một cặp `nocobase-db` (`pgvector:0.8.1-pg16`) và `nocobase` (`2.2.50`) cô lập tại `127.0.0.1:13001`. Stack diễn tập không gắn volume production và không mở cổng công khai.

<CodeTabs
  :tabs="[
    {
      label: 'Chạy Rehearsal Stack',
      lang: 'bash',
      code: 'docker compose -f infra/compose/native-rehearsal.yml up -d --wait\ndocker compose -f infra/compose/native-rehearsal.yml exec -T nocobase yarn nocobase upgrade\n\n# Dọn dẹp hoàn toàn sau khi kiểm tra xong\ndocker compose -f infra/compose/native-rehearsal.yml down -v'
    }
  ]"
/>

---

## 3. Quy trình Nâng cấp Runtime và 7 Plugin

Khi nâng cấp hệ thống đang vận hành (`nocobase.yml` ở môi trường phát triển hoặc `prod.yml` ở môi trường production), quá trình cập nhật luôn tách làm bốn bước: sao lưu, build gói cục bộ, nạp lại container `nocobase` và thực thi `yarn nocobase upgrade`.

### Nâng cấp tự động trên Workspace cục bộ (`scripts/install-workspace.mjs`)

Lệnh `pnpm workspace:install` tự động hóa toàn bộ quy trình an toàn trên stack `infra/compose/nocobase.yml`:
1. Thực hiện `pg_dump --format=custom` cơ sở dữ liệu `nocobase` vào `output/backups/nocobase-before-workspace-<uuid>.dump` kèm tệp `.json` chứa mã băm `sha256`. Nếu bước sao lưu lỗi, script dừng ngay và giữ nguyên runtime hiện tại.
2. Cài đặt phụ thuộc khóa phiên bản cho `plugin-enterprise-auth` (`npm ci --ignore-scripts --no-audit --no-fund`) và build cả 7 plugin trên host.
3. Khởi tạo lại container `nocobase` (`up -d --no-deps --force-recreate nocobase`) và chờ endpoint `/api/app:getLang` phản hồi HTTP 200.
4. Đóng gói offline (`npm pack --offline --ignore-scripts`), chạy `yarn nocobase pm add` và `yarn nocobase pm enable` cho từng package `@latticedx/*`, sau đó đối chiếu `yarn nocobase pm list` để bảo đảm cả 7 plugin đều ở trạng thái `enabled: true` và khớp đúng phiên bản `0.4.2`.

### Nâng cấp trên Production (`infra/compose/prod.yml`)

Trên môi trường production, thực thi tuần tự các bước sau trong cửa sổ bảo trì:

<CodeTabs
  :tabs="[
    {
      label: 'Production Upgrade Runbook',
      lang: 'bash',
      code: '# 1. Kéo mã nguồn phiên bản mới và build 7 plugin trên host\npnpm install --frozen-lockfile\nnpm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund\nnode plugins/nocobase/action-bridge/build.mjs\nnode plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs\nnode plugins/nocobase/plugin-enterprise-auth/build.mjs\nnode plugins/nocobase/plugin-dxos-para/build.mjs\nnode plugins/nocobase/plugin-dxos-blocks/build.mjs\nnode plugins/nocobase/plugin-dxos-studio/build.mjs\nnode plugins/nocobase/plugin-dxos-ai/build.mjs\n\n# 2. Tái tạo container nocobase với mount plugin mới\ndocker compose --env-file .env.prod -f infra/compose/prod.yml up -d --no-deps --force-recreate nocobase\n\n# 3. Chạy migration schema của host và 7 plugin\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase yarn nocobase upgrade'
    },
    {
      label: 'Xác minh Sau Nâng cấp',
      lang: 'bash',
      code: '# Kiểm tra toàn bộ migration của @latticedx đã áp dụng\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U nocobase -d nocobase -At -c \x22SELECT count(*) FROM migrations WHERE name LIKE \x27%/@latticedx/%\x27;\x22\n\n# Kiểm tra trạng thái FORCE RLS trên các bảng tenant\ndocker compose --env-file .env.prod -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U nocobase -d nocobase -At -c \x22SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=\x27public\x27 AND c.relname LIKE \x27lattice%\x27 AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);\x22\n\n# Kiểm tra health endpoint\ncurl -fsS \x22https://<LATTICE_DOMAIN>/api/dxos:health\x22'
    }
  ]"
/>

Nếu kết quả truy vấn RLS trả về lớn hơn `0`, cần kiểm tra lại log migration của `plugin-lattice-foundation` và `plugin-dxos-ai` trước khi mở lại lưu lượng người dùng.

---

## 4. Chính sách Tương thích Nhánh `0.4.x` và Host NocoBase `2.2.50`

LatticeDX duy trì khóa phiên bản `0.4.2` trên kho gốc và toàn bộ 7 package `@latticedx/*` thuộc dòng phát hành tiền ổn định `0.4.x` (`< 1.0.0`). Các ràng buộc tương thích sau được kiểm tra tự động trong pipeline CI:

| Thành phần | Quy ước Phiên bản | Hợp đồng Tương thích |
| :--- | :--- | :--- |
| **Gói nền tảng & 7 plugin** | `0.4.2` | Toàn bộ 7 package khai báo `"version": "0.4.2"` và `"sdkProvidedByHost": true`. |
| **Host runtime NocoBase** | `2.2.50` (`supportedVersions: ["2.2.x"]`) | Chạy từ OCI image khóa digest `@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777`, cung cấp `react: 18.2.0`, `react-dom: 18.2.0`, `antd: 5.24.2` và các gói `@nocobase/*`. |
| **Cơ sở dữ liệu PostgreSQL** | `16.16` + `pgvector 0.8.1` | Hỗ trợ mở rộng cột vector (`8..8192` chiều) và cưỡng chế `FORCE ROW LEVEL SECURITY` qua role `nocobase_app`. |
| **Keycloak / APISIX / Valkey** | `26.8.2` / `3.19.0` / `8.1` | Định danh realm `lattice`, chuẩn PKCE `S256` và phân vùng DB 0/1/2 giữ nguyên ổn định trong nhánh `0.4.x`. |

Khi nâng cấp trong phạm vi `0.4.x`, các trường mở rộng của `latticeCustom*` và snapshot giao diện trong `latticeUiSnapshots` được giữ nguyên vẹn; bất kỳ thay đổi lược đồ phá vỡ tương thích ngược nào đều được công bố rõ trong ghi chú phát hành kèm bước chuyển đổi dữ liệu tường minh.

---

## 5. Tính Di động Cấu hình với Solution Bundle v3

Khi chuyển cấu hình ứng dụng (cổng thông tin, vai trò nghiệp vụ, quy trình LatticeFlow v2, bảng DMN, cấu hình AI Profile, bảng động `latticeCustom*`) giữa các môi trường dev, staging và production hoặc khi di chuyển sang cụm mới sau nâng cấp, hãy xuất và nhập theo chuẩn **Solution Bundle v3** (`latticedx.solution-bundle/v3`).

Cấu trúc `latticedx.solution-bundle/v3` gồm phần `metadata` (`schemaVersion`, `platformVersion: '0.4.2'`, `organizationId`, `exportedAt`, `contentSha256`) cùng 8 khóa dữ liệu: `roles`, `portals`, `workflows`, `aiProfiles`, `customCollections`, `connectors`, `routesAndBlocks` (`routes`, `flowModels`), và `governance` (`decisionTables`, `slaPolicies`, `incidentRules`, `automationRules`, `webhookSubscriptions`).

Cơ chế kiểm soát an toàn khi nhập Bundle được thực thi theo bảng quy tắc sau:

| Kiểm soát Bảo mật | Cơ chế Thực thi trên Server |
| :--- | :--- |
| Tương thích ngược v1 / v2 / v3 | Bộ nạp chấp nhận cấu trúc v1, v2 và v3; tự động loại bỏ các khóa bí mật (`SECRET_KEY_RE`, `CONNECTOR_SECRET_KEYS`) để tránh rò rỉ token giữa các môi trường. |
| Chặn leo thang quyền và mã độc | Từ chối các vai trò hệ thống (`root`, `admin`, `ldx_admin`), wildcard permission snippet, khóa mã tùy chỉnh, XSS và prototype pollution. |
| Mặc định `dryRun: true` và Snapshot | Lệnh nhập mặc định chạy kiểm tra thử; trước khi ghi thật (`dryRun: false`), hệ thống tự động chụp trạng thái vào `latticeUiSnapshots` dưới `portalSlug: '__gitops_bundle__'` để khôi phục bằng `solutionBundleRollback`. |

<ApiEndpoint
  method="GET"
  path="/api/dxosStudio:solutionBundleExport"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Xuất toàn bộ cấu hình ứng dụng của tổ chức hiện tại thành tệp JSON chuẩn latticedx.solution-bundle/v3 kèm mã kiểm tra contentSha256."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleDiff"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="So sánh chênh lệch cấu hình giữa tệp Solution Bundle v3 sắp nạp và trạng thái hiện hành của tổ chức."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleImport"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Kiểm thử (mặc định dryRun: true) hoặc áp dụng cấu hình Bundle v1/v2/v3 sau khi lưu snapshot khôi phục."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosStudio:solutionBundleRollback"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Khôi phục giao diện, route và thành phần đã thay đổi về snapshot __gitops_bundle__ trước lần import gần nhất."
/>

<CodeTabs
  :tabs="[
    {
      label: 'Export & Diff Bundle v3',
      lang: 'bash',
      code: '# Xuất Solution Bundle v3 của tổ chức hiện tại\ncurl -fsS -H \x22Authorization: Bearer <TOKEN>\x22 \\\n  \x22https://<LATTICE_DOMAIN>/api/dxosStudio:solutionBundleExport\x22 -o bundle-v3.json\n\n# Kiểm tra sai khác (diff) trước khi nhập sang môi trường đích\ncurl -fsS -X POST \\\n  -H \x22Authorization: Bearer <TARGET_TOKEN>\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d @bundle-v3.json \\\n  \x22https://<TARGET_DOMAIN>/api/dxosStudio:solutionBundleDiff\x22'
    },
    {
      label: 'Dry-Run & Rollback',
      lang: 'bash',
      code: '# Chạy thử import (dryRun: true mặc định, không ghi DB)\ncurl -fsS -X POST \\\n  -H \x22Authorization: Bearer <TARGET_TOKEN>\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d @bundle-v3.json \\\n  \x22https://<TARGET_DOMAIN>/api/dxosStudio:solutionBundleImport\x22\n\n# Hoàn tác về snapshot trước khi import nếu cần\ncurl -fsS -X POST \\\n  -H \x22Authorization: Bearer <TARGET_TOKEN>\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{}\x27 \\\n  \x22https://<TARGET_DOMAIN>/api/dxosStudio:solutionBundleRollback\x22'
    }
  ]"
/>

---

## 6. Hoàn tác Khẩn cấp Khi Nâng cấp Thất bại

Nếu quá trình nâng cấp container hoặc migration gặp lỗi nghiêm trọng:
1. Dừng container `nocobase` và chuyển cổng vào chế độ bảo trì.
2. Nếu lỗi xảy ra ở bước nạp Bundle v3, gọi `POST /api/dxosStudio:solutionBundleRollback` để trả lại cấu hình giao diện và route.
3. Nếu lỗi xảy ra ở schema PostgreSQL (`nocobase-db`), khôi phục từ bản `stack-recovery.mjs` đã kiểm chứng trước nâng cấp hoặc thực hiện phục hồi PITR về mốc thời gian ngay trước thời điểm chạy `yarn nocobase upgrade` theo hướng dẫn tại [Sao lưu và Phục hồi PITR](/operations/backup-and-pitr).

---

## Tài liệu Liên quan

- [Triển khai Production Zero-Trust](/getting-started/production-deployment)
- [Sao lưu và Phục hồi PITR](/operations/backup-and-pitr)
- [Gói Giải pháp Solution Bundle v3](/studio/solution-bundles)
- [Hệ thống Plugin và Host Contract](/architecture/plugin-system)
