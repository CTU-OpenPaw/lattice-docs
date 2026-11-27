<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol } from 'vitepress';
import DiagramCanvas from './DiagramCanvas.vue';
import type { DiagramEdge, DiagramLocale, DiagramNode, DiagramStep, DiagramZone } from './diagramTypes';

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
    ? 'Khóa Ed25519 theo tổ chức (latticePkiKeys, bọc AES-256-GCM) ký các bản ghi nối chuỗi prevHash -> entryHash trong sổ cái bất biến latticeCryptoLedger dưới khóa tư vấn pg_advisory_xact_lock, đồng thời xuất chứng thư HMAC cho cổng /v/track/:code.'
    : 'Per-organization Ed25519 keys (latticePkiKeys, AES-256-GCM wrapped) sign hash-chained prevHash -> entryHash entries in latticeCryptoLedger under pg_advisory_xact_lock, powering Merkle roots and HMAC ePOD QR proofs at /v/track/:code.',
);

const zones = computed<DiagramZone[]>(() => [
  {
    id: 'pki-ledger-plane',
    label: isVi.value
      ? 'MẶT PHẲNG KÝ SỐ ED25519 & SỔ CÁI MERKLE BẤT BIẾN'
      : 'ED25519 SIGNING & IMMUTABLE MERKLE LEDGER PLANE',
    x: 16,
    y: 16,
    width: 888,
    height: 244,
    kind: 'admin',
  },
  {
    id: 'epod-verify-zone',
    label: isVi.value
      ? 'VÙNG CHỨNG THƯ HMAC ePOD & XÁC MINH CÔNG KHAI /v/track/:code'
      : 'HMAC ePOD PROOF & PUBLIC /v/track/:code VERIFICATION ZONE',
    x: 16,
    y: 300,
    width: 888,
    height: 128,
    kind: 'traffic',
  },
]);

