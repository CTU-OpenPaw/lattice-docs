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

const isVi = computed(() => resolvedLang.value === 'vi');

const title = computed(() =>
  isVi.value
    ? 'Chuỗi Ký Ed25519, Sổ cái Băm Merkle & Xác minh QR ePOD'
    : 'Ed25519 PKI Signing, Merkle Ledger & Public QR Verification',
);

const caption = computed(() =>
  isVi.value
    ? 'Dữ liệu ePOD chuẩn hóa bằng canonicalJson() được băm SHA-256, ghi tuần tự dưới khóa pg_advisory_xact_lock vào latticeCryptoLedger (prevHash -> entryHash), ký Ed25519 bằng khóa bọc AES-256-GCM và tổng hợp thành cây Merkle để đối chiếu công khai qua /v/track/:code.'
    : 'ePOD mutations are canonicalized and SHA-256 hashed, serialized under pg_advisory_xact_lock into latticeCryptoLedger (prevHash -> entryHash), signed with per-org AES-256-GCM-wrapped Ed25519 keys, and aggregated into a binary Merkle root for public /v/track/:code verification.',
);

const zones = computed<DiagramZone[]>(() => [
  {
    id: 'pki-ledger-plane',
    label: isVi.value
      ? 'SỔ CÁI BĂM BẤT BIẾN, KÝ ED25519 & CÂY MERKLE'
      : 'IMMUTABLE HASH-CHAINED LEDGER, ED25519 SIGNING & MERKLE TREE',
    x: 16,
    y: 16,
    width: 1128,
    height: 152,
    kind: 'admin',
  },
  {
    id: 'epod-verify-zone',
    label: isVi.value
      ? 'CHỨNG THƯ HMAC ePOD & XÁC MINH CÔNG KHAI /v/track/:code'
      : 'PUBLIC ePOD QR HMAC PROOF & /v/track/:code VERIFICATION',
    x: 16,
    y: 204,
    width: 1128,
    height: 136,
    kind: 'traffic',
  },
]);

