---
title: Biểu mẫu Công khai (/v/form/:slug)
description: Tiếp nhận dữ liệu công khai Zero-PII qua /v/form/:slug và API dxosForms với danh sách collection cho phép, giới hạn tốc độ trượt, token băm SHA-256, kiểm tra magic-byte tệp đính kèm và CloudEvent public_form.submitted.
---

# Biểu mẫu Công khai (`/v/form/:slug`)

Biểu mẫu công khai cho phép đối tác bên ngoài, khách hàng hoặc nhân sự chưa đăng nhập gửi yêu cầu, đơn hàng, sự cố hoặc phiếu dịch vụ tại `/v/form/:slug` thông qua resource `dxosForms` (`public-forms.js` và `public-form-html.js`) trong plugin `@latticedx/plugin-lattice-foundation`. Toàn bộ luồng tiếp nhận tuân thủ mô hình Zero-PII: client bên ngoài không nhận được `organizationId`, cấu hình nội bộ hay tên bảng đích, đồng thời không thể truy cập trực tiếp vào bảng định nghĩa hoặc bảng lưu kết quả nộp.

Khi một biểu mẫu hợp lệ được gửi, máy chủ mở phiên giao dịch PostgreSQL theo tổ chức sở hữu biểu mẫu (`withTenantRlsContext`), tạo bản ghi đích trong collection được phép, ghi biên nhận vào `latticePublicFormSubmissions` và phát sự kiện CloudEvent `public_form.submitted` lên Event Bus.

## Hàng rào `latticePublicFormsGuard` và Kiểm soát Truy cập

Middleware `registerPublicFormsGuard` (gắn tag `latticePublicFormsGuard`, chạy sau `acl`) chặn mọi truy vấn CRUD trực tiếp hoặc `charts:queryData` từ các vai trò không phải `root` nhắm vào hai bảng nội bộ:

- `latticePublicForms`
- `latticePublicFormSubmissions`

Mọi truy vấn đều trả về mã HTTP `403` (`PUBLIC_FORM_DIRECT_ACCESS_FORBIDDEN`) và buộc client đi qua resource `dxosForms`. Khi cần định tuyến qua Nginx, khối cấu hình `10-lattice-public-routes.sh` chuyển tiếp `/v/form` và chuyển hướng `302` từ `/form` sang `/v/form`.

## Tài liệu API `dxosForms`

Resource `dxosForms` chia làm 3 action công khai (`public`) và 7 action quản trị (`loggedIn`, yêu cầu `resolveAdminContext`). Hai action `listSubmissions` và `downloadAttachment` cho phép thêm vai trò quản lý nghiệp vụ (`ldx_manager`, `ldx_admin`, `admin`).

### Nhóm Action Công khai (`public`)

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:meta?slug=partner-intake"
  auth="Public"
  summary="Trả về lược đồ trường hiển thị qua serializePublicMeta, ẩn hoàn toàn organizationId, targetCollection và hash bảo mật."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:submit?slug=partner-intake"
  auth="Public | Optional x-form-token (ldx_ftok_*)"
  summary="Xác thực payload, kiểm tra honeypot và rate limit, tạo bản ghi đích + biên nhận và trả về submissionCode cùng statusToken (ldx_frm_*)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:status?slug=partner-intake&submissionCode=LDX-FRM-...&token=ldx_frm_..."
  auth="Public + statusToken (ldx_frm_*)"
  summary="Tra cứu trạng thái xử lý mới nhất của bản ghi đích bằng so sánh hằng thời gian timingSafeEqualHex."
/>

### Nhóm Action Quản trị (`loggedIn`)

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:list?limit=50"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin"
  summary="Liệt kê danh sách biểu mẫu công khai thuộc tổ chức (hoặc toàn hệ thống nếu là root)."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:get?id=1"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin"
  summary="Đọc chi tiết cấu hình một biểu mẫu theo id hoặc slug."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:save"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin + write"
  summary="Tạo mới hoặc cập nhật định nghĩa biểu mẫu, kiểm tra SLUG_RE, PUBLIC_FORM_ALLOWLIST_COLLECTIONS và BLOCKED_TARGET_FIELDS."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:delete"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin + write"
  summary="Xóa định nghĩa biểu mẫu theo id trong phạm vi tổ chức (hỗ trợ cả POST và DELETE)."
/>