const nodes = computed<DiagramNode[]>(() => [
  {
    id: 'pki_keys',
    title: 'latticePkiKeys',
    sub: 'Ed25519 · AES-GCM',
    icon: 'key',
    x: 48,
    y: 80,
    width: 192,
    height: 64,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'Kho Khóa Ed25519 theo Tổ chức' : 'Per-Organization Ed25519 Key Registry',
      packageOrPort: '@latticedx/plugin-lattice-foundation · pki-ledger.js',
      protocol: 'Ed25519 + AES-256-GCM Key Wrap',
      payloadOrSchema: 'keyId · publicKeyPem · ENCRYPTION_FIELD_KEY || APP_KEY',
      responsibilities: isVi.value
        ? 'Lưu trữ cặp khóa Ed25519 riêng cho từng tổ chức; khóa bí mật được mã hóa AES-256-GCM khi lưu trữ và chỉ giải bọc lúc ký sổ cái.'
        : 'Stores per-org Ed25519 keypairs; private keys are encrypted at rest with AES-256-GCM and unwrapped in memory strictly during ledger signing.',
    },
  },
  {
    id: 'crypto_ledger',
    title: 'latticeCryptoLedger',
    sub: 'Advisory Lock · Seq',
    icon: 'lock',
    x: 360,
    y: 80,
    width: 192,
    height: 64,
    zoneId: 'pki-ledger-plane',
    focal: true,
    inspector: {
      role: isVi.value ? 'Sổ cái Nối chuỗi Băm Bất biến' : 'Immutable Hash-Chained Audit Ledger',
      packageOrPort: 'pki-ledger.js · pg_advisory_xact_lock',
      protocol: 'SHA-256 Chain + Ed25519 Signature',
      payloadOrSchema: 'seq · payloadHash · prevHash -> entryHash · signatureBase64',
      responsibilities: isVi.value
        ? 'Tuần tự hóa ghi bằng pg_advisory_xact_lock, nối prevHash (64 số 0 ở seq=1) sang entryHash và chặn UPDATE/DELETE với lỗi LEDGER_IMMUTABLE.'
        : 'Serializes appends via pg_advisory_xact_lock, chains prevHash (64 zeros at seq=1) to entryHash, and rejects updates/deletes with LEDGER_IMMUTABLE.',
    },
  },
  {
    id: 'merkle_root',
    title: 'Merkle Root',
    sub: 'SHA-256 Binary Tree',
    icon: 'git-branch',
    x: 672,
    y: 80,
    width: 192,
    height: 64,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'Bộ tổng hợp Cây Nhị phân Merkle' : 'Binary SHA-256 Merkle Aggregator',
      packageOrPort: 'pki-ledger.js · computeMerkleRoot',
      protocol: 'SHA-256 Pairwise Leaf Hashing',
      payloadOrSchema: 'sha256Hex("${left}${right}") · odd leaf dup',
      responsibilities: isVi.value
        ? 'Xây cây SHA-256 nhị phân trên các lá entryHash theo thứ tự seq; nếu tầng có số nút lẻ thì nhân đôi nút ngoài cùng bên phải.'
        : 'Builds a binary SHA-256 tree over ordered entryHash leaves; duplicates the rightmost node whenever a tree level has an odd node count.',
    },
  },
  {
    id: 'epod_source',
    title: isVi.value ? 'Sự kiện ePOD' : 'ePOD / Mutation',
    sub: 'canonicalJson()',
    icon: 'truck',
    x: 48,
    y: 180,
    width: 192,
    height: 64,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'Nguồn Sự kiện Giao nhận & Nghiệp vụ' : 'ePOD & Business Event Producer',
      packageOrPort: 'wms-engine.js · latticeEpodRecords',
      protocol: 'Deterministic Key-Sorted Canonical JSON',
      payloadOrSchema: 'payloadHash = sha256Hex(canonicalJson(payload))',
      responsibilities: isVi.value
        ? 'Chuẩn hóa JSON theo thứ tự khóa đệ quy trước khi băm SHA-256 để bảo đảm chữ ký khớp tuyệt đối trên mọi môi trường.'
        : 'Serializes event payloads with recursive sorted-key canonicalJson before SHA-256 hashing so signatures remain reproducible across runtimes.',
    },
  },
  {
    id: 'dxos_ledger_api',
    title: 'dxosLedger API',
    sub: 'verify · exportProof',
    icon: 'check-circle',
    x: 672,
    y: 180,
    width: 192,
    height: 64,
    zoneId: 'pki-ledger-plane',
    inspector: {
      role: isVi.value ? 'API Kiểm chứng Chuỗi & Bằng chứng' : 'Ledger & Merkle Verification API',
      packageOrPort: 'GET/POST /api/dxosLedger:*',
      protocol: 'REST · Bearer JWT | ldx_pat_* (ledger)',
      payloadOrSchema: 'publicKey · entries · status · verify · signDocument · verifySignature · rotateKey · exportProof',
      responsibilities: isVi.value
        ? 'Cung cấp kiểm tra toàn vẹn chuỗi băm, đối chiếu chữ ký Ed25519 bằng khóa công khai, tính gốc Merkle và xuất gói bằng chứng kiểm toán.'
        : 'Exposes chain integrity verification, public-key Ed25519 signature checks, Merkle root computation, and audit evidence bundle exports.',
    },
  },
  {
    id: 'hmac_epod',
    title: isVi.value ? 'Mã QR HMAC' : 'HMAC ePOD Proof',
    sub: 'HMAC-SHA256 #verify=',
    icon: 'shield',
    x: 48,
    y: 344,
    width: 192,
    height: 64,
    zoneId: 'epod-verify-zone',
    inspector: {
      role: isVi.value ? 'Bộ sinh Mã Chứng thực QR ePOD' : 'ePOD QR Proof Generator',
      packageOrPort: 'plugin-dxos-studio · wms-engine.js:486',
      protocol: 'HMAC-SHA256',
      payloadOrSchema: '${org}|${trackingCode}|${epodUid}|${tokenHash}|${seq}',
      responsibilities: isVi.value
        ? 'Ký HMAC bằng LATTICE_TRACK_VERIFY_SECRET (dự phòng ENCRYPTION_FIELD_KEY || APP_KEY) và nhúng vào mảnh #verify= của mã QR.'
        : 'Computes qrVerificationHash with LATTICE_TRACK_VERIFY_SECRET (fallback ENCRYPTION_FIELD_KEY || APP_KEY) for the QR #verify= fragment.',
    },
  },
  {
    id: 'public_track',
    title: isVi.value ? 'Tra cứu QR' : 'Public Track UI',
    sub: '/v/track/:code · CSP',
    icon: 'globe',
    x: 360,
    y: 344,
    width: 192,
    height: 64,
    zoneId: 'epod-verify-zone',
    inspector: {
      role: isVi.value ? 'Cổng Xác minh Công khai Không Cần Đăng nhập' : 'Unauthenticated Public Tracking Portal',
      packageOrPort: '10-lattice-public-routes.sh · public-track-html.js',
      protocol: 'HTTPS · Nonce CSP + Masked Fields',
      payloadOrSchema: 'GET /api/dxosWms:publicTrack',
      responsibilities: isVi.value
        ? 'Phục vụ trang tra cứu /v/track/:code với per-response nonce CSP nghiêm ngặt và chỉ hiển thị trường đã che dữ liệu nhạy cảm.'
        : 'Serves /v/track/:code with strict per-response nonce CSP and returns masked tracking fields alongside the #verify= proof fragment.',
    },
  },
  {
    id: 'verify_endpoint',
    title: isVi.value ? 'Xác minh QR' : 'Signature Verify',
    sub: ':verifyTrackSignature',
    icon: 'file-text',
    x: 672,
    y: 344,
    width: 192,
    height: 64,
    zoneId: 'epod-verify-zone',
    inspector: {
      role: isVi.value ? 'Điểm cuối Kiểm tra Toàn vẹn ePOD' : 'ePOD Cryptographic Proof Verifier',
      packageOrPort: 'wms-engine.js · /api/dxosWms:verifyTrackSignature',
      protocol: 'GET/POST REST · Zero Tenant Secret Leak',
      payloadOrSchema: 'qrVerificationHash + latticeCryptoLedger entry',
      responsibilities: isVi.value
        ? 'Kiểm tra qrVerificationHash và đối chiếu mục sổ cái latticeCryptoLedger tương ứng, trả về trạng thái hợp lệ mà không lộ khóa tổ chức.'
        : 'Validates qrVerificationHash and cross-checks the referenced latticeCryptoLedger entry signature/chain without leaking tenant secrets.',
    },
  },
]);

