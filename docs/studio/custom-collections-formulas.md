---
title: Custom Collections & Safe AST Formulas
description: Tham chiếu kỹ thuật dxosBuilder cho collection ^latticeCustom*, 12 kiểu trường dữ liệu, kiểm tra regex Thompson NFA tuyến tính, auto-RLS PostgreSQL và 22 hàm công thức AST an toàn.
---

# Custom Collections & Safe AST Formulas

Phân hệ mô hình hóa dữ liệu động trong `@latticedx/plugin-dxos-studio` cho phép người quản trị và App Builder khởi tạo bảng nghiệp vụ theo từng tenant thông qua tài nguyên `dxosBuilder` mà không cần viết lệnh SQL DDL thủ công. Mọi collection tùy biến đều gắn cột `organizationId`, được bảo vệ bằng `FORCE ROW LEVEL SECURITY` trên PostgreSQL 16, kiểm tra chuỗi đầu vào bằng bộ máy Thompson NFA tuyến tính và tính toán trường dẫn xuất trên trình thông dịch AST thuần túy.

## API `dxosBuilder` và quy ước đặt tên

Tất cả endpoint dưới tiền tố `dxosBuilder` được bảo vệ bởi lớp kiểm tra `requireBuilderAdmin`. Thao tác tạo hoặc cập nhật cấu trúc bảng yêu cầu quyền `rootOnly` kết hợp phạm vi PAT `write`.

<ApiEndpoint
  method="GET"
  path="/api/dxosBuilder:listDomains"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Liệt kê toàn bộ collection khớp ^latticeCustom* kèm metadata trường, trạng thái RLS và các trang portal đã liên kết."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosBuilder:createDomain"
  auth="Bearer JWT | ldx_pat_*"
  scope="write (rootOnly)"
  summary="Tạo hoặc cập nhật collection ^latticeCustom*, tự động gắn cột organizationId, index, FORCE RLS, quyền vai trò ldx_* và tùy chọn tạo trang portal."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosBuilder:listBusinessPacks"
  auth="Bearer JWT | ldx_pat_*"
  scope="read"
  summary="Trả về danh mục Business Packs có sẵn trong BUSINESS_PACK_CATALOG kèm cấu trúc domain mẫu."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosBuilder:installBusinessPack"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Cài đặt một Business Pack vào tổ chức mục tiêu, đồng bộ các collection, quy tắc DMN và trang portal tương ứng."
/>

<ParamGrid
  title="Quy ước định danh và danh sách bảo vệ"
  :items="[
    { name: 'CUSTOM_COLLECTION_RE', type: 'RegExp', default: '/^latticeCustom[A-Z][A-Za-z0-9]{1,40}$/', description: 'Mọi tên bảng do người dùng hoặc App Builder tạo bắt buộc phải khớp mẫu này.' },
    { name: 'FIELD_NAME_RE', type: 'RegExp', default: '/^[a-z][a-zA-Z0-9_]{0,62}$/', description: 'Tên trường bắt đầu bằng chữ thường, dài tối đa 63 ký tự.' },
    { name: 'BLOCKED_FIELD_NAMES', type: 'Set<string>', default: '6 khóa', description: 'Chặn __proto__, constructor, prototype, id, createdAt và updatedAt.' },
    { name: 'SYSTEM_PROTECTED_COLLECTIONS', type: 'Set<string>', default: '32 bảng', description: 'Cấm ghi đè hoặc liên kết trực tiếp tới users, roles, apiKeys, workflows, latticeAiAuditLogs, latticeUiSnapshots.' },
    { name: 'ALLOWLISTED_BUSINESS_COLLECTIONS', type: 'Set<string>', default: '9 bảng', description: 'Các bảng lõi được phép làm đích quan hệ: latticeRequests, latticeOrders, latticeOrderLines, latticeServiceTickets, latticeParaDocuments, latticeIncidentCases, latticeLocations, latticeAssets, latticeAgentProposals.' }
  ]"
/>

## Tự động gắn PostgreSQL RLS và bảng nối `belongsToMany`

Khi `createOrUpdateDomainCollection` khởi tạo hoặc mở rộng một collection `latticeCustom*`, `domain-schema-rls.js` thực hiện chuỗi bước sau một cách tuần tự:

