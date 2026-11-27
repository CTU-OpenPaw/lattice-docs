<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol } from 'vitepress';
import DiagramCanvas from './DiagramCanvas.vue';
import type {
  DiagramEdge,
  DiagramLocale,
  DiagramMode,
  DiagramNode,
  DiagramStep,
  DiagramZone,
} from './diagramTypes';

const props = defineProps<{ lang?: DiagramLocale }>();
const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const meta = computed(() =>
  resolvedLang.value === 'vi'
    ? {
        title: 'Kho tri thức P.A.R.A. & Tìm kiếm Lai RRF (k = 60)',
        caption:
          'Luồng nạp tài liệu và truy vấn app.current_org hội tụ về hai chỉ mục PG16 (GIN tsvector gập dấu tiếng Việt & pgvector Cosine), lọc qua Candidate Gate (lex > 0 || sem >= 0.18) và hợp nhất RRF (k = 60). Đường ống OCR-to-Record tách tệp số đi thẳng Field Mapper và ảnh scan qua Multimodal OCR (SSRF-safe, 5s) vào 4 bảng cho phép.',
      }
    : {
        title: 'P.A.R.A. Knowledge Vault & RRF Hybrid RAG (k = 60)',
        caption:
          'Ingestion and tenant-scoped queries converge on dual PG16 indexes (GIN tsvector with Vietnamese folding & pgvector Cosine), filter at Candidate Gate (lex > 0 || sem >= 0.18), and fuse via RRF (k = 60). Document extraction routes digital PDF/Office straight to Field Mapper and image scans through SSRF-safe Multimodal OCR (5s) into 4 allowlisted collections.',
      },
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  // View 1: Ingestion & Hybrid RRF Retrieval (k = 60)
  const ragZones: DiagramZone[] = [
    {
      id: 'para-ingest',
      label: isVi ? 'Luồng 1 · Nạp & Phân đoạn P.A.R.A.' : 'Lane 1 · Ingestion & P.A.R.A. Chunking',
      x: 16,
      y: 16,
      width: 436,
      height: 164,
      kind: 'admin',
    },
    {
      id: 'para-query',
      label: isVi ? 'Luồng 2 · Truy vấn Cô lập RLS' : 'Lane 2 · Tenant-Scoped Query (RLS)',
      x: 16,
      y: 196,
      width: 436,
      height: 160,
      kind: 'traffic',
    },
    {
      id: 'para-indexes',
      label: isVi ? 'Chỉ mục Kép PG16 (FORCE RLS)' : 'Dual PG16 Indexes (FORCE RLS)',
      x: 496,
      y: 16,
      width: 228,
      height: 340,
      kind: 'traffic',
    },
    {
      id: 'para-fusion',
      label: isVi ? 'Candidate Gate · RRF k=60 · Trích dẫn' : 'Candidate Gate · RRF k=60 · Citations',
      x: 768,
      y: 16,
      width: 488,
      height: 340,
      kind: 'admin',
    },
  ];

  const ragNodes: DiagramNode[] = [
    {
      id: 'docs_in',
      title: 'PDF / Office / Scan',
      sub: ['Pure-Node zlib <= 2MB', 'ToUnicode CMap'],
      icon: 'file-text',
      x: 28,
      y: 64,
      width: 176,
      height: 76,
      zoneId: 'para-ingest',
      inspector: isVi
        ? {
            role: 'Bộ trích xuất tài liệu thuần Node.js zlib và ZIP Central Directory',
            packageOrPort: '@latticedx/plugin-dxos-para · document-extractor.js',
            protocol: 'In-process · Zero External Binary',
            payloadOrSchema: 'PDF (CMap, /ObjStm), DOCX, XLSX, PPTX, PNG/JPEG/WebP',
            responsibilities:
              'Giải nén và trích xuất văn bản trong bộ nhớ với giới hạn MAX_UPLOAD_BYTES=2MB, MAX_INFLATED_BYTES=10MB và tối đa 5000 trang PDF.',
          }
        : {
            role: 'Pure-Node zlib and ZIP Central Directory document extractor',
            packageOrPort: '@latticedx/plugin-dxos-para · document-extractor.js',
            protocol: 'In-process · Zero External Binary',
            payloadOrSchema: 'PDF (CMap, /ObjStm), DOCX, XLSX, PPTX, PNG/JPEG/WebP',
            responsibilities:
              'Extracts text without OS binaries while enforcing MAX_UPLOAD_BYTES=2MB, MAX_INFLATED_BYTES=10MB, and MAX_PDF_PAGE_COUNT=5000.',
          },
    },
    {
      id: 'para_chunker',
      title: isVi ? 'Phân đoạn P.A.R.A.' : 'P.A.R.A. Chunker',
      sub: ['latticeParaChunks', '800 chars · 120 overlap'],
      icon: 'layers',
      x: 244,
      y: 64,
      width: 192,
      height: 76,
      zoneId: 'para-ingest',
      focal: true,
      inspector: isVi
        ? {
            role: 'Chuẩn hóa không gian P.A.R.A. và cắt đoạn sau commit giao dịch',
            packageOrPort: 'schema.js · latticeParaDocuments / Chunks',
            protocol: 'PG16 afterCommit · FORCE RLS',
            payloadOrSchema: 'projects | areas | resources | archives (800/120 chars)',
            responsibilities:
              'Lưu tài liệu theo (organizationId, code) và đồng bộ phân đoạn bất đồng bộ (retry 3 lần) vào hai chỉ mục PG16.',
          }
        : {
            role: 'P.A.R.A. organizer and post-commit structural chunker',
            packageOrPort: 'schema.js · latticeParaDocuments / Chunks',
            protocol: 'PG16 afterCommit · FORCE RLS',
            payloadOrSchema: 'projects | areas | resources | archives (800/120 chars)',
            responsibilities:
              'Stores unique (organizationId, code) documents and chunks content asynchronously after commit (3x retry) into dual PG16 indexes.',
          },
    },
    {
      id: 'query_rls',
      title: isVi ? 'Truy vấn Theo RLS' : 'Tenant-Scoped Query',
      sub: ['SET LOCAL app.current_org', 'latticePara:hybridSearch'],
      icon: 'globe',
      x: 132,
      y: 244,
      width: 236,
      height: 76,
      zoneId: 'para-query',
      focal: true,
      inspector: isVi
        ? {
            role: 'Điểm vào tìm kiếm tri thức gắn ngữ cảnh tổ chức app.current_org',
            packageOrPort: 'para-resource.js · POST /api/latticePara:hybridSearch',
            protocol: 'HTTPS · Bearer + PG16 FORCE RLS',
            payloadOrSchema: 'query, paraSpace, limit (<= 30) · app.current_org',
            responsibilities:
              'Cô lập truy vấn theo tenant hiện tại và gửi song song tới bộ chấm điểm GIN tsvector (lex) và pgvector Cosine (sem).',
          }
        : {
            role: 'Tenant-isolated query entrypoint binding app.current_org',
            packageOrPort: 'para-resource.js · POST /api/latticePara:hybridSearch',
            protocol: 'HTTPS · Bearer + PG16 FORCE RLS',
            payloadOrSchema: 'query, paraSpace, limit (<= 30) · app.current_org',
            responsibilities:
              'Binds transaction-local app.current_org and executes parallel scoring against GIN tsvector (lex) and pgvector Cosine (sem).',
          },
    },
    {
      id: 'gin_tsv',
      title: 'GIN tsvector',
      sub: ['ts_rank_cd · VN-fold', 'idx_lattice_para_tsv'],
      icon: 'terminal',
      x: 512,
      y: 64,
      width: 196,
      height: 76,
      zoneId: 'para-indexes',
      inspector: isVi
        ? {
            role: 'Chỉ mục từ vựng GIN tsvector hỗ trợ gập dấu tiếng Việt tự động',
            packageOrPort: 'PG16 · idx_lattice_para_chunks_tsv',
            protocol: 'Trigger trg_lattice_para_chunks_tsv',
            payloadOrSchema: "ts_rank_cd(searchVector, plainto_tsquery('simple', ...)) + lex",
            responsibilities:
              'Gập dấu tiếng Việt (VN_ACCENTED -> VN_FOLDED) qua trigger PostgreSQL và tính điểm khớp cụm từ + từ khóa lex.',
          }
        : {
            role: 'GIN tsvector lexical scorer with automatic Vietnamese folding',
            packageOrPort: 'PG16 · idx_lattice_para_chunks_tsv',
            protocol: 'Trigger trg_lattice_para_chunks_tsv',
            payloadOrSchema: "ts_rank_cd(searchVector, plainto_tsquery('simple', ...)) + lex",
            responsibilities:
              'Indexes folded Vietnamese diacritics via PostgreSQL trigger and computes ts_rank_cd + lexicalOverlapScore (lex).',
          },
    },
    {
      id: 'pgvector_cos',
      title: 'pgvector Cosine',
      sub: ['1536d Neural / FNV 256d', '1 - (embedding <=> vec)'],
      icon: 'database',
      x: 512,
      y: 244,
      width: 196,
      height: 76,
      zoneId: 'para-indexes',
      inspector: isVi
        ? {
            role: 'Chỉ mục vector ngữ nghĩa pgvector hỗ trợ chiều linh hoạt và dự phòng FNV-1a',
            packageOrPort: 'pgvector 0.8.1 · idx_lattice_para_chunks_emb_hnsw',
            protocol: 'HTTPS Neural (4.5s) | FNV-1a 256d Fallback',
            payloadOrSchema: 'vector (8..8192 dims) · 1 - (embedding <=> CAST(:vec AS vector))',
            responsibilities:
              'Tính độ tương đồng cosine sem bằng neural 1536d hoặc tự động chuyển sang vector tất định FNV-1a 256d khi ngoại tuyến.',
          }
        : {
            role: 'Flexible-dimension pgvector cosine scorer with FNV-1a 256d fallback',
            packageOrPort: 'pgvector 0.8.1 · idx_lattice_para_chunks_emb_hnsw',
            protocol: 'HTTPS Neural (4.5s) | FNV-1a 256d Fallback',
            payloadOrSchema: 'vector (8..8192 dims) · 1 - (embedding <=> CAST(:vec AS vector))',
            responsibilities:
              'Computes semantic similarity sem (1536d neural default or deterministic 256d FNV-1a fallback if neural endpoint is unavailable).',
          },
    },
    {
      id: 'gate_rrf',
      title: 'Candidate Gate & RRF',
      sub: ['lex>0 || sem>=0.18', 'RRF Fusion (k = 60)'],
      icon: 'git-branch',
      x: 784,
      y: 150,
      width: 196,
      height: 86,
      zoneId: 'para-fusion',
      focal: true,
      tone: 'accent',
      inspector: isVi
        ? {
            role: 'Lọc ứng viên sau chấm điểm song song và hợp nhất hạng RRF (k = 60)',
            packageOrPort: 'para-hybrid-search.js · scoreRrfEntries',
            protocol: 'Candidate Gate -> Deterministic RRF (k = 60)',
            payloadOrSchema: 'rrf = (lex>0 ? 1/(60+rLex) : 0) + 1/(60+rSem)',
            responsibilities:
              'Loại nhiễu neural sem < 0.18 khi không có từ khóa khớp, xếp hạng rLex/rSem độc lập và tính score = round4(rrf*100 + lex*0.25 + max(0,sem)*2).',
          }
        : {
            role: 'Post-scoring candidate filter and Reciprocal Rank Fusion (k = 60)',
            packageOrPort: 'para-hybrid-search.js · scoreRrfEntries',
            protocol: 'Candidate Gate -> Deterministic RRF (k = 60)',
            payloadOrSchema: 'rrf = (lex>0 ? 1/(60+rLex) : 0) + 1/(60+rSem)',
            responsibilities:
              'Filters out low-confidence neural hits (< 0.18) with lex=0, assigns rLex/rSem ranks, and fuses with k=60 plus lexical/semantic tie-breakers.',
          },
    },
    {
      id: 'citations',
      title: isVi ? 'Trích dẫn Có nguồn' : 'Grounded Citations',
      sub: ['dxos_search_', 'enterprise_context', 'Top-K · RBAC Filtered'],
      icon: 'bot',
      x: 1036,
      y: 154,
      width: 204,
      height: 78,
      zoneId: 'para-fusion',
      tone: 'flow',
      inspector: isVi
        ? {
            role: 'Trả về phân đoạn xếp hạng cao nhất kèm mã tài liệu, mục và số trang',
            packageOrPort: 'ai-operational-tools.js · dxos_search_enterprise_context',
            protocol: 'JSON Citations · Deduplicated by documentId',
            payloadOrSchema: 'documentId, code, sectionTitle, pageNumber, score',
            responsibilities:
              'Khử trùng lặp theo documentId (giữ chunk điểm cao nhất) và cung cấp trích dẫn có căn cứ cho UI lẫn tác nhân AI.',
          }
        : {
            role: 'Delivers top-ranked grounded chunks with citations to AI & UI',
            packageOrPort: 'ai-operational-tools.js · dxos_search_enterprise_context',
            protocol: 'JSON Citations · Deduplicated by documentId',
            payloadOrSchema: 'documentId, code, sectionTitle, pageNumber, score',
            responsibilities:
              'Deduplicates top-scoring chunks per documentId and feeds verified tenant citations to UI search and AI studio agents.',
          },
    },
  ];

  const ragEdges: DiagramEdge[] = [
    {
      id: 'h1',
      from: 'docs_in',
      to: 'para_chunker',
      kind: 'flow',
      points: [
        [204, 102],
        [244, 102],
      ],
    },
    {
      id: 'h2',
      from: 'para_chunker',
      to: 'gin_tsv',
      label: 'tsvector',
      kind: 'flow',
      points: [
        [436, 86],
        [512, 86],
      ],
    },
    {
      id: 'h3',
      from: 'para_chunker',
      to: 'pgvector_cos',
      label: 'Embed',
      kind: 'flow',
      labelPosition: 0.36,
      points: [
        [436, 122],
        [462, 122],
        [462, 264],
        [512, 264],
      ],
    },
    {
      id: 'h4',
      from: 'query_rls',
      to: 'gin_tsv',
      label: 'Lex',
      kind: 'primary',
      labelPosition: 0.36,
      points: [
        [368, 264],
        [488, 264],
        [488, 118],
        [512, 118],
      ],
    },
    {
      id: 'h5',
      from: 'query_rls',
      to: 'pgvector_cos',
      label: 'Cosine',
      kind: 'primary',
      points: [
        [368, 300],
        [512, 300],
      ],
    },
    {
      id: 'h6',
      from: 'gin_tsv',
      to: 'gate_rrf',
      label: 'lex',
      kind: 'primary',
      points: [
        [708, 102],
        [750, 102],
        [750, 178],
        [784, 178],
      ],
    },
    {
      id: 'h7',
      from: 'pgvector_cos',
      to: 'gate_rrf',
      label: 'sem',
      kind: 'primary',
      points: [
        [708, 282],
        [750, 282],
        [750, 208],
        [784, 208],
      ],
    },
    {
      id: 'h8',
      from: 'gate_rrf',
      to: 'citations',
      label: 'Top-K',
      kind: 'primary',
      points: [
        [980, 193],
        [1036, 193],
      ],
    },
  ];

  const ragSteps: DiagramStep[] = [
    {
      id: 'rag-s1',
      title: isVi ? '1. Nạp & Lập chỉ mục Kép' : '1. Ingest, Chunk & Dual Index',
      activeNodes: ['docs_in', 'para_chunker', 'gin_tsv', 'pgvector_cos'],
      activeEdges: ['h1', 'h2', 'h3'],
      description: isVi
        ? 'Tài liệu giải nén thuần zlib/Node, cắt thành đoạn 800 ký tự vào latticeParaChunks và cập nhật GIN tsvector (gập dấu VN) + pgvector.'
        : 'Pure-Node zlib extraction chunks documents into latticeParaChunks and updates both GIN tsvector (VN-folded) and pgvector Cosine.',
      route: 'POST /api/latticeParaDocuments:create',
      payload: 'GIN tsvector + pgvector (1536d / FNV 256d)',
      chips: ['Pure-Node', 'FORCE RLS'],
    },
    {
      id: 'rag-s2',
      title: isVi ? '2. Truy vấn RLS -> Chấm điểm Song song' : '2. Tenant Query -> Parallel Scoring',
      activeNodes: ['query_rls', 'gin_tsv', 'pgvector_cos'],
      activeEdges: ['h4', 'h5'],
      description: isVi
        ? 'Truy vấn gắn SET LOCAL app.current_org chạy song song trên ts_rank_cd (lex) và khoảng cách cosine pgvector (sem).'
        : 'Queries bound to app.current_org score ts_rank_cd (lex) and pgvector cosine similarity (sem) in parallel.',
      route: 'POST /api/latticePara:hybridSearch',
      payload: 'SET LOCAL app.current_org -> lex & sem',
      chips: ['app.current_org', 'Cosine <=>'],
    },
    {
      id: 'rag-s3',
      title: isVi ? '3. Candidate Gate + RRF (k=60) -> Trích dẫn' : '3. Candidate Gate + RRF (k=60) -> Citations',
      activeNodes: ['gin_tsv', 'pgvector_cos', 'gate_rrf', 'citations'],
      activeEdges: ['h6', 'h7', 'h8'],
      description: isVi
        ? 'Candidate Gate lọc e.lex > 0 || (neural && e.sem >= 0.18), hợp nhất hạng RRF (k=60) và trả về Top-K trích dẫn cho dxos_search_enterprise_context.'
        : 'Candidate Gate enforces lex > 0 || (neural && sem >= 0.18), fuses ranks via RRF (k=60), and returns Top-K citations to dxos_search_enterprise_context.',
      route: 'scoreRrfEntries -> dxos_search_enterprise_context',
      payload: 'rrf = (lex>0 ? 1/(60+rLex) : 0) + 1/(60+rSem)',
      chips: ['k = 60', 'Grounded'],
    },
  ];

  // View 2: Document Extraction & OCR-to-Record (Strict L->R, Full Allowlisted Table Names)
  const ocrZones: DiagramZone[] = [
    {
      id: 'ocr-extract',
      label: isVi ? 'Trích xuất Tệp Số & OCR Ảnh Scan (SSRF-Safe)' : 'Extraction Guard & Image-Scan OCR (SSRF-Safe)',
      x: 16,
      y: 16,
      width: 688,
      height: 296,
      kind: 'admin',
    },
    {
      id: 'ocr-map',
      label: isVi ? 'Ánh xạ Trường & 4 Bảng Nghiệp vụ' : 'Field Mapper & 4 Allowlisted Tables',
      x: 720,
      y: 16,
      width: 516,
      height: 296,
      kind: 'traffic',
    },
  ];

  const ocrNodes: DiagramNode[] = [
    {
      id: 'upload_doc',
      title: 'Upload <= 2MB',
      sub: ['PDF · Office · Image', 'MAX_UPLOAD_BYTES'],
      icon: 'file-text',
      x: 28,
      y: 64,
      width: 172,
      height: 76,
      zoneId: 'ocr-extract',
      inspector: isVi
        ? {
            role: 'Tiếp nhận chứng từ PDF, Office hoặc ảnh chụp biểu mẫu tối đa 2MB',
            packageOrPort: 'para-resource.js · POST /api/latticePara:extractFormFields',
            protocol: 'HTTPS POST · Bearer + Tenant RLS',
            payloadOrSchema: 'PDF, DOCX, XLSX, PPTX, PNG, JPEG, WebP (<= 2MB)',
            responsibilities:
              'Kiểm tra ngưỡng MAX_UPLOAD_BYTES=2MB và chuyển tệp sang Extractor Guard để phân luồng tài liệu số và ảnh scan.',
          }
        : {
            role: 'Document and form image upload entrypoint capped at 2MB',
            packageOrPort: 'para-resource.js · POST /api/latticePara:extractFormFields',
            protocol: 'HTTPS POST · Bearer + Tenant RLS',
            payloadOrSchema: 'PDF, DOCX, XLSX, PPTX, PNG, JPEG, WebP (<= 2MB)',
            responsibilities:
              'Validates MAX_UPLOAD_BYTES=2MB and routes payloads to Extractor Guard to separate digital text from image-only scans.',
          },
    },
    {
      id: 'extractor_guard',
      title: 'Extractor Guard',
      sub: ['MAX_INFLATED 10MB', 'Pure-Node zlib / ZIP'],
      icon: 'shield',
      x: 248,
      y: 64,
      width: 192,
      height: 76,
      zoneId: 'ocr-extract',
      focal: true,
      inspector: isVi
        ? {
            role: 'Bảo vệ chống Zip-Bomb/XXE và tách nhánh văn bản số vs ảnh scan',
            packageOrPort: 'document-extractor.js · extractDocumentText',
            protocol: 'In-process · Zip-Bomb & XXE Guard',
            payloadOrSchema: 'MAX_INFLATED=10MB | MAX_ZIP_ENTRIES=10000 | MAX_PAGES=5000',
            responsibilities:
              'Chặn <!DOCTYPE/<!ENTITY và path traversal; văn bản số đi thẳng tới Field Mapper, còn ảnh/PDF scan chuyển qua Multimodal OCR.',
          }
        : {
            role: 'Zip-bomb/XXE guard and digital-vs-scan branch router',
            packageOrPort: 'document-extractor.js · extractDocumentText',
            protocol: 'In-process · Zip-Bomb & XXE Guard',
            payloadOrSchema: 'MAX_INFLATED=10MB | MAX_ZIP_ENTRIES=10000 | MAX_PAGES=5000',
            responsibilities:
              'Rejects <!DOCTYPE/<!ENTITY and path traversal; routes digital Office/PDF directly to Field Mapper and scanned images to Multimodal OCR.',
          },
    },
    {
      id: 'multimodal_ocr',
      title: isVi ? 'OCR Đa phương thức' : 'Multimodal OCR',
      sub: ['DX_OCR_ENDPOINT · SSRF-safe', '5s · Offline Fallback'],
      icon: 'globe',
      x: 460,
      y: 204,
      width: 228,
      height: 84,
      zoneId: 'ocr-extract',
      focal: true,
      inspector: isVi
        ? {
            role: 'Gọi dịch vụ OCR đa phương thức có kiểm soát SSRF và dự phòng ngoại tuyến',
            packageOrPort: 'para-resource.js · extractWithMultimodalOcr',
            protocol: 'HTTPS · validateOcrEndpoint · redirect: error · 5s',
            payloadOrSchema: 'DX_OCR_ENDPOINT | offline-deterministic-fallback',
            responsibilities:
              'Xác thực URL qua validateOcrEndpoint (chặn redirect, timeout 5000ms); nếu vắng endpoint hoặc lỗi mạng sẽ tự chuyển sang bộ đọc tất định ngoại tuyến.',
          }
        : {
            role: 'SSRF-checked multimodal OCR connector with offline deterministic fallback',
            packageOrPort: 'para-resource.js · extractWithMultimodalOcr',
            protocol: 'HTTPS · validateOcrEndpoint · redirect: error · 5s',
            payloadOrSchema: 'DX_OCR_ENDPOINT | offline-deterministic-fallback',
            responsibilities:
              'Validates DX_OCR_ENDPOINT via validateOcrEndpoint with redirect: error and 5000ms timeout; degrades cleanly to offline-deterministic-fallback.',
          },
    },
    {
      id: 'field_mapper',
      title: isVi ? 'Ánh xạ Trường' : 'Field Mapper',
      sub: ['extractStructuredFormFields', 'Allowlist Validation'],
      icon: 'workflow',
      x: 736,
      y: 64,
      width: 212,
      height: 76,
      zoneId: 'ocr-map',
      focal: true,
      inspector: isVi
        ? {
            role: 'Chuẩn hóa văn bản số hoặc đầu ra OCR thành JSON biểu mẫu hợp lệ',
            packageOrPort: 'para-resource.js · extractStructuredFormFields',
            protocol: 'Allowlist Schema Validation · PII Scrubbed Preview',
            payloadOrSchema: 'ALLOWED_FORM_COLLECTIONS (4 allowlisted tables)',
            responsibilities:
              'Tiếp nhận đầu ra từ nhánh văn bản số lẫn Multimodal OCR, chuẩn hóa trường và chỉ cho phép ghi vào 4 bảng nghiệp vụ hợp lệ.',
          }
        : {
            role: 'Normalizes digital text or OCR output into validated record fields',
            packageOrPort: 'para-resource.js · extractStructuredFormFields',
            protocol: 'Allowlist Schema Validation · PII Scrubbed Preview',
            payloadOrSchema: 'ALLOWED_FORM_COLLECTIONS (4 allowlisted tables)',
            responsibilities:
              'Accepts extracted text from the digital fast-path or Multimodal OCR, scrubs PII previews, and enforces the 4-table allowlist.',
          },
    },
    {
      id: 'target_records',
      title: isVi ? '4 Bảng Cho phép' : '4 Allowlisted Tables',
      sub: [
        'latticeOrders · latticeRequests',
        'latticeStockLots',
        'latticeServiceTickets',
      ],
      icon: 'database',
      x: 980,
      y: 56,
      width: 244,
      height: 92,
      zoneId: 'ocr-map',
      tone: 'accent',
      inspector: isVi
        ? {
            role: '4 bảng đích duy nhất được phép điền tự động từ tài liệu và OCR',
            packageOrPort: 'PG16 · ALLOWED_FORM_COLLECTIONS',
            protocol: 'Tenant RLS · SET LOCAL app.current_org',
            payloadOrSchema: 'latticeOrders, latticeRequests, latticeStockLots, latticeServiceTickets',
            responsibilities:
              'Ghi nhận dữ liệu biểu mẫu đã chuẩn hóa vào đơn hàng, yêu cầu, lô hàng hoặc phiếu dịch vụ trong vùng cô lập đa tenant.',
          }
        : {
            role: 'The 4 operational collections allowlisted for form pre-population',
            packageOrPort: 'PG16 · ALLOWED_FORM_COLLECTIONS',
            protocol: 'Tenant RLS · SET LOCAL app.current_org',
            payloadOrSchema: 'latticeOrders, latticeRequests, latticeStockLots, latticeServiceTickets',
            responsibilities:
              'Populates validated orders, requests, stock lots, or service tickets strictly within the tenant RLS isolation boundary.',
          },
    },
  ];

  const ocrEdges: DiagramEdge[] = [
    {
      id: 'o1',
      from: 'upload_doc',
      to: 'extractor_guard',
      kind: 'primary',
      points: [
        [200, 102],
        [248, 102],
      ],
    },
    {
      id: 'o_digital',
      from: 'extractor_guard',
      to: 'field_mapper',
      label: 'Digital PDF / Office',
      kind: 'primary',
      points: [
        [440, 92],
        [736, 92],
      ],
    },
    {
      id: 'o2',
      from: 'extractor_guard',
      to: 'multimodal_ocr',
      label: 'Image Scan',
      kind: 'flow',
      labelPosition: 0.42,
      points: [
        [344, 140],
        [344, 246],
        [460, 246],
      ],
    },
    {
      id: 'o3',
      from: 'multimodal_ocr',
      to: 'field_mapper',
      label: 'OCR / Fallback',
      kind: 'flow',
      labelPosition: 0.48,
      points: [
        [688, 246],
        [714, 246],
        [714, 118],
        [736, 118],
      ],
    },
    {
      id: 'o4',
      from: 'field_mapper',
      to: 'target_records',
      kind: 'primary',
      points: [
        [948, 102],
        [980, 102],
      ],
    },
  ];

  const ocrSteps: DiagramStep[] = [
    {
      id: 'ocr-s1',
      title: isVi ? '1. Nhánh Nhanh: PDF/Office Số -> Field Mapper' : '1. Fast Path: Digital PDF/Office -> Field Mapper',
      activeNodes: ['upload_doc', 'extractor_guard', 'field_mapper'],
      activeEdges: ['o1', 'o_digital'],
      description: isVi
        ? 'Tệp <= 2MB qua Extractor Guard (MAX_INFLATED 10MB); PDF có lớp văn bản và Office đi thẳng tới Field Mapper không cần gọi OCR.'
        : 'Uploads <= 2MB pass Extractor Guard (MAX_INFLATED 10MB); text-layer PDFs and Office docs bypass external OCR straight to Field Mapper.',
      route: 'document-extractor.js -> extractStructuredFormFields()',
      payload: 'MAX_UPLOAD_BYTES=2MB | MAX_INFLATED_BYTES=10MB',
      chips: ['Zero-OCR Fast Path', 'Zip-Bomb Guard'],
    },
    {
      id: 'ocr-s2',
      title: isVi ? '2. Nhánh Ảnh Scan: Multimodal OCR (SSRF-safe, 5s)' : '2. Scan Path: Multimodal OCR (SSRF-safe, 5s)',
      activeNodes: ['extractor_guard', 'multimodal_ocr', 'field_mapper'],
      activeEdges: ['o2', 'o3'],
      description: isVi
        ? 'Ảnh và PDF scan gọi DX_OCR_ENDPOINT qua kiểm tra SSRF (redirect: error, timeout 5s) hoặc tự hạ cấp sang offline-deterministic-fallback.'
        : 'Scanned PDFs and images call DX_OCR_ENDPOINT with SSRF checks (redirect: error, 5s timeout) or fall back to offline-deterministic-fallback.',
      route: 'validateOcrEndpoint(DX_OCR_ENDPOINT)',
      payload: 'OCR_TIMEOUT_MS = 5000 | offline-deterministic-fallback',
      chips: ['SSRF-Safe', '5s Timeout'],
    },
    {
      id: 'ocr-s3',
      title: isVi ? '3. Ghi vào 4 Bảng Cho phép (RLS)' : '3. Populate 4 Allowlisted Tables (RLS)',
      activeNodes: ['field_mapper', 'target_records'],
      activeEdges: ['o4'],
      description: isVi
        ? 'Field Mapper chỉ cho phép điền trước vào 4 bảng: latticeOrders, latticeRequests, latticeStockLots và latticeServiceTickets.'
        : 'Field Mapper constrains target writes strictly to latticeOrders, latticeRequests, latticeStockLots, and latticeServiceTickets.',
      route: 'POST /api/latticePara:extractFormFields',
      payload: 'latticeOrders | latticeRequests | latticeStockLots | latticeServiceTickets',
      chips: ['4 Allowlisted Tables', 'Tenant RLS'],
    },
  ];

  return [
    {
      id: 'hybrid-rag',
      label: isVi ? 'Tìm kiếm Lai RRF' : 'Hybrid RRF Retrieval',
      viewBox: '0 0 1272 372',
      zones: ragZones,
      nodes: ragNodes,
      edges: ragEdges,
      steps: ragSteps,
    },
    {
      id: 'ocr-to-record',
      label: 'OCR-to-Record',
      viewBox: '0 0 1252 332',
      zones: ocrZones,
      nodes: ocrNodes,
      edges: ocrEdges,
      steps: ocrSteps,
    },
  ];
});
</script>

<template>
  <DiagramCanvas
    :title="meta.title"
    :caption="meta.caption"
    viewBox="0 0 1272 372"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