const edges = computed<DiagramEdge[]>(() => [
  { id: 'e1', from: 'pki_keys', to: 'crypto_ledger', label: 'Ed25519', kind: 'primary' },
  {
    id: 'e2',
    from: 'epod_source',
    to: 'crypto_ledger',
    label: 'payloadHash',
    kind: 'primary',
    points: [
      [240, 212],
      [456, 212],
      [456, 144],
    ],
  },
  { id: 'e3', from: 'crypto_ledger', to: 'crypto_ledger', label: 'prevHash', kind: 'flow', selfLoop: 'top' },
  { id: 'e4', from: 'crypto_ledger', to: 'merkle_root', label: 'Leaves', kind: 'flow' },
  { id: 'e5', from: 'merkle_root', to: 'dxos_ledger_api', label: 'Root', kind: 'flow' },
  {
    id: 'e6',
    from: 'crypto_ledger',
    to: 'dxos_ledger_api',
    label: 'entryHash',
    kind: 'flow',
    points: [
      [552, 128],
      [612, 128],
      [612, 212],
      [672, 212],
    ],
  },
  { id: 'e7', from: 'epod_source', to: 'hmac_epod', label: 'HMAC QR', kind: 'primary' },
  { id: 'e8', from: 'hmac_epod', to: 'public_track', label: '#verify=', kind: 'primary' },
  { id: 'e9', from: 'public_track', to: 'verify_endpoint', label: 'Verify', kind: 'primary' },
  { id: 'e10', from: 'verify_endpoint', to: 'dxos_ledger_api', label: 'Check Sig', kind: 'flow' },
]);

