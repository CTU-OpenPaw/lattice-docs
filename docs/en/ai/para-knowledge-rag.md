---
title: P.A.R.A. Knowledge Vault & Hybrid RAG
description: P.A.R.A. knowledge vault schema, binary-free Office/PDF/OCR ingestion pipeline, pgvector + tsvector indexing, and exact RRF (k = 60) hybrid ranking.
---

# P.A.R.A. Knowledge Vault & Hybrid RAG

The `@latticedx/plugin-dxos-para` plugin organizes enterprise documentation using the P.A.R.A. taxonomy (`Projects`, `Areas`, `Resources`, `Archives`) paired with a PostgreSQL 16 Hybrid RAG retrieval engine. It separates document ingestion, embedding computation, and hybrid ranking across Vietnamese/English lexical search and `pgvector` semantic similarity.

Documents created or updated in `latticeParaDocuments` synchronize into `latticeParaChunks` asynchronously after transaction commit (`afterCommit`). Both collections enforce tenant isolation via PostgreSQL `FORCE ROW LEVEL SECURITY` and feed grounding context directly to AI agents through `dxos_search_enterprise_context`.

<ParaHybridRagDiagram />

## P.A.R.A. Vault Data Model

Knowledge records reside in two tenant-scoped collections whose `organizationId` is bound automatically from the authenticated actor inside `validateParaDocument`.

| Collection | Purpose | Key Fields & Indexes |
| :--- | :--- | :--- |
| `latticeParaDocuments` | Canonical P.A.R.A. records | `code` (unique per `organizationId` via `uidx_lattice_para_org_code`), `title`, `paraSpace` (`projects`, `areas`, `resources`, `archives`), `status` (`draft`, `active`, `archived`), `summary`, `contentMarkdown`, `tags`, `attachmentUrl`, `relatedCollection`, `relatedRecordId`, `searchText`, `embeddingJson`. |
| `latticeParaChunks` | Indexed retrieval chunks | `documentId`, `organizationId`, `paraSpace`, `sourceType` (`document` \| `attachment`), `chunkIndex`, `sectionTitle`, `pageNumber`, `content`, `tokenCount`, `embeddingModel`, `embeddingEngine` (`neural` \| `deterministic-fallback`), `embeddingDim`, `embeddingJson`, `searchVector` (`tsvector`), and `embedding` (`vector`). |

The `afterCreate` and `afterUpdate` hooks schedule `syncDocumentChunks` (`chunkSize = 800` characters, `overlap = 120` characters) outside the main write transaction so external embedding latency never blocks document saves. If an embedding call fails transiently, `runAfterCommit` retries up to 3 times with exponential backoff (`1000ms`, `2000ms`) and surfaces unresolved failures on `latticePara:indexHealth`. Moving a document to `draft` or `archived`, or deleting it (`afterDestroy`), removes its searchable chunks from `latticeParaChunks`.

## Office, PDF, and OCR Ingestion Pipeline

Attachment parsing runs purely in Node.js (`node:zlib` and a custom ZIP Central Directory reader in `document-extractor.js`) with zero external OS binary dependencies.

### Supported Formats and Safety Bounds

| Format | Extraction Engine | Security & Resource Guards |
| :--- | :--- | :--- |
| PDF (`.pdf`) | Content stream parser with `ToUnicode` CMap decoding and `/ObjStm` / image-stream detection. | Capped at `5000` pages (`MAX_PDF_PAGE_COUNT`) and `65536` CMap entries (`MAX_CMAP_ENTRIES`); flags image-only scans with `PDF_SCANNED_OCR_REQUIRED`. |
| Word (`.docx`) | Bounded ZIP Central Directory inflation of `word/document.xml` with XML entity decoding. | Rejects `<!DOCTYPE` and `<!ENTITY` declarations against XXE (`OFFICE_XML_ENTITY_FORBIDDEN`); blocks path traversal and encrypted archives. |
| Excel (`.xlsx`) | Parses `xl/sharedStrings.xml` and worksheet cells under `xl/worksheets/sheet*.xml`. | Enforces `2MB` base64 upload cap (`MAX_UPLOAD_BYTES`), `10MB` total inflated ceiling (`MAX_INFLATED_BYTES`), and `10000` ZIP entries (`MAX_ZIP_ENTRIES`). |
| PowerPoint (`.pptx`) | Extracts slide text (`ppt/slides/slide*.xml`) together with speaker notes (`ppt/notesSlides/*`). | Shares the `MAX_INFLATED_BYTES` budget and Central Directory integrity validation. |
| Images & Plain Text | Direct UTF-8/CSV/Markdown reading plus offline PNG (`tEXt`/`zTXt`/`iTXt`), JPEG (`COM`/`XMP`), and WebP text extraction. | Scanned PDFs and raster images route to `DX_OCR_ENDPOINT` when invoked via `extractFormFields`. |

