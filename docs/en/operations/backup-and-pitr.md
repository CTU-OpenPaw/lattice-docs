---
title: Backup and Point-in-Time Recovery (PITR)
description: PostgreSQL 16 base backup workflows, gzipped WAL archiving, stack recovery rehearsals, and Point-in-Time Recovery runbooks for LatticeDX.
---

# Backup and Point-in-Time Recovery (PITR)

LatticeDX stores persistent state across two independent PostgreSQL 16 instances (`postgres` for core API, Keycloak, and n8n; `nocobase-db` running `pgvector/pgvector:0.8.1-pg16`), paired with RustFS object storage and MongoDB for Orion-LD. To support low-RPO recovery and pre-incident verification, the platform pairs continuous Write-Ahead Log (WAL) archiving for Point-in-Time Recovery (PITR) with automated checksummed backup and restore-rehearsal scripts.

## PostgreSQL 16 WAL Archiving and PITR Architecture

In `infra/compose/prod.yml`, both `postgres` and `nocobase-db` load `infra/config/postgres/pitr.conf`, mount `infra/config/postgres/pitr-archive.sh`, and write compressed WAL segments to dedicated volumes (`postgres-wal-archive` and `nocobase-wal-archive`).

<ParamGrid
  title="PITR and WAL Archiving Parameters (infra/config/postgres/pitr.conf)"
  :items="[
    { name: 'wal_level', type: 'string', default: 'replica', description: 'Records sufficient WAL detail for continuous archiving and PITR replay.' },
    { name: 'archive_mode', type: 'string', default: 'on', description: 'Enables the archiver background process to invoke archive_command per completed WAL segment.' },
    { name: 'PG_ARCHIVE_COMMAND', type: 'string', default: '/bin/sh /etc/postgresql/pitr-archive.sh %p %f', description: 'Archiver command; override for external wal-g or pgBackRest targets.' },
    { name: 'archive_timeout', type: 'integer', default: '300', description: 'Forces a WAL segment switch at least every 300 seconds under low write volume.' },
    { name: 'wal_compression', type: 'string', default: 'on', description: 'Compresses full-page writes inside WAL to reduce storage I/O.' },
    { name: 'wal_keep_size', type: 'string', default: '512MB', description: 'Retains at least 512 MB of recent WAL segments inside pg_wal.' },
    { name: 'PITR_WAL_DIR', type: 'string', default: '/var/lib/postgresql/wal-archive', description: 'Destination directory holding <wal>.gz segments with 0700 permissions.' },
    { name: 'PITR_WAL_RETENTION_DAYS', type: 'integer', default: '7', description: 'Number of days compressed .gz segments remain locally before pruning.' },
    { name: 'WALG_S3_PREFIX', type: 'string', description: 'Optional S3 prefix (such as s3://bucket/pitr) enabling direct wal-g wal-push streaming.' }
  ]"
/>

### Safety Guarantees in `pitr-archive.sh`