const nodes = computed<DiagramNode[]>(() => [
  {
    id: 'epod_event',
    title: isVi.value ? 'Sự kiện Nghiệp vụ / ePOD' : 'Business / ePOD Mutation',
    sub: 'latticeEpodRecords',
    icon: 'truck',
    x: 32,
    y: 60,
    width: 172,
    height: 80,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'Nguồn Sự kiện Giao nhận & Nghiệp vụ' : 'ePOD & Business Event Producer',
      packageOrPort: 'wms-engine.js · latticeEpodRecords',
      protocol: 'Transactional PG16 Capture',
      payloadOrSchema: 'epodUid · trackingCode · signatureSha256 · gpsLat/Lng',
      responsibilities: isVi.value
        ? 'Ghi nhận biên bản giao hàng ePOD hoặc sự kiện nghiệp vụ trọng yếu và đẩy payload sang bước chuẩn hóa JSON.'
        : 'Captures ePOD delivery proof or critical domain mutations and passes the event payload into deterministic canonicalization.',
    },
  },
  {
    id: 'canon_hash',
    title: 'Canonical JSON + SHA-256',
    sub: ['payloadHash', 'Deterministic JSON'],
    icon: 'file-text',
    x: 260,
    y: 60,
    width: 172,
    height: 80,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'Chuẩn hóa & Băm Payload Xác định' : 'Deterministic Canonicalization & Hasher',
      packageOrPort: '@latticedx/plugin-lattice-foundation · pki-ledger.js',
      protocol: 'Recursive Key-Sorted JSON + SHA-256',
      payloadOrSchema: 'payloadHash = sha256Hex(canonicalJson(payload))',
      responsibilities: isVi.value
        ? 'Sắp xếp khóa JSON đệ quy theo thứ tự từ điển trước khi băm SHA-256 để bảo đảm chuỗi băm khớp tuyệt đối trên mọi nút.'
        : 'Recursively sorts object keys via canonicalJson() before SHA-256 hashing so digests are byte-identical across runtimes.',
    },
  },
  {
    id: 'ledger_append',
    title: isVi.value ? 'Ghi Sổ cái (Advisory Lock)' : 'PG16 Advisory Lock Append',
    sub: ['latticeCryptoLedger', 'prevHash -> entryHash'],
    icon: 'lock',
    x: 488,
    y: 60,
    width: 184,
    height: 80,
    zoneId: 'pki-ledger-plane',
    focal: true,
    inspector: {
      role: isVi.value ? 'Sổ cái Nối chuỗi Băm Bất biến' : 'Immutable Hash-Chained Audit Ledger',
      packageOrPort: 'pki-ledger.js · pg_advisory_xact_lock',
      protocol: "pg_advisory_xact_lock(hashtext('latticedx:ledger:' || orgId))",
      payloadOrSchema: 'seq · payloadHash · prevHash -> entryHash · LEDGER_IMMUTABLE',
      responsibilities: isVi.value
        ? 'Tuần tự hóa ghi theo tổ chức bằng pg_advisory_xact_lock, nối prevHash (64 số 0 ở seq=1) sang entryHash và chặn mọi UPDATE/DELETE.'
        : 'Serializes per-org appends under pg_advisory_xact_lock, chains prevHash (64 zeros at seq=1) into entryHash, and blocks updates/deletes.',
    },
  },
  {
    id: 'ed25519_sign',
    title: isVi.value ? 'Ký Ed25519 theo Tổ chức' : 'Per-Org Ed25519 Sign',
    sub: ['latticePkiKeys', 'AES-256-GCM Wrap'],
    icon: 'key',
    x: 728,
    y: 60,
    width: 172,
    height: 80,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'Kho Khóa & Bộ Ký Ed25519 Riêng Tổ chức' : 'Per-Org Ed25519 Keystore & Signer',
      packageOrPort: 'pki-ledger.js · latticePkiKeys',
      protocol: 'Ed25519 + AES-256-GCM Private Key Wrap',
      payloadOrSchema: 'Ed25519.sign("${orgId}|${seq}|${entryHash}")',
      responsibilities: isVi.value
        ? 'Giải bọc khóa bí mật Ed25519 (bọc bằng AES-256-GCM với ENCRYPTION_FIELD_KEY) chỉ trong bộ nhớ lúc ký từng mục sổ cái.'
        : 'Unwraps the AES-256-GCM encrypted per-org Ed25519 private key strictly in memory to sign each appended ledger entry.',
    },
  },
  {
    id: 'merkle_root',
    title: isVi.value ? 'Gốc Cây Nhị phân Merkle' : 'Binary SHA-256 Merkle Root',
    sub: ['computeMerkleRoot', ':verify · :export'],
    icon: 'git-branch',
    x: 956,
    y: 60,
    width: 172,
    height: 80,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'Bộ tổng hợp Cây Merkle & Xuất Bằng chứng' : 'Binary Merkle Aggregator & Proof Export',
      packageOrPort: 'GET/POST /api/dxosLedger:{verify,exportProof}',
      protocol: 'SHA-256 Pairwise Binary Tree',
      payloadOrSchema: 'sha256Hex("${left}${right}") · odd leaf duplicated',
      responsibilities: isVi.value
        ? 'Gộp các entryHash theo thứ tự seq thành gốc Merkle (nhân đôi lá phải khi tầng lẻ) và phục vụ kiểm chứng qua :verify / :exportProof.'
        : 'Folds ordered entryHash leaves into a binary SHA-256 Merkle root (duplicating odd rightmost nodes) exposed via :verify and :exportProof.',
    },
  },
  {
    id: 'hmac_qr',
    title: isVi.value ? 'Mã QR HMAC ePOD' : 'ePOD QR HMAC Proof',
    sub: ['HMAC-SHA256', '#verify= Fragment'],
    icon: 'shield',
    x: 32,
    y: 244,
    width: 188,
    height: 80,
    zoneId: 'epod-verify-zone',
    inspector: {
      role: isVi.value ? 'Bộ sinh Chứng thực HMAC cho Mã QR' : 'ePOD QR HMAC Proof Generator',
      packageOrPort: 'plugin-dxos-studio · wms-engine.js:486',
      protocol: 'HMAC-SHA256 (LATTICE_TRACK_VERIFY_SECRET)',
      payloadOrSchema: '${org}|${trackingCode}|${epodUid}|${tokenHash}|${seq}',
      responsibilities: isVi.value
        ? 'Sinh qrVerificationHash gắn với ledgerSeq và nhúng vào mảnh #verify= trên URL mã QR để kiểm chứng không rò rỉ dữ liệu.'
        : 'Computes qrVerificationHash bound to ledgerSeq and embeds it in the QR #verify= fragment for tamper-evident public lookup.',
    },
  },
  {
    id: 'track_ui',
    title: isVi.value ? 'Cổng Tra cứu Công khai' : 'Public Track Portal',
    sub: ['/v/track/:code', 'Nonce CSP · Masked'],
    icon: 'globe',
    x: 296,
    y: 244,
    width: 196,
    height: 80,
    zoneId: 'epod-verify-zone',
    inspector: {
      role: isVi.value ? 'Cổng Xác minh Công khai Không Đăng nhập' : 'Unauthenticated Public Tracking Portal',
      packageOrPort: '10-lattice-public-routes.sh · public-track-html.js',
      protocol: 'HTTPS · Per-Response Nonce CSP',
      payloadOrSchema: 'GET /api/dxosWms:publicTrack (Masked Fields)',
      responsibilities: isVi.value
        ? 'Phục vụ trang /v/track/:code với chính sách CSP nonce riêng theo từng phản hồi và che số điện thoại, thông tin nhạy cảm.'
        : 'Serves /v/track/:code under strict per-response nonce CSP, displaying masked tracking metadata alongside the #verify= proof.',
    },
  },
  {
    id: 'verify_api',
    title: isVi.value ? 'Xác minh Chữ ký Công khai' : 'Public Signature Verify',
    sub: ['GET/POST', ':verifyTrackSignature'],
    icon: 'check-circle',
    x: 568,
    y: 244,
    width: 204,
    height: 80,
    zoneId: 'epod-verify-zone',
    focal: true,
    inspector: {
      role: isVi.value ? 'API Đối chiếu Toàn vẹn QR & Sổ cái' : 'Public QR & Ledger Cross-Check API',
      packageOrPort: 'wms-engine.js · /api/dxosWms:verifyTrackSignature',
      protocol: 'GET/POST REST · Zero Tenant Secret Leak',
      payloadOrSchema: 'qrVerificationHash + latticeCryptoLedger Ed25519 check',
      responsibilities: isVi.value
        ? 'Kiểm tra chữ ký HMAC của mã QR và đối chiếu mục latticeCryptoLedger tương ứng để xác nhận hợp lệ mà không lộ khóa bí mật.'
        : 'Validates the QR HMAC proof and cross-checks the referenced latticeCryptoLedger Ed25519 signature without leaking tenant secrets.',
    },
  },
]);

