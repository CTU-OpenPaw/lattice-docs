---
title: Omnichannel Notifications (dxosNotify)
description: Omnichannel notification routing across SMTP, Telegram, Slack, Webhooks, and In-App with templating, secret scrubbing, and exponential backoff.
---

<script setup>
const notifyTabs = [
  {
    label: 'Omnichannel Dispatch (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosNotify:send \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "channels": ["telegram", "slack", "webhook"],
    "title": "Cold room excursion in {{warehouseCode}}",
    "body": "Lot {{lotCode}} recorded MKT {{mktCelsius}}C",
    "variables": {
      "warehouseCode": "WH-CT-01",
      "lotCode": "LOT-2026-A09",
      "mktCelsius": 8.74
    }
  }'`,
  },
  {
    label: 'Dispatch Response (JSON)',
    lang: 'json',
    code: `{
  "data": {
    "organizationId": "org-coldchain-01",
    "total": 3,
    "succeeded": 3,
    "failed": 0,
    "deliveries": [
      { "channel": "telegram", "status": "sent", "attempts": 1 },
      { "channel": "slack", "status": "sent", "attempts": 1 },
      { "channel": "webhook", "status": "sent", "attempts": 1 }
    ]
  }
}`,
  },
];
</script>

# Omnichannel Notifications (`dxosNotify`)

The notification subsystem in `@latticedx/plugin-lattice-foundation` separates internal portal bell alerts (`notification-center.js`, stored in `latticeNotifications`) from outbound omnichannel delivery (`omnichannel-notify.js`, exposed via `dxosNotify` and logged in `latticeNotificationDeliveries`). All channel credentials remain encrypted inside `latticeConnectors` (`AES-256-GCM` via `dxosVault`) and are never exposed in API responses or delivery logs.

## Supported Channels and Routing Architecture

`dxosNotify` routes outbound messages across four external transports (`SUPPORTED_CHANNELS`: `smtp`, `telegram`, `slack`, `webhook`), alongside internal `in_app` notifications and optional `DX_APPRISE_URL` / `DX_NOTIFICATION_WEBHOOK_URL` bridges. Direct CRUD requests against `latticeNotificationDeliveries` are blocked by middleware; all sends and log reads must invoke `dxosNotify`.

| Channel | Backing `dxosVault` Connector | Payload Format | Channel-Specific Input Guards |
| :--- | :--- | :--- | :--- |
| `smtp` | `email_smtp` | Interpolated plain text or HTML body via <code v-pre>{{var}}</code> | Rejects `\r`, `\n`, `\0` to block header injection (`SMTP_HEADER_INJECTION_BLOCKED`). |
| `telegram` | `telegram` | Text message dispatched via Bot API | Validates bot token format (`[0-9]{5,16}:[A-Za-z0-9_-]{20,120}`) and `chat_id`. |
| `slack` | `slack` | Incoming Webhook or Web API JSON | Classifies transient `ratelimited`, `internal_error`, and `fatal_error` replies. |
| `webhook` | `webhook` / HTTP connector | Custom JSON template or default `lattice.notification` envelope | Enforces asynchronous DNS SSRF checks (`assertSafeConnectorUrlAsync`). |
| `in_app` | Internal notification center | Row in `latticeNotifications` scoped by user or role | Read and acknowledged via the `latticeNotifications` resource. |

<ApiEndpoint
  method="POST"
  path="/api/dxosNotify:send"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Dispatches notifications to a single channel or fans out across multiple channels (requires operator or admin role)."
/>

<ParamGrid
  title="Request Parameters for dxosNotify:send"
  :items="[
    { name: 'channel / channels', type: 'string | string[]', required: true, description: 'Single channel name or array from [smtp, telegram, slack, webhook].' },
    { name: 'connectorKey', type: 'string', description: 'Specific connector key in dxosVault; defaults to the active connector for that channel.' },
    { name: 'target', type: 'string | string[]', description: 'Recipient target (email addresses, Telegram chat_id, or permitted override).' },
    { name: 'title', type: 'string', required: true, description: 'Notification title supporting {{var}} template placeholders.' },
    { name: 'body', type: 'string', required: true, description: 'Notification body supporting {{dot.path}} lookup and optional HTML escaping.' },
    { name: 'variables', type: 'object', description: 'Context object passed to renderTemplate and renderWebhookPayload.' },
    { name: 'template', type: 'object | string', description: 'Structured JSON template used for webhook or Slack payloads.' },
    { name: 'dryRun', type: 'boolean', default: 'false', description: 'Renders payloads and validates routing without executing network requests.' }
  ]"
/>

## Template Interpolation and Secret Scrubbing

`renderTemplate(template, vars, { htmlEscape })` resolves <code v-pre>{{dot.path}}</code> placeholders using `Object.hasOwn` traversal while blocking prototype pollution keys in `BLOCKED_PATH_KEYS` (`__proto__`, `constructor`, `prototype`). When `htmlEscape: true` is active for HTML email bodies, `&`, `<`, `>`, `"`, and `'` characters are escaped.

For `webhook` targets, `renderWebhookPayload` recursively interpolates template strings (`sanitizeAndInterpolateNode`) or constructs a structured default JSON envelope when no custom `template` is supplied:

```json
{
  "event": "lot.held_mkt",
  "organizationId": "org-coldchain-01",
  "category": "cold_chain",
  "severity": "high",
  "title": "MKT threshold exceeded on lot LOT-2026-A09",
  "body": "Computed MKT 8.74C exceeded threshold 8.0C",
  "targetCollection": "latticeStockLots",
  "targetRecordId": 41,
  "targetPath": "/p/incidents",
  "timestamp": "2026-11-26T16:10:00.000Z"
}
```

