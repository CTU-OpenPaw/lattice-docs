---
title: Public Forms (/v/form/:slug)
description: Zero-PII external data intake via /v/form/:slug and dxosForms with collection allowlisting, sliding-window rate limits, SHA-256 access/status tokens, magic-byte file verification, and public_form.submitted CloudEvents.
---

# Public Forms (`/v/form/:slug`)

Public forms allow external partners, customers, and unauthenticated field reporters to submit requests, orders, incident reports, or service tickets at `/v/form/:slug` through the `dxosForms` resource (`public-forms.js` and `public-form-html.js`) in `@latticedx/plugin-lattice-foundation`. The intake pipeline enforces Zero-PII isolation: anonymous clients never receive `organizationId`, internal defaults, or target collection names, and direct CRUD access to form metadata or submission tables is blocked.

Every valid submission runs inside a tenant-scoped PostgreSQL RLS transaction (`withTenantRlsContext`), inserts the target business record, stores an audit receipt in `latticePublicFormSubmissions`, and emits a `public_form.submitted` CloudEvent to the Event Bus.

## `latticePublicFormsGuard` and Routing Boundary

The `registerPublicFormsGuard` middleware (tagged `latticePublicFormsGuard`, mounted `after: 'acl'`) blocks direct non-`root` CRUD or `charts:queryData` requests against:

- `latticePublicForms`
- `latticePublicFormSubmissions`

Blocked requests fail with HTTP `403` (`PUBLIC_FORM_DIRECT_ACCESS_FORBIDDEN`), forcing all interactions through `dxosForms`. At the Nginx edge (`10-lattice-public-routes.sh`), `/v/form` proxies directly to the application upstream and `/form` issues a `302` redirect to `/v/form`.

## `dxosForms` API Reference

`dxosForms` exposes 3 `public` actions and 7 `loggedIn` administrative actions guarded by `resolveAdminContext`. Two inspection actions (`listSubmissions` and `downloadAttachment`) also permit business managers (`ldx_manager`, `ldx_admin`, `admin`).

### Public Actions (`public` ACL)

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:meta?slug=partner-intake"
  auth="Public"
  summary="Returns public field metadata via serializePublicMeta, stripping organizationId, targetCollection, and token hashes."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:submit?slug=partner-intake"
  auth="Public | Optional x-form-token (ldx_ftok_*)"
  summary="Validates payload, honeypot, and rate limits; creates target record and submission receipt; returns submissionCode and statusToken (ldx_frm_*)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:status?slug=partner-intake&submissionCode=LDX-FRM-...&token=ldx_frm_..."
  auth="Public + statusToken (ldx_frm_*)"
  summary="Queries live target record status using constant-time SHA-256 verification via timingSafeEqualHex."
/>

### Administrative Actions (`loggedIn` ACL)

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:list?limit=50"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin"
  summary="Lists public form definitions scoped to the caller's tenant (or all tenants for root)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:get?id=1"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin"
  summary="Fetches a single form definition by numeric id or slug."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:save"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin + write"
  summary="Creates or updates a form definition, validating SLUG_RE, PUBLIC_FORM_ALLOWLIST_COLLECTIONS, and BLOCKED_TARGET_FIELDS."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:delete"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin + write"
  summary="Deletes a tenant-owned form definition by id (supports POST and DELETE)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:rotateToken"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin + write"
  summary="Generates a fresh ldx_ftok_<48 hex> access token, stores its SHA-256 accessTokenHash, and enables requireAccessToken."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:listSubmissions?slug=partner-intake&page=1&pageSize=20"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin | Manager"
  summary="Lists sanitized submission receipts alongside attachment metadata."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:downloadAttachment?submissionCode=LDX-FRM-...&fieldName=attachment"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin | Manager"
  summary="Streams a stored attachment with Content-Disposition: attachment and X-Content-Type-Options: nosniff."
/>

## Slug Rules, Allowlisted Collections, and Field Schema

Every form definition passes `validatePublicFormDefinition` before persistence:

<ParamGrid
  title="Form Definition Schema (dxosForms:save)"
  :items="[
    { name: 'slug', type: 'string', required: true, description: 'Matches /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/ (3 to 63 chars) and is excluded from the 15 RESERVED_FORM_SLUGS.' },
    { name: 'title', type: 'string', required: true, description: 'Public form title (1 to 180 characters).' },
    { name: 'targetCollection', type: 'string', required: true, description: 'Must be in PUBLIC_FORM_ALLOWLIST_COLLECTIONS or match ^latticeCustom[A-Z][A-Za-z0-9]{1,40}$.' },
    { name: 'allowedFieldsJson', type: 'FieldSpec[]', required: true, description: '1 to 50 input field descriptors restricted to the 9 ALLOWED_FIELD_TYPES.' },
    { name: 'defaultValuesJson', type: 'object', description: 'Primitive default values applied server-side on target creation; rejects BLOCKED_TARGET_FIELDS.' },
    { name: 'honeypotField', type: 'string', default: '_hp_website', description: 'Hidden bot-trap field name matching /^[a-zA-Z_][a-zA-Z0-9_]{1,63}$/.' },
    { name: 'rateLimitPerMinute', type: 'integer', default: '20', description: 'Per-IP per-slug submission cap per minute (1..300).' },
    { name: 'requireAccessToken', type: 'boolean', default: 'false', description: 'Enforces ldx_ftok_* bearer or header token verification on submit.' },
    { name: 'workflowRuleKey', type: 'string', description: 'Optional workflow key attached to the emitted public_form.submitted CloudEvent.' },
    { name: 'active', type: 'boolean', default: 'true', description: 'Enables or disables public metadata and submissions.' }
  ]"
