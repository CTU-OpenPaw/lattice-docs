---
title: Kho tri thức P.A.R.A. & Hybrid RAG
description: Kiến trúc kho tri thức P.A.R.A., bộ trích xuất tài liệu Office/PDF/OCR không phụ thuộc binary ngoài, chỉ mục pgvector + tsvector và công thức RRF (k = 60).
---

# Kho tri thức P.A.R.A. & Hybrid RAG

Plugin `@latticedx/plugin-dxos-para` xây dựng kho tri thức doanh nghiệp theo cấu trúc P.A.R.A. (`Projects`, `Areas`, `Resources`, `Archives`) kết hợp công cụ tìm kiếm lai (Hybrid RAG) trên PostgreSQL 16. Hệ thống tách biệt việc phân mảnh tài liệu, tính vector nhúng (embedding) và truy xuất hợp nhất giữa từ khóa tiếng Việt không dấu/có dấu với độ tương đồng ngữ nghĩa `pgvector`.

Tài liệu sau khi tạo hoặc cập nhật trong `latticeParaDocuments` được đồng bộ bất đồng bộ sau commit (`afterCommit`) vào `latticeParaChunks`, bảo vệ bởi `FORCE ROW LEVEL SECURITY` theo từng `organizationId` và phục vụ trực tiếp cho các tác tử AI qua công cụ `dxos_search_enterprise_context`.

<ParaHybridRagDiagram />

## Mô hình dữ liệu kho P.A.R.A.

Dữ liệu tri thức lưu trong hai bảng quan hệ thuộc `@latticedx/plugin-dxos-para`, tự động gán `organizationId` từ ngữ cảnh người gọi tại hook `beforeValidate`.

| Bảng dữ liệu | Vai trò | Trường khóa và chỉ mục chính |
| :--- | :--- | :--- |
| `latticeParaDocuments` | Tài liệu gốc P.A.R.A. | `code` (unique cùng `organizationId` qua `uidx_lattice_para_org_code`), `title`, `paraSpace` (`projects`, `areas`, `resources`, `archives`), `status` (`draft`, `active`, `archived`), `summary`, `contentMarkdown`, `tags`, `attachmentUrl`, `relatedCollection`, `relatedRecordId`, `searchText`, `embeddingJson`. |
| `latticeParaChunks` | Phân đoạn tìm kiếm lai | `documentId`, `organizationId`, `paraSpace`, `sourceType` (`document` \| `attachment`), `chunkIndex`, `sectionTitle`, `pageNumber`, `content`, `tokenCount`, `embeddingModel`, `embeddingEngine` (`neural` \| `deterministic-fallback`), `embeddingDim`, `embeddingJson`, cột `searchVector` (`tsvector`) và cột `embedding` (`vector`). |

Hook `afterCreate` và `afterUpdate` trên `latticeParaDocuments` kích hoạt `syncDocumentChunks` sau khi transaction ghi DB commit thành công (`chunkSize = 800` ký tự, `overlap = 120` ký tự). Nếu quá trình gọi endpoint embedding bên ngoài tạm thời thất bại, cơ chế `runAfterCommit` tự động thử lại tối đa 3 lần với độ trễ lũy thừa (`1000ms`, `2000ms`) và ghi nhận trạng thái lỗi vào `latticePara:indexHealth`. Khi tài liệu chuyển trạng thái sang `draft` hoặc `archived`, hoặc khi bị xóa (`afterDestroy`), toàn bộ phân đoạn trong `latticeParaChunks` bị vô hiệu hóa hoặc gỡ bỏ khỏi chỉ mục tìm kiếm.

## Bộ trích xuất Office, PDF và OCR biểu mẫu

Tất cả thao tác đọc tệp đính kèm đều thực hiện bằng trình phân tích thuần Node.js (`node:zlib` và bộ đọc ZIP Central Directory trong `document-extractor.js`), không gọi tiến trình binary ngoài.

### Hỗ trợ định dạng và giới hạn an toàn