const steps = computed<DiagramStep[]>(() => [
  {
    id: 'step-canonical',
    title: isVi.value ? 'Băm Canonical & Khóa Tư vấn PG' : 'Canonical Hash & PG Advisory Lock',
    activeNodes: ['epod_source', 'crypto_ledger'],
    activeEdges: ['e2'],
    description: isVi.value
      ? 'Dữ liệu ePOD được chuẩn hóa bằng canonicalJson() để tính payloadHash, trong khi pg_advisory_xact_lock tuần tự hóa số thứ tự seq theo tổ chức.'
      : 'ePOD payloads are normalized via canonicalJson() into payloadHash while pg_advisory_xact_lock serializes per-org sequence numbers.',
    route: "pg_advisory_xact_lock(hashtext('latticedx:ledger:' || orgId))",
    payload: 'payloadHash = sha256Hex(canonicalJson(payload))',
    chips: ['Deterministic JSON', 'Serialized Appends'],
  },
  {
    id: 'step-sign',
    title: isVi.value ? 'Nối Chuỗi prevHash & Ký Ed25519' : 'Hash-Chaining & Ed25519 Signature',
    activeNodes: ['pki_keys', 'crypto_ledger'],
    activeEdges: ['e1', 'e3'],
    description: isVi.value
      ? 'Khóa riêng trong latticePkiKeys (bọc AES-256-GCM) ký "${orgId}|${seq}|${entryHash}" sau khi nối prevHash từ bản ghi liền trước.'
      : 'An AES-256-GCM-unwrapped key from latticePkiKeys signs "${orgId}|${seq}|${entryHash}" after chaining prevHash from seq - 1.',
    route: 'POST /api/dxosLedger:verify',
    payload: 'Ed25519.sign("${orgId}|${seq}|${entryHash}")',
    chips: ['LEDGER_IMMUTABLE', 'AES-256-GCM Wrap'],
  },
  {
    id: 'step-merkle',
    title: isVi.value ? 'Tính Gốc Cây Nhị phân Merkle' : 'Binary SHA-256 Merkle Root',
    activeNodes: ['crypto_ledger', 'merkle_root', 'dxos_ledger_api'],
    activeEdges: ['e4', 'e5', 'e6'],
    description: isVi.value
      ? 'Các entryHash được gộp thành cây SHA-256 nhị phân để kiểm chứng tập bằng chứng thông qua dxosLedger:status, dxosLedger:verify và dxosLedger:exportProof.'
      : 'Ordered entryHash leaves fold into a binary SHA-256 Merkle root exposed through dxosLedger:status, dxosLedger:verify, and dxosLedger:exportProof.',
    route: 'GET /api/dxosLedger:status | :verify | :exportProof',
    payload: 'sha256Hex("${left}${right}") · odd level duplicates rightmost',
    chips: ['Merkle Proof', 'Audit Export'],
  },
  {
    id: 'step-qr',
    title: isVi.value ? 'Nhúng Bằng chứng HMAC vào Mã QR' : 'HMAC ePOD QR Proof & Nonce CSP',
    activeNodes: ['epod_source', 'hmac_epod', 'public_track'],
    activeEdges: ['e7', 'e8'],
    description: isVi.value
      ? 'wms-engine tính qrVerificationHash bằng HMAC-SHA256 gắn liền ledgerSeq, hiển thị qua /v/track/:code với chính sách CSP nonce theo từng phản hồi.'
      : 'wms-engine computes qrVerificationHash with HMAC-SHA256 bound to ledgerSeq and serves /v/track/:code under per-response nonce CSP.',
    route: 'GET /api/dxosWms:publicTrack',
    payload: 'HMAC-SHA256("${org}|${trackingCode}|${epodUid}|${tokenHash}|${ledgerSeq}")',
    chips: ['HMAC-SHA256', 'Nonce CSP'],
  },
  {
    id: 'step-verify',
    title: isVi.value ? 'Đối chiếu Chữ ký Công khai QR' : 'Public QR & Ledger Cross-Check',
    activeNodes: ['public_track', 'verify_endpoint', 'dxos_ledger_api'],
    activeEdges: ['e9', 'e10'],
    description: isVi.value
      ? 'verifyTrackSignature xác nhận HMAC QR và đối chiếu chữ ký Ed25519 cùng liên kết chuỗi trên latticeCryptoLedger mà không làm lộ bí mật nội bộ.'
      : 'verifyTrackSignature validates the QR HMAC and cross-checks the referenced latticeCryptoLedger Ed25519 signature without exposing tenant secrets.',
    route: 'GET/POST /api/dxosWms:verifyTrackSignature',
    payload: 'qrVerificationHash === expected && ledgerEntry.verified === true',
    chips: ['Public Verifiable', 'Zero Secret Leak'],
  },
]);
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 920 444"
    :zones="zones"
    :nodes="nodes"
    :edges="edges"
    :steps="steps"
    :lang="resolvedLang"
  />
</template>
