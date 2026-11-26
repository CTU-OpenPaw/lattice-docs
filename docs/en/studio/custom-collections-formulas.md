---
title: Custom Collections & Safe AST Formulas
description: Technical reference for dxosBuilder ^latticeCustom* collections, 12 field types, linear-time Thompson NFA validation, automatic PostgreSQL FORCE RLS, and all 22 Safe AST formula functions.
---

# Custom Collections & Safe AST Formulas

The dynamic schema subsystem in `@latticedx/plugin-dxos-studio` lets platform administrators and App Builder provision tenant-isolated domain tables through `dxosBuilder` without hand-written SQL DDL. Every custom collection receives an indexed `organizationId` column, `FORCE ROW LEVEL SECURITY` in PostgreSQL 16, linear-time Thompson NFA input validation, and sandboxed derived fields evaluated on a pure recursive-descent AST interpreter.

## `dxosBuilder` API and Naming Contract

All `dxosBuilder` actions are guarded by `requireBuilderAdmin`. Schema creation and mutation require `rootOnly` privilege alongside PAT scope `write`.

<ApiEndpoint
  method="GET"
  path="/api/dxosBuilder:listDomains"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Lists all ^latticeCustom* collections with field definitions, RLS status, and bound portal routes."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosBuilder:createDomain"
  auth="Bearer JWT | ldx_pat_*"
  scope="write (rootOnly)"
  summary="Creates or updates a ^latticeCustom* collection, attaching organizationId, B-tree index, FORCE RLS, ldx_* role permissions, and an optional portal page."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosBuilder:listBusinessPacks"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Returns the built-in BUSINESS_PACK_CATALOG entries and their domain schema templates."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosBuilder:installBusinessPack"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Installs a Business Pack into the target organization, syncing collections, DMN tables, and portal views."
/>

<ParamGrid
  title="Naming Constraints and Protection Boundaries"
  :items="[
    { name: 'CUSTOM_COLLECTION_RE', type: 'RegExp', default: '/^latticeCustom[A-Z][A-Za-z0-9]{1,40}$/', description: 'All user-defined or App Builder collections must match this naming pattern.' },
    { name: 'FIELD_NAME_RE', type: 'RegExp', default: '/^[a-z][a-zA-Z0-9_]{0,62}$/', description: 'Field identifiers start with a lowercase letter and are capped at 63 characters.' },
    { name: 'BLOCKED_FIELD_NAMES', type: 'Set<string>', default: '6 keys', description: 'Blocks __proto__, constructor, prototype, id, createdAt, and updatedAt.' },
    { name: 'SYSTEM_PROTECTED_COLLECTIONS', type: 'Set<string>', default: '32 tables', description: 'Prevents overwriting or targeting system tables such as users, roles, apiKeys, workflows, latticeAiAuditLogs, and latticeUiSnapshots.' },
    { name: 'ALLOWLISTED_BUSINESS_COLLECTIONS', type: 'Set<string>', default: '9 tables', description: 'Core tables permitted as relation targets: latticeRequests, latticeOrders, latticeOrderLines, latticeServiceTickets, latticeParaDocuments, latticeIncidentCases, latticeLocations, latticeAssets, latticeAgentProposals.' }
  ]"
/>

## Automatic PostgreSQL RLS and `belongsToMany` Join Safety

Whenever `createOrUpdateDomainCollection` provisions or extends a `latticeCustom*` collection, `domain-schema-rls.js` executes a deterministic safety sequence:

1. Prepends a non-null indexed `organizationId` (`string`, `allowNull: false`, `index: true`) column and creates index `idx_<collection>_org`. If the index identifier exceeds PostgreSQL's 63-byte cap, `buildSafePgIndexName` truncates it and appends an 8-character SHA-256 hash suffix.
2. For every `belongsToMany` field, `ensureBelongsToManyJoinCollection` provisions and RLS-protects the join table `latticeCustom<Src><Tgt>Join` (with organization, foreign-key, and composite unique `(organizationId, foreignKey, otherKey)` indexes) before syncing the parent table. This prevents Sequelize from auto-creating an unprotected join table.
3. `attachAndVerifyPgRls` runs `ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY` and installs policy `lattice_tenant_isolation` referencing `app.current_org` and `app.rls_bypass`. It then queries `pg_class` (`relrowsecurity`, `relforcerowsecurity`), throwing `PG_RLS_VERIFICATION_FAILED` if verification fails.
4. During `ALTER TABLE` schema migrations on existing tables, `syncCollectionWithSafeRls` keeps RLS enabled (fail-closed) while temporarily dropping and re-attaching `lattice_tenant_isolation` inside a `try/finally` block.
5. Finally, `grantDomainRbac` grants `DEFAULT_ROLE_ACTIONS` to `ldx_admin`, `ldx_manager`, `ldx_operator`, and `ldx_employee`, and binds a portal page via `upsertPortalPageForDomain` when `portalSlug` is supplied.