### OCR-to-Record Pipeline

`POST /api/latticePara:extractFormFields` extracts structured fields and line items from uploaded invoices, receipts, scanned PDFs, or existing P.A.R.A. records to pre-populate forms targeting `ALLOWED_FORM_COLLECTIONS`: `latticeOrders`, `latticeRequests`, `latticeStockLots`, and `latticeServiceTickets`.

When `DX_OCR_ENDPOINT` is set, `validateOcrEndpoint` validates the URL against SSRF rules (requiring public `HTTPS` or an internal host allowlisted in `TRUSTED_OCR_HTTP_HOSTS` such as `ocr`, `ocr-service`, `paddleocr`, `tesseract`, `vllm`, `ollama`, or `9router`), sets `redirect: 'error'`, and enforces a `5000ms` timeout. If remote OCR is unconfigured or unavailable, extraction degrades cleanly to `offline-deterministic-fallback` while scrubbing secrets and PII from `extractedTextPreview`.

## Hybrid Search: pgvector, BM25 tsvector, and Exact RRF (k = 60)

`executeHybridSearch` in `para-hybrid-search.js` merges PostgreSQL full-text ranking with cosine vector similarity and deterministic fallback scoring.

### Vietnamese Full-Text Index (`tsvector` + GIN)

Migration `20261123000300` installs trigger `trg_lattice_para_chunks_tsv` (`lattice_para_chunks_tsv_update()`), indexing `code`, `title`, `sectionTitle`, and `content` alongside a diacritic-folded copy (`VN_ACCENTED` mapped to `VN_FOLDED`) using the `'simple'` dictionary and a `GIN` index (`idx_lattice_para_chunks_tsv`). Unaccented queries such as `"nhiet do kho lanh"` match accented Vietnamese passages via `ts_rank_cd("searchVector", plainto_tsquery('simple', ...))`, combined with stop-word-filtered phrase and token overlap scoring in `lexicalOverlapScore`.

### Flexible Vector Storage (`pgvector`)

Migration `20261123000300` initially added `embedding vector(1536)` with an HNSW index (`idx_lattice_para_chunks_emb_hnsw`, falling back to `ivfflat`). Migration `20261127000200` converted `embedding` to unparameterized `vector` (dropping the fixed-dimension index) so neural models between `8` and `8192` dimensions (defaulting to `text-embedding-3-small` at `1536` dimensions with `NEURAL_TIMEOUT_MS = 4500ms`) coexist with the `fnv1a-256` unigram+trigram deterministic fallback (`EMBEDDING_DIM = 256`).

PostgreSQL semantic similarity uses the cosine distance operator `<=>`:

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

### Exact Reciprocal Rank Fusion Formula (`k = 60`)

`scoreRrfEntries` retains candidates satisfying `e.lex > 0 || (e.embeddingEngine === 'neural' && e.sem >= 0.18)`, computes independent descending ranks for lexical (`rLex`) and semantic (`rSem`) scores, and fuses them with constant `k = 60`:

```text
rLex = (e.lex > 0) ? rank_desc(e.lex) : (N + 50)
rSem = rank_desc(e.sem)

rrf(e)   = (e.lex > 0 ? 1 / (60 + rLex) : 0) + 1 / (60 + rSem)
score(e) = round4( rrf(e) * 100 + e.lex * 0.25 + max(0, e.sem) * 2 )
```

Here, `k = 60` dampens single-signal rank spikes, `e.lex * 0.25` preserves exact identifier matches (such as document codes or warehouse IDs), and `max(0, e.sem) * 2` breaks ties among semantically close passages. Results are deduplicated by `documentId` (keeping the highest-scoring chunk) and capped at `limit` (maximum `30`).

## `latticePara` API Reference

<ApiEndpoint
  method="GET"
  path="/api/latticePara:summary"
  auth="Bearer JWT"
  scope="loggedIn"
  summary="Returns active document counts partitioned across projects, areas, resources, and archives."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:hybridSearch"
  auth="Bearer JWT"
  scope="loggedIn"
  summary="Executes Hybrid RAG search (tsvector + pgvector + RRF k=60) returning ranked snippets and citations."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:extractAttachment"
  auth="Bearer JWT"
  scope="Owner | Manager | Admin"
  summary="Extracts text from an uploaded PDF or Office document and indexes its chunks into latticeParaChunks."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:extractFormFields"
  auth="Bearer JWT"
  scope="Collection View ACL"
  summary="Runs multimodal OCR or offline structured extraction to pre-fill target operational records."
