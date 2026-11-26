---
title: Scoped API Keys
description: Issuance, constant-time verification, 7 permission scopes, latticeApiKeys schema, role escalation prevention, and zero-downtime rotation for ldx_pat_* keys.
---

<script setup>
const rotationTabs = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `# 1. Issue a scoped key for WMS sync
curl -sS -X POST "https://app.example.com/api/dxosApiKeys:issue" \\
  -H "Authorization: Bearer <ADMIN_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "wms-scanner-sync",
    "scopes": ["read", "wms"],
    "roleName": "ldx_operator",
    "expiresInDays": 90
  }'

# 2. Revoke the superseded key after rollout
curl -sS -X POST "https://app.example.com/api/dxosApiKeys:revoke" \\
  -H "Authorization: Bearer <ADMIN_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{"id": 14}'`,
  },
  {
    label: 'TypeScript',
    lang: 'ts',
    code: `export async function rotateApiKey(
  baseUrl: string,
  adminToken: string,
  oldKeyId: number,
  config: {
    name: string;
    scopes: string[];
    roleName: string;
    expiresInDays: number;
  },
) {
  const issueRes = await fetch(\`\${baseUrl}/api/dxosApiKeys:issue\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${adminToken}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  if (!issueRes.ok) throw new Error(\`Issue failed: \${issueRes.status}\`);
  const issued = await issueRes.json();

  const revokeRes = await fetch(\`\${baseUrl}/api/dxosApiKeys:revoke\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${adminToken}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: oldKeyId }),
  });
  if (!revokeRes.ok) throw new Error(\`Revoke failed: \${revokeRes.status}\`);

  return issued.data ?? issued;
}`,
  },
];
</script>

# Scoped API Keys

LatticeDX uses Personal Access Tokens (PATs) formatted as `ldx_pat_*` to grant programmatic access to external integrations, CI/CD pipelines, IIoT gateways, and off-box agents. Each key is bound to a verified user, organization, and role inside `latticeApiKeys` (protected by `FORCE ROW LEVEL SECURITY`) and checked against explicit permission scopes before any resource handler executes.

## Token Format and Storage Schema

Tokens are generated using `node:crypto` `randomBytes` in a fixed structure:

```text
ldx_pat_<8hex>_<32hex>
```

| Token Part | Storage Behavior |
| :--- | :--- |
| Lookup prefix (`keyPrefix`) | `ldx_pat_` followed by 4 random hex-encoded bytes (`8` characters), stored in plaintext for operator identification and auditing. |
| Secret (`token`) | 16 random bytes (`32` hex characters) returned once in the `dxosApiKeys:issue` response and never persisted. |
| Hash storage (`keyHash`) | The server stores a `SHA-256` digest of the full token string under the unique index `uidx_lattice_api_keys_hash`. |

<ParamGrid
  title="latticeApiKeys Collection Fields"
  :items="[
    { name: 'organizationId', type: 'string', required: true, description: 'Tenant organization identifier bound to the key.' },
    { name: 'name', type: 'string', required: true, description: 'Human-readable label (1..120 characters).' },
    { name: 'keyPrefix', type: 'string', required: true, description: 'Public lookup prefix formatted as ldx_pat_<8hex>.' },
    { name: 'keyHash', type: 'string', required: true, description: 'SHA-256 digest of the raw token (unique index uidx_lattice_api_keys_hash).' },
    { name: 'userId / employeeId', type: 'bigInt', required: true, description: 'Owning user ID and employee membership record.' },
    { name: 'roleName', type: 'string', required: true, description: 'NocoBase role clamped onto every request using this key.' },
    { name: 'scopesJson', type: 'jsonb', required: true, description: 'Array of granted permission scopes.' },
    { name: 'expiresAt / lastUsedAt / revokedAt', type: 'date', required: false, description: 'Expiration timestamp, 60s-throttled last-used timestamp, and revocation timestamp.' },
    { name: 'active', type: 'boolean', required: false, default: 'true', description: 'Active flag; set to false immediately on revocation.' }
  ]"
