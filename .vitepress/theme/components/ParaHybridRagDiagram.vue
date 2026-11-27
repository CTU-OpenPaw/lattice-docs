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
          'Truy vấn chấm điểm song song GIN tsvector + pgvector Cosine trước khi lọc tại Candidate Gate (lex > 0 || sem >= 0.18) và hợp nhất RRF (k = 60); OCR-to-Record tách nhánh văn bản số đi thẳng Field Mapper và ảnh scan qua Multimodal OCR.',
      }
    : {
        title: 'P.A.R.A. Knowledge Vault & RRF Hybrid RAG (k = 60)',
        caption:
          'Queries score GIN tsvector and pgvector Cosine first, filter at Candidate Gate (lex > 0 || sem >= 0.18), and fuse via RRF (k = 60); OCR-to-Record routes digital PDF/Office directly to Field Mapper while image scans pass through Multimodal OCR.',
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
      width: 444,
      height: 160,
      kind: 'admin',
    },
    {
      id: 'para-query',
      label: isVi ? 'Truy vấn Theo Ngữ cảnh RLS' : 'RBAC & Tenant RLS Query',
      x: 16,
      y: 196,
      width: 444,
      height: 184,
      kind: 'traffic',
    },
    {
      id: 'para-indexes',
      label: isVi ? 'Chấm điểm Chỉ mục Kép (PG16)' : 'Dual Index Scoring (PG16)',
      x: 520,
      y: 16,
      width: 212,
      height: 364,
      kind: 'traffic',
    },
    {
      id: 'para-fusion',
      label: isVi ? 'Candidate Gate -> RRF k=60 -> Trả lời' : 'Candidate Gate -> RRF k=60 -> Output',
      x: 780,
      y: 16,
      width: 372,
      height: 364,
      kind: 'admin',
    },
  ];

  const ragNodes: DiagramNode[] = [
    {
      id: 'source_docs',
      title: 'Office / PDF / OCR',
      sub: 'zlib · <=2MB · CMap',
      icon: 'file-text',
      x: 24,
      y: 64,
      width: 172,
      height: 64,
      zoneId: 'para-ingest',
      inspector: isVi
        ? {
            role: 'Bộ trích xuất tài liệu thuần Node.js zlib và ZIP',
            packageOrPort: '@latticedx/plugin-dxos-para · document-extractor.js',
            protocol: 'In-process · Zero External Binary',
            payloadOrSchema: 'PDF (ToUnicode CMap, /ObjStm), DOCX, XLSX, PPTX, PNG/JPEG/WebP',
            responsibilities:
              'Giải nén và phân tích nội dung trực tiếp trong bộ nhớ với giới hạn an toàn MAX_UPLOAD_BYTES=2MB, MAX_INFLATED_BYTES=10MB và tối đa 5000 trang PDF.',
          }
        : {
            role: 'Pure Node.js zlib + ZIP document text extractor',
            packageOrPort: '@latticedx/plugin-dxos-para · document-extractor.js',
            protocol: 'In-process · Zero External Binary',
            payloadOrSchema: 'PDF (ToUnicode CMap, /ObjStm), DOCX, XLSX, PPTX, PNG/JPEG/WebP',
            responsibilities:
              'Extracts text without external binaries while enforcing MAX_UPLOAD_BYTES=2MB, MAX_INFLATED_BYTES=10MB, and MAX_PDF_PAGE_COUNT=5000.',
          },
    },
    {
      id: 'para_chunker',
      title: isVi ? 'Phân đoạn P.A.R.A.' : 'P.A.R.A. Chunker',
      sub: 'latticeParaChunks',
      icon: 'layers',
      x: 264,
      y: 64,
      width: 184,
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
      id: 'query_input',
      title: isVi ? 'Truy vấn & RLS' : 'Query & RLS',
      sub: 'app.current_org',
      icon: 'globe',
      x: 112,
      y: 256,
      width: 212,
      height: 64,
      zoneId: 'para-query',
      focal: true,
      inspector: isVi
        ? {
            role: 'Điểm vào tìm kiếm tri thức gắn app.current_org',
            packageOrPort: 'para-resource.js · DxosParaVaultBlockModel',
            protocol: 'HTTPS · Bearer + Tenant RLS',
            payloadOrSchema: 'paraSpace filter + app.current_org isolation',
            responsibilities:
              'Gắn ngữ cảnh tổ chức app.current_org và chạy truy vấn chấm điểm song song lên GIN tsvector và pgvector Cosine trước khi lọc ngưỡng.',
          }
        : {
            role: 'RBAC-scoped query entry binding app.current_org',
            packageOrPort: 'para-resource.js · DxosParaVaultBlockModel',
            protocol: 'HTTPS · Bearer + Tenant RLS',
            payloadOrSchema: 'paraSpace filter + app.current_org isolation',
            responsibilities:
              'Binds transaction-local app.current_org and executes dual scoring against GIN tsvector and pgvector Cosine before candidate filtering.',
          },
    },
    {
      id: 'tsv_index',
      title: 'GIN tsvector',
      sub: 'ts_rank_cd · VN-fold',
      icon: 'terminal',
      x: 536,
      y: 64,
      width: 180,
      height: 64,
      zoneId: 'para-indexes',
      inspector: isVi
        ? {
            role: 'Chấm điểm từ khóa GIN tsvector hỗ trợ gập dấu tiếng Việt',
            packageOrPort: 'PG16 · idx_lattice_para_chunks_tsv',
            protocol: 'Trigger trg_lattice_para_chunks_tsv',
            payloadOrSchema: "ts_rank_cd(searchVector, plainto_tsquery('simple', ...)) + lexicalOverlapScore",
            responsibilities:
              'Tự động gập dấu tiếng Việt qua trigger PostgreSQL và tính điểm từ vựng lex cho từng đoạn văn bản ứng viên.',
          }
        : {
            role: 'GIN tsvector lexical scorer with Vietnamese folding',
            packageOrPort: 'PG16 · idx_lattice_para_chunks_tsv',
            protocol: 'Trigger trg_lattice_para_chunks_tsv',
            payloadOrSchema: "ts_rank_cd(searchVector, plainto_tsquery('simple', ...)) + lexicalOverlapScore",
            responsibilities:
              'Scores folded Vietnamese and exact keyword matches via ts_rank_cd and JS lexicalOverlapScore prior to Candidate Gate.',
          },
    },
    {
      id: 'pgvector_index',
      title: 'pgvector Cosine',
      sub: 'HNSW 1536d | FNV 256d',
      icon: 'database',
      x: 536,
      y: 256,
      width: 180,
      height: 64,
      zoneId: 'para-indexes',
      inspector: isVi
        ? {
            role: 'Chấm điểm khoảng cách cosine <=> trên pgvector',
            packageOrPort: 'pgvector 0.8.1 · idx_lattice_para_chunks_emb_hnsw',
            protocol: 'HTTPS Neural (4.5s) | FNV-1a Fallback',
            payloadOrSchema: 'embedding vector (8..8192 dims) · 1 - (embedding <=> vec)',
            responsibilities:
              'Tính điểm tương đồng ngữ nghĩa sem (neural 1536d hoặc dự phòng FNV-1a 256d) trước khi chuyển vào Candidate Gate.',
          }
        : {
            role: 'pgvector cosine similarity scorer with FNV-1a fallback',
            packageOrPort: 'pgvector 0.8.1 · idx_lattice_para_chunks_emb_hnsw',
            protocol: 'HTTPS Neural (4.5s) | FNV-1a Fallback',
            payloadOrSchema: 'embedding vector (8..8192 dims) · 1 - (embedding <=> vec)',
            responsibilities:
              'Computes semantic similarity sem (1536d neural or deterministic 256d FNV-1a fallback) before Candidate Gate filtering.',
          },
    },
    {
      id: 'dual_retrieval',
      title: isVi ? 'Lọc Ngưỡng Kép' : 'Candidate Gate',
      sub: 'lex>0 || sem>=0.18',
      icon: 'git-branch',
      x: 788,
      y: 160,
      width: 164,
      height: 64,
      zoneId: 'para-fusion',
      focal: true,
      inspector: isVi
        ? {
            role: 'Bộ lọc ứng viên sau bước chấm điểm song song (trước RRF)',
            packageOrPort: 'para-hybrid-search.js:419-430 · scoreRrfEntries',
            protocol: 'Post-Scoring Candidate Filter',
            payloadOrSchema: 'e.lex > 0 || (e.embeddingEngine === "neural" && e.sem >= 0.18)',
            responsibilities:
              'Chạy SAU khi GIN tsvector và pgvector đã chấm điểm; loại bỏ nhiễu neural sem < 0.18 nếu không có từ khóa khớp trước khi xếp hạng RRF.',
          }
        : {
            role: 'Post-scoring candidate filter before RRF fusion',
            packageOrPort: 'para-hybrid-search.js:419-430 · scoreRrfEntries',
            protocol: 'Post-Scoring Candidate Filter',
            payloadOrSchema: 'e.lex > 0 || (e.embeddingEngine === "neural" && e.sem >= 0.18)',
            responsibilities:
              'Applies after GIN tsvector and pgvector scoring to discard low-confidence neural hits (< 0.18) lacking lexical overlap before RRF ranking.',
          },
    },
    {
      id: 'rrf_fusion',
      title: isVi ? 'Hợp nhất RRF' : 'RRF Fusion',
      sub: 'k = 60 · rLex & rSem',
      icon: 'cpu',
      x: 964,
      y: 64,
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
              'Computes score = round4(rrf * 100 + lex * 0.25 + max(0, sem) * 2), assigning fallback rank filtered.length + 50 when lex === 0.',
          },
    },
    {
      id: 'grounded_answer',
      title: isVi ? 'Trả lời Trích dẫn' : 'Grounded Citations',
      sub: 'dxos_search_context',
      icon: 'bot',
      x: 964,
      y: 256,
      width: 176,
      height: 64,
      zoneId: 'para-fusion',
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
    {
      id: 'h1',
      from: 'source_docs',
      to: 'para_chunker',
      label: 'Chunks',
      kind: 'flow',
      points: [
        [196, 96],
        [264, 96],
      ],
    },
    {
      id: 'h2',
      from: 'para_chunker',
      to: 'tsv_index',
      label: 'tsvector',
      kind: 'flow',
      points: [
        [448, 84],
        [536, 84],
      ],
    },
    {
      id: 'h3',
      from: 'para_chunker',
      to: 'pgvector_index',
      label: 'Embed',
      kind: 'flow',
      points: [
        [448, 112],
        [480, 112],
        [480, 272],
        [536, 272],
      ],
    },
    {
      id: 'h4',
      from: 'query_input',
      to: 'tsv_index',
      label: 'Lex Score',
      kind: 'primary',
      points: [
        [324, 268],
        [500, 268],
        [500, 108],
        [536, 108],
      ],
    },
    {
      id: 'h5',
      from: 'query_input',
      to: 'pgvector_index',
      label: 'Cosine <=>',
      kind: 'primary',
      points: [
        [324, 300],
        [536, 300],
      ],
    },
    {
      id: 'h6',
      from: 'tsv_index',
      to: 'dual_retrieval',
      label: 'lex',
      kind: 'primary',
      points: [
        [716, 96],
        [752, 96],
        [752, 176],
        [788, 176],
      ],
    },
    {
      id: 'h7',
      from: 'pgvector_index',
      to: 'dual_retrieval',
      label: 'sem',
      kind: 'primary',
      points: [
        [716, 288],
        [752, 288],
        [752, 208],
        [788, 208],
      ],
    },
    {
      id: 'h8',
      from: 'dual_retrieval',
      to: 'rrf_fusion',
      label: 'Filtered',
      kind: 'primary',
      points: [
        [870, 160],
        [870, 96],
        [964, 96],
      ],
    },
    {
      id: 'h9',
      from: 'rrf_fusion',
      to: 'grounded_answer',
      label: 'Top-K',
      kind: 'primary',
      points: [
        [1052, 128],
        [1052, 256],
      ],
    },
  ];

  const ragSteps: DiagramStep[] = [
    {
      id: 'rag-s1',
      title: isVi ? 'Trích xuất, cắt đoạn & lập chỉ mục' : 'Extract, Chunk & Dual Index',
      activeNodes: ['source_docs', 'para_chunker', 'tsv_index', 'pgvector_index'],
      activeEdges: ['h1', 'h2', 'h3'],
      description: isVi
        ? 'Tài liệu được phân tách thuần zlib/Node, ghi vào không gian P.A.R.A. và lập chỉ mục kép GIN tsvector (gập dấu VN) + pgvector (1536d/256d).'
        : 'Pure-Node zlib extractors chunk documents into P.A.R.A. spaces and populate dual GIN tsvector (VN-folded) and pgvector (1536d/256d) indexes.',
      route: 'POST /api/latticeParaDocuments:create',
      payload: 'GIN tsvector + pgvector HNSW (8..8192 dims)',
      chips: ['Zero Binary', 'FORCE RLS'],
    },
    {
      id: 'rag-s2',
      title: isVi ? 'Truy vấn RLS -> Chấm điểm Kép (GIN & Cosine)' : 'Query & RLS -> Dual Scoring (GIN & Cosine)',
      activeNodes: ['query_input', 'tsv_index', 'pgvector_index'],
      activeEdges: ['h4', 'h5'],
      description: isVi
        ? 'Truy vấn mang ngữ cảnh app.current_org chạy thẳng tới hai bộ chấm điểm ts_rank_cd (lex) và khoảng cách cosine <=> (sem) trước khi lọc.'
        : 'Tenant-scoped queries score ts_rank_cd (lex) and pgvector cosine distance (sem) in parallel first before candidate gating.',
      route: 'POST /api/latticePara:hybridSearch',
      payload: 'SET LOCAL app.current_org -> lex + sem scores',
      chips: ['app.current_org', 'Dual Scoring'],
    },
    {
      id: 'rag-s3',
      title: isVi ? 'Candidate Gate (lex > 0 || sem >= 0.18)' : 'Candidate Gate (lex > 0 || sem >= 0.18)',
      activeNodes: ['tsv_index', 'pgvector_index', 'dual_retrieval'],
      activeEdges: ['h6', 'h7'],
      description: isVi
        ? 'scoreRrfEntries chỉ lọc ứng viên tại Candidate Gate SAU bước chấm điểm để giữ e.lex > 0 || (neural && e.sem >= 0.18).'
        : 'scoreRrfEntries applies Candidate Gate AFTER dual scoring, retaining candidates with e.lex > 0 || (neural && e.sem >= 0.18).',
      route: 'para-hybrid-search.js:419-430',
      payload: 'entries.filter(e => e.lex > 0 || (neural && e.sem >= 0.18))',
      chips: ['Post-Score Gate', 'Noise Filter'],
    },
    {
      id: 'rag-s4',
      title: isVi ? 'Hợp nhất RRF (k=60) & Trích dẫn' : 'RRF Fusion (k=60) & Grounded Citations',
      activeNodes: ['dual_retrieval', 'rrf_fusion', 'grounded_answer'],
      activeEdges: ['h8', 'h9'],
      description: isVi
        ? 'Các ứng viên qua Gate được xếp hạng rLex và rSem, hợp nhất theo RRF k=60 rồi trả về Top-K trích dẫn cho Agent.'
        : 'Gated candidates receive rLex/rSem ranks, fuse via RRF k=60, and return Top-K grounded citations to dxos_search_enterprise_context.',
      route: 'dxos_search_enterprise_context',
      payload: 'score = round4(rrf*100 + lex*0.25 + max(0,sem)*2)',
      chips: ['k = 60', 'Grounded'],
    },
  ];

  // Mode 2: OCR-to-Record Pipeline (Direct Digital Path + Scan OCR Path)
  const ocrZones: DiagramZone[] = [
    {
      id: 'ocr-extract',
      label: isVi ? 'Giải mã Tệp Số & Nhánh Ảnh Scan OCR (SSRF-Checked)' : 'Digital Extraction & Image-Scan Multimodal OCR',
      x: 16,
      y: 16,
      width: 472,
      height: 364,
      kind: 'admin',
    },
    {
      id: 'ocr-map',
      label: isVi ? 'Dự phòng & Ánh xạ 4 Bảng Cho phép' : 'Fallback & 4 Allowlisted Collections',
      x: 560,
      y: 16,
      width: 584,
      height: 364,
      kind: 'traffic',
    },
  ];

  const ocrNodes: DiagramNode[] = [
    {
      id: 'upload_doc',
      title: isVi ? 'Tệp Đầu vào' : 'Upload Document',
      sub: 'PDF | Office <= 2MB',
      icon: 'file-text',
      x: 28,
      y: 72,
      width: 176,
      height: 64,
      zoneId: 'ocr-extract',
      inspector: isVi
        ? {
            role: 'Tiếp nhận chứng từ PDF, Office hoặc ảnh chụp biểu mẫu',
            packageOrPort: 'para-resource.js · latticePara:extractFormFields',
            protocol: 'HTTPS POST · Bearer + RLS',
            payloadOrSchema: 'PDF, DOCX, XLSX, PPTX, PNG, JPEG, WebP (<= 2MB)',
            responsibilities:
              'Kiểm tra kích thước tệp tối đa 2MB và chuyển sang Extractor Guard để phân loại tài liệu số hay ảnh scan.',
          }
        : {
            role: 'Document and form image upload entrypoint',
            packageOrPort: 'para-resource.js · latticePara:extractFormFields',
            protocol: 'HTTPS POST · Bearer + RLS',
            payloadOrSchema: 'PDF, DOCX, XLSX, PPTX, PNG, JPEG, WebP (<= 2MB)',
            responsibilities:
              'Validates the 2MB upload ceiling and passes payloads to Extractor Guard to branch digital text vs image scans.',
          },
    },
    {
      id: 'zip_pdf_parser',
      title: isVi ? 'Extractor Guard' : 'Extractor Guard',
      sub: 'MAX_INFLATED 10MB',
      icon: 'box',
      x: 284,
      y: 72,
      width: 188,
      height: 64,
      zoneId: 'ocr-extract',
      focal: true,
      inspector: isVi
        ? {
            role: 'Phân giải ZIP/PDF số trực tiếp hoặc chuyển ảnh scan sang OCR',
            packageOrPort: 'document-extractor.js:2901-2935',
            protocol: 'In-process · Zip-Bomb Guard',
            payloadOrSchema: 'Digital Office/PDF -> Field Mapper | Image Scan -> OCR',
            responsibilities:
              'Tài liệu Office (DOCX/XLSX/PPTX) và PDF có lớp văn bản đi thẳng tới Field Mapper; chỉ PDF scan hoặc ảnh mới gọi Multimodal OCR.',
          }
        : {
            role: 'Digital PDF/Office parser & image-scan router',
            packageOrPort: 'document-extractor.js:2901-2935',
            protocol: 'In-process · Zip-Bomb Guard',
            payloadOrSchema: 'Digital Office/PDF -> Field Mapper | Image Scan -> OCR',
            responsibilities:
              'Digital Office docs and text-layer PDFs bypass OCR straight to Field Mapper; only image-only scans route to Multimodal OCR.',
          },
    },
    {
      id: 'ocr_endpoint',
      title: isVi ? 'OCR Đa phương thức' : 'Multimodal OCR',
      sub: 'DX_OCR_ENDPOINT · 5s',
      icon: 'globe',
      x: 284,
      y: 236,
      width: 188,
      height: 64,
      zoneId: 'ocr-extract',
      focal: true,
      inspector: isVi
        ? {
            role: 'Gọi dịch vụ OCR ngoài cho ảnh scan với kiểm tra SSRF nghiêm ngặt',
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
              'Validates DX_OCR_ENDPOINT via validateOcrEndpoint, disables HTTP redirects, and enforces OCR_TIMEOUT_MS=5000ms for image scans.',
          },
    },
    {
      id: 'offline_fallback',
      title: isVi ? 'Dự phòng Ngoại tuyến' : 'Offline Fallback',
      sub: 'offline-deterministic',
      icon: 'cpu',
      x: 604,
      y: 236,
      width: 204,
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
      x: 604,
      y: 72,
      width: 204,
      height: 64,
      zoneId: 'ocr-map',
      focal: true,
      inspector: isVi
        ? {
            role: 'Chuẩn hóa văn bản số hoặc đầu ra OCR thành JSON khớp bảng đích',
            packageOrPort: 'para-resource.js:854 · extractStructuredFormFields',
            protocol: 'Allowlist Schema Validation',
            payloadOrSchema: 'ALLOWED_FORM_COLLECTIONS whitelist',
            responsibilities:
              'Nhận dữ liệu từ cả luồng tách văn bản số trực tiếp lẫn luồng OCR/Fallback, làm sạch kiểu và ánh xạ vào bảng cho phép.',
          }
        : {
            role: 'Normalizes digital text or OCR output into collection payloads',
            packageOrPort: 'para-resource.js:854 · extractStructuredFormFields',
            protocol: 'Allowlist Schema Validation',
            payloadOrSchema: 'ALLOWED_FORM_COLLECTIONS whitelist',
            responsibilities:
              'Accepts extracted text directly from digital docs or via Multimodal OCR / Offline Fallback, restricting targets to ALLOWED_FORM_COLLECTIONS.',
          },
    },
    {
      id: 'target_records',
      title: isVi ? '4 Bảng Cho phép' : '4 Allowlisted Tables',
      sub: 'Orders|Requests|Lots|Tkt',
      icon: 'database',
      x: 912,
      y: 72,
      width: 212,
      height: 64,
      zoneId: 'ocr-map',
      inspector: isVi
        ? {
            role: '4 bảng đích được phép tạo bản ghi tự động từ tài liệu',
            packageOrPort: 'PG16 · ALLOWED_FORM_COLLECTIONS',
            protocol: 'Tenant RLS · app.current_org',
            payloadOrSchema: 'latticeOrders, latticeRequests, latticeStockLots, latticeServiceTickets',
            responsibilities:
              'Tiếp nhận dữ liệu biểu mẫu đã chuẩn hóa vào đơn hàng, yêu cầu, lô hàng hoặc phiếu dịch vụ trong vùng cô lập tenant.',
          }
        : {
            role: 'Allowlisted operational collections populated by extractor',
            packageOrPort: 'PG16 · ALLOWED_FORM_COLLECTIONS',
            protocol: 'Tenant RLS · app.current_org',
            payloadOrSchema: 'latticeOrders, latticeRequests, latticeStockLots, latticeServiceTickets',
            responsibilities:
              'Accepts validated structured payloads into orders, requests, stock lots, or service tickets inside the tenant RLS boundary.',
          },
    },
  ];

  const ocrEdges: DiagramEdge[] = [
    {
      id: 'o1',
      from: 'upload_doc',
      to: 'zip_pdf_parser',
      label: 'Parse',
      kind: 'primary',
      points: [
        [204, 104],
        [284, 104],
      ],
    },
    {
      id: 'o_digital',
      from: 'zip_pdf_parser',
      to: 'schema_mapper',
      label: 'Digital PDF/Office',
      kind: 'primary',
      points: [
        [472, 92],
        [604, 92],
      ],
    },
    {
      id: 'o2',
      from: 'zip_pdf_parser',
      to: 'ocr_endpoint',
      label: 'Image Scan',
      kind: 'flow',
      points: [
        [378, 136],
        [378, 236],
      ],
    },
    {
      id: 'o3',
      from: 'ocr_endpoint',
      to: 'schema_mapper',
      label: 'OCR JSON',
      kind: 'flow',
      points: [
        [472, 248],
        [524, 248],
        [524, 120],
        [604, 120],
      ],
    },
    {
      id: 'o4',
      from: 'ocr_endpoint',
      to: 'offline_fallback',
      label: 'Fallback',
      kind: 'dashed',
      points: [
        [472, 276],
        [604, 276],
      ],
    },
    {
      id: 'o5',
      from: 'offline_fallback',
      to: 'schema_mapper',
      label: 'UTF-8',
      kind: 'dashed',
      points: [
        [706, 236],
        [706, 136],
      ],
    },
    {
      id: 'o6',
      from: 'schema_mapper',
      to: 'target_records',
      label: 'Record',
      kind: 'primary',
      points: [
        [808, 104],
        [912, 104],
      ],
    },
  ];

  const ocrSteps: DiagramStep[] = [
    {
      id: 'ocr-s1',
      title: isVi ? 'Nhánh thẳng: PDF/Office số -> Field Mapper' : 'Fast-Path: Digital PDF/Office -> Field Mapper',
      activeNodes: ['upload_doc', 'zip_pdf_parser', 'schema_mapper'],
      activeEdges: ['o1', 'o_digital'],
      description: isVi
        ? 'Tài liệu Office và PDF có sẵn văn bản số đi thẳng từ Extractor Guard sang Field Mapper mà không cần gọi dịch vụ OCR ngoài.'
        : 'Digital Office documents and text-layer PDFs flow directly from Extractor Guard to Field Mapper without calling external OCR.',
      route: 'document-extractor.js:2901-2935 -> extractStructuredFormFields()',
      payload: 'MAX_UPLOAD_BYTES=2MB | MAX_INFLATED_BYTES=10MB',
      chips: ['Zero-OCR Fast-Path', 'Zip-Bomb Guard'],
    },
    {
      id: 'ocr-s2',
      title: isVi ? 'Nhánh ảnh scan: Multimodal OCR & Offline Fallback' : 'Scan Path: Multimodal OCR & Offline Fallback',
      activeNodes: ['zip_pdf_parser', 'ocr_endpoint', 'offline_fallback'],
      activeEdges: ['o2', 'o4'],
      description: isVi
        ? 'Ảnh chụp và PDF scan đi qua Multimodal OCR (validateOcrEndpoint, 5s, cấm redirect); nếu ngoại tuyến sẽ chuyển sang offline-deterministic-fallback.'
        : 'Image-only scans route to SSRF-checked Multimodal OCR (5s timeout, redirect: error), falling back to offline-deterministic-fallback if unreachable.',
      route: 'validateOcrEndpoint(DX_OCR_ENDPOINT)',
      payload: 'OCR_TIMEOUT_MS = 5000 | redirect: error',
      chips: ['SSRF Safe', 'Deterministic Fallback'],
    },
    {
      id: 'ocr-s3',
      title: isVi ? 'Ánh xạ vào 4 Bảng Cho phép' : 'Map to 4 Allowlisted Collections',
      activeNodes: ['ocr_endpoint', 'offline_fallback', 'schema_mapper', 'target_records'],
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
      summary: isVi ? 'Score -> Candidate Gate -> RRF k=60' : 'Score -> Candidate Gate -> RRF k=60',
      zones: ragZones,
      nodes: ragNodes,
      edges: ragEdges,
      steps: ragSteps,
    },
    {
      id: 'ocr-to-record',
      label: 'OCR-to-Record',
      summary: isVi ? 'Digital Text + Scan OCR -> 4 Bảng' : 'Digital Text + Scan OCR -> 4 Tables',
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
    viewBox="0 0 1160 400"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