Before persisting delivery attempts into `latticeNotificationDeliveries`, the engine applies two sanitization layers (`maskTarget` and `scrubSecrets`):

| Sanitization Function | Inspected Field | Persisted Output in `latticeNotificationDeliveries` |
| :--- | :--- | :--- |
| `maskEmail` (`smtp`) | Recipient email addresses | Preserves first character and domain (`a***@example.com`). |
| `maskTarget` (`telegram`) | Telegram `chat_id` | Preserves first 2 and last 2 characters (`12***89`). |
| `scrubSecrets` | Error strings, headers, and response payloads | Replaces Telegram bot tokens, `Bearer`/`Basic` headers, Slack `xox*` tokens, and Vault secrets with `[REDACTED]`. |

## Retry Policy and Exponential Backoff

Outbound transport calls apply `DEFAULT_TIMEOUT_MS = 6000` ms and up to `DEFAULT_MAX_ATTEMPTS = 3` attempts (configurable from `1` to `5`). Retries trigger strictly on transient errors marked `err.retryable === true`, failing immediately on permanent validation or authorization errors.

| Transport / Channel | Retryable Conditions (`retryable = true`) | Immediate Failure Conditions (`retryable = false`) |
| :--- | :--- | :--- |
| HTTP (`webhook`, `telegram`) | HTTP `429`, HTTP `>= 500`, network resets, or `6000` ms timeout. | HTTP `400`, `401`, `403`, `404`, or SSRF-blocked destinations. |
| SMTP (`smtp`) | Transient `4xx` SMTP replies or TCP/TLS connection errors. | Permanent `5xx` SMTP errors, invalid address, or `SMTP_HEADER_INJECTION_BLOCKED`. |
| Slack (`slack`) | `ratelimited`, `internal_error`, `fatal_error`, or HTTP `>= 500`. | `invalid_payload`, `channel_not_found`, or `invalid_auth`. |

The delay between retry attempts follows capped exponential backoff:

```text
delayMs = Math.min(5000, 250 * 2 ** (attempt - 1))
```

With `DEFAULT_BACKOFF_BASE_MS = 250` ms and `MAX_BACKOFF_MS = 5000` ms, the dispatcher waits `250` ms after the first failure and `500` ms after the second failure before recording the final delivery state.

## `dxosNotify` API Reference

| Endpoint | Method | Required Role | Responsibility |
| :--- | :--- | :--- | :--- |
| `/api/dxosNotify:send` | `POST` | `OPERATOR_ROLES` (`root`, `admin`, `ldx_admin`, `ldx_manager`, `operator`) | Sends single-channel or multi-channel notifications using org connectors. |
| `/api/dxosNotify:testSend` | `POST` | `ELEVATED_ROLES` (`root`, `admin`, `ldx_admin`) | Verifies connector reachability and template rendering against `dxosVault`. |
| `/api/dxosNotify:logs` | `GET` | `ELEVATED_ROLES` (`root`, `admin`, `ldx_admin`) | Queries `latticeNotificationDeliveries` with masked targets and scrubbed errors. |
| `/api/dxosNotify:channels` | `GET` | `loggedIn` | Lists `supportedChannels` and active organization connectors without secrets. |

<ApiEndpoint
  method="GET"
  path="/api/dxosNotify:logs"
  auth="Bearer JWT | ldx_pat_*"
  scope="read, write"
  summary="Queries masked notification delivery logs filtered by channel, status, and dryRun."
/>

<ParamGrid
  title="Query Parameters for dxosNotify:logs"
  :items="[
    { name: 'channel', type: 'string', description: 'Filter logs by transport channel: smtp, telegram, slack, or webhook.' },
    { name: 'status', type: 'string', description: 'Filter logs by delivery outcome: sent, failed, or dry_run.' },
    { name: 'dryRun', type: 'boolean', description: 'Filter specifically for simulated dry-run dispatches.' },
    { name: 'limit', type: 'integer', default: '50', description: 'Maximum number of log rows returned per request.' },
    { name: 'offset', type: 'integer', default: '0', description: 'Pagination offset ordered from most recent delivery.' }
  ]"
/>

## Environment Variables and SSRF Boundaries

By default, `omnichannel-notify.js` resolves every destination hostname asynchronously (`assertSafeConnectorUrlAsync`) and blocks loopback, RFC 1918 private ranges, link-local (`169.254.*`), and cloud metadata endpoints. Operators control internal network access through four environment settings:

| Environment Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DX_APPRISE_URL` | *(unset)* | Optional Apprise gateway URL for additional external notification providers. |
| `DX_NOTIFICATION_WEBHOOK_URL` | *(unset)* | Platform fallback webhook endpoint when no tenant connector is specified. |
| `DX_ALLOW_INTERNAL_CONNECTORS` | `'false'` | Controls whether internal network webhook destinations are permitted. |
| `DX_INTERNAL_SERVICE_HOSTS` | *(unset)* | Explicit allowlist of internal hostnames permitted when enabled by `root`. |

<CodeTabs :tabs="notifyTabs" />

In automated workflows, the `notify.send` LatticeFlow v2 node invokes this omnichannel dispatcher alongside `in_app` bell notifications, while `latticeSlaPolicies` and `dxosApprovals` route SLA escalations across configured `notifyChannels`.

## Related

- [Events & Transactional Outbox](/en/architecture/events-and-outbox)
- [Unified Approvals & Delegations](/en/domains/approvals-and-delegations)
- [LatticeFlow v2 Node Reference](/en/automation/node-reference)
- [Environment Configuration](/en/getting-started/configuration)