1. Chèn tự động cột `organizationId` (`string`, `allowNull: false`, `index: true`) vào đầu danh sách trường và tạo chỉ mục `idx_<collection>_org`. Nếu tên chỉ mục vượt quá 63 byte của PostgreSQL, `buildSafePgIndexName` tự động rút gọn kèm 8 ký tự hex SHA-256.
2. Với mọi trường `belongsToMany`, hàm `ensureBelongsToManyJoinCollection` tạo và bật RLS trên bảng nối `latticeCustom<Src><Tgt>Join` (kèm chỉ mục tổ chức, khóa ngoại và ràng buộc duy nhất `(organizationId, foreignKey, otherKey)`) trước khi đồng bộ bảng cha. Điều này ngăn Sequelize tự sinh bảng trung gian không có RLS.
3. Hàm `attachAndVerifyPgRls` thực thi `ENABLE ROW LEVEL SECURITY` cùng `FORCE ROW LEVEL SECURITY` và tạo policy `lattice_tenant_isolation` sử dụng biến phiên `app.current_org` và `app.rls_bypass`. Sau đó hệ thống truy vấn lại `pg_class` (`relrowsecurity`, `relforcerowsecurity`); nếu không xác minh được, tiến trình dừng với mã lỗi `PG_RLS_VERIFICATION_FAILED`.
4. Nếu bảng đã tồn tại và cần bổ sung cột (`ALTER TABLE`), `syncCollectionWithSafeRls` giữ nguyên trạng thái bật RLS (fail-closed), tạm gỡ policy tham chiếu `organizationId` trong khối `try/finally` và gắn lại ngay sau khi DDL hoàn tất.
5. Cuối cùng, `grantDomainRbac` cấp quyền theo `DEFAULT_ROLE_ACTIONS` cho 4 vai trò `ldx_admin`, `ldx_manager`, `ldx_operator`, `ldx_employee` và gắn trang portal nếu có tham số `portalSlug`.

## Danh mục 12 kiểu trường dữ liệu (`ALLOWED_FIELD_TYPES`)

Module `rich-schema.js` chuẩn hóa đúng 12 kiểu trường logic (`ALLOWED_FIELD_TYPES`) và ánh xạ sang NocoBase `interface` cùng `uiSchema['x-component']`:

| # | Kiểu (`type`) | NocoBase `interface` | `uiSchema['x-component']` | Lưu trữ & Tham số đặc thù |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `string` | `input` (hoặc `select`) | `Input` (hoặc `Select`) | Chuỗi ngắn; chuyển sang `Select` khi có `enumValues` hoặc `validation.enum`. |
| 2 | `text` | `textarea` | `Input.TextArea` | Văn bản nhiều dòng; hỗ trợ `validation.min`, `max`, `pattern`. |
| 3 | `integer` | `integer` | `InputNumber` | Số nguyên; hỗ trợ `required`, `unique`, `min`, `max`, `enum`. |
| 4 | `float` | `number` | `InputNumber` | Số thực dấu phẩy động; hỗ trợ `required`, `unique`, `min`, `max`. |
| 5 | `boolean` | `checkbox` | `Checkbox` | Giá trị logic đúng/sai; không hỗ trợ `min`/`max`. |
| 6 | `date` | `date` | `DatePicker` | Ngày lịch không kèm múi giờ. |
| 7 | `datetime` | `datetime` | `DatePicker` (`showTime: true`) | Mốc thời gian đầy đủ ISO-8601. |
| 8 | `json` | `json` | `Input.JSON` | Lưu dưới dạng `jsonb` trong PostgreSQL; không hỗ trợ `unique`, `min`, `max`. |
| 9 | `belongsTo` | `obo` | `AssociationField` | Khóa ngoại `foreignKey` (mặc định `<name>Id`), đích thuộc `latticeCustom*` hoặc 9 bảng nghiệp vụ cho phép. |
| 10 | `hasOne` | `oho` | `AssociationField` | Quan hệ 1-1 trỏ tới `target` qua `foreignKey` và `sourceKey` (`id`). |
| 11 | `belongsToMany` | `m2m` | `AssociationField` | Quan hệ N-N qua bảng nối `through` được gắn RLS tự động trước khi sync. |
| 12 | `formula` | `formula` | `InputNumber` / `Input` / `Checkbox` | Trường chỉ đọc (`x-read-pretty: true`), tính tự động bằng Safe AST Engine theo `formulaReturnType`. |