/>

### Target Collection Allowlist (`PUBLIC_FORM_ALLOWLIST_COLLECTIONS`)

Forms may only write to 8 built-in collections or custom collections matching `^latticeCustom[A-Z][A-Za-z0-9]{1,40}$`:

| Target Collection | Typical Intake Use Case | Initialized Fields |
| :--- | :--- | :--- |
| `latticeRequests` | Purchase or partner intake requests | `status: 'submitted'`, `version: 1`, `amendmentNo: 0` |
| `latticeOrders` | External order or shipment requests | `status: 'submitted'`, `version: 1`, `amendmentNo: 0` |
| `latticeServiceTickets` | Customer support and service tickets | `status: 'submitted'`, `version: 1`, `amendmentNo: 0` |
| `latticeIncidentCases` | Field cold-chain incident reports | `status: 'submitted'` |
| `latticeParaDocuments` | External knowledge vault submissions | `status: 'submitted'` |
| `latticeAgentProposals` | Queued operational proposals | `status: 'submitted'` |
| `latticeLocations` | Partner site or drop-off registration | `active: true` |
| `latticeAssets` | Asset and equipment onboarding | `active: true` |

### Reserved Slugs and Supported Field Types

| Rule | Values |
| :--- | :--- |
| `RESERVED_FORM_SLUGS` (`15`) | `admin`, `api`, `signin`, `signup`, `mobile`, `track`, `form`, `v`, `p`, `static`, `storage`, `files`, `lattice`, `health`, `settings` |
| `ALLOWED_FIELD_TYPES` (`9`) | `string`, `text`, `number`, `integer`, `boolean`, `date`, `email`, `select`, `file` |
| Field length & regex bounds | `DEFAULT_MAX_FIELD_LENGTH = 2000` (`MAX_FIELD_LENGTH_CAP = 10000`), regex `pattern <= 120` chars with nested quantifier rejection to prevent ReDoS. |

## Security Controls, Anti-Spam, and Rate Limiting

### Zero-PII, Prototype Guards, and `BLOCKED_TARGET_FIELDS`

#### `serializePublicMeta`

Public metadata responses return only `slug`, `title`, `description`, `fields`, `honeypotField`, `requireAccessToken`, and `active`, omitting `organizationId`, `targetCollection`, `accessTokenHash`, `createdByUserId`, and `defaultValuesJson`.

#### Prototype & depth guard (`assertNoPrototypePollution`)

Rejects payloads nested deeper than `20` levels (`maxDepth = 20`) or containing `__proto__`, `constructor`, or `prototype`. Supplying `organizationId` in `submit` requests fails immediately with `400 FORM_ORG_OVERRIDE_FORBIDDEN`.

#### `BLOCKED_TARGET_FIELDS`

Blocks exposure or client override of 29 system, lifecycle, and security keys:

```text
id, organizationId, createdAt, updatedAt, createdById, updatedById,
status, version, amendedFromId, amendmentNo, requesterId, assigneeId,
submittedBy, cancelledBy, cancelReason, cancelledAt, submittedAt,
userId, identitySubject, password, secret, token, apiKey, privateKey,
accessTokenHash, statusTokenHash, __proto__, constructor, prototype
```

Any field name matching `SENSITIVE_FIELD_NAME_RE` (`password|secret|token|apikey|api_key|privatekey|private_key|hash|salt`) is also rejected across form schemas, defaults, and hydrated submission listings.

### `_hp_website` Honeypot and `20 / 60 / 300` Rate Limits

- **Bot honeypot (`_hp_website`):** If any request bag (`body`, `params`, `values`) supplies a non-empty value for the configured `honeypotField` or `_hp_website`, the submission is rejected with `400 FORM_BOT_DETECTED`.
- **60-second sliding-window rate limiter (`createSlidingWindowRateLimiter`):**

| Scope | Constant | Default Limit / Min | Counter Key |
| :--- | :--- | :---: | :--- |
| Pre-lookup IP flood protection | `PRE_LOOKUP_IP_FLOOD_LIMIT` | `300` | `${clientIp}:__flood__` |
| Form submission (`dxosForms:submit`) | `DEFAULT_RATE_LIMIT_PER_MIN` | `20` *(configurable `1..300`)* | `${clientIp}:${slug}` |
| Status lookup (`dxosForms:status`) | `STATUS_RATE_LIMIT_PER_MIN` | `60` | `${clientIp}:status:${slug}` |