<ApiEndpoint
  method="POST"
  path="/api/dxosForms:rotateToken"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin + write"
  summary="Sinh mới accessToken dạng ldx_ftok_<48 hex>, lưu accessTokenHash (SHA-256) và bật requireAccessToken: true."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:listSubmissions?slug=partner-intake&page=1&pageSize=20"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin | Manager"
  summary="Liệt kê lịch sử tiếp nhận kèm payload đã làm sạch và metadata tệp đính kèm."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxosForms:downloadAttachment?submissionCode=LDX-FRM-...&fieldName=attachment"
  auth="Bearer JWT | ldx_pat_*"
  scope="Admin | Manager"
  summary="Tải tệp đính kèm nhị phân kèm header Content-Disposition: attachment và X-Content-Type-Options: nosniff."
/>

## Quy tắc Slug, Collection Cho phép và Trường Dữ liệu

Mỗi biểu mẫu được chuẩn hóa nghiêm ngặt tại `validatePublicFormDefinition` trước khi lưu:

<ParamGrid
  title="Cấu hình Biểu mẫu (dxosForms:save)"
  :items="[
    { name: 'slug', type: 'string', required: true, description: 'Khớp /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/ (3 đến 63 ký tự) và không nằm trong 15 từ khóa RESERVED_FORM_SLUGS.' },
    { name: 'title', type: 'string', required: true, description: 'Tiêu đề biểu mẫu công khai (1 đến 180 ký tự).' },
    { name: 'targetCollection', type: 'string', required: true, description: 'Thuộc PUBLIC_FORM_ALLOWLIST_COLLECTIONS hoặc khớp ^latticeCustom[A-Z][A-Za-z0-9]{1,40}$.' },
    { name: 'allowedFieldsJson', type: 'FieldSpec[]', required: true, description: 'Từ 1 đến 50 trường đầu vào với kiểu nằm trong 9 ALLOWED_FIELD_TYPES.' },
    { name: 'defaultValuesJson', type: 'object', description: 'Giá trị mặc định kiểu nguyên thủy gắn vào bản ghi đích; từ chối khóa thuộc BLOCKED_TARGET_FIELDS.' },
    { name: 'honeypotField', type: 'string', default: '_hp_website', description: 'Tên trường bẫy bot khớp /^[a-zA-Z_][a-zA-Z0-9_]{1,63}$/.' },
    { name: 'rateLimitPerMinute', type: 'integer', default: '20', description: 'Giới hạn gửi theo phút trên mỗi cặp IP và slug, giá trị hợp lệ từ 1 đến 300.' },
    { name: 'requireAccessToken', type: 'boolean', default: 'false', description: 'Yêu cầu người nộp cung cấp mã ldx_ftok_* hợp lệ.' },
    { name: 'workflowRuleKey', type: 'string', description: 'Mã quy trình tùy chọn được đính kèm vào sự kiện public_form.submitted.' },
    { name: 'active', type: 'boolean', default: 'true', description: 'Trạng thái cho phép nhận dữ liệu công khai.' }
  ]"
/>

### Danh sách Collection Cho phép (`PUBLIC_FORM_ALLOWLIST_COLLECTIONS`)

Biểu mẫu công khai chỉ được ghi vào 8 collection chuẩn sau đây hoặc các collection mở rộng có tiền tố `latticeCustom` (`^latticeCustom[A-Z][A-Za-z0-9]{1,40}$`):

| Collection đích | Mục đích tiếp nhận phổ biến | Trạng thái khởi tạo mặc định |
| :--- | :--- | :--- |
| `latticeRequests` | Yêu cầu mua sắm / tiếp nhận đối tác | `status: 'submitted'`, `version: 1`, `amendmentNo: 0` |
| `latticeOrders` | Đơn đặt hàng / yêu cầu vận chuyển | `status: 'submitted'`, `version: 1`, `amendmentNo: 0` |
| `latticeServiceTickets` | Phiếu hỗ trợ khách hàng / dịch vụ nội bộ | `status: 'submitted'`, `version: 1`, `amendmentNo: 0` |
| `latticeIncidentCases` | Báo cáo sự cố chuỗi lạnh từ hiện trường | `status: 'submitted'` |
| `latticeParaDocuments` | Tiếp nhận tài liệu vào kho tri thức | `status: 'submitted'` |
| `latticeAgentProposals` | Đề xuất tác nghiệp chờ xem xét | `status: 'submitted'` |
| `latticeLocations` | Đăng ký địa điểm hoặc điểm nhận hàng | `active: true` |
| `latticeAssets` | Khai báo thông tin tài sản / thiết bị | `active: true` |

### Danh sách Slug bị Chặn và Các Kiểu Trường Hỗ trợ

