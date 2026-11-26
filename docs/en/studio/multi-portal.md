---
title: Multi-Portal Architecture
description: Role-segregated business portals, slug rules, latticePortals API with PostgreSQL transaction advisory locking, 8 ldx_* roles, and public branding routes.
---

# Multi-Portal Architecture

LatticeDX segregates operational workspaces by business role on a single NocoBase `2.2.50` host rather than maintaining separate frontend deployments. The `@latticedx/plugin-lattice-foundation` plugin manages layout lifecycles, role-to-route mappings, and portal metadata, while `@latticedx/plugin-dxos-studio` seeds the default overview portals and domain cockpits.

Each `/p/<slug>` URL binds a `uiLayouts` record, a `desktopRoutes` tree linked through `desktopRoutesUiLayouts`, role visibility entries in `rolesDesktopRoutes`, and metadata stored under `applicationPlugins.options.portals`. All collection queries executed inside any portal pass through PostgreSQL 16 `FORCE ROW LEVEL SECURITY` tenant isolation.

## Built-In Layouts and Seeded Portals

The platform defines two immutable built-in layouts (`BUILTIN_UIDS`) that cannot be deleted via the management API, alongside four seeded overview portals (`OVERVIEW_SPECS` in `portal-composer.js`) and dynamic domain cockpits installed by Business Packs.