## Quy tắc kiểm tra và bộ máy regex Thompson NFA

Đặc tả `validation` của từng trường được lưu tại `uiSchema['x-validation']` và thực thi đồng bộ qua hook `beforeValidate` và `beforeSave` (`registerRichSchemaHooks`). Các khóa hợp lệ gồm `required`, `unique` (kiểm tra trùng lặp trong phạm vi `organizationId`, trả về HTTP `409`), `min`, `max`, `enum` (tối đa `100` phần tử chuỗi hoặc số hữu hạn) và `pattern` (chỉ áp dụng cho `string` và `text`).

Thay vì dùng động cơ backtracking của V8 dễ bị tấn công ReDoS, `validateSafeRegexPattern` biên dịch `pattern` thành đồ thị Thompson NFA và mô phỏng khóa bước (lock-step simulation) trong thời gian tuyến tính `O(n * m)`. Trình phân tích AST từ chối backreference, lookbehind và các bộ lặp lồng nhau mơ hồ trước khi biên dịch.

<ParamGrid
  title="Giới hạn an toàn của bộ máy Thompson NFA"
  :items="[
    { name: 'MAX_REGEX_PATTERN_LENGTH', type: 'number', default: '256', description: 'Độ dài tối đa của chuỗi biểu thức chính quy.' },
    { name: 'MAX_REGEX_INPUT_LENGTH', type: 'number', default: '4096', description: 'Độ dài chuỗi giá trị trường tối đa được kiểm tra lúc runtime.' },
    { name: 'MAX_REGEX_QUANTIFIER_BOUND', type: 'number', default: '100', description: 'Cận lặp tối đa {m,n} và tổng số lượng bộ lặp trong một pattern.' },
    { name: 'MAX_REGEX_AST_DEPTH', type: 'number', default: '64', description: 'Độ sâu lồng nhóm tối đa của cây cú pháp biểu thức.' },
    { name: 'MAX_NFA_STATES', type: 'number', default: '512', description: 'Tổng số trạng thái NFA tối đa đối với biểu thức neo đầu dòng (^).' },
    { name: 'MAX_UNANCHORED_ROOT_NFA_STATES', type: 'number', default: '320', description: 'Giới hạn trạng thái NFA gốc đối với biểu thức không neo đầu dòng.' },
    { name: 'MAX_TOTAL_LOOKAHEAD_STATES', type: 'number', default: '120', description: 'Tổng số trạng thái NFA tối đa cấp cho các biểu thức lookahead.' }
  ]"
/>

## Trình thông dịch công thức AST an toàn (`rich-schema.js`)

Mọi biểu thức `formula` được phân tích từ vựng, dựng cây cú pháp bằng đệ quy xuống và thực thi hoàn toàn trong sandbox AST mà không gọi `eval` hay `new Function`. Kiểu trả về (`formulaReturnType`) chấp nhận một trong bốn giá trị `float`, `integer`, `string` hoặc `boolean`.

<ParamGrid
  title="Giới hạn sandbox và định danh bị chặn"
  :items="[
    { name: 'MAX_FORMULA_LENGTH', type: 'number', default: '1000', description: 'Số ký tự tối đa của biểu thức công thức.' },
    { name: 'MAX_FORMULA_TOKENS', type: 'number', default: '256', description: 'Tổng số token tối đa sau bước tách từ vựng.' },
    { name: 'MAX_FORMULA_DEPTH', type: 'number', default: '24', description: 'Độ sâu lồng ngoặc/biểu thức tối đa của cây AST.' },
    { name: 'Toán tử hỗ trợ', type: 'operators', default: '17 toán tử', description: 'Số học (+, -, *, /, %), logic (!, &&, ||), ba ngôi (?:) và so sánh (==, ===, !=, !==, <, <=, >, >=).' },
    { name: 'BLOCKED_FORMULA_IDENTIFIERS', type: 'Set<string>', default: '15 từ khóa', description: 'Cấm __proto__, constructor, prototype, global, globalThis, process, require, module, exports, Function, eval, Proxy, Reflect, window, self.' }
  ]"
/>