/>

### Middleware Verification Pipeline

The `createPaasApiKeyAuthMiddleware` handler (registered `before: 'auth'`) accepts credentials via either header:

- `X-Lattice-API-Key: ldx_pat_<8hex>_<32hex>`
- `Authorization: Bearer ldx_pat_<8hex>_<32hex>` (when no host session user is already resolved)

Verification runs inside `withSystemRlsBypass`:

1. Validates format against `PAT_TOKEN_RE`, computes `SHA-256`, and compares `keyHash` using constant-time `timingSafeEqualHex`.
2. Asserts `active === true`, `revokedAt == null`, and unexpired `expiresAt`.
3. Confirms the owning `users` account, `rolesUsers` role binding, and `latticeEmployees` membership in `organizationId` are all active.
4. Calls `clampHeaderRole(ctx, roleName)` to overwrite any incoming `x-role` header variant, preventing header-based privilege elevation.
5. Throttles `lastUsedAt` updates to at most once per `60` seconds (`LAST_USED_THROTTLE_MS = 60_000`) to avoid database write amplification on hot API paths.

Direct REST queries against `/api/latticeApiKeys:*` are blocked (`403 PAAS_PRIVATE_COLLECTION_FORBIDDEN`) for all non-`root` roles.

## 7 Permission Scopes (`ALLOWED_PAT_SCOPES`)

Every issued key requires between `1` and `20` scopes chosen from the `7` valid values:

