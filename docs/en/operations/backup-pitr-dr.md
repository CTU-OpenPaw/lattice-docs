---
title: Full-Stack Backup, PITR & Disaster Recovery
description: Production disaster recovery runbook for LatticeDX v0.4.2 covering 7-component stack snapshots, ephemeral container rehearsal, guarded restore, and PostgreSQL 16 WAL PITR.
---

# Full-Stack Backup, PITR & Disaster Recovery (`v0.4.2`)

LatticeDX (`v0.4.2`) implements a two-tier, fail-closed backup and recovery architecture:
1. **Full-Stack 7-Component Snapshot & Ephemeral Rehearsal** (`scripts/stack-recovery.mjs`)
2. **Continuous PostgreSQL 16 WAL Archiving & Point-in-Time Recovery** (`infra/config/postgres/pitr.conf`, `pitr-archive.sh`, `scripts/pitr-backup.mjs`)

---

## 1. Recovery Objectives

| Tier | RPO | RTO | Mechanism |
| --- | --- | --- | --- |
| **Full-Stack Scheduled Snapshot** | `<= 24 hours` | `<= 30 minutes` | Daily SHA-256-verified 7-component bundle (`scripts/stack-recovery.mjs`) in `output/backups/stack/stack-<32hex>/`. |
| **Production WAL PITR** | `<= 5 minutes` | `<= 30 minutes` | `archive_timeout = 300` in `infra/config/postgres/pitr.conf` archiving to encrypted RustFS S3 (`wal-g`), pgBackRest, or local `.gz` WAL archives. |

---

## 2. Full-Stack 7-Component Snapshot (`scripts/stack-recovery.mjs`)

All 7 stateful stores are captured atomically into `output/backups/stack/stack-<32hex>/` (gitignored, mode `0o700` directory / `0o600` files):

| # | Component | Default Container (Env Override) | Backup Artifact & Method | Ephemeral / Non-Destructive Verification |
| :---: | --- | --- | --- | --- |
| 1 | `nocobase-db` | `lattice-dx-nocobase-db-1` (`NATIVE_DATABASE_CONTAINER`) | `nocobase/*.dump` via `backupNative()` (`pg_dump --format=custom`) | Restored into throwaway DB `dx_restore_<uuid>` inside ephemeral PG16 container; verifies `requiredNativeTables`, `@latticedx/` migrations, `collections`, and `lattice_native_request_attachments`. |
| 2 | `uploads` | `lattice-dx-nocobase-1` (`NATIVE_APP_CONTAINER`) | `uploads.tar.gz` (`/app/nocobase/storage/uploads`) | Checks SHA-256 + gzip magic bytes, runs strict `tar -tvzf` filter, extracts to isolated `mkdtemp` dir, then cleans up. |
| 3 | `keycloak` | `lattice-dx-postgres-1` (`KEYCLOAK_DB_CONTAINER`) | `keycloak.dump` (`pg_dump --format=custom`) + `keycloak-realm.json` (`infra/config/keycloak/lattice-realm.json`) | Checks SHA-256 + `PGDMP` header, parses realm JSON, restores into ephemeral `dx_restore_<uuid>` DB and verifies table list. |
| 4 | `orion-mongo` | `lattice-dx-orion-mongo-1` (`ORION_MONGO_CONTAINER`) | `orion-mongo.archive.gz` (`mongodump --archive --gzip`; uses `ORION_MONGO_USER`/`ORION_MONGO_PASSWORD` when set) | Checks SHA-256 + gzip header, executes `mongorestore --archive --gzip --dryRun` (never mutates live Orion-LD MongoDB). |
| 5 | `n8n` | `lattice-dx-n8n-1` (`N8N_CONTAINER`) | `n8n-workflows.json` (`n8n export:workflow --all`) + `n8n-credentials.json` (`n8n export:credentials --all`) | Checks SHA-256, parses JSON arrays, and verifies `workflowCount` and `credentialsCount`. |
| 6 | `lattice-db` | `KEYCLOAK_DB_CONTAINER` (`LATTICE_DB_CONTAINER`) | `lattice.dump` (`pg_dump --format=custom` of companion `/v1` API database) | Checks SHA-256 + `PGDMP` header, restores into ephemeral `dx_restore_<uuid>` DB and verifies core tables (`records`, `foundation_tasks`, `enterprise_entities`, `workflow_runs`). |
| 7 | `engine-objects` | `lattice-dx-api-1` (`API_CONTAINER`) | `engine-objects.tar.gz` (`FILE_STORAGE_ROOT`, default `/var/lib/latticedx/objects`) | Checks SHA-256 + gzip header, runs strict `tar -tvzf` filter, extracts to `mkdtemp` dir, then cleans up. |

### Streaming Safety & Zero-Secret Manifest