const edges = computed<DiagramEdge[]>(() => [
  {
    id: 'e1',
    from: 'epod_event',
    to: 'canon_hash',
    label: 'JSON',
    kind: 'primary',
    points: [
      [204, 100],
      [260, 100],
    ],
  },
  {
    id: 'e2',
    from: 'canon_hash',
    to: 'ledger_append',
    label: 'SHA',
    kind: 'primary',
    points: [
      [432, 100],
      [488, 100],
    ],
  },
  {
    id: 'e3',
    from: 'ledger_append',
    to: 'ed25519_sign',
    label: 'Sign',
    kind: 'primary',
    points: [
      [672, 100],
      [728, 100],
    ],
  },
  {
    id: 'e4',
    from: 'ed25519_sign',
    to: 'merkle_root',
    label: 'Tree',
    kind: 'flow',
    points: [
      [900, 100],
      [956, 100],
    ],
  },
  {
    id: 'e5',
    from: 'epod_event',
    to: 'hmac_qr',
    label: 'QR Token',
    kind: 'primary',
    points: [
      [118, 140],
      [118, 244],
    ],
  },
  {
    id: 'e6',
    from: 'hmac_qr',
    to: 'track_ui',
    label: '#verify=',
    kind: 'primary',
    points: [
      [220, 284],
      [296, 284],
    ],
  },
  {
    id: 'e7',
    from: 'track_ui',
    to: 'verify_api',
    label: 'Verify',
    kind: 'primary',
    points: [
      [492, 284],
      [568, 284],
    ],
  },
  {
    id: 'e8',
    from: 'verify_api',
    to: 'ledger_append',
    label: 'dxosLedger:verify',
    kind: 'flow',
    points: [
      [612, 244],
      [612, 140],
    ],
  },
  {
    id: 'e9',
    from: 'verify_api',
    to: 'merkle_root',
    label: 'Merkle Proof',
    kind: 'dashed',
    labelPosition: 0.34,
    points: [
      [772, 284],
      [1042, 284],
      [1042, 140],
    ],
  },
]);