| Scope | Read Access | Unlocked Mutating Actions |
|---|---|---|
| `read` | All `GET`, `HEAD`, `OPTIONS` endpoints and approved safe `POST` queries | Blocks all state-mutating operations (`403 API_KEY_SCOPE_INSUFFICIENT`) |
| `write` | Includes all read access | Unlocks all create, update, delete, and key management (`dxosApiKeys`) actions across permitted roles |
| `wms` | Role-permitted reads | Mutating actions on `dxosWms` (`receiveStock`, `issueStock`, `epodCapture`) |
| `dmn` | Role-permitted reads | `dxosDmn:saveTable` and `dxosDmn:saveDelegation` |
| `iot` | Role-permitted reads | `dxosBroker`, `dxosAutomations`, and IoT actions on `dxosBlocks` (`telemetryIngest`, `twinSetDesired`, `twinAckCommand`, `alarmIngest`, `alarmAck`, `alarmClear`, `provisionDevice`, `revokeDevice`, `deviceStatusIngest`) |
| `ai` | Role-permitted reads | `dxosAi`, `dxosMcp`, `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `dxosN8n`, `dxosAutomations`, and `dxosApprovals:decide` |
| `ledger` | Role-permitted reads | Document signing and key rotation via `dxosLedger:signDocument` and `dxosLedger:rotateKey` |

Alongside `GET`, `HEAD`, and `OPTIONS`, keys holding only the `read` scope may invoke read-only `POST` actions (`*:list`, `*:get`, `*:count`) and deterministic verification/query endpoints: `dxosLedger:verify`, `dxosLedger:verifySignature`, `latticePara:hybridSearch`, `dxosDmn:evaluate`, `dxosStudio:solutionBundleDiff`, `charts:queryData`, `dxosDataGov:computeMkt`, and `latticeIntegrations:{record,context,proposals,proposalReceipt}`. Requests to `/api/dxos-mcp*` with a read-only key are rejected.

## Key Lifecycle Endpoints (`dxosApiKeys`)

### Issuing a Key

<ApiEndpoint
  method="POST"
  path="/api/dxosApiKeys:issue"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write"
  summary="Issues a scoped ldx_pat_* key bound to a user, role, and organization. Returns the plaintext token once."
/>

<ParamGrid
  title="dxosApiKeys:issue Parameters"
  :items="[
    { name: 'name', type: 'string', required: true, description: 'Human-readable key label, 1..120 characters.' },
    { name: 'scopes', type: 'string[]', required: true, description: 'Non-empty array of scopes from {read, write, wms, dmn, iot, ai, ledger}.' },
    { name: 'expiresInDays', type: 'integer', required: false, default: 'null', description: 'Validity window in days (1..365). Omit for non-expiring keys.' },
    { name: 'roleName', type: 'string', required: false, description: 'Role bound to the key. Non-admin users may only select non-elevated roles they currently hold.' },
    { name: 'userId', type: 'integer', required: false, description: 'Target user ID. Only administrators or root may issue keys for other users.' },
    { name: 'organizationId', type: 'string', required: false, description: 'Target organization identifier (only root may specify another organization).' }
  ]"
/>

Privilege escalation protections in `resolveIssueTarget`:

- Non-administrators (`allowConfigure !== true` and lacking `pm`/`pm.*` snippets) cannot issue keys for other users (`API_KEY_FORBIDDEN`) or bind elevated roles (`API_KEY_ROLE_ESCALATION`).
- Organization admins (`ldx_admin`) cannot issue `root` keys or keys belonging to another organization (`NATIVE_ORGANIZATION_MISMATCH`).

### Listing and Revoking Keys

<ApiEndpoint
  method="GET"
  path="/api/dxosApiKeys:list?limit=50"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Lists API key metadata with keyHash omitted. Standard users see only their own keys; admins see all keys in their organization."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosApiKeys:revoke"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="write"
  summary="Revokes an API key by id (or filterByTk / keyId), setting active = false and recording revokedAt and revokedBy."
/>

## Zero-Downtime Key Rotation

To rotate credentials used by active workers or edge gateways without dropping traffic:

1. Issue a replacement key via `POST /api/dxosApiKeys:issue` with the same `roleName`, `scopes`, and `expiresInDays`.
2. Deploy the new secret to client configurations and confirm a successful `GET` health or list call.
3. Revoke the previous key via `POST /api/dxosApiKeys:revoke`; subsequent requests using the old token fail immediately with `401 API_KEY_REVOKED`.

<CodeTabs :tabs="rotationTabs" />

## Rate Limits and Error Codes

Traffic authenticated with `ldx_pat_*` is subject to APISIX `limit-count` buckets (`240 req/60s` on `/api/*`, `120 req/60s` on `/api/dxos-mcp*`, `300 req/60s` on telemetry ingestion) and the NocoBase ACL rules attached to the key's `roleName`.

| Error Code | HTTP | Cause |
|---|---|---|
| `API_KEY_INVALID` | `401` | Fails `PAT_TOKEN_RE`, fails `keyHash` match, or has invalid user/org binding |
| `API_KEY_REVOKED` | `401` | Key is inactive (`active !== true`) or `revokedAt` is set |
| `API_KEY_EXPIRED` | `401` | Current timestamp is past `expiresAt` |
| `API_KEY_USER_INACTIVE` / `API_KEY_ROLE_REVOKED` / `API_KEY_MEMBERSHIP_INACTIVE` | `401` | Owner account disabled, role removed from `rolesUsers`, or employee deactivated in `latticeEmployees` |
| `API_KEY_SCOPE_INSUFFICIENT` | `403` | Key lacks `write` or the domain scope (`wms`, `dmn`, `iot`, `ai`, `ledger`) required by the action |
| `API_KEY_ROLE_ESCALATION` | `403` | Caller attempted to bind a role with higher privileges than held |

## Related

- [REST API Reference](/en/reference/rest-api)
- [Zero-Trust Security Model](/en/architecture/security-model)
- [PKI & Merkle Ledger](/en/reference/pki-merkle-ledger)
- [OpenAPI 3.1 & AsyncAPI 3.0](/en/reference/openapi-asyncapi)