| Định dạng | Cơ chế trích xuất | Kiểm soát bảo mật và giới hạn |
| :--- | :--- | :--- |
| PDF (`.pdf`) | Đọc content stream, bảng ánh xạ `ToUnicode` CMap và kiểm tra stream ảnh/Object Stream (`/ObjStm`). | Tối đa `5000` trang (`MAX_PDF_PAGE_COUNT`) và `65536` mục CMap (`MAX_CMAP_ENTRIES`); tự động phát hiện PDF chỉ chứa ảnh scan (`PDF_SCANNED_OCR_REQUIRED`). |
| Word (`.docx`) | Giải nén có kiểm soát Central Directory, đọc `word/document.xml` và giải mã thực thể XML. | Chặn tuyệt đối khai báo `<!DOCTYPE` và `<!ENTITY` chống XXE (`OFFICE_XML_ENTITY_FORBIDDEN`); chặn ZIP path traversal và file mã hóa mật khẩu. |
| Excel (`.xlsx`) | Phân tích `xl/sharedStrings.xml` và các sheet `xl/worksheets/sheet*.xml`. | Giới hạn tối đa `2MB` kích thước upload base64 (`MAX_UPLOAD_BYTES`), `10MB` tổng dung lượng giải nén (`MAX_INFLATED_BYTES`) và `10000` entry ZIP (`MAX_ZIP_ENTRIES`). |
| PowerPoint (`.pptx`) | Trích xuất văn bản slide (`ppt/slides/slide*.xml`) kèm ghi chú thuyết trình (`ppt/notesSlides/*`). | Áp dụng chung ngân sách `MAX_INFLATED_BYTES` và kiểm tra tính toàn vẹn Central Directory. |
| Ảnh & Văn bản | Đọc trực tiếp UTF-8/CSV/Markdown hoặc metadata PNG (`tEXt`/`zTXt`/`iTXt`), JPEG (`COM`/`XMP`), WebP. | Ảnh scan và PDF không có lớp văn bản được chuyển sang `DX_OCR_ENDPOINT` khi sử dụng `extractFormFields`. |

### Đường ống OCR-to-Record

Endpoint `POST /api/latticePara:extractFormFields` cho phép trích xuất trường dữ liệu có cấu trúc từ ảnh hóa đơn, phiếu nhập kho, PDF scan hoặc tài liệu P.A.R.A. có sẵn để điền trước biểu mẫu cho 4 bảng nghiệp vụ nằm trong `ALLOWED_FORM_COLLECTIONS`: `latticeOrders`, `latticeRequests`, `latticeStockLots` và `latticeServiceTickets`.

Nếu `DX_OCR_ENDPOINT` được cấu hình, `validateOcrEndpoint` xác thực URL chống SSRF (chỉ cho phép `HTTPS` công cộng hoặc HTTP tới các host tin cậy trong `TRUSTED_OCR_HTTP_HOSTS` như `ocr`, `ocr-service`, `paddleocr`, `tesseract`, `vllm`, `ollama`, `9router`, đồng thời khóa `redirect: 'error'` và timeout `5000ms`). Khi dịch vụ OCR từ xa không khả dụng hoặc chưa cấu hình, hệ thống chuyển sang bộ phân tích tất định nội bộ (`ocrEngine: 'offline-deterministic-fallback'`) và vẫn giữ lớp lọc che giấu bí mật/PII trên `extractedTextPreview`.

## Tìm kiếm lai pgvector, BM25 tsvector và công thức RRF (k = 60)

Công cụ `executeHybridSearch` trong `para-hybrid-search.js` kết hợp truy xuất từ vựng trên PostgreSQL `tsvector` với truy xuất ngữ nghĩa trên `pgvector` (hoặc vector tất định FNV-1a khi chưa cấu hình model neural).

### Chỉ mục từ vựng tiếng Việt (`tsvector` + GIN)

Migration `20261123000300` tạo trigger `trg_lattice_para_chunks_tsv` gọi hàm `lattice_para_chunks_tsv_update()`, tự động ghép trường `code`, `title`, `sectionTitle`, `content` kèm bản gấp dấu tiếng Việt (`VN_ACCENTED` sang `VN_FOLDED`) qua bộ tách từ `'simple'` và đánh chỉ mục `GIN` (`idx_lattice_para_chunks_tsv`). Nhờ bước gấp dấu này, truy vấn không dấu như `"nhiet do kho lanh"` vẫn khớp chính xác với tài liệu có dấu tiếng Việt thông qua `ts_rank_cd("searchVector", plainto_tsquery('simple', ...))` kết hợp điểm khớp cụm từ và từ khóa trong `lexicalOverlapScore` (đã loại bỏ `STOP_WORDS`).

### Lưu trữ vector linh hoạt (`pgvector`)