`/etc/postgresql/pitr-archive.sh` validates WAL filenames strictly (rejecting `/`, `\`, `..`, and leading `-`), applies `umask 077`, and writes to a temporary file `${dest}.tmp.$$` before atomically renaming to `<wal_name>.gz`. If the target archive already exists, the script validates integrity with `gzip -t` and compares bytes with `cmp -s`: identical segments return exit `0` for idempotency, while mismatched contents fail non-zero so PostgreSQL preserves the source WAL segment.

When `WALG_S3_PREFIX` is configured and the `wal-g` binary is present, `pitr-archive.sh` delegates directly to `exec wal-g wal-push "$wal_path"`. In environments using `pgBackRest`, override `PG_ARCHIVE_COMMAND="pgbackrest --stanza=latticedx archive-push %p"` without altering container layouts.

## Scoped Backup and Rehearsal Scripts

Alongside continuous WAL archiving, `scripts/` provides four Node.js recovery scripts that compute SHA-256 manifests, verify archive structure, and run non-destructive restore rehearsals against isolated databases or ephemeral containers.

| Package Script | Source File | Backup Scope | Rehearsal Verification (`rehearse`) |
| :--- | :--- | :--- | :--- |
| `pnpm backup:core` | `scripts/backup-core.mjs` | `lattice` database (`pg_dump --format=custom`) | Restores into `dx_restore_*` and verifies core tables (`records`, `foundation_tasks`, `enterprise_entities`, `workflow_runs`). |
| `pnpm backup:full` | `scripts/full-backup-core.mjs` | `lattice` DB + `foundation_files` objects | Verifies SHA-256 of every file in `objects/` and tests authenticated download via internal API. |
| `pnpm backup:native` | `scripts/native-database-recovery.mjs` | `nocobase` database (`pg_dump --format=custom`) | Validates 16 required native tables and compares per-table MD5 row fingerprints in `dx_restore_*`. |
| `pnpm backup:stack` | `scripts/stack-recovery.mjs` | All 7 stateful platform components | Supports `--ephemeral` Postgres containers and runs `verifyWalArchiveReadiness`. |

<CodeTabs
  :tabs="[
    {
      label: 'Full Stack Backup',
      lang: 'bash',
      code: 'pnpm backup:stack\n# Or select specific components\nnode scripts/stack-recovery.mjs backup --components=nocobase-db,keycloak,lattice-db'
    },
    {
      label: 'Ephemeral Rehearsal',
      lang: 'bash',
      code: 'node scripts/stack-recovery.mjs rehearse output/backups/stack/stack-<bundle_id> --ephemeral'
    },
    {
      label: 'NocoBase DB Backup',
      lang: 'bash',
      code: 'pnpm backup:native\nnode scripts/native-database-recovery.mjs rehearse output/backups/native/core-<id>.dump'
    }
  ]"
/>

### Stack Bundle Layout and Integrity Checks

`scripts/stack-recovery.mjs` packages seven components into `output/backups/stack/stack-<32hex>/`:

| Component | Bundle Artifact | Integrity & Rehearsal Check |
| :--- | :--- | :--- |
| `nocobase-db` | `nocobase/core-<id>.dump` | Verifies `PGDMP` header, SHA-256, 16 required tables, and MD5 row fingerprints. |
| `uploads` | `uploads.tar.gz` | Validates Gzip magic bytes, checks tar paths against traversal, and extracts to a temporary directory. |
| `keycloak` | `keycloak.dump` + `keycloak-realm.json` | Validates `PGDMP` archive and parses the exported realm JSON. |
| `orion-mongo` | `orion-mongo.archive.gz` | Verifies Gzip header and runs `mongorestore --archive --gzip --dryRun`. |
| `n8n` | `n8n-workflows.json` + `n8n-credentials.json` | Confirms workflow and credential array counts match `manifest.json`. |
| `lattice-db` | `lattice.dump` | Validates `PGDMP`, restores into `dx_restore_*`, and verifies core API tables. |
| `engine-objects` | `engine-objects.tar.gz` | Validates tar archive of `FILE_STORAGE_ROOT` and records object entry counts. |

Every artifact path is checked against symlinks before reading or writing, and `manifest.json` records `envPresence` booleans for critical encryption keys (`APP_KEY`, `ENCRYPTION_FIELD_KEY`, `DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `AGENT_API_KEY`) without writing secret values to disk.

### Guarded Live Stack Restore

Live restores via `stack-recovery.mjs restore` require an explicit confirmation flag `--confirm-restore=<bundle-id>` matching the target directory name and support `--dry-run` to validate all SHA-256 checksums and archive headers without mutating running services.

```bash
# Dry-run validation before touching live containers
node scripts/stack-recovery.mjs restore output/backups/stack/stack-<bundle_id> \
  --confirm-restore=stack-<bundle_id> --dry-run

# Selective component restore
node scripts/stack-recovery.mjs restore output/backups/stack/stack-<bundle_id> \
  --confirm-restore=stack-<bundle_id> \
  --components=nocobase-db,uploads
```

## Base Backup and Point-in-Time Recovery Runbook

Recovering to an exact timestamp before an accidental schema drop or logical corruption requires a physical base backup (`pg_basebackup`) paired with the `.gz` WAL sequence stored in `*-wal-archive`.

### Step 1: Verify WAL Readiness and Capture a Physical Base Backup