const steps = computed<DiagramStep[]>(() => [
  {
    id: 'step-canonical',
    title: isVi.value ? 'Canonical JSON & Khóa Tư vấn PG16' : 'Canonical Hash & PG16 Advisory Lock',
    activeNodes: ['epod_event', 'canon_hash', 'ledger_append'],
    activeEdges: ['e1', 'e2'],
    description: isVi.value
      ? 'Sự kiện ePOD được chuẩn hóa bằng canonicalJson() để tính payloadHash, sau đó pg_advisory_xact_lock tuần tự hóa việc nối prevHash -> entryHash.'
      : 'ePOD events are normalized via canonicalJson() into payloadHash before pg_advisory_xact_lock serializes prevHash -> entryHash appends.',
    route: "pg_advisory_xact_lock(hashtext('latticedx:ledger:' || orgId))",
    payload: 'payloadHash = sha256Hex(canonicalJson(payload))',
    chips: ['LEDGER_IMMUTABLE', 'prevHash -> entryHash'],
  },
  {
    id: 'step-ed25519',
    title: isVi.value ? 'Ký Ed25519 theo Tổ chức' : 'Per-Org Ed25519 Signature',
    activeNodes: ['ledger_append', 'ed25519_sign'],
    activeEdges: ['e3'],
    description: isVi.value
      ? 'Khóa riêng Ed25519 của từng tổ chức trong latticePkiKeys (bọc AES-256-GCM) ký xác nhận "${orgId}|${seq}|${entryHash}".'
      : 'The tenant-specific Ed25519 key in latticePkiKeys (AES-256-GCM wrapped) signs "${orgId}|${seq}|${entryHash}" for non-repudiation.',
    route: 'POST /api/dxosLedger:signDocument | :verify',
    payload: 'Ed25519.sign("${orgId}|${seq}|${entryHash}")',
    chips: ['AES-256-GCM Wrap', 'Per-Org PKI'],
  },
  {
    id: 'step-merkle',
    title: isVi.value ? 'Tổng hợp Gốc Cây Merkle' : 'Binary SHA-256 Merkle Root',
    activeNodes: ['ed25519_sign', 'merkle_root'],
    activeEdges: ['e4'],
    description: isVi.value
      ? 'Chuỗi entryHash được gộp theo từng cặp thành cây nhị phân SHA-256; :exportProof xuất bằng chứng kiểm toán độc lập.'
      : 'Ordered entryHash leaves fold pairwise into a binary SHA-256 Merkle root; :exportProof exports standalone audit bundles.',
    route: 'GET /api/dxosLedger:status | :exportProof',
    payload: 'sha256Hex("${left}${right}") · odd leaf duplicated',
    chips: ['Merkle Tree', 'Audit Proof'],
  },
  {
    id: 'step-qr',
    title: isVi.value ? 'QR HMAC & Đối chiếu Công khai' : 'Public QR HMAC & Ledger Cross-Check',
    activeNodes: ['epod_event', 'hmac_qr', 'track_ui', 'verify_api', 'ledger_append', 'merkle_root'],
    activeEdges: ['e5', 'e6', 'e7', 'e8', 'e9'],
    description: isVi.value
      ? 'Cổng /v/track/:code (Nonce CSP) gửi #verify= tới :verifyTrackSignature để kiểm tra HMAC và đối chiếu trực tiếp sổ cái cùng gốc Merkle.'
      : 'The nonce-CSP /v/track/:code portal submits #verify= to :verifyTrackSignature, validating HMAC and cross-checking the ledger and Merkle root.',
    route: 'GET/POST /api/dxosWms:verifyTrackSignature -> dxosLedger:verify',
    payload: 'HMAC-SHA256 #verify= · Zero Tenant Secret Leak',
    chips: ['Nonce CSP', 'Public Verifiable'],
  },
]);
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 1160 356"
    :zones="zones"
    :nodes="nodes"
    :edges="edges"
    :steps="steps"
    :lang="resolvedLang"
  />
</template>