- **No secrets in `manifest.json`:** `manifest.json` (`format: "latticedx.stack-backup"`, `version: 1`) records only boolean `envPresence` flags for `APP_KEY`, `ENCRYPTION_FIELD_KEY`, `DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, and `AGENT_API_KEY`.
- **Anti-symlink & traversal enforcement:** `lstatSync` and `realpathSync` reject symlinked bundle directories or files. `validateTarVerboseEntries` (`tar -tvzf`) rejects symlinks (`l`), hardlinks (`h`), device nodes (`cbps`), link targets (`->` / `link to`), absolute paths, and `..` traversal.
- **Streaming cap:** Direct Docker-to-disk streaming enforces `maxStreamingBackupBytes = 10 GiB` (override via `LATTICE_MAX_BACKUP_BYTES`).

### Taking a Snapshot

```sh
# Full 7-component backup
pnpm backup:stack

# Or select specific components
node scripts/stack-recovery.mjs backup --components=nocobase-db,uploads,keycloak
```

When targeting a clean-install lab (`pnpm native:clean`), override the container names:

```powershell
$env:NATIVE_DATABASE_CONTAINER = "lattice-native-clean-<id>-nocobase-db-1"
$env:NATIVE_APP_CONTAINER = "lattice-native-clean-<id>-nocobase-1"
pnpm backup:stack
```

---

## 3. Ephemeral Container Rehearsal (`--ephemeral`)

**Never** test disaster recovery directly against production databases. Use `--ephemeral` so `scripts/stack-recovery.mjs`:
1. Verifies SHA-256 checksums, byte sizes, `PGDMP`/gzip headers, and tar entry safety **fail-closed** before touching any container.
2. Launches an isolated PostgreSQL container (`ldx-dr-ephemeral-<12hex>`) from `postgres:16.16-alpine@sha256:f2f98726820d0342055351c6e9d36e705f5bfffb3dd53ff556325114b08afb6d` (overridable via `EPHEMERAL_PG_IMAGE`).
3. Restores `nocobase-db`, `keycloak`, and `lattice-db` into throwaway databases, validates application migrations (`migrations WHERE name LIKE '%/@latticedx/%'`) and schemas, verifies tar extraction for `uploads` and `engine-objects`, dry-runs `orion-mongo`, validates `n8n` exports, and inspects WAL archive readiness (`checkWalArchiveReadiness`).
4. Destroys the ephemeral container in `finally` and writes `stack-rehearsal-<32hex>.json`.

```sh
pnpm backup:stack
node scripts/stack-recovery.mjs rehearse "output/backups/stack/stack-<id>" --ephemeral
```

::: tip Strict `fullRecoverability` Contract
`fullRecoverability: true` is reported **only** when all 7 components are included (`skippedComponents` is empty), every artifact passes checksum verification, `--ephemeral` PostgreSQL restoration succeeds, object/upload archives extract safely, and `@latticedx/` migration/application health checks pass.
:::

You can also run the non-ephemeral throwaway-DB rehearsal on an existing PostgreSQL container:

```sh
pnpm backup:rehearse-stack -- "output/backups/stack/stack-<id>"
```

---

## 4. Guarded Production Restore

`restore` fails closed unless **all** requested artifacts pass SHA-256, header, and tar checks **and** `--confirm-restore=<stack-id>` matches the exact `stack-<32hex>` directory name:

```sh
# 1. Dry-run verification first (no mutations)
node scripts/stack-recovery.mjs restore "output/backups/stack/stack-<id>" --confirm-restore="stack-<id>" --dry-run