Exceeded windows return HTTP `429 RATE_LIMIT_EXCEEDED` with a `Retry-After` header.

### Token Model: `ldx_ftok_` and `ldx_frm_`

- **Form access token (`ldx_ftok_<48 hex>`):** When `requireAccessToken` is enabled, `dxosForms:rotateToken` generates a 24-byte random token prefixed with `ldx_ftok_` and persists only its SHA-256 digest (`accessTokenHash`). Clients supply the token via body (`token` / `accessToken`), query, or `x-form-token` header; validation executes constant-time `timingSafeEqualHex` (using `DUMMY_HASH_HEX` when the form does not exist to prevent timing side-channels).
- **Submission status token (`ldx_frm_<48 hex>`):** Every accepted submission generates a unique `submissionCode` (`LDX-FRM-<8 hex>`) and a one-time `statusToken` (`ldx_frm_...`), storing only its SHA-256 `statusTokenHash` for subsequent `dxosForms:status` checks.

## File Upload Magic-Byte Verification and `public_form.submitted` CloudEvent

The `sanitizeFileFieldValue` handler caps uploads at `MAX_FILE_UPLOAD_BYTES = 2MB` (`2,097,152` bytes), blocks path-traversal characters (`..`, `/`, `\`, control bytes), hashes content with SHA-256, and verifies binary file signatures across the 5 `ALLOWED_FILE_MIME_TYPES`:

| MIME Type | Magic-Byte / Content Verification |
| :--- | :--- |
| `application/pdf` | Leading 5 bytes match `%PDF-` |
| `image/png` | Leading 8 bytes match `89 50 4E 47 0D 0A 1A 0A` |
| `image/jpeg` | Leading 3 bytes match `FF D8 FF` |
| `image/webp` | Bytes `0..3` equal `RIFF` and bytes `8..11` equal `WEBP` |
| `text/plain` | Zero `0x00` null bytes and does not start with `<script`, `<svg`, `<html`, `<?xml`, `<!doctype`, `<!--`, `<iframe`, `<object`, or `<embed` |

After committing both the target record and the `latticePublicFormSubmissions` receipt, `dxosForms:submit` emits the `public_form.submitted` CloudEvent (`source: 'dxosForms'`, `subject: submissionCode`) carrying `{ slug, submissionCode, targetCollection, targetRecordId, workflowRuleKey }` to trigger downstream LatticeFlow v2 rules or Event Bus webhooks.

<CodeTabs
  :tabs="[
    {
      label: 'Create Form (save)',
      lang: 'bash',
      code: 'curl -X POST https://localhost:8443/api/dxosForms:save \\\n  -H \x22Authorization: Bearer $ADMIN_TOKEN\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \'{\n    \x22slug\x22: \x22coldchain-incident\x22,\n    \x22title\x22: \x22Cold-Chain Incident Intake\x22,\n    \x22targetCollection\x22: \x22latticeIncidentCases\x22,\n    \x22rateLimitPerMinute\x22: 20,\n    \x22allowedFieldsJson\x22: [\n      { \x22name\x22: \x22name\x22, \x22label\x22: \x22Incident Summary\x22, \x22type\x22: \x22string\x22, \x22required\x22: true, \x22maxLength\x22: 160 },\n      { \x22name\x22: \x22severity\x22, \x22label\x22: \x22Severity\x22, \x22type\x22: \x22select\x22, \x22required\x22: true, \x22options\x22: [\x22low\x22, \x22medium\x22, \x22high\x22, \x22critical\x22] },\n      { \x22name\x22: \x22evidence\x22, \x22label\x22: \x22Site Photo\x22, \x22type\x22: \x22file\x22, \x22required\x22: false }\n    ]\n  }\''
    },
    {
      label: 'Submit Form (submit)',
      lang: 'bash',
      code: 'curl -X POST \x22https://localhost:8443/api/dxosForms:submit?slug=coldchain-incident\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \'{\n    \x22values\x22: {\n      \x22name\x22: \x22Warehouse CT-02 exceeded 8.5C threshold\x22,\n      \x22severity\x22: \x22high\x22\n    },\n    \x22_hp_website\x22: \x22\x22\n  }\''
    },
    {
      label: 'Submit Response',
      lang: 'json',
      code: '{\n  \x22ok\x22: true,\n  \x22slug\x22: \x22coldchain-incident\x22,\n  \x22submissionCode\x22: \x22LDX-FRM-9A3C1E04\x22,\n  \x22statusToken\x22: \x22ldx_frm_4f8b2d...\x22,\n  \x22status\x22: \x22submitted\x22,\n  \x22submittedAt\x22: \x222026-11-26T09:15:42.108Z\x22\n}'
    }
  ]"
/>

## Related

- [Multi-Portal Architecture](/en/studio/multi-portal)
- [Events & Transactional Outbox](/en/architecture/events-and-outbox)
- [LatticeFlow v2 Overview](/en/automation/latticeflow-overview)
- [Field Mobile PWA](/en/studio/mobile-pwa)
