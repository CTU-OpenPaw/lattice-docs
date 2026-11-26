# P.A.R.A. Knowledge Vault & OCR / Hybrid RAG

The **P.A.R.A. Knowledge Vault** (`@latticedx/plugin-dxos-para`, version `0.4.2`, Apache-2.0) organizes enterprise SOPs, incident dossiers, and operational documents into the four **P.A.R.A.** spaces (`projects`, `areas`, `resources`, `archives`), extracts structured fields from PDF and Office documents with strict archive/SSRF hardening, and serves **Hybrid RAG** queries combining PostgreSQL `pgvector 0.8.1` HNSW semantic similarity with Vietnamese diacritic-folded `tsvector` full-text search via Reciprocal Rank Fusion (RRF).

::: info Settings Route & Tenant Isolation
- **Admin Settings UI:** `/admin/settings/dxos-para`
- **PostgreSQL `FORCE RLS`:** Both `latticeParaDocuments` and `latticeParaChunks` enforce `lattice_tenant_isolation` via `organizationId` and `runParaRlsOp`.
- **Active Document Filter:** Hybrid search strictly indexes and returns records where `active !== false` and `status = 'active'` (archived/draft documents are excluded from RAG citations).
:::

---

## 1. Hybrid Search & RRF Architecture

```mermaid
flowchart TB
  Q[User / AI Query] --> NORM[Normalize & Fold Vietnamese Diacritics<br/>Strip stop words, keep code/ID tokens]
  NORM --> LEX[Lexical Branch<br/>PostgreSQL tsvector 'simple' + folded text]
  NORM --> EMB{Embedding Endpoint<br/>Configured?}
  EMB -->|Yes: DXOS_EMBEDDING_URL / AGENT_BASE_URL| NEURAL[Neural Embedding Batch<br/>8..8192 dims, default 1536]
  EMB -->|No / Offline| DET[Deterministic Fallback<br/>FNV-1a 256-dim vector]
  NEURAL --> VEC[Semantic Branch<br/>pgvector 0.8.1 Cosine Similarity]
  DET --> VEC
  LEX --> RRF[Reciprocal Rank Fusion k=60<br/>Filter status='active' + RLS]
  VEC --> RRF
  RRF --> OUT[Deduplicated Top Citations<br/>[latticeParaDocuments:code#id · chunk #n]]
```

### 1.1 `pgvector 0.8.1` Flexible Dimensions & Diacritic-Folded `tsvector`

- **Flexible Vector Column (`20261127000200-para-flexible-vector-dimension.js`):** Migration converts `latticeParaChunks.embedding` and `latticeParaDocuments.embedding` to untyped `vector`, supporting embedding models from `8` to `8192` dimensions (`DX_EMBEDDING_DIM` / `DXOS_EMBEDDING_DIM`, default `1536`) instead of locking deployments to a single provider dimension. Rollback (`down()`) restores `vector(1536)` with `idx_lattice_para_chunks_emb_hnsw` (`USING hnsw (embedding vector_cosine_ops)`).
- **Deterministic Offline Fallback:** When no external embedding service (`DXOS_EMBEDDING_URL`, `DX_EMBEDDING_URL`, or `AGENT_BASE_URL`) is reachable, `computeDeterministicEmbedding` computes a normalized `256`-dimensional `fnv1a-256` token + trigram vector so hybrid search and unit tests continue functioning without external network access.
- **Vietnamese `tsvector` Trigger (`20261123000300-para-chunks-and-semantic-vector.js`):** Every chunk maintains a `searchVector` column populated by `lattice_para_chunks_tsv_update()` combining raw Vietnamese text and accent-folded lowercase text (`áàảãạ...` → `aaaaa...`, `đ` → `d`), enabling accurate recall for both accented and unaccented queries.
- **RRF Fusion (`scoreRrfEntries`):** Combines lexical rank (`r_lex`) and semantic rank (`r_sem`) using `k = 60`:
  ```text
  RRF = (lex > 0 ? 1 / (60 + r_lex) : 0) + 1 / (60 + r_sem)
  ```
  Results are deduplicated per parent document and returned with machine-verifiable citations (`[latticeParaDocuments:<code>#<id> · đoạn #<n>]`).

---

## 2. Document Extraction, PDF ToUnicode CMap & Archive Hardening

`plugins/nocobase/plugin-dxos-para/src/server/document-extractor.js` parses PDF, DOCX, XLSX, PPTX, Markdown, CSV, JSON, and plain text natively in Node.js without shelling out to unsafe binaries.

### 2.1 PDF Parser with Vietnamese ToUnicode CMap

- Decodes compressed PDF streams (`FlateDecode` via `node:zlib`) up to `MAX_PDF_PAGE_COUNT = 5000`.
- Parses `begincodespacerange` / `endcodespacerange`, `beginbfchar` / `endbfchar`, and `beginbfrange` / `endbfrange` sections inside PDF `/ToUnicode` CMap streams (`MAX_CMAP_ENTRIES = 65536`, `MAX_BFRANGE_SPAN = 4096`) so Vietnamese Unicode glyphs (`ă, â, đ, ê, ô, ơ, ư` and tone marks) extracted from custom-encoded PDF fonts map cleanly to UTF-8 text.

### 2.2 Office OOXML ZIP & XXE Safety Bounds

When extracting `.docx`, `.xlsx`, and `.pptx` archives:

