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
          'Nạp tài liệu Office/PDF/OCR không phụ thuộc binary ngoài, phân đoạn vào pgvector HNSW và GIN tsvector, hợp nhất RRF (k = 60) và trả lời có trích dẫn trong vùng RLS.',
      }
    : {
        title: 'P.A.R.A. Knowledge Vault & RRF Hybrid RAG (k = 60)',
        caption:
          'Zero-binary Office/PDF/OCR extraction, dual pgvector + GIN tsvector indexing, RRF fusion (k = 60), and RBAC-grounded retrieval under PostgreSQL 16 FORCE RLS.',
      },
);

const modes = computed<DiagramMode[]>(() => {
  const isVi = resolvedLang.value === 'vi';

  const ragZones: DiagramZone[] = [
    {
      id: 'para-ingest',
      label: isVi ? 'Nạp & Phân đoạn P.A.R.A.' : 'P.A.R.A. Ingestion & Chunking',
      x: 16,
      y: 16,
      width: 408,
      height: 156,
      kind: 'admin',
    },
    {
      id: 'para-indexes',
      label: isVi ? 'Chỉ mục Kép (PG16)' : 'Dual Search Indexes',
      x: 444,
      y: 16,
      width: 212,
      height: 256,
      kind: 'traffic',
    },
    {
      id: 'para-query',
      label: isVi ? 'Truy vấn & Lọc Ngưỡng' : 'RBAC Query & Threshold',
      x: 16,
      y: 188,
      width: 408,
      height: 172,
      kind: 'traffic',
    },
    {
      id: 'para-fusion',
      label: isVi ? 'RRF & Trả lời' : 'RRF & Grounded Output',
      x: 672,
      y: 16,
      width: 192,
      height: 344,
      kind: 'admin',
    },
  ];

  const ragNodes: DiagramNode[] = [
    {
      id: 'source_docs',
      title: isVi ? 'Office / PDF / OCR' : 'Office / PDF / OCR',
      sub: 'zlib · <=2MB · CMap',
      icon: 'file-text',
      x: 28,
      y: 64,
      width: 176,
      height: 64,
      zoneId: 'para-ingest',
      inspector: isVi
        ? {
            role: 'Bộ trích xuất tài liệu thuần Node.js zlib và ZIP',
            packageOrPort: '@latticedx/plugin-dxos-para · document-extractor.js',
            protocol: 'In-process · Zero External Binary',
            payloadOrSchema: 'PDF (ToUnicode CMap, /ObjStm), DOCX, XLSX, PPTX, PNG/JPEG/WebP, CSV/MD',
            responsibilities:
              'Giải nén và phân tích nội dung trực tiếp trong bộ nhớ với giới hạn an toàn MAX_UPLOAD_BYTES=2MB, MAX_INFLATED_BYTES=10MB và tối đa 5000 trang PDF.',
          }
        : {
            role: 'Pure Node.js zlib + ZIP document text extractor',
            packageOrPort: '@latticedx/plugin-dxos-para · document-extractor.js',
            protocol: 'In-process · Zero External Binary',
            payloadOrSchema: 'PDF (ToUnicode CMap, /ObjStm), DOCX, XLSX, PPTX, PNG/JPEG/WebP, CSV/MD',
            responsibilities:
              'Extracts text without external binaries while enforcing MAX_UPLOAD_BYTES=2MB, MAX_INFLATED_BYTES=10MB, MAX_ZIP_ENTRIES=10000, and MAX_PDF_PAGE_COUNT=5000.',
          },
    },
    {
      id: 'para_chunker',
      title: isVi ? 'Phân đoạn P.A.R.A.' : 'P.A.R.A. Chunker',
      sub: 'latticeParaChunks',
      icon: 'layers',
      x: 232,
      y: 64,
      width: 176,
      height: 64,
      zoneId: 'para-ingest',
      focal: true,
      inspector: isVi
        ? {
            role: 'Chuẩn hóa không gian P.A.R.A. và cắt đoạn có tiêu đề mục',
            packageOrPort: 'schema.js · latticeParaDocuments / Chunks',
            protocol: 'PG16 Transaction · FORCE RLS',
            payloadOrSchema: 'PARA_SPACES: projects | areas | resources | archives',
            responsibilities:
              'Lưu tài liệu duy nhất theo (organizationId, code) và tách thành các chunk gắn chunkIndex, sectionTitle, pageNumber và tokenCount.',
          }
        : {
            role: 'P.A.R.A. vault organizer and structural chunker',
            packageOrPort: 'schema.js · latticeParaDocuments / Chunks',
            protocol: 'PG16 Transaction · FORCE RLS',
            payloadOrSchema: 'PARA_SPACES: projects | areas | resources | archives',
            responsibilities:
              'Stores unique (organizationId, code) documents and splits content into chunks with chunkIndex, sectionTitle, pageNumber, and tokenCount.',
          },
    },
    {
      id: 'tsv_index',
      title: isVi ? 'Full-Text tsvector' : 'Full-Text tsvector',
      sub: 'GIN · VN-fold · BM25',
      icon: 'terminal',
      x: 460,
      y: 56,
      width: 184,
      height: 64,
      zoneId: 'para-indexes',
      inspector: isVi
        ? {
            role: 'Chỉ mục từ khóa GIN tsvector hỗ trợ gập dấu tiếng Việt',
            packageOrPort: 'PG16 · idx_lattice_para_chunks_tsv',
            protocol: 'Trigger trg_lattice_para_chunks_tsv',
            payloadOrSchema: "ts_rank_cd(searchVector, plainto_tsquery('simple', ...)) + lexicalOverlapScore",
            responsibilities:
              'Tự động gập dấu tiếng Việt (VN_ACCENTED -> VN_FOLDED) qua trigger PostgreSQL và tính điểm từ vựng kết hợp lọc từ dừng STOP_WORDS.',
          }
        : {
            role: 'GIN tsvector index with Vietnamese diacritic folding',
            packageOrPort: 'PG16 · idx_lattice_para_chunks_tsv',
            protocol: 'Trigger trg_lattice_para_chunks_tsv',
            payloadOrSchema: "ts_rank_cd(searchVector, plainto_tsquery('simple', ...)) + lexicalOverlapScore",
            responsibilities:
              'Maintains folded Vietnamese and exact keyword tokens via trigger using simple dictionary, scored by ts_rank_cd and JS lexicalOverlapScore.',
          },
    },
    {
      id: 'pgvector_index',
      title: isVi ? 'Vector pgvector' : 'pgvector Embedding',
      sub: 'HNSW 1536d | FNV 256d',
      icon: 'database',
      x: 460,
      y: 184,
      width: 184,
      height: 64,
      zoneId: 'para-indexes',
      inspector: isVi
        ? {
            role: 'Lưu trữ vector linh hoạt và tính khoảng cách cosine <=>',
            packageOrPort: 'pgvector 0.8.1 · idx_lattice_para_chunks_emb_hnsw',
            protocol: 'HTTPS Neural (4.5s) | FNV-1a Fallback',
            payloadOrSchema: 'embedding vector (8..8192 dims) · 1 - (embedding <=> vec)',
            responsibilities:
              'Hỗ trợ neural embedding (mặc định text-embedding-3-small 1536 chiều) kèm bộ dự phòng tất định FNV-1a unigram+trigram 256 chiều khi ngoại tuyến.',
          }
        : {
            role: 'Flexible pgvector cosine index with offline FNV-1a fallback',
            packageOrPort: 'pgvector 0.8.1 · idx_lattice_para_chunks_emb_hnsw',
            protocol: 'HTTPS Neural (4.5s) | FNV-1a Fallback',
            payloadOrSchema: 'embedding vector (8..8192 dims) · 1 - (embedding <=> vec)',
            responsibilities:
              'Migrated from fixed HNSW vector(1536) to flexible vector (8..8192 dims) with 4500ms neural timeout and deterministic 256-dim FNV-1a fallback.',
          },
    },
    {
      id: 'query_input',
      title: isVi ? 'Truy vấn & RLS' : 'Query & RBAC',
      sub: 'app.current_org · space',
      icon: 'globe',
      x: 28,
      y: 244,
      width: 176,
      height: 64,
      zoneId: 'para-query',
      inspector: isVi
        ? {
            role: 'Điểm vào tìm kiếm tri thức từ AI hoặc block P.A.R.A.',
            packageOrPort: 'para-resource.js · DxosParaVaultBlockModel',
            protocol: 'HTTPS · Bearer + Tenant RLS',
            payloadOrSchema: 'paraSpace filter + app.current_org isolation',
            responsibilities:
              'Gắn ngữ cảnh tổ chức app.current_org và phạm vi không gian P.A.R.A. trước khi chạy truy vấn song song lên PostgreSQL.',
          }
        : {
            role: 'RBAC-scoped query entry from AI tools or P.A.R.A. block',
            packageOrPort: 'para-resource.js · DxosParaVaultBlockModel',
            protocol: 'HTTPS · Bearer + Tenant RLS',
            payloadOrSchema: 'paraSpace filter + app.current_org isolation',
            responsibilities:
              'Binds transaction-local app.current_org and optional P.A.R.A. space filters before running hybrid candidate retrieval.',
          },
    },
    {
      id: 'dual_retrieval',
      title: isVi ? 'Lọc Ngưỡng Kép' : 'Dual Candidate Gate',
      sub: 'lex > 0 | sem >= 0.18',
      icon: 'git-branch',
      x: 232,
      y: 244,
      width: 176,
      height: 64,
      zoneId: 'para-query',
      inspector: isVi
        ? {
            role: 'Bộ lọc ứng viên theo độ khớp từ khóa và ngữ nghĩa neural',
            packageOrPort: 'para-hybrid-search.js · scoreRrfEntries',
            protocol: 'Dual-Branch Retrieval',
            payloadOrSchema: 'e.lex > 0 || (e.embeddingEngine === "neural" && e.sem >= 0.18)',
            responsibilities:
              'Loại bỏ nhiễu vector không đạt ngưỡng tối thiểu sem >= 0.18 khi không có điểm khớp từ vựng, giữ kết quả gọn và chính xác.',
          }
        : {
            role: 'Candidate filter balancing lexical and neural thresholds',
            packageOrPort: 'para-hybrid-search.js · scoreRrfEntries',
            protocol: 'Dual-Branch Retrieval',
            payloadOrSchema: 'e.lex > 0 || (e.embeddingEngine === "neural" && e.sem >= 0.18)',
            responsibilities:
              'Filters out low-confidence vector hits below 0.18 unless backed by positive lexical overlap before rank assignment.',
          },
    },
    {
      id: 'rrf_fusion',
      title: isVi ? 'Hợp nhất RRF' : 'RRF Fusion',
      sub: 'k = 60 · rLex & rSem',
      icon: 'cpu',
      x: 680,
      y: 104,
      width: 176,
      height: 64,
      zoneId: 'para-fusion',
      focal: true,
      inspector: isVi
        ? {
            role: 'Công thức Reciprocal Rank Fusion chuẩn hóa thứ hạng kép',
            packageOrPort: 'para-hybrid-search.js:385-430',
            protocol: 'Deterministic Ranking (k = 60)',
            payloadOrSchema: 'rrf = (lex>0 ? 1/(60+rLex) : 0) + 1/(60+rSem)',
            responsibilities:
              'Tính điểm tổng hợp rrf * 100 + lex * 0.25 + max(0, sem) * 2 làm tròn 4 chữ số thập phân; nếu lex=0 thì gán rLex = filtered.length + 50.',
          }
        : {
            role: 'Reciprocal Rank Fusion scorer (k = 60)',
            packageOrPort: 'para-hybrid-search.js:385-430',
            protocol: 'Deterministic Ranking (k = 60)',
            payloadOrSchema: 'rrf = (lex>0 ? 1/(60+rLex) : 0) + 1/(60+rSem)',
            responsibilities:
              'Computes score = round4(rrf * 100 + lex * 0.25 + max(0, sem) * 2), assigning fallback rank filtered.length + 50 when lexical score is zero.',
          },
    },
    {
      id: 'grounded_answer',
      title: isVi ? 'Trả lời Có Căn cứ' : 'Grounded Answer',
      sub: 'dxos_search_context',
      icon: 'bot',
      x: 680,
      y: 244,
      width: 176,
      height: 64,
      zoneId: 'para-fusion',
      focal: true,
      inspector: isVi
        ? {
            role: 'Tổng hợp đoạn trích dẫn kèm nguồn tài liệu cho Agent & UI',
            packageOrPort: 'ai-operational-tools.js · dxos_search_enterprise_context',
            protocol: 'JSON Citations · RBAC Filtered',
            payloadOrSchema: 'documentId, code, sectionTitle, pageNumber, score',
            responsibilities:
              'Trả về các đoạn chunk xếp hạng cao nhất kèm mã tài liệu, mục và số trang để Agent sinh câu trả lời bám sát dữ liệu thật.',
          }
        : {
            role: 'Delivers ranked chunks with document citations to AI & UI',
            packageOrPort: 'ai-operational-tools.js · dxos_search_enterprise_context',
            protocol: 'JSON Citations · RBAC Filtered',
            payloadOrSchema: 'documentId, code, sectionTitle, pageNumber, score',
            responsibilities:
              'Returns top-ranked chunks with document code, sectionTitle, pageNumber, and RRF score so agents ground responses in verified tenant records.',
          },
    },
  ];

  const ragEdges: DiagramEdge[] = [
    { id: 'h1', from: 'source_docs', to: 'para_chunker', label: 'Chunks', kind: 'primary' },
    { id: 'h2', from: 'para_chunker', to: 'tsv_index', label: 'tsvector', kind: 'flow' },
    {
      id: 'h3',
      from: 'para_chunker',
      to: 'pgvector_index',
      label: 'Embed',
      kind: 'flow',
      points: [
        [408, 108],
        [428, 108],
        [428, 204],
        [460, 204],
      ],
    },
    { id: 'h4', from: 'query_input', to: 'dual_retrieval', label: 'Query', kind: 'primary' },
    {
      id: 'h5',
      from: 'dual_retrieval',
      to: 'tsv_index',
      label: 'Lexical',
      kind: 'primary',
      points: [
        [408, 264],
        [440, 264],
        [440, 104],
        [460, 104],
      ],
    },
    {
      id: 'h6',
      from: 'dual_retrieval',
      to: 'pgvector_index',
      label: 'Cosine <=>',
      kind: 'primary',
      points: [
        [408, 284],
        [432, 284],
        [432, 224],
        [460, 224],
      ],
    },
    {
      id: 'h7',
      from: 'tsv_index',
      to: 'rrf_fusion',
      label: 'rLex',
      kind: 'flow',
      points: [
        [644, 88],
        [660, 88],
        [660, 128],
        [680, 128],
      ],
    },
    {
      id: 'h8',
      from: 'pgvector_index',
      to: 'rrf_fusion',
      label: 'rSem',
      kind: 'flow',
      points: [
        [644, 216],
        [664, 216],
        [664, 148],
        [680, 148],
      ],
    },
    { id: 'h9', from: 'rrf_fusion', to: 'grounded_answer', label: 'Top-K', kind: 'primary' },
  ];

  const ragSteps: DiagramStep[] = [
    {
      id: 'rag-s1',
      title: isVi ? 'Trích xuất & cắt đoạn P.A.R.A.' : 'Extract & P.A.R.A. Chunk',
      activeNodes: ['source_docs', 'para_chunker'],
      activeEdges: ['h1'],
      description: isVi
        ? 'Bộ trích xuất thuần zlib phân tích PDF/Office trong giới hạn 2MB/10MB, rồi ghi tài liệu và các đoạn chunk vào không gian P.A.R.A.'
        : 'Pure-zlib extractors parse PDF/Office uploads within 2MB/10MB bounds and persist structured chunks into P.A.R.A. spaces.',
      route: 'POST /api/latticeParaDocuments:create',
      payload: 'PARA_SPACES: projects | areas | resources | archives',
      chips: ['Zero Binary', 'FORCE RLS'],
    },
    {
      id: 'rag-s2',
      title: isVi ? 'Đánh chỉ mục GIN & pgvector' : 'Dual GIN & pgvector Index',
      activeNodes: ['para_chunker', 'tsv_index', 'pgvector_index'],
      activeEdges: ['h2', 'h3'],
      description: isVi
        ? 'Trigger PostgreSQL cập nhật searchVector gập dấu tiếng Việt cho GIN, đồng thời lưu embedding neural (1536d) hoặc FNV-1a (256d).'
        : 'PostgreSQL triggers populate Vietnamese-folded GIN tsvector while embeddings store neural vectors (1536d) or 256d FNV-1a fallbacks.',
      route: 'trg_lattice_para_chunks_tsv',
      payload: 'GIN tsvector + vector cosine <=>',
      chips: ['VN-Fold', 'pgvector 0.8.1'],
    },
    {
      id: 'rag-s3',
      title: isVi ? 'Truy vấn song song & lọc ngưỡng' : 'Dual Retrieval & Gate',
      activeNodes: ['query_input', 'dual_retrieval', 'tsv_index', 'pgvector_index'],
      activeEdges: ['h4', 'h5', 'h6'],
      description: isVi
        ? 'Truy vấn mang ngữ cảnh app.current_org đồng thời chấm điểm ts_rank_cd và khoảng cách cosine, chỉ giữ ứng viên đạt lex > 0 hoặc sem >= 0.18.'
        : 'Tenant-scoped queries evaluate ts_rank_cd and cosine similarity in parallel, filtering candidates to lex > 0 or neural sem >= 0.18.',
      route: 'POST /api/latticePara:hybridSearch',
      payload: 'e.lex > 0 || (neural && e.sem >= 0.18)',
      chips: ['app.current_org', 'Dual Branch'],
    },
    {
      id: 'rag-s4',
      title: isVi ? 'Hợp nhất RRF (k=60) & trích dẫn' : 'RRF Fusion (k=60) & Answer',
      activeNodes: ['tsv_index', 'pgvector_index', 'rrf_fusion', 'grounded_answer'],
      activeEdges: ['h7', 'h8', 'h9'],
      description: isVi
        ? 'RRF gộp hạng từ vựng rLex và hạng ngữ nghĩa rSem với hằng số k=60 rồi trả về Top-K đoạn trích dẫn cho Agent tổng hợp câu trả lời.'
        : 'RRF merges lexical rank rLex and semantic rank rSem with k=60, returning Top-K cited chunks to dxos_search_enterprise_context.',
      route: 'dxos_search_enterprise_context',
      payload: 'score = round4(rrf*100 + lex*0.25 + max(0,sem)*2)',
      chips: ['k = 60', 'Grounded'],
    },
  ];

  // Mode 2: OCR-to-Record Pipeline
  const ocrZones: DiagramZone[] = [
    {
      id: 'ocr-extract',
      label: isVi ? 'Giải mã Tệp & Cổng OCR Có Kiểm soát SSRF' : 'File Parser & SSRF-Validated OCR',
      x: 16,
      y: 16,
      width: 408,
      height: 344,
      kind: 'admin',
    },
    {
      id: 'ocr-map',
      label: isVi ? 'Dự phòng & Ánh xạ Bản ghi Nghiệp vụ' : 'Fallback & Target Collection Mapping',
      x: 444,
      y: 16,
      width: 420,
      height: 344,
      kind: 'traffic',
    },
  ];

  const ocrNodes: DiagramNode[] = [
    {
      id: 'upload_doc',
      title: isVi ? 'Tệp Đầu vào' : 'Upload Document',
      sub: 'PDF | DOCX | IMG <= 2MB',
      icon: 'file-text',
      x: 28,
      y: 72,
      width: 176,
      height: 64,
      zoneId: 'ocr-extract',
      inspector: isVi
        ? {
            role: 'Tiếp nhận chứng từ PDF, Office hoặc ảnh chụp biểu mẫu',
            packageOrPort: 'para-resource.js · dxosPara:extractFormFields',
            protocol: 'HTTPS POST · Bearer + RLS',
            payloadOrSchema: 'PDF, DOCX, XLSX, PPTX, PNG, JPEG, WebP (<= 2MB)',
            responsibilities:
              'Kiểm tra kích thước tệp tối đa 2MB và định tuyến vào pipeline tách văn bản hoặc OCR đa phương thức.',
          }
        : {
            role: 'Document and form image upload entrypoint',
            packageOrPort: 'para-resource.js · dxosPara:extractFormFields',
            protocol: 'HTTPS POST · Bearer + RLS',
            payloadOrSchema: 'PDF, DOCX, XLSX, PPTX, PNG, JPEG, WebP (<= 2MB)',
            responsibilities:
              'Validates the 2MB upload ceiling and routes payloads into pure-Node extraction or multimodal OCR.',
          },
    },
    {
      id: 'zip_pdf_parser',
      title: isVi ? 'Bộ tách zlib/PDF' : 'Extractor Guard',
      sub: 'MAX_INFLATED 10MB',
      icon: 'box',
      x: 232,
      y: 72,
      width: 176,
      height: 64,
      zoneId: 'ocr-extract',
      inspector: isVi
        ? {
            role: 'Phân giải cấu trúc ZIP/PDF và phát hiện PDF dạng ảnh scan',
            packageOrPort: 'document-extractor.js · extractPdfText',
            protocol: 'In-process · Zip-Bomb Guard',
            payloadOrSchema: 'MAX_ZIP_ENTRIES=10000 · MAX_CMAP_ENTRIES=65536',
            responsibilities:
              'Giải mã ToUnicode CMap, /ObjStm và nhận diện tài liệu scan chỉ chứa ảnh để chuyển sang bước OCR.',
          }
        : {
            role: 'Zip-bomb-safe Office/PDF parser and scan detector',
            packageOrPort: 'document-extractor.js · extractPdfText',
            protocol: 'In-process · Zip-Bomb Guard',
            payloadOrSchema: 'MAX_ZIP_ENTRIES=10000 · MAX_CMAP_ENTRIES=65536',
            responsibilities:
              'Decodes PDF ToUnicode CMaps and /ObjStm streams, flagging image-only scans for multimodal OCR.',
          },
    },
    {
      id: 'ocr_endpoint',
      title: isVi ? 'OCR Đa phương thức' : 'Multimodal OCR',
      sub: 'DX_OCR_ENDPOINT · 5s',
      icon: 'globe',
      x: 232,
      y: 228,
      width: 176,
      height: 64,
      zoneId: 'ocr-extract',
      focal: true,
      inspector: isVi
        ? {
            role: 'Gọi dịch vụ OCR ngoài với kiểm tra SSRF nghiêm ngặt',
            packageOrPort: 'para-resource.js · extractWithMultimodalOcr',
            protocol: 'HTTPS · redirect: error · 5000ms',
            payloadOrSchema: 'validateOcrEndpoint + TRUSTED_OCR_HTTP_HOSTS',
            responsibilities:
              'Xác thực URL đích qua validateOcrEndpoint để chặn SSRF, tắt chuyển hướng (redirect: error) và giới hạn thời gian chờ 5000ms.',
          }
        : {
            role: 'SSRF-checked external multimodal OCR connector',
            packageOrPort: 'para-resource.js · extractWithMultimodalOcr',
            protocol: 'HTTPS · redirect: error · 5000ms',
            payloadOrSchema: 'validateOcrEndpoint + TRUSTED_OCR_HTTP_HOSTS',
            responsibilities:
              'Validates DX_OCR_ENDPOINT via validateOcrEndpoint, disables HTTP redirects (redirect: error), and enforces OCR_TIMEOUT_MS=5000ms.',
          },
    },
    {
      id: 'offline_fallback',
      title: isVi ? 'Dự phòng Ngoại tuyến' : 'Offline Fallback',
      sub: 'offline-deterministic',
      icon: 'cpu',
      x: 460,
      y: 228,
      width: 184,
      height: 64,
      zoneId: 'ocr-map',
      inspector: isVi
        ? {
            role: 'Bộ trích xuất dự phòng tất định khi chưa cấu hình OCR',
            packageOrPort: 'para-resource.js · offline-deterministic-fallback',
            protocol: 'Deterministic UTF-8 + Metadata',
            payloadOrSchema: 'UTF-8 text & metadata field heuristics',
            responsibilities:
              'Tự động kích hoạt khi DX_OCR_ENDPOINT vắng mặt hoặc quá hạn, trích xuất khóa/giá trị từ metadata và chuỗi UTF-8.',
          }
        : {
            role: 'Deterministic offline metadata and UTF-8 extractor',
            packageOrPort: 'para-resource.js · offline-deterministic-fallback',
            protocol: 'Deterministic UTF-8 + Metadata',
            payloadOrSchema: 'UTF-8 text & metadata field heuristics',
            responsibilities:
              'Activates automatically if DX_OCR_ENDPOINT is unset or unreachable, extracting structured key-value pairs from metadata and UTF-8 text.',
          },
    },
    {
      id: 'schema_mapper',
      title: isVi ? 'Ánh xạ Trường' : 'Field Mapper',
      sub: 'extractStructuredFields',
      icon: 'workflow',
      x: 460,
      y: 72,
      width: 184,
      height: 64,
      zoneId: 'ocr-map',
      focal: true,
      inspector: isVi
        ? {
            role: 'Chuẩn hóa đầu ra OCR thành JSON khớp schema bảng đích',
            packageOrPort: 'para-resource.js · extractStructuredFormFields',
            protocol: 'Allowlist Schema Validation',
            payloadOrSchema: 'ALLOWED_FORM_COLLECTIONS whitelist',
            responsibilities:
              'Làm sạch kiểu dữ liệu, lọc bỏ trường nhạy cảm và ánh xạ vào cấu trúc trường hợp lệ của bảng nghiệp vụ.',
          }
        : {
            role: 'Normalizes extracted text into collection field payloads',
            packageOrPort: 'para-resource.js · extractStructuredFormFields',
            protocol: 'Allowlist Schema Validation',
            payloadOrSchema: 'ALLOWED_FORM_COLLECTIONS whitelist',
            responsibilities:
              'Coerces field types and restricts target schemas strictly to ALLOWED_FORM_COLLECTIONS.',
          },
    },
    {
      id: 'target_records',
      title: isVi ? 'Bảng Nghiệp vụ' : 'Target Collections',
      sub: 'Orders|Requests|Lots',
      icon: 'database',
      x: 672,
      y: 72,
      width: 176,
      height: 64,
      zoneId: 'ocr-map',
      inspector: isVi
        ? {
            role: '4 bảng đích được phép tạo bản ghi tự động từ OCR',
            packageOrPort: 'PG16 · ALLOWED_FORM_COLLECTIONS',
            protocol: 'Tenant RLS · app.current_org',
            payloadOrSchema: 'latticeOrders, latticeRequests, latticeStockLots, latticeServiceTickets',
            responsibilities:
              'Tiếp nhận dữ liệu biểu mẫu đã chuẩn hóa vào đơn hàng, yêu cầu, lô hàng hoặc phiếu dịch vụ trong vùng cô lập tenant.',
          }
        : {
            role: 'Allowlisted operational collections populated by OCR',
            packageOrPort: 'PG16 · ALLOWED_FORM_COLLECTIONS',
            protocol: 'Tenant RLS · app.current_org',
            payloadOrSchema: 'latticeOrders, latticeRequests, latticeStockLots, latticeServiceTickets',
            responsibilities:
              'Accepts validated structured payloads into orders, requests, stock lots, or service tickets inside the tenant RLS boundary.',
          },
    },
  ];

  const ocrEdges: DiagramEdge[] = [
    { id: 'o1', from: 'upload_doc', to: 'zip_pdf_parser', label: 'Parse', kind: 'primary' },
    { id: 'o2', from: 'zip_pdf_parser', to: 'ocr_endpoint', label: 'Scan', kind: 'primary' },
    {
      id: 'o3',
      from: 'ocr_endpoint',
      to: 'schema_mapper',
      label: 'JSON',
      kind: 'primary',
      points: [
        [408, 244],
        [436, 244],
        [436, 104],
        [460, 104],
      ],
    },
    { id: 'o4', from: 'ocr_endpoint', to: 'offline_fallback', label: 'Fallback', kind: 'dashed' },
    { id: 'o5', from: 'offline_fallback', to: 'schema_mapper', label: 'UTF-8', kind: 'dashed' },
    { id: 'o6', from: 'schema_mapper', to: 'target_records', label: 'Record', kind: 'flow' },
  ];

  const ocrSteps: DiagramStep[] = [
    {
      id: 'ocr-s1',
      title: isVi ? 'Kiểm tra & tách tệp đầu vào' : 'Upload & Zip-Bomb Guard',
      activeNodes: ['upload_doc', 'zip_pdf_parser'],
      activeEdges: ['o1'],
      description: isVi
        ? 'Tệp tải lên (<=2MB) được kiểm tra bằng bộ tách zlib/PDF, giải mã CMap hoặc phát hiện bản scan để chuyển sang OCR.'
        : 'Uploads (<=2MB) pass zlib/PDF decompression limits; image-only scans route to multimodal OCR.',
      route: 'POST /api/dxosPara:extractFormFields',
      payload: 'MAX_UPLOAD_BYTES=2MB | MAX_INFLATED_BYTES=10MB',
      chips: ['CMap Decoder', 'Zip Guard'],
    },
    {
      id: 'ocr-s2',
      title: isVi ? 'OCR có kiểm soát SSRF & dự phòng' : 'SSRF OCR & Offline Fallback',
      activeNodes: ['zip_pdf_parser', 'ocr_endpoint', 'offline_fallback'],
      activeEdges: ['o2', 'o4'],
      description: isVi
        ? 'DX_OCR_ENDPOINT được kiểm tra qua validateOcrEndpoint (timeout 5s, cấm redirect); nếu ngoại tuyến sẽ chuyển sang offline-deterministic-fallback.'
        : 'DX_OCR_ENDPOINT runs with SSRF checks and 5s timeout; unavailability triggers offline-deterministic-fallback.',
      route: 'validateOcrEndpoint(DX_OCR_ENDPOINT)',
      payload: 'OCR_TIMEOUT_MS = 5000 | redirect: error',
      chips: ['SSRF Safe', 'Deterministic Fallback'],
    },
    {
      id: 'ocr-s3',
      title: isVi ? 'Ánh xạ vào 4 bảng cho phép' : 'Map to Allowlisted Collections',
      activeNodes: ['schema_mapper', 'target_records'],
      activeEdges: ['o3', 'o5', 'o6'],
      description: isVi
        ? 'extractStructuredFormFields chuẩn hóa trường dữ liệu và chỉ ghi vào 4 bảng được cấp phép: latticeOrders, latticeRequests, latticeStockLots, latticeServiceTickets.'
        : 'extractStructuredFormFields maps validated payloads strictly into latticeOrders, latticeRequests, latticeStockLots, or latticeServiceTickets.',
      route: 'extractStructuredFormFields()',
      payload: 'ALLOWED_FORM_COLLECTIONS (4 targets)',
      chips: ['4 Collections', 'Tenant RLS'],
    },
  ];

  return [
    {
      id: 'hybrid-rag',
      label: isVi ? 'Tìm kiếm Lai RRF' : 'Hybrid RRF Search',
      summary: isVi ? 'pgvector + GIN tsvector · RRF k = 60' : 'pgvector + GIN tsvector · RRF k = 60',
      zones: ragZones,
      nodes: ragNodes,
      edges: ragEdges,
      steps: ragSteps,
    },
    {
      id: 'ocr-to-record',
      label: isVi ? 'OCR-to-Record' : 'OCR-to-Record',
      summary: isVi ? 'Office/PDF/OCR -> 4 bảng đích' : 'Office/PDF/OCR -> 4 target tables',
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
    viewBox="0 0 880 376"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