| Hạng mục | Giá trị |
| :--- | :--- |
| `RESERVED_FORM_SLUGS` (`15`) | `admin`, `api`, `signin`, `signup`, `mobile`, `track`, `form`, `v`, `p`, `static`, `storage`, `files`, `lattice`, `health`, `settings` |
| `ALLOWED_FIELD_TYPES` (`9`) | `string`, `text`, `number`, `integer`, `boolean`, `date`, `email`, `select`, `file` |
| Giới hạn độ dài & regex | Mặc định `DEFAULT_MAX_FIELD_LENGTH = 2000` (trần `MAX_FIELD_LENGTH_CAP = 10000`), `pattern <= 120` ký tự và chặn lượng từ lồng nhau chống ReDoS. |

## Kiểm soát Bảo mật, Chống Bot và Giới hạn Tốc độ

### Zero-PII, Chống Prototype Pollution và `BLOCKED_TARGET_FIELDS`

#### `serializePublicMeta`

Phản hồi của `dxosForms:meta` chỉ trả về `slug`, `title`, `description`, `fields`, `honeypotField`, `requireAccessToken` và `active`; loại bỏ hoàn toàn `organizationId`, `targetCollection`, `accessTokenHash`, `createdByUserId` và `defaultValuesJson`.

#### Chống lạm dụng object (`assertNoPrototypePollution`)

Từ chối payload lồng sâu quá `20` tầng (`maxDepth = 20`) và chặn các khóa `__proto__`, `constructor`, `prototype`. Mọi yêu cầu `submit` truyền `organizationId` ở body hoặc `values` đều bị chặn (`400 FORM_ORG_OVERRIDE_FORBIDDEN`).

#### `BLOCKED_TARGET_FIELDS`

Cấm mọi biểu mẫu tiếp xúc hoặc ghi đè 29 khóa hệ thống, vòng đời chứng từ và bí mật bảo mật:

```text
id, organizationId, createdAt, updatedAt, createdById, updatedById,
status, version, amendedFromId, amendmentNo, requesterId, assigneeId,
submittedBy, cancelledBy, cancelReason, cancelledAt, submittedAt,
userId, identitySubject, password, secret, token, apiKey, privateKey,
accessTokenHash, statusTokenHash, __proto__, constructor, prototype
```

Các tên trường khớp `SENSITIVE_FIELD_NAME_RE` (`password|secret|token|apikey|api_key|privatekey|private_key|hash|salt`) cũng bị từ chối ở cả cấu hình lẫn dữ liệu nộp.

### Honeypot `_hp_website` và Rate Limiting `20 / 60 / 300`

- **Honeypot chống bot (`_hp_website`):** Nếu bất kỳ bag nào (`body`, `params`, `values`) chứa giá trị khác rỗng ở `honeypotField` hoặc `_hp_website`, yêu cầu bị từ chối ngay với mã `400 FORM_BOT_DETECTED`.
- **Cửa sổ trượt 60 giây (`createSlidingWindowRateLimiter`):**

| Ngữ cảnh áp dụng | Hằng số cấu hình | Ngưỡng mặc định / phút | Khóa đếm |
| :--- | :--- | :---: | :--- |
| Chống ngập IP trước khi tra DB | `PRE_LOOKUP_IP_FLOOD_LIMIT` | `300` | `${clientIp}:__flood__` |
| Gửi biểu mẫu (`dxosForms:submit`) | `DEFAULT_RATE_LIMIT_PER_MIN` | `20` *(cấu hình `1..300`)* | `${clientIp}:${slug}` |
| Tra cứu trạng thái (`dxosForms:status`) | `STATUS_RATE_LIMIT_PER_MIN` | `60` | `${clientIp}:status:${slug}` |

Khi vượt ngưỡng, máy chủ trả về HTTP `429 RATE_LIMIT_EXCEEDED` kèm header `Retry-After`.

### Kiến trúc Token `ldx_ftok_` và `ldx_frm_`

- **Token truy cập biểu mẫu (`ldx_ftok_<48 hex>`):** Khi bật `requireAccessToken`, quản trị viên sinh mã qua `dxosForms:rotateToken`. Máy chủ chỉ lưu chuỗi băm SHA-256 (`accessTokenHash`). Khi nộp, client gửi mã qua body (`token` / `accessToken`), query hoặc header `x-form-token`; máy chủ so sánh hằng thời gian qua `timingSafeEqualHex` (dùng `DUMMY_HASH_HEX` khi form không tồn tại để triệt tiêu kênh thời gian).
- **Token tra cứu trạng thái (`ldx_frm_<48 hex>`):** Mỗi lần nộp thành công sinh mã biên nhận `submissionCode` (`LDX-FRM-<8 hex>`) và `statusToken` (`ldx_frm_...`) trả về duy nhất một lần. Cơ sở dữ liệu chỉ lưu `statusTokenHash` (SHA-256) để xác thực tại `dxosForms:status`.