Migration `20261123000300` ban đầu khởi tạo cột `embedding vector(1536)` cùng chỉ mục HNSW (`idx_lattice_para_chunks_emb_hnsw`, với `ivfflat` làm phương án dự phòng). Tiếp theo, migration `20261127000200` chuyển đổi cột `embedding` sang kiểu `vector` không cố định số chiều (và gỡ bỏ ràng buộc chỉ mục cố định chiều) để cho phép các mô hình neural có số chiều từ `8` đến `8192` (mặc định `text-embedding-3-small` với `1536` chiều, `NEURAL_TIMEOUT_MS = 4500ms`) vận hành song song với vector dự phòng `fnv1a-256` (`EMBEDDING_DIM = 256`) tính từ unigram và trigram ký tự.

Khoảng cách ngữ nghĩa trên PostgreSQL được tính bằng toán tử cosine `<=>`:

```sql
SELECT id, "documentId", "chunkIndex",
       1 - (embedding <=> CAST(:vec AS vector)) AS "pgVectorSim"
FROM "latticeParaChunks"
WHERE active = true
  AND embedding IS NOT NULL
  AND "embeddingDim" = :dim
ORDER BY embedding <=> CAST(:vec AS vector) ASC
LIMIT 200;
```

### Công thức hợp nhất hạng Reciprocal Rank Fusion (`k = 60`)

Hàm `scoreRrfEntries` lọc tập ứng viên thỏa điều kiện `e.lex > 0 || (e.embeddingEngine === 'neural' && e.sem >= 0.18)`, sau đó xếp hạng độc lập theo điểm từ vựng (`rLex`) và điểm ngữ nghĩa (`rSem`) trước khi hợp nhất:

```text
rLex = (e.lex > 0) ? rank_desc(e.lex) : (N + 50)
rSem = rank_desc(e.sem)

rrf(e)   = (e.lex > 0 ? 1 / (60 + rLex) : 0) + 1 / (60 + rSem)
score(e) = round4( rrf(e) * 100 + e.lex * 0.25 + max(0, e.sem) * 2 )
```

Trong công thức trên, `k = 60` giảm độ nhạy với ngoại lệ ở các vị trí đầu bảng, thành phần `e.lex * 0.25` giữ ưu thế cho cụm từ khóa chính xác (như mã chứng từ hoặc mã kho), còn `max(0, e.sem) * 2` phân biệt các phân đoạn cùng hạng ngữ nghĩa. Kết quả cuối cùng được khử trùng lặp theo `documentId` (giữ phân đoạn có điểm cao nhất) và cắt theo `limit` (tối đa `30`).

## Tham chiếu API `latticePara`

<ApiEndpoint
  method="GET"
  path="/api/latticePara:summary"
  auth="Bearer JWT"
  scope="loggedIn"
  summary="Thống kê số lượng tài liệu đang hoạt động theo 4 phân vùng projects, areas, resources, archives."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:hybridSearch"
  auth="Bearer JWT"
  scope="loggedIn"
  summary="Chạy truy vấn Hybrid RAG (tsvector + pgvector + RRF k=60) trả về danh sách phân đoạn và trích dẫn."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:extractAttachment"
  auth="Bearer JWT"
  scope="Owner | Manager | Admin"
  summary="Giải nén, trích xuất văn bản PDF/Office và cập nhật phân đoạn vào latticeParaChunks."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:extractFormFields"
  auth="Bearer JWT"
  scope="Collection View ACL"
  summary="Trích xuất trường có cấu trúc từ tài liệu hoặc tệp ảnh/PDF qua OCR để điền sẵn biểu mẫu nghiệp vụ."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:reindex"
  auth="Bearer JWT"
  scope="Manager | Director | Admin"
  summary="Lập chỉ mục lại toàn bộ tổ chức hoặc một documentId cụ thể theo cấu hình embedding hiện hành."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePara:indexHealth"
  auth="Bearer JWT"
  scope="loggedIn"
  summary="Kiểm tra tình trạng pgvector, số lượng chunk neural/fallback, cấu hình OCR và nhật ký lỗi retry gần nhất."
/>

### Biến môi trường cấu hình RAG & OCR