## All 12 Supported Field Types (`ALLOWED_FIELD_TYPES`)

`rich-schema.js` supports 12 canonical field types (`ALLOWED_FIELD_TYPES`) mapped to NocoBase interfaces and UI components:

| # | Field `type` | NocoBase `interface` | `uiSchema['x-component']` | Storage and Special Configuration |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `string` | `input` (or `select`) | `Input` (or `Select`) | Short text; switches to `Select` when `enumValues` or `validation.enum` is set. |
| 2 | `text` | `textarea` | `Input.TextArea` | Multi-line text supporting `validation.min`, `max`, and `pattern`. |
| 3 | `integer` | `integer` | `InputNumber` | Integer column supporting `required`, `unique`, `min`, `max`, and `enum`. |
| 4 | `float` | `number` | `InputNumber` | Floating-point number supporting `required`, `unique`, `min`, and `max`. |
| 5 | `boolean` | `checkbox` | `Checkbox` | Boolean flag; `min` and `max` validation are disallowed. |
| 6 | `date` | `date` | `DatePicker` | Calendar date without time-of-day component. |
| 7 | `datetime` | `datetime` | `DatePicker` (`showTime: true`) | Full ISO-8601 timestamp with time picker. |
| 8 | `json` | `json` | `Input.JSON` | Stored as PostgreSQL `jsonb`; `unique`, `min`, and `max` are disallowed. |
| 9 | `belongsTo` | `obo` | `AssociationField` | Uses `foreignKey` (default `<name>Id`), targeting `latticeCustom*` or the 9 allowlisted business collections. |
| 10 | `hasOne` | `oho` | `AssociationField` | One-to-one relation referencing `target` via `foreignKey` and `sourceKey` (`id`). |
| 11 | `belongsToMany` | `m2m` | `AssociationField` | Many-to-many relation backed by an automatically RLS-protected `through` join table. |
| 12 | `formula` | `formula` | `InputNumber` / `Input` / `Checkbox` | Read-only derived field (`x-read-pretty: true`) evaluated by the Safe AST Engine according to `formulaReturnType`. |

## Validation Rules and Linear-Time Thompson NFA Engine

Field validation rules are stored under `uiSchema['x-validation']` and enforced synchronously at runtime via `beforeValidate` and `beforeSave` hooks (`registerRichSchemaHooks`). Supported keys are `required`, `unique` (tenant-scoped uniqueness check returning HTTP `409`), `min`, `max`, `enum` (`1..100` string or finite number items), and `pattern` (`string` and `text` fields only).

Instead of executing V8's backtracking `RegExp.test` (which is vulnerable to ReDoS), `validateSafeRegexPattern` compiles each pattern into a Thompson NFA and runs an `O(n * m)` lock-step simulation. Backreferences, lookbehinds, and nested or ambiguous quantifiers are rejected before compilation.

<ParamGrid
  title="Thompson NFA Safety Limits"
  :items="[
    { name: 'MAX_REGEX_PATTERN_LENGTH', type: 'number', default: '256', description: 'Maximum length of the validation regex pattern string.' },
    { name: 'MAX_REGEX_INPUT_LENGTH', type: 'number', default: '4096', description: 'Maximum field value string length accepted by the runtime matcher.' },
    { name: 'MAX_REGEX_QUANTIFIER_BOUND', type: 'number', default: '100', description: 'Maximum repetition bound {m,n} and total quantifier count per pattern.' },
    { name: 'MAX_REGEX_AST_DEPTH', type: 'number', default: '64', description: 'Maximum AST group nesting depth allowed during regex parsing.' },
    { name: 'MAX_NFA_STATES', type: 'number', default: '512', description: 'Maximum total NFA state count for start-anchored (^) patterns.' },
    { name: 'MAX_UNANCHORED_ROOT_NFA_STATES', type: 'number', default: '320', description: 'Stricter root state cap enforced on unanchored regex patterns.' },
    { name: 'MAX_TOTAL_LOOKAHEAD_STATES', type: 'number', default: '120', description: 'Maximum combined NFA states allocated to positive or negative lookaheads.' }
  ]"