### Danh mục đầy đủ 22 hàm công thức (`FORMULA_FUNCTIONS`)

#### Nhóm Toán học (8 hàm)

| Hàm & Chữ ký | Kiểu tham số | Kiểu trả về | Hành vi biên và xử lý `null` |
| :--- | :--- | :--- | :--- |
| `ROUND(n, digits = 0)` | `number`, `integer?` | `number \| null` | Kẹp `digits` trong `[0..10]`; trả về `null` nếu `n` không chuyển được thành số hữu hạn. |
| `ABS(n)` | `number` | `number \| null` | Trả về giá trị tuyệt đối hoặc `null` nếu đầu vào rỗng/không hợp lệ. |
| `CEIL(n)` | `number` | `integer \| null` | Làm tròn lên số nguyên gần nhất (`Math.ceil`). |
| `FLOOR(n)` | `number` | `integer \| null` | Làm tròn xuống số nguyên gần nhất (`Math.floor`). |
| `MIN(...args)` | `...number` | `number \| null` | Bỏ qua phần tử `null`/không hợp lệ; trả về `null` nếu không có số hợp lệ nào. |
| `MAX(...args)` | `...number` | `number \| null` | Bỏ qua phần tử `null`/không hợp lệ; trả về giá trị lớn nhất hoặc `null`. |
| `POW(base, exp)` | `number`, `number` | `number \| null` | Tính `base ** exp`; trả về `null` nếu kết quả là `NaN` hoặc `Infinity`. |
| `SQRT(n)` | `number` | `number \| null` | Trả về căn bậc hai; trả về `null` nếu `n < 0` hoặc không hợp lệ. |

#### Nhóm Điều kiện và Giá trị rỗng (3 hàm)

| Hàm & Chữ ký | Kiểu tham số | Kiểu trả về | Hành vi biên và xử lý `null` |
| :--- | :--- | :--- | :--- |
| `COALESCE(...args)` | `...any` | `any \| null` | Trả về đối số đầu tiên khác `null` và khác `undefined`; trả `null` nếu tất cả đều rỗng. |
| `IF(cond, thenVal, elseVal)` | `any`, `any`, `any` | `any` | Đánh giá tính đúng sai của `cond` và trả về nhánh tương ứng. |
| `ISNULL(v)` | `any` | `boolean` | Trả về `true` chỉ khi `v === null || v === undefined` (chuỗi rỗng hoặc `0` trả về `false`). |

#### Nhóm Xử lý chuỗi (6 hàm)

| Hàm & Chữ ký | Kiểu tham số | Kiểu trả về | Hành vi biên và xử lý `null` |
| :--- | :--- | :--- | :--- |
| `CONCAT(...args)` | `...any` | `string` | Nối chuỗi liên tiếp; giá trị `null` hoặc `undefined` được đổi thành `""`. |
| `UPPER(s)` | `any` | `string` | Chuyển toàn bộ ký tự sang chữ hoa; trả `""` nếu `s` là `null`/`undefined`. |
| `LOWER(s)` | `any` | `string` | Chuyển toàn bộ ký tự sang chữ thường; trả `""` nếu `s` là `null`/`undefined`. |
| `TRIM(s)` | `any` | `string` | Cắt khoảng trắng đầu và cuối chuỗi; trả `""` nếu `s` là `null`/`undefined`. |
| `LEN(s)` | `any` | `integer` | Trả `0` nếu `null`/`undefined`; trả `.length` cho chuỗi/mảng hoặc `String(s).length`. |
| `SUBSTR(s, start = 0, len)` | `any`, `integer?`, `integer?` | `string` | Cắt từ vị trí `start >= 0` với độ dài `len >= 0`; nếu bỏ qua `len` sẽ cắt đến hết chuỗi. |

#### Nhóm Ngày và Thời gian (5 hàm)