```bash
# 1. Confirm archive_mode and archive_command on nocobase-db
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  psql -U "$NOCOBASE_DB_USER" -d nocobase -c "SHOW wal_level; SHOW archive_mode; SHOW archive_command;"

# 2. Verify compressed .gz WAL segments inside the archive volume
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  ls -lh /var/lib/postgresql/wal-archive | tail -n 10

# 3. Stream a compressed physical base backup from nocobase-db
mkdir -p ./backups/base/nocobase-$(date -u +%Y%m%dT%H%M%SZ)
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  pg_basebackup -U "$NOCOBASE_DB_USER" -D - -Ft -z -Xs -P \
  > ./backups/base/nocobase-base.tar.gz

# 4. Switch the current WAL segment so recent transactions archive immediately
docker compose -f infra/compose/prod.yml exec -T nocobase-db \
  psql -U "$NOCOBASE_DB_USER" -d postgres -c "SELECT pg_switch_wal();"
```

### Step 2: Replay WAL Segments to `recovery_target_time`

Stop dependent application writers (`nocobase`, `n8n`) before replacing the data directory so no stale connections interfere with replay:

<CodeTabs
  :tabs="[
    {
      label: '1. Stop App Writers',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml stop nocobase n8n'
    },
    {
      label: '2. Stage Base Backup & PITR Signal',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml stop nocobase-db\n\ndocker run --rm \\\n  -v lattice-dx-prod_nocobase-db-data:/var/lib/postgresql/data \\\n  -v lattice-dx-prod_nocobase-wal-archive:/wal-archive:ro \\\n  -v \x22$(pwd)/backups/base:/backup:ro\x22 \\\n  pgvector/pgvector:0.8.1-pg16 sh -ec \x27\n    rm -rf /var/lib/postgresql/data/*\n    tar -xzf /backup/nocobase-base.tar.gz -C /var/lib/postgresql/data\n    chmod 700 /var/lib/postgresql/data\n    touch /var/lib/postgresql/data/recovery.signal\n    cat <<EOF >> /var/lib/postgresql/data/postgresql.auto.conf\nrestore_command = \x22gzip -dc /wal-archive/%f.gz > %p\x22\nrecovery_target_time = \x222026-11-26 14:30:00+07\x22\nrecovery_target_action = \x22pause\x22\nEOF\n  \x27'
    },
    {
      label: '3. Inspect and Promote',
      lang: 'bash',
      code: 'docker compose --env-file .env -f infra/compose/prod.yml start nocobase-db\n\n# Inspect database state at the target timestamp while paused in recovery\ndocker compose -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U \x22$NOCOBASE_DB_USER\x22 -d nocobase -c \x22SELECT now(), pg_is_in_recovery();\x22\n\n# Promote the cluster to read-write mode\ndocker compose -f infra/compose/prod.yml exec -T nocobase-db \\\n  psql -U \x22$NOCOBASE_DB_USER\x22 -d nocobase -c \x22SELECT pg_wal_replay_resume();\x22'
    }
  ]"
/>

Once `pg_is_in_recovery()` returns `f`, verify the `nocobase_app` runtime role (`NOBYPASSRLS`) and `FORCE ROW LEVEL SECURITY` state across tenant tables before starting the `nocobase` service.

## Operational Notes and Security Boundaries

- Use `recovery_target_action = 'pause'` during logical recovery so operators can inspect restored tables before calling `pg_wal_replay_resume()` and advancing the PostgreSQL timeline.
- Inspect `walArchiveReady` inside generated `stack-rehearsal-*.json` reports: `verifyWalArchiveReadiness` confirms `archiveMode === 'on'`, a non-noop `archiveCommand`, a writable WAL directory, and executable `pitr-archive.sh`.
- Back up `NOCOBASE_ENCRYPTION_FIELD_KEY` and `NOCOBASE_APP_KEY` in an external secrets manager; without these keys, AES-256-GCM-wrapped Ed25519 keys in `latticePkiKeys` and encrypted connector credentials cannot be decrypted after restore.

## Related

- [Upgrading](/en/getting-started/upgrading)
- [Multi-Tenancy and PostgreSQL RLS](/en/architecture/multi-tenancy-rls)
- [Testing and Verification](/en/operations/testing-and-verification)
- [Troubleshooting](/en/operations/troubleshooting)