## Kiểm tra Magic-Byte Tệp Tải lên và CloudEvent `public_form.submitted`

Hàm `sanitizeFileFieldValue` xác thực tệp đính kèm có kích thước tối đa `MAX_FILE_UPLOAD_BYTES = 2MB` (`2,097,152` bytes), chặn ký tự đường dẫn (`..`, `/`, `\`, ký tự điều khiển), tính mã băm SHA-256 và đối chiếu chữ ký nhị phân (magic bytes) thực tế của 5 định dạng được phép (`ALLOWED_FILE_MIME_TYPES`):

| MIME Type | Quy tắc kiểm tra Magic Bytes / Nội dung |
| :--- | :--- |
| `application/pdf` | 5 byte đầu khớp chính xác `%PDF-` |
| `image/png` | 8 byte đầu khớp `89 50 4E 47 0D 0A 1A 0A` |
| `image/jpeg` | 3 byte đầu khớp `FF D8 FF` |
| `image/webp` | Byte `0..3` là `RIFF` và byte `8..11` là `WEBP` |
| `text/plain` | Không chứa byte null `0x00` và không bắt đầu bằng thẻ `<script`, `<svg`, `<html`, `<?xml`, `<!doctype`, `<!--`, `<iframe`, `<object`, `<embed` |

Sau khi ghi thành công bản ghi đích và biên nhận `latticePublicFormSubmissions`, `dxosForms:submit` phát CloudEvent `public_form.submitted` (`source: 'dxosForms'`, `subject: submissionCode`) chứa `{ slug, submissionCode, targetCollection, targetRecordId, workflowRuleKey }` để kích hoạt các quy trình LatticeFlow v2 hoặc webhook đăng ký trên Event Bus.

<CodeTabs
  :tabs="[
    {
      label: 'Tạo Form (save)',
      lang: 'bash',
      code: 'curl -X POST https://localhost:8443/api/dxosForms:save \\\n  -H \x22Authorization: Bearer $ADMIN_TOKEN\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \'{\n    \x22slug\x22: \x22coldchain-incident\x22,\n    \x22title\x22: \x22Báo cáo Sự cố Chuỗi lạnh\x22,\n    \x22targetCollection\x22: \x22latticeIncidentCases\x22,\n    \x22rateLimitPerMinute\x22: 20,\n    \x22allowedFieldsJson\x22: [\n      { \x22name\x22: \x22name\x22, \x22label\x22: \x22Tóm tắt sự cố\x22, \x22type\x22: \x22string\x22, \x22required\x22: true, \x22maxLength\x22: 160 },\n      { \x22name\x22: \x22severity\x22, \x22label\x22: \x22Mức độ\x22, \x22type\x22: \x22select\x22, \x22required\x22: true, \x22options\x22: [\x22low\x22, \x22medium\x22, \x22high\x22, \x22critical\x22] },\n      { \x22name\x22: \x22evidence\x22, \x22label\x22: \x22Ảnh hiện trường\x22, \x22type\x22: \x22file\x22, \x22required\x22: false }\n    ]\n  }\''
    },
    {
      label: 'Gửi Form (submit)',
      lang: 'bash',
      code: 'curl -X POST \x22https://localhost:8443/api/dxosForms:submit?slug=coldchain-incident\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \'{\n    \x22values\x22: {\n      \x22name\x22: \x22Nhiệt độ kho CT-02 vượt ngưỡng 8.5C\x22,\n      \x22severity\x22: \x22high\x22\n    },\n    \x22_hp_website\x22: \x22\x22\n  }\''
    },
    {
      label: 'Phản hồi & Tra cứu',
      lang: 'json',
      code: '{\n  \x22ok\x22: true,\n  \x22slug\x22: \x22coldchain-incident\x22,\n  \x22submissionCode\x22: \x22LDX-FRM-9A3C1E04\x22,\n  \x22statusToken\x22: \x22ldx_frm_4f8b2d...\x22,\n  \x22status\x22: \x22submitted\x22,\n  \x22submittedAt\x22: \x222026-11-26T09:15:42.108Z\x22\n}'
    }
  ]"
/>

## Tài liệu liên quan

- [Kiến trúc Multi-Portal](/studio/multi-portal)
- [Kiến trúc Sự kiện & Transactional Outbox](/architecture/events-and-outbox)
- [Tổng quan LatticeFlow v2](/automation/latticeflow-overview)
- [Ứng dụng Hiện trường Mobile PWA](/studio/mobile-pwa)