| Hàm & Chữ ký | Kiểu tham số | Kiểu trả về | Hành vi biên và xử lý `null` |
| :--- | :--- | :--- | :--- |
| `NOW()` | `(không tham số)` | `string` | Trả về chuỗi thời gian hiện tại chuẩn UTC ISO-8601 (`new Date().toISOString()`). |
| `YEAR(d)` | `Date \| string \| number` | `integer \| null` | Trích năm UTC (`getUTCFullYear()`); trả `null` nếu ngày không hợp lệ. |
| `MONTH(d)` | `Date \| string \| number` | `integer \| null` | Trích tháng UTC từ `1..12` (`getUTCMonth() + 1`); trả `null` nếu ngày không hợp lệ. |
| `DAY(d)` | `Date \| string \| number` | `integer \| null` | Trích ngày trong tháng UTC từ `1..31` (`getUTCDate()`); trả `null` nếu không hợp lệ. |
| `DATEDIFF_DAYS(d1, d2)` | `Date \| string`, `Date \| string` | `integer \| null` | Trả về số ngày chênh lệch làm tròn về 0 (`Math.trunc((d1 - d2) / 86400000)`). |

## Ví dụ khởi tạo Domain Collection qua API

<CodeTabs
  :tabs="[
    {
      label: 'POST dxosBuilder:createDomain',
      lang: 'json',
      code: '{\n  &quot;collectionName&quot;: &quot;latticeCustomColdLotLogs&quot;,\n  &quot;title&quot;: &quot;Nhat ky lo kho lanh&quot;,\n  &quot;portalSlug&quot;: &quot;cold-lot-logs&quot;,\n  &quot;fields&quot;: [\n    { &quot;name&quot;: &quot;lotCode&quot;, &quot;type&quot;: &quot;string&quot;, &quot;required&quot;: true, &quot;validation&quot;: { &quot;unique&quot;: true, &quot;pattern&quot;: &quot;^LOT-[0-9]{4}-[A-Z0-9]{2,8}$&quot; } },\n    { &quot;name&quot;: &quot;order&quot;, &quot;type&quot;: &quot;belongsTo&quot;, &quot;target&quot;: &quot;latticeOrders&quot;, &quot;foreignKey&quot;: &quot;orderId&quot; },\n    { &quot;name&quot;: &quot;tempC&quot;, &quot;type&quot;: &quot;float&quot;, &quot;validation&quot;: { &quot;min&quot;: -80, &quot;max&quot;: 50 } },\n    { &quot;name&quot;: &quot;isExcursion&quot;, &quot;type&quot;: &quot;formula&quot;, &quot;formulaReturnType&quot;: &quot;boolean&quot;, &quot;formulaExpression&quot;: &quot;IF(ISNULL(tempC), false, tempC > -15)&quot; }\n  ]\n}'
    },
    {
      label: 'Phản hồi 200 OK',
      lang: 'json',
      code: '{\n  &quot;domain&quot;: {\n    &quot;collectionName&quot;: &quot;latticeCustomColdLotLogs&quot;,\n    &quot;title&quot;: &quot;Nhat ky lo kho lanh&quot;,\n    &quot;indexName&quot;: &quot;idx_latticeCustomColdLotLogs_org&quot;,\n    &quot;rls&quot;: { &quot;attached&quot;: true, &quot;verified&quot;: true },\n    &quot;grantedRoles&quot;: [&quot;ldx_admin&quot;, &quot;ldx_manager&quot;, &quot;ldx_operator&quot;, &quot;ldx_employee&quot;]\n  }\n}'
    }
  ]"
/>

## Lưu ý vận hành và xử lý lỗi

- Khi giá trị `unique: true` bị trùng trong cùng `organizationId`, hook `beforeValidate` trả về mã HTTP `409`; cùng giá trị đó ở một tenant khác vẫn hợp lệ nhờ phạm vi lọc theo `organizationId`.
- Biểu thức công thức không được tự tham chiếu chính tên trường đang định nghĩa (`selfFieldName`), đồng thời không thể dùng lại hàm ngoài tập `FORMULA_FUNCTIONS`.
- Nếu mẫu regex kiểm tra chứa ký tự neo `^` ở đầu chuỗi, hạn mức trạng thái NFA là `512`; với mẫu không neo đầu chuỗi, hạn mức thu hẹp xuống `320` để bảo đảm hiệu năng quét.

## Tài liệu liên quan

- [Cô lập đa tenant với PG16 FORCE RLS](/architecture/multi-tenancy-rls)
- [Mô hình dữ liệu nền tảng](/architecture/data-model)
- [Kiến trúc Multi-Portal](/studio/multi-portal)
- [Solution Bundles v3 & GitOps](/studio/solution-bundles)