/>

## Safe AST Formula Engine (`rich-schema.js`)

Formula fields are tokenized, parsed by recursive descent, and interpreted directly on the AST without `eval` or `new Function`. Declared `formulaReturnType` must be one of `float`, `integer`, `string`, or `boolean`.

<ParamGrid
  title="Sandbox Guardrails and Blocked Identifiers"
  :items="[
    { name: 'MAX_FORMULA_LENGTH', type: 'number', default: '1000', description: 'Maximum character length of a formula expression string.' },
    { name: 'MAX_FORMULA_TOKENS', type: 'number', default: '256', description: 'Maximum lexical token count emitted by tokenizeFormula.' },
    { name: 'MAX_FORMULA_DEPTH', type: 'number', default: '24', description: 'Maximum AST nesting depth allowed during expression parsing.' },
    { name: 'Supported Operators', type: 'operators', default: '17 operators', description: 'Arithmetic (+, -, *, /, %), logical (!, &&, ||), ternary (?:), and comparison (==, ===, !=, !==, <, <=, >, >=).' },
    { name: 'BLOCKED_FORMULA_IDENTIFIERS', type: 'Set<string>', default: '15 keywords', description: 'Blocks __proto__, constructor, prototype, global, globalThis, process, require, module, exports, Function, eval, Proxy, Reflect, window, and self.' }
  ]"
/>

### Complete Catalog of 22 Formula Functions (`FORMULA_FUNCTIONS`)

#### Math Functions (8)

| Signature | Parameter Types | Return Type | Edge & Null Handling |
| :--- | :--- | :--- | :--- |
| `ROUND(n, digits = 0)` | `number`, `integer?` | `number \| null` | Clamps `digits` to `[0..10]`; returns `null` when `n` is non-finite. |
| `ABS(n)` | `number` | `number \| null` | Returns `Math.abs(n)` or `null` if `n` cannot coerce to a finite number. |
| `CEIL(n)` | `number` | `integer \| null` | Rounds upward via `Math.ceil(n)` or returns `null`. |
| `FLOOR(n)` | `number` | `integer \| null` | Rounds downward via `Math.floor(n)` or returns `null`. |
| `MIN(...args)` | `...number` | `number \| null` | Filters out `null`/non-numeric arguments; returns `null` if none remain. |
| `MAX(...args)` | `...number` | `number \| null` | Filters out `null`/non-numeric arguments; returns maximum or `null`. |
| `POW(base, exp)` | `number`, `number` | `number \| null` | Computes `base ** exp`; returns `null` when output is `NaN` or `Infinity`. |
| `SQRT(n)` | `number` | `number \| null` | Returns `Math.sqrt(n)`; returns `null` if `n < 0` or invalid. |

#### Conditional and Null Functions (3)

| Signature | Parameter Types | Return Type | Edge & Null Handling |
| :--- | :--- | :--- | :--- |
| `COALESCE(...args)` | `...any` | `any \| null` | Returns the first argument that is neither `null` nor `undefined`; else `null`. |
| `IF(cond, thenVal, elseVal)` | `any`, `any`, `any` | `any` | Evaluates truthiness of `cond` and returns `thenVal` or `elseVal`. |
| `ISNULL(v)` | `any` | `boolean` | Returns `true` strictly for `v === null \|\| v === undefined` (`""` and `0` return `false`). |

#### String Functions (6)

| Signature | Parameter Types | Return Type | Edge & Null Handling |
| :--- | :--- | :--- | :--- |
| `CONCAT(...args)` | `...any` | `string` | Concatenates arguments as strings; `null` and `undefined` coerce to `""`. |
| `UPPER(s)` | `any` | `string` | Uppercases string representation; returns `""` for `null`/`undefined`. |
| `LOWER(s)` | `any` | `string` | Lowercases string representation; returns `""` for `null`/`undefined`. |
| `TRIM(s)` | `any` | `string` | Trims leading and trailing whitespace; returns `""` for `null`/`undefined`. |
| `LEN(s)` | `any` | `integer` | Returns `0` for `null`/`undefined`; `.length` for string/array or coerced string length. |
| `SUBSTR(s, start = 0, len)` | `any`, `integer?`, `integer?` | `string` | Slices from `start >= 0` for `len >= 0` characters; slices to end when `len` is omitted. |