<ParamGrid
  title="Cấu hình Embedding và OCR cho @latticedx/plugin-dxos-para"
  :items="[
    { name: 'DXOS_EMBEDDING_URL / DX_EMBEDDING_URL', type: 'string', required: false, description: 'Endpoint tương thích OpenAI /embeddings (tự suy diễn từ AGENT_BASE_URL nếu bỏ trống).' },
    { name: 'DXOS_EMBEDDING_MODEL', type: 'string', required: false, default: 'text-embedding-3-small', description: 'Tên mô hình embedding gửi tới endpoint neural.' },
    { name: 'DX_EMBEDDING_DIM', type: 'integer', required: false, default: '1536', description: 'Số chiều vector mục tiêu (8..8192); dùng khi gọi model hỗ trợ tham số dimensions.' },
    { name: 'DXOS_EMBEDDING_API_KEY', type: 'string', required: false, description: 'Khóa Bearer cho dịch vụ embedding (dự phòng AGENT_API_KEY).' },
    { name: 'DX_OCR_ENDPOINT', type: 'string', required: false, description: 'URL dịch vụ OCR đa phương thức (bắt buộc HTTPS hoặc host thuộc TRUSTED_OCR_HTTP_HOSTS).' },
    { name: 'DX_OCR_TRUSTED_HOSTS', type: 'string', required: false, description: 'Danh sách hostname nội bộ bổ sung (phân tách bằng dấu phẩy) được phép gọi qua HTTP.' },
    { name: 'DX_OCR_API_KEY', type: 'string', required: false, description: 'Token xác thực gửi qua header Authorization tới dịch vụ OCR.' }
  ]"
/>

### Ví dụ gọi API tìm kiếm và trích xuất tài liệu

<CodeTabs
  :tabs="[
    {
      label: 'Hybrid Search',
      lang: 'bash',
      code: 'curl -s -X POST https://lattice.example.com/api/latticePara:hybridSearch \\\n  -H \x22Authorization: Bearer $LATTICE_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22query\x22: \x22quy trinh xu ly su co nhiet do kho lanh\x22,\n    \x22paraSpace\x22: \x22areas\x22,\n    \x22limit\x22: 5\n  }\x27'
    },
    {
      label: 'Extract Attachment',
      lang: 'bash',
      code: 'DOC_B64=$(base64 -w 0 ./sop-coldchain.pdf)\ncurl -s -X POST https://lattice.example.com/api/latticePara:extractAttachment \\\n  -H \x22Authorization: Bearer $LATTICE_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x22{\n    \\\x22documentId\\\x22: 42,\n    \\\x22filename\\\x22: \\\x22sop-coldchain.pdf\\\x22,\n    \\\x22mimeType\\\x22: \\\x22application/pdf\\\x22,\n    \\\x22contentBase64\\\x22: \\\x22$DOC_B64\\\x22\n  }\x22'
    },
    {
      label: 'OCR Form Extraction',
      lang: 'json',
      code: '// Yêu cầu POST /api/latticePara:extractFormFields\n{\n  \x22documentId\x22: 42,\n  \x22targetCollection\x22: \x22latticeOrders\x22\n}'
    }
  ]"
/>

## Lưu ý vận hành và chế độ dự phòng

Khi chuyển đổi giữa mô hình embedding có số chiều khác nhau (ví dụ từ `fnv1a-256` sang `text-embedding-3-small` 1536 chiều), quản trị viên cần gọi `POST /api/latticePara:reindex` để đồng bộ lại cột `embedding` và `embeddingDim` trên toàn bộ bảng `latticeParaChunks`, vì truy vấn `pgvector` chỉ so khớp các hàng có cùng `embeddingDim` với vector truy vấn. Nếu PostgreSQL không cài extension `vector` hoặc dịch vụ embedding quá thời hạn `4500ms`, hệ thống tự động hạ cấp về tìm kiếm trên `embeddingJson` với vector `fnv1a-256` và từ vựng `tsvector` mà không làm gián đoạn luồng tạo hoặc tìm kiếm tài liệu.

## Tài liệu liên quan

- [Bộ 20 công cụ hợp nhất](/ai/unified-tools): Chi tiết công cụ `dxos_search_enterprise_context` sử dụng kết quả Hybrid RAG.
- [Tổng quan & Hồ sơ AI](/ai/overview-and-profiles): Cách `dxos-workspace` và `dxos-ops` khai thác kho tri thức P.A.R.A.
- [Cô lập đa tenant với PostgreSQL RLS](/architecture/multi-tenancy-rls): Chính sách `lattice_tenant_isolation` trên `latticeParaDocuments` và `latticeParaChunks`.
- [Giám sát & Quan sát hệ thống](/operations/observability): Theo dõi độ trễ truy vấn và chỉ số vận hành AI.