/>

<ApiEndpoint
  method="POST"
  path="/api/latticePara:reindex"
  auth="Bearer JWT"
  scope="Manager | Director | Admin"
  summary="Rebuilds chunk embeddings for an entire organization or a single documentId."
/>

<ApiEndpoint
  method="GET"
  path="/api/latticePara:indexHealth"
  auth="Bearer JWT"
  scope="loggedIn"
  summary="Reports pgvector availability, neural vs fallback chunk counts, OCR configuration, and retry failures."
/>

### RAG & OCR Environment Configuration

<ParamGrid
  title="Environment Variables for @latticedx/plugin-dxos-para"
  :items="[
    { name: 'DXOS_EMBEDDING_URL / DX_EMBEDDING_URL', type: 'string', required: false, description: 'OpenAI-compatible /embeddings endpoint URL (derived from AGENT_BASE_URL if unset).' },
    { name: 'DXOS_EMBEDDING_MODEL', type: 'string', required: false, default: 'text-embedding-3-small', description: 'Embedding model identifier sent to the neural embedding endpoint.' },
    { name: 'DX_EMBEDDING_DIM', type: 'integer', required: false, default: '1536', description: 'Target vector dimensionality (8..8192) when the provider accepts dimensions.' },
    { name: 'DXOS_EMBEDDING_API_KEY', type: 'string', required: false, description: 'Bearer API key for the embedding service (falls back to AGENT_API_KEY).' },
    { name: 'DX_OCR_ENDPOINT', type: 'string', required: false, description: 'Remote OCR endpoint URL (must use HTTPS or an allowlisted internal Docker host).' },
    { name: 'DX_OCR_TRUSTED_HOSTS', type: 'string', required: false, description: 'Comma-separated list of additional internal hostnames allowed over plain HTTP.' },
    { name: 'DX_OCR_API_KEY', type: 'string', required: false, description: 'Bearer token forwarded in Authorization header to DX_OCR_ENDPOINT.' }
  ]"
/>

### Request Examples

<CodeTabs
  :tabs="[
    {
      label: 'Hybrid Search',
      lang: 'bash',
      code: 'curl -s -X POST https://lattice.example.com/api/latticePara:hybridSearch \\\n  -H \x22Authorization: Bearer $LATTICE_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x27{\n    \x22query\x22: \x22cold chain temperature excursion SOP\x22,\n    \x22paraSpace\x22: \x22areas\x22,\n    \x22limit\x22: 5\n  }\x27'
    },
    {
      label: 'Extract Attachment',
      lang: 'bash',
      code: 'DOC_B64=$(base64 -w 0 ./sop-coldchain.pdf)\ncurl -s -X POST https://lattice.example.com/api/latticePara:extractAttachment \\\n  -H \x22Authorization: Bearer $LATTICE_JWT\x22 \\\n  -H \x22Content-Type: application/json\x22 \\\n  -d \x22{\n    \\\x22documentId\\\x22: 42,\n    \\\x22filename\\\x22: \\\x22sop-coldchain.pdf\\\x22,\n    \\\x22mimeType\\\x22: \\\x22application/pdf\\\x22,\n    \\\x22contentBase64\\\x22: \\\x22$DOC_B64\\\x22\n  }\x22'
    },
    {
      label: 'OCR Form Extraction',
      lang: 'json',
      code: '// POST /api/latticePara:extractFormFields\n{\n  \x22documentId\x22: 42,\n  \x22targetCollection\x22: \x22latticeOrders\x22\n}'
    }
  ]"
/>

## Operational Notes and Fallback Behavior

When switching between embedding providers with different output dimensions, run `POST /api/latticePara:reindex` so `embedding` and `embeddingDim` stay aligned across all active chunks; PostgreSQL vector queries filter strictly by `"embeddingDim" = :dim`. If the `vector` extension is absent or the neural embedding endpoint exceeds the `4500ms` timeout, retrieval falls back automatically to `fnv1a-256` vectors in `embeddingJson` combined with `tsvector` lexical ranking without failing writes or agent tool calls.

## Related

- [20 Unified Tools](/en/ai/unified-tools): Reference for `dxos_search_enterprise_context` backed by P.A.R.A. Hybrid RAG.
- [AI Overview & Profiles](/en/ai/overview-and-profiles): How `dxos-workspace` and `dxos-ops` query P.A.R.A. knowledge spaces.
- [Multi-Tenancy & PostgreSQL RLS](/en/architecture/multi-tenancy-rls): `lattice_tenant_isolation` policies protecting `latticeParaDocuments` and `latticeParaChunks`.
- [Observability](/en/operations/observability): Latency and error monitoring for AI and RAG pipelines.