#### Date and Time Functions (5)

| Signature | Parameter Types | Return Type | Edge & Null Handling |
| :--- | :--- | :--- | :--- |
| `NOW()` | `(none)` | `string` | Returns current UTC timestamp in ISO-8601 format (`new Date().toISOString()`). |
| `YEAR(d)` | `Date \| string \| number` | `integer \| null` | Extracts UTC year (`getUTCFullYear()`); returns `null` for invalid dates. |
| `MONTH(d)` | `Date \| string \| number` | `integer \| null` | Extracts 1-based UTC month (`1..12`); returns `null` for invalid dates. |
| `DAY(d)` | `Date \| string \| number` | `integer \| null` | Extracts UTC day of month (`1..31`); returns `null` for invalid dates. |
| `DATEDIFF_DAYS(d1, d2)` | `Date \| string`, `Date \| string` | `integer \| null` | Truncates `(d1.getTime() - d2.getTime()) / 86400000` toward zero. |

## Domain Creation API Example

<CodeTabs
  :tabs="[
    {
      label: 'POST dxosBuilder:createDomain',
      lang: 'json',
      code: '{\n  &quot;collectionName&quot;: &quot;latticeCustomColdLotLogs&quot;,\n  &quot;title&quot;: &quot;Cold Lot Logs&quot;,\n  &quot;portalSlug&quot;: &quot;cold-lot-logs&quot;,\n  &quot;fields&quot;: [\n    { &quot;name&quot;: &quot;lotCode&quot;, &quot;type&quot;: &quot;string&quot;, &quot;required&quot;: true, &quot;validation&quot;: { &quot;unique&quot;: true, &quot;pattern&quot;: &quot;^LOT-[0-9]{4}-[A-Z0-9]{2,8}$&quot; } },\n    { &quot;name&quot;: &quot;order&quot;, &quot;type&quot;: &quot;belongsTo&quot;, &quot;target&quot;: &quot;latticeOrders&quot;, &quot;foreignKey&quot;: &quot;orderId&quot; },\n    { &quot;name&quot;: &quot;tempC&quot;, &quot;type&quot;: &quot;float&quot;, &quot;validation&quot;: { &quot;min&quot;: -80, &quot;max&quot;: 50 } },\n    { &quot;name&quot;: &quot;isExcursion&quot;, &quot;type&quot;: &quot;formula&quot;, &quot;formulaReturnType&quot;: &quot;boolean&quot;, &quot;formulaExpression&quot;: &quot;IF(ISNULL(tempC), false, tempC > -15)&quot; }\n  ]\n}'
    },
    {
      label: '200 OK Response',
      lang: 'json',
      code: '{\n  &quot;domain&quot;: {\n    &quot;collectionName&quot;: &quot;latticeCustomColdLotLogs&quot;,\n    &quot;title&quot;: &quot;Cold Lot Logs&quot;,\n    &quot;indexName&quot;: &quot;idx_latticeCustomColdLotLogs_org&quot;,\n    &quot;rls&quot;: { &quot;attached&quot;: true, &quot;verified&quot;: true },\n    &quot;grantedRoles&quot;: [&quot;ldx_admin&quot;, &quot;ldx_manager&quot;, &quot;ldx_operator&quot;, &quot;ldx_employee&quot;]\n  }\n}'
    }
  ]"
/>

## Operational Notes

- Uniqueness checks (`unique: true`) are scoped strictly to `organizationId` and return HTTP `409` on duplicate values within the same tenant while allowing identical values across distinct tenants.
- Formula expressions reject self-references matching the defining field's `name` and reject any function outside the 22 registered `FORMULA_FUNCTIONS`.
- Patterns anchored at the start of input (`^`) permit up to `512` NFA states, whereas unanchored patterns are capped at `320` root states to keep validation predictable.

## Related

- [Multi-Tenancy and PG16 FORCE RLS](/en/architecture/multi-tenancy-rls)
- [Platform Data Model](/en/architecture/data-model)
- [Multi-Portal Architecture](/en/studio/multi-portal)
- [Solution Bundles v3 & GitOps](/en/studio/solution-bundles)