| Route Path | Layout UID | Type | Default Roles | Operational Scope |
| :--- | :--- | :--- | :--- | :--- |
| `/admin` | `admin-layout-model` | `desktop` | `root`, `admin` | System administration, plugin settings, and visual builder |
| `/mobile` | `mobile-layout-model` | `mobile` | Field roles | Base shell for the Field Mobile PWA and offline capture |
| `/p/procurement` | `ldx-portal-procurement` | `desktop` | `ldx_employee`, `ldx_manager`, `ldx_director`, `ldx_admin` | Purchase requests (`latticeRequests`), asset ledger (`latticeAssets`) |
| `/p/incidents` | `ldx-portal-incidents` | `desktop` | `ldx_manager`, `ldx_dispatcher`, `ldx_warehouse`, `ldx_director`, `ldx_admin` | IoT incidents (`latticeIncidentCases`), alarm rules (`latticeIncidentRules`), WebGIS |
| `/p/logistics` | `ldx-portal-logistics` | `desktop` | `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver`, `ldx_manager`, `ldx_admin` | Cold-chain orders (`latticeOrders`), warehouses (`latticeLocations`), FEFO and ePOD |
| `/p/services` | `ldx-portal-services` | `desktop` | `ldx_employee`, `ldx_manager`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver`, `ldx_director`, `ldx_admin` | Service tickets (`latticeServiceTickets`), HR directory, P.A.R.A. knowledge vault |

Business Packs installed via `dxosBuilder:installBusinessPack` provision additional domain portals such as `/p/cmms` (CMMS maintenance) and `/p/partner-claims` (partner settlement). The client also registers workspace and builder routes at `/admin/lattice-workspace`, `/admin/lattice-builder`, `/admin/settings/multi-portal`, `/lattice`, `/lattice/console`, `/lattice/studio`, and `/lattice/systems`.

::: tip Prefix-Aware Portal Fallback Routing
The `resolvePortalRedirect` helper resolves `/p/<slug>` to the first `firstPagePath` accessible to the caller's active role. If a user lacks access to the primary portal but holds grants on a sibling portal sharing the same prefix (for example, an `ldx_employee` visiting `/p/logistics` redirects to the employee-scoped logistics portal), the router transitions safely instead of rendering an empty view.
:::

## Slug Rules and Portal Conventions

Every custom portal submitted to `latticePortals:save` is validated and normalized by `normalizePortalInput` (`native-portal-helpers.js`) before any database write runs.

<ParamGrid
  title="Portal Input Normalization & Constraints"
  :items="[
    { name: 'slug', type: 'string', required: true, description: 'Must match SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,35}[a-z0-9])$/ (2 to 37 lowercase alphanumeric or hyphen chars) and cannot appear in RESERVED_SLUGS.' },
    { name: 'uid', type: 'string', description: 'Generated as ldx-portal-<slug> for custom portals. If supplied on create or update, it must match ldx-portal-<slug> (except the two built-in UIDs).' },
    { name: 'title', type: 'string', required: true, description: 'Display name shown in the portal switcher, 1 to 80 characters.' },
    { name: 'layoutType', type: 'desktop | mobile', default: 'desktop', description: 'Layout target stored on uiLayouts.' },
    { name: 'routeName', type: 'string', description: 'Derived as p_<slug_underscored> (hyphens replaced with underscores), or admin for admin-layout-model.' },
    { name: 'routePath', type: 'string', description: 'Derived as /p/<slug> (or /admin for admin-layout-model).' },
    { name: 'icon', type: 'string', default: 'AppstoreOutlined', description: 'Icon identifier matching /^[a-zA-Z0-9_-]{1,64}$/.' },
    { name: 'color', type: 'string', default: '#1677ff', description: 'Hex accent color matching /^#[0-9a-fA-F]{3,8}$/.' },
    { name: 'description', type: 'string', default: '\'\'', description: 'Short portal summary, truncated to 300 characters.' },
    { name: 'isDefault', type: 'boolean', default: 'false', description: 'Marks the portal as default; setting true clears isDefault on all other portals in the same transaction.' },
    { name: 'sort', type: 'integer', default: '0', description: 'Sort order in the portal switcher.' },
    { name: 'enabled', type: 'boolean', default: 'true', description: 'Controls whether end users can access the portal.' },
    { name: 'roles', type: 'string[]', default: 'null', description: 'Business role names granted visibility to routes linked to this layout.' }
  ]"
/>

### Reserved Slugs (`RESERVED_SLUGS`)

To prevent route collisions with administrative panels, public endpoints, and static asset handlers, the following 11 slugs are permanently reserved:

```text
admin, settings, signin, signup, p, v, api, static, storage, files, lattice
```

## `latticePortals` API and PostgreSQL Advisory Locking

The `latticePortals` resource (`native-portals.js`) exposes five actions under the `loggedIn` ACL. All management actions (`list`, `save`, `destroy`, `exportBlueprint`) enforce `isPortalAdmin`, requiring `root`, `allowConfigure: true`, or role snippets containing `pm` / `pm.*`.

<ApiEndpoint
  method="GET"
  path="/api/latticePortals:list"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Lists all configured portals (including disabled ones), route counts, granted business roles, and resolved firstPagePath."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePortals:listAccessible?includeMobile=false"
  auth="Bearer JWT | Session"
  scope="loggedIn"
  summary="Returns enabled portals with at least one accessible page for the caller; hides admin-layout-model and mobile-layout-model from non-admin users by default."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePortals:save"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Creates or updates a portal inside a PostgreSQL transaction, syncs rolesDesktopRoutes, and persists metadata under an advisory lock."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePortals:destroy"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Deletes a custom portal by uid, removes desktopRoutesUiLayouts links, and purges its metadata entry. Rejects built-in UIDs with HTTP 400."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePortals:exportBlueprint?uid=ldx-portal-logistics"
  auth="Bearer JWT | Session"
  scope="Portal Admin"
  summary="Exports a sanitized route tree and role mapping formatted as latticedx.portal-blueprint.v1."
/>

### Transaction Advisory Lock (`741209551`) and Route Grant Sync

Extended portal metadata (`icon`, `color`, `description`, `isDefault`, `sort`, `roles`) is persisted inside `applicationPlugins.options.portals` on the `@latticedx/plugin-lattice-foundation` row. To prevent concurrent admin saves from overwriting sibling entries in that JSON object, `createPortalMetaStore.write` acquires a transaction-scoped PostgreSQL advisory lock before reading and writing:

```sql
SELECT pg_advisory_xact_lock(741209551);
```

The lock is released automatically when the outer Sequelize transaction commits or rolls back. Inside the same transaction, `syncPortalRoles` reconciles `rolesDesktopRoutes` for every `desktopRouteId` linked to the portal:

- Only roles satisfying `isBusinessPortalRole` are added or removed by portal role synchronization.
- Before revoking an unchecked role from a route, `protectedByOtherPortal` checks whether that route is also linked to `admin-layout-model` or another portal whose `roles` metadata still grants that role, preventing accidental lockouts on shared routes.

<CodeTabs
  :tabs="[
    {
      label: 'Create Custom Portal',
      lang: 'bash',
      code: 'curl -X POST https://localhost:8443/api/latticePortals:save \\\n  -H \x22Authorization: Bearer $TOKEN\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \'{\n    \x22slug\x22: \x22quality-qa\x22,\n    \x22title\x22: \x22Quality Assurance Portal\x22,\n    \x22layoutType\x22: \x22desktop\x22,\n    \x22icon\x22: \x22SafetyCertificateOutlined\x22,\n    \x22color\x22: \x22#D94E1F\x22,\n    \x22sort\x22: 35,\n    \x22roles\x22: [\x22ldx_warehouse\x22, \x22ldx_manager\x22, \x22ldx_admin\x22]\n  }\''
    },
    {
      label: 'exportBlueprint Response',
      lang: 'json',
      code: '{\n  \x22format\x22: \x22latticedx.portal-blueprint.v1\x22,\n  \x22license\x22: \x22Apache-2.0\x22,\n  \x22exportedAt\x22: \x222026-11-26T08:30:00.000Z\x22,\n  \x22portal\x22: {\n    \x22uid\x22: \x22ldx-portal-quality-qa\x22,\n    \x22slug\x22: \x22quality-qa\x22,\n    \x22title\x22: \x22Quality Assurance Portal\x22,\n    \x22layoutType\x22: \x22desktop\x22,\n    \x22routeName\x22: \x22p_quality_qa\x22,\n    \x22routePath\x22: \x22/p/quality-qa\x22,\n    \x22enabled\x22: true,\n    \x22builtin\x22: false,\n    \x22icon\x22: \x22SafetyCertificateOutlined\x22,\n    \x22color\x22: \x22#D94E1F\x22,\n    \x22isDefault\x22: false,\n    \x22sort\x22: 35\n  },\n  \x22routes\x22: [],\n  \x22roles\x22: [\x22ldx_admin\x22, \x22ldx_manager\x22, \x22ldx_warehouse\x22]\n}'
    }
  ]"
/>

## The 8 Native `ldx_*` Roles and Business Role Filtering

The `@latticedx/plugin-lattice-foundation` plugin provisions 8 operational roles (`native-roles.js`) with `allowConfigure: false`, `allowNewMenu: false`, `allowNewAiEmployee: false`, and collection/field-level ACL scopes.

| Role Name | Purpose | Document Read Scope (`latticeRequests`, `latticeOrders`) | Write & Operational Capabilities |
| :--- | :--- | :--- | :--- |
| `ldx_employee` | Employee | Restricted to records where `requester.userId` or `assignee.userId` matches caller | Create requests/orders and update own `draft` records |
| `ldx_manager` | Manager | Full visibility within tenant organization | Create, update own drafts, approve/reject/assign, manage IoT cases |
| `ldx_operator` | Operator | Assigned or requested records | Execute operational tasks and complete assigned steps |
| `ldx_warehouse` | Warehouse | Assigned or requested records | Execute FEFO stock allocations, issues, MKT holds, and lot checks |
| `ldx_dispatcher` | Dispatcher | Full visibility within tenant organization | Create, update drafts, dispatch orders, and complete deliveries |
| `ldx_driver` | Driver | Assigned or requested records | Complete delivery legs and submit field ePOD captures |
| `ldx_director` | Director (read-only) | Full visibility within tenant organization | Read-only (`view`) across operational collections; no `create` or `update` |
| `ldx_admin` | Business Admin | Full visibility within tenant organization | Full operational CRUD and incident resolution within the tenant |

The `isBusinessPortalRole` predicate (`src/shared/portal-roles.js`) governs which roles appear in the Multi-Portal Manager:

1. The role name must match `BUSINESS_ROLE_NAME_RE = /^[a-z][a-z0-9_]{1,40}$/`.
2. Four system roles in `SYSTEM_PORTAL_EXCLUDED_ROLES` are always excluded: `root`, `admin`, `anonymous`, `member`.
3. Any role with `allowConfigure === true` or admin plugin snippets (`pm` or `pm.*`) is excluded.

## Public Tenant Branding (`/v/lattice-brand.svg`) and Gateway Routing

Protected file storage under `/files/*` requires an authenticated session. To render tenant branding on the sign-in screen, `/v/track/:code` verification views, and `/v/form/:slug` intake pages without exposing internal file storage endpoints, `public-branding.js` registers two handlers:

- **`createPublicBrandingGatewayHandler`:** Serves `GET` and `HEAD` requests for `/v/lattice-brand.svg` (and fallback `/v/favicon_no_exist.ico`) with `Content-Type: image/svg+xml; charset=utf-8`, `Cache-Control: public, max-age=86400`, and `X-Content-Type-Options: nosniff`.
- **`createSystemSettingsBrandingMiddleware`:** Wraps `systemSettings:get`. When the caller is unauthenticated or the logo references the seeded default `/files/main/main/attachments/1.png` (`nocobase-logo`), it rewrites `logo.url` and `logo.preview` to `/v/lattice-brand.svg` and sets `logo.title` to `LatticeDX`.

At the Nginx edge (`infra/config/nginx/10-lattice-public-routes.sh`), public routes proxy `/.well-known/agent-card.json`, `/v/form`, `/v/track`, `/v/mobile`, and `/track` to the application upstream while issuing a `302` redirect from `/form` to `/v/form`. Both `BuilderShell` and `MultiPortalSettingsPage` preserve the `Powered by NocoBase` attribution linking to `https://www.nocobase.com` in compliance with NocoBase `2.2.50` Clause 5.2.

## Error Reference & Troubleshooting

| HTTP Status | Error Message | Resolution |
| :--- | :--- | :--- |
| `400` | `Portal slug must match /^[a-z0-9](?:[a-z0-9-]{0,35}[a-z0-9])$/` or `Portal slug is reserved` | Use 2–37 lowercase alphanumeric/hyphen characters and avoid the 11 `RESERVED_SLUGS`. |
| `400` | `Cannot delete built-in portal` | Never call `latticePortals:destroy` on `admin-layout-model` or `mobile-layout-model`. |
| `403` | `Portal administration permission required` | Caller must hold `root`, `allowConfigure: true`, or `pm` / `pm.*` snippets. |
| `409` | `Portal with this slug already exists` or `Portal route already exists` | `uid`, `routeName`, or `routePath` already exists in `uiLayouts`; supply `uid` to update instead of creating. |

## Related

- [12 Native v2 BlockModels](/en/studio/native-blocks)
- [Public Forms (/v/form/:slug)](/en/studio/public-forms)
- [Field Mobile PWA](/en/studio/mobile-pwa)
- [Multi-Tenant PostgreSQL FORCE RLS](/en/architecture/multi-tenancy-rls)