| Guardrail Constant | Limit | Protection |
| :--- | :---: | :--- |
| `MAX_UPLOAD_BYTES` | `2 MB` (`2,097,152` bytes) | Rejects oversized base64 attachment payloads before extraction (`ATTACHMENT_TOO_LARGE`) |
| `MAX_INFLATED_BYTES` | `10 MB` (`10,485,760` bytes) | Cumulative ZIP decompression ceiling preventing ZIP bomb memory exhaustion |
| `MAX_ZIP_ENTRIES` | `10,000` entries | Rejects Central Directory / local header bombs (`OFFICE_ZIP_TOO_MANY_ENTRIES`) |
| Path Traversal Check | Rejects `..`, `\0` | Blocks directory-escape ZIP entry names (`OFFICE_CORRUPT_ARCHIVE`) |
| XML Entity Guard (`assertSafeOfficeXml`) | Rejects `<!DOCTYPE` / `<!ENTITY` | Prevents XML External Entity (XXE) injection (`OFFICE_XML_ENTITY_FORBIDDEN`) |
| Encrypted Archive Check | Encrypted flag / streams rejected | Fails cleanly rather than hanging on password-locked Office files |

### 2.3 SSRF-Guarded Multimodal OCR (`DX_OCR_ENDPOINT`) & Offline Parser

- When `DX_OCR_ENDPOINT` is configured, `extractWithMultimodalOcr` posts attachments with `OCR_TIMEOUT_MS = 5000` only after validating the URL against `TRUSTED_OCR_HTTP_HOSTS` (`localhost`, `127.0.0.1`, `::1`, `host.docker.internal`, `ocr`, `ocr-service`, `dxos-ocr`, `paddleocr`, `tesseract`, `vllm`, `ollama`, `ninerouter`, `9router`) and rejecting private/link-local/metadata IP ranges via `BLOCKED_OCR_HOST_RE` (`169.254.*`, `10.*`, `172.16–31.*`, `192.168.*`, `100.64–127.*`, `metadata.google.internal`, `metadata.azure.com`, IPv6 ULA/link-local).
- **Offline Vietnamese Regex Fallback:** Without `DX_OCR_ENDPOINT`, `extractStructuredFormFields` extracts structured fields and line items offline for allowlisted target collections (`ALLOWED_FORM_COLLECTIONS`: `latticeOrders`, `latticeRequests`, `latticeStockLots`, `latticeServiceTickets`).
- **Preview Redaction:** `buildSafeTextPreview` strips control characters and redacts JWTs, `Bearer` tokens, `sk-*` keys, bank accounts, CCCD/CMND, phone numbers, and MST tax IDs before returning `extractedTextPreview` (max `500` chars).

---

## 3. `latticePara` Resource API (`6` Actions)

| Action | HTTP | Role / ACL Requirement | Purpose |
| :--- | :---: | :--- | :--- |
| `summary` | `GET` | Authenticated (`loggedIn` + P.A.R.A. read scope) | Return counts across the 4 P.A.R.A. spaces (`projects`, `areas`, `resources`, `archives`) for the caller's tenant |
| `hybridSearch` | `GET` / `POST` | Authenticated (`loggedIn` + P.A.R.A. read scope) | Execute RRF hybrid search (`pgvector` + `tsvector`) filtered by `paraSpace`, `status = 'active'`, and tenant RLS |
| `reindex` | `POST` | `REINDEX_ROLES` (`root`, `admin`, `ldx_admin`, `ldx_director`, `ldx_manager`) | Re-chunk and recompute embeddings + `searchVector` for active documents in the organization |
| `extractAttachment` | `POST` | Authenticated (`loggedIn` + P.A.R.A. write/extract scope) | Decode base64 upload (`<= 2 MB`), run PDF CMap / Office ZIP-safe / OCR extraction, and return redacted text preview |
| `extractFormFields` | `POST` | Authenticated + target collection ACL (`hasFormExtractionAcl`) | Extract structured record fields & `lineItems` mapped to `latticeOrders`, `latticeRequests`, `latticeStockLots`, or `latticeServiceTickets` |
| `indexHealth` | `GET` | Authenticated (`root` can pass `organizationId`) | Report `documentsCount`, `chunksCount`, `neuralChunks`, `fallbackChunks`, `targetEmbeddingDim`, `embeddingDims`, `pgvectorAvailable`, `embeddingConfigured`, `ocrConfigured`, and `pendingRetries` |

---

## 4. Environment Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DX_EMBEDDING_URL` / `DXOS_EMBEDDING_URL` | *(optional)* | OpenAI-compatible `/embeddings` endpoint (falls back to `AGENT_BASE_URL` if set, otherwise `fnv1a-256`) |
| `DXOS_EMBEDDING_MODEL` | `text-embedding-3-small` | Model identifier sent to the embedding endpoint |
| `DX_EMBEDDING_DIM` / `DXOS_EMBEDDING_DIM` | `1536` | Target vector dimension (`8..8192`) |
| `DXOS_EMBEDDING_API_KEY` | `AGENT_API_KEY` | Bearer key for embedding service requests |
| `DX_OCR_ENDPOINT` | *(optional)* | Multimodal OCR / VLM endpoint (validated against SSRF blocklist) |

---

## Related Modules

- [DX-OS AI Studio & App Builder 2.0](/en/modules/ai-studio-app-builder)
- [Unified Approvals, Omnichannel Notify, Public Forms & Mobile PWA](/en/modules/approvals-notify-forms-pwa)
- [IIoT, 2-Way Digital Twin, Connector Vault, Event Bus & Stock n8n](/en/modules/iiot-digital-twin-n8n)