# 2. Apply restore
node scripts/stack-recovery.mjs restore "output/backups/stack/stack-<id>" --confirm-restore="stack-<id>"
```

### Production Cutover Checklist

1. Provision the target host with matching `@sha256:` OCI image digests (`infra/compose/prod.yml`) and the 7 Apache-2.0 plugins (`0.4.2`).
2. Populate secrets (`NOCOBASE_APP_KEY`, `NOCOBASE_ENCRYPTION_FIELD_KEY`, DB credentials, `N8N_ENCRYPTION_KEY`, `DX_METRICS_TOKEN`, `RUSTFS_*`) from your external secret manager.
3. Pause background workers/outbox dispatchers before opening public ingress.
4. Run `restore --dry-run`, execute the restore, verify login (`admin` + `ldx_*` RBAC), and re-enable workers/ingress.

---

## 5. PostgreSQL 16 WAL Archiving & PITR

### Configuration (`infra/config/postgres/pitr.conf` & `prod.yml`)

Both `postgres` (`postgres:16.16-alpine`) and `nocobase-db` (`pgvector/pgvector:0.8.1-pg16`) in `infra/compose/prod.yml` enable continuous WAL archiving:

```ini
wal_level = replica
archive_mode = on
archive_command = '/bin/sh /etc/postgresql/pitr-archive.sh %p %f'
archive_timeout = 300
max_wal_senders = 4
wal_compression = on
wal_keep_size = 512MB
checkpoint_timeout = 10min
shared_preload_libraries = 'pg_stat_statements'
```

- `archive_timeout = 300` caps uncommitted WAL segment flush delay at **5 minutes**, bounding production PITR RPO to `<= 5 minutes`.
- You can override `archive_command` via `PG_ARCHIVE_COMMAND` in `prod.yml` (for example `'wal-g wal-push %p'` or `'pgbackrest --stanza=latticedx archive-push %p'`).

### Dual-Mode Archiver (`infra/config/postgres/pitr-archive.sh`)

`pitr-archive.sh` validates `<wal-path>` and `<wal-filename>` (rejecting `/`, `\`, `..`, and leading `-` flags) and routes WAL segments as follows:
1. **Remote S3 (`wal-g`):** When `WALG_S3_PREFIX` is set and `wal-g` is available, delegates directly via `exec wal-g wal-push "<wal-path>"` (targeting Apache-2.0 `rustfs` at `http://rustfs:9000` in `prod.yml`).
2. **Local Compressed Fallback (`.gz`):** Compresses atomically (`umask 077`, temporary file + `mv`) to `${PITR_WAL_DIR:-/var/lib/postgresql/wal-archive}/<wal-filename>.gz`. If the destination already exists, verifies byte-for-byte identity (`gzip -dc | cmp -s`) before returning `0` (or fails closed on mismatch), and prunes `.gz` files older than `PITR_WAL_RETENTION_DAYS` (default `7`).

### PITR Operations CLI (`scripts/pitr-backup.mjs`)

`scripts/pitr-backup.mjs` supports three backends (`wal-g`, `pgbackrest`, `local-gz`) and four actions (`check-config`, `base-backup`, `list`, `restore-plan`). By default it outputs a JSON execution plan; pass `--execute` to run the underlying binary.

#### Option A — Encrypted `wal-g` + RustFS S3 (Recommended for Production)

`wal-g` requires client-side encryption (`WALG_LIBSODIUM_KEY*` or `WALG_PGP_KEY*`):

```sh
# 1. Verify configuration without printing secrets
WALG_S3_PREFIX=s3://lattice-dr/nocobase \
WALG_LIBSODIUM_KEY_PATH=/etc/latticedx/walg.key \
AWS_ENDPOINT=http://rustfs:9000 \
node scripts/pitr-backup.mjs check-config --backend=wal-g

# 2. Generate base-backup plan (add --execute to run wal-g backup-push)
WALG_S3_PREFIX=s3://lattice-dr/nocobase \
WALG_LIBSODIUM_KEY_PATH=/etc/latticedx/walg.key \
AWS_ENDPOINT=http://rustfs:9000 \
node scripts/pitr-backup.mjs base-backup --backend=wal-g

# 3. Generate a PITR restore plan for a strict ISO-8601 timestamp
WALG_S3_PREFIX=s3://lattice-dr/nocobase \
WALG_LIBSODIUM_KEY_PATH=/etc/latticedx/walg.key \
AWS_ENDPOINT=http://rustfs:9000 \
node scripts/pitr-backup.mjs restore-plan --backend=wal-g --target-time=2026-11-22T06:00:00Z
```

#### Option B — `pgbackrest`

Requires `PGBACKREST_STANZA`, `PGBACKREST_REPO1_S3_BUCKET` or `PGBACKREST_REPO1_PATH`, and `PGBACKREST_REPO1_CIPHER_PASS`:

```sh
node scripts/pitr-backup.mjs check-config --backend=pgbackrest
node scripts/pitr-backup.mjs restore-plan --backend=pgbackrest --target-time=2026-11-22T06:00:00Z
```

#### Option C — Unencrypted Local `.gz` WAL (`local-gz`)

Requires explicit opt-in via `--allow-unencrypted-local`:

```sh
node scripts/pitr-backup.mjs check-config --backend=local-gz --allow-unencrypted-local
node scripts/pitr-backup.mjs restore-plan --backend=local-gz --allow-unencrypted-local --target-time=2026-11-22T06:00:00Z
```

This generates `tar -xzf .../latest/base.tar.gz -C <PGDATA>` alongside `recoveryConfig`:
- `restore_command`: `gzip -dc "<PITR_WAL_DIR>/%f.gz" > "%p"`
- `recovery_target_time`: `<target-time>`
- `recovery_target_action`: `promote`

---

## Related Documentation

- [Production Zero-Trust Deployment](/en/getting-started/production-deployment)
- [Multi-Tenant PostgreSQL FORCE RLS](/en/security/multi-tenant-rls)
- [Observability, OTel GenAI & Alerting](/en/operations/observability)
- [Complete Automated & E2E Testing Guide](/en/operations/testing-e2e-guide)
- [Clean-Install Demo Pack, 15-Min Finals & Troubleshooting](/en/operations/demo-pack-troubleshooting)
