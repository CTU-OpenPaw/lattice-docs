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

const props = defineProps<{
  lang?: DiagramLocale;
  compact?: boolean;
}>();

const vpData = inject(dataSymbol, null);

const locale = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const repoZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'org-repos',
          label: '4 Kho mã Nguồn mở CTU-OpenPaw (Apache-2.0)',
          x: 16,
          y: 12,
          width: 540,
          height: 224,
          kind: 'admin',
        },
        {
          id: 'external-boundary',
          label: 'Runtime Ngoài & Cổng Kiểm tra CI',
          x: 580,
          y: 12,
          width: 284,
          height: 224,
          kind: 'external',
        },
        {
          id: 'delivery-targets',
          label: 'Môi trường Triển khai, Tài liệu & Ranh giới Pure-OSI',
          x: 16,
          y: 260,
          width: 848,
          height: 120,
          kind: 'traffic',
        },
      ]
    : [
        {
          id: 'org-repos',
          label: 'CTU-OpenPaw Apache-2.0 Repositories',
          x: 16,
          y: 12,
          width: 540,
          height: 224,
          kind: 'admin',
        },
        {
          id: 'external-boundary',
          label: 'External Runtime & CI Verification Gates',
          x: 580,
          y: 12,
          width: 284,
          height: 224,
          kind: 'external',
        },
        {
          id: 'delivery-targets',
          label: 'Deployment Target, Docs Portal & Pure-OSI Boundary',
          x: 16,
          y: 260,
          width: 848,
          height: 120,
          kind: 'traffic',
        },
      ],
);

const repoNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'repo-core',
      title: 'lattice-dx',
      sub: 'v0.4.2 · 7 Plugins · Infra',
      icon: 'box',
      x: 36,
      y: 52,
      width: 224,
      height: 64,
      zoneId: 'org-repos',
      focal: true,
      inspector: isVi
        ? {
            role: 'Kho mã Nền tảng Lõi, 7 Plugin & Hạ tầng Compose',
            packageOrPort: 'CTU-OpenPaw/lattice-dx · v0.4.2',
            protocol: 'Git · pnpm Workspace · Docker Compose',
            payloadOrSchema: 'plugins/nocobase/* | infra/compose/prod.yml | apps/api',
            responsibilities:
              'Chứa 7 plugin Apache-2.0, cấu hình Zero-Trust Caddy/APISIX/Keycloak/PG16/IIoT, script sao lưu PITR và bộ kiểm định PoF.',
          }
        : {
            role: 'Core Platform Repository, 7 Plugins & Compose Infrastructure',
            packageOrPort: 'CTU-OpenPaw/lattice-dx · v0.4.2',
            protocol: 'Git · pnpm Workspace · Docker Compose',
            payloadOrSchema: 'plugins/nocobase/* | infra/compose/prod.yml | apps/api',
            responsibilities:
              'Maintains the 7 Apache-2.0 plugins, Zero-Trust infrastructure definitions, PITR recovery scripts, and OpenAPI/AsyncAPI specs.',
          },
    },
    {
      id: 'repo-docs',
      title: 'lattice-docs',
      sub: 'VitePress · VI/EN · SVG',
      icon: 'file-text',
      x: 312,
      y: 52,
      width: 224,
      height: 64,
      zoneId: 'org-repos',
      inspector: isVi
        ? {
            role: 'Cổng Tài liệu Kỹ thuật Song ngữ Việt – Anh',
            packageOrPort: 'CTU-OpenPaw/lattice-docs · VitePress 1.6.4',
            protocol: 'Static SSG · Vue 3 Interactive SVG · GitHub Pages',
            payloadOrSchema: 'docs/*.md (VI) | docs/en/*.md (EN) | .vitepress/theme/*',
            responsibilities:
              'Cung cấp tài liệu kiến trúc 9 phân mục, bộ sơ đồ SVG tương tác có thanh kiểm tra 5 trường và tham chiếu API đầy đủ.',
          }
        : {
            role: 'Bilingual Engineering Documentation Portal',
            packageOrPort: 'CTU-OpenPaw/lattice-docs · VitePress 1.6.4',
            protocol: 'Static SSG · Vue 3 Interactive SVG · GitHub Pages',
            payloadOrSchema: 'docs/*.md (VI) | docs/en/*.md (EN) | .vitepress/theme/*',
            responsibilities:
              'Publishes 9-section VI/EN engineering documentation, interactive SVG diagrams, and strict dead-link verified API references.',
          },
    },
    {
      id: 'repo-templates',
      title: 'lattice-templates',
      sub: '43 Artifacts · Bundle v3',
      icon: 'layers',
      x: 36,
      y: 152,
      width: 224,
      height: 64,
      zoneId: 'org-repos',
      inspector: isVi
        ? {
            role: 'Thư viện Gói Giải pháp, Quy trình & Bảng DMN',
            packageOrPort: 'CTU-OpenPaw/lattice-templates · 43 JSON artifacts',
            protocol: 'JSON Schema · Solution Bundle v3 · CLI Validator',
            payloadOrSchema: 'latticedx.solution-bundle/v3 | validate-templates.mjs',
            responsibilities:
              'Lưu trữ 8 blueprint LatticeFlow, 10 luồng n8n, 3 bảng DMN, 16 business pack, 4 biểu mẫu công khai và Bundle v3 khởi đầu.',
          }
        : {
            role: 'Solution Bundle v3, Workflow Blueprint & DMN Catalog',
            packageOrPort: 'CTU-OpenPaw/lattice-templates · 43 JSON artifacts',
            protocol: 'JSON Schema · Solution Bundle v3 · CLI Validator',
            payloadOrSchema: 'latticedx.solution-bundle/v3 | validate-templates.mjs',
            responsibilities:
              'Provides 8 LatticeFlow blueprints, 10 n8n workflows, 3 DMN tables, 16 business packs, 4 public forms, and starter v3 bundles.',
          },
    },
    {
      id: 'repo-github',
      title: '.github',
      sub: 'Org Profile · Security',
      icon: 'globe',
      x: 312,
      y: 152,
      width: 224,
      height: 64,
      zoneId: 'org-repos',
      inspector: isVi
        ? {
            role: 'Hồ sơ Tổ chức & Chính sách Quản trị Cộng đồng',
            packageOrPort: 'CTU-OpenPaw/.github · profile/README.md',
            protocol: 'GitHub Community Health · Security Policy',
            payloadOrSchema: 'SECURITY.md | CONTRIBUTING.md | CODE_OF_CONDUCT.md',
            responsibilities:
              'Điều phối hồ sơ công khai của tổ chức CTU-OpenPaw, quy trình báo cáo lỗ hổng bảo mật và chuẩn đóng góp mã nguồn mở.',
          }
        : {
            role: 'Organization Profile & Community Governance Repository',
            packageOrPort: 'CTU-OpenPaw/.github · profile/README.md',
            protocol: 'GitHub Community Health · Security Policy',
            payloadOrSchema: 'SECURITY.md | CONTRIBUTING.md | CODE_OF_CONDUCT.md',
            responsibilities:
              'Hosts the CTU-OpenPaw public profile, vulnerability disclosure policies, and shared repository governance defaults.',
          },
    },
    {
      id: 'ext-nocobase',
      title: 'NocoBase Runtime',
      sub: 'nocobase/nocobase:2.2.50',
      icon: 'server',
      x: 604,
      y: 52,
      width: 240,
      height: 64,
      zoneId: 'external-boundary',
      inspector: isVi
        ? {
            role: 'Container Host Độc lập ngoài Git',
            packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751...',
            protocol: 'OCI Image Digest · Read-Only Bind Mount (:ro)',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Chạy độc lập dưới dạng image OCI ghim digest SHA-256; không nhúng mã nguồn upstream vào kho Git hay gói phát hành.',
          }
        : {
            role: 'External Digest-Pinned Host OCI Container',
            packageOrPort: 'nocobase/nocobase:2.2.50@sha256:04b751...',
            protocol: 'OCI Image Digest · Read-Only Bind Mount (:ro)',
            payloadOrSchema: '/app/nocobase/node_modules/@latticedx/*',
            responsibilities:
              'Runs strictly as an external digest-pinned OCI container with zero upstream submodules or .gitmodules in Git.',
          },
    },
    {
      id: 'ext-ci',
      title: isVi ? 'Cổng Kiểm tra CI' : 'CI & Security Gates',
      sub: 'CodeQL · SPDX · CycloneDX',
      icon: 'shield',
      x: 604,
      y: 152,
      width: 240,
      height: 64,
      zoneId: 'external-boundary',
      inspector: isVi
        ? {
            role: 'Hệ thống Xác minh Tĩnh, SBOM và Kiểm tra Template',
            packageOrPort: 'GitHub Actions · Check · CodeQL · Validate',
            protocol: 'CycloneDX 1.5 · SPDX Apache-2.0 · pnpm audit',
            payloadOrSchema: 'docs/sbom-cyclonedx.json | source-headers.mjs | pof:check',
            responsibilities:
              'Kiểm tra header Apache-2.0, độ tươi mới của SBOM, phân tích bảo mật CodeQL và tính hợp lệ lược đồ template trước khi hợp nhất.',
          }
        : {
            role: 'Static Analysis, SBOM & Template Validation Pipeline',
            packageOrPort: 'GitHub Actions · Check · CodeQL · Validate',
            protocol: 'CycloneDX 1.5 · SPDX Apache-2.0 · pnpm audit',
            payloadOrSchema: 'docs/sbom-cyclonedx.json | source-headers.mjs | pof:check',
            responsibilities:
              'Verifies SPDX headers, CycloneDX SBOM freshness, CodeQL scans, production dependency audits, and template schemas.',
          },
    },
    {
      id: 'tgt-cluster',
      title: isVi ? 'Cụm DX-OS' : 'DX-OS Cluster',
      sub: 'Caddy · APISIX · PG16',
      icon: 'workflow',
      x: 36,
      y: 296,
      width: 240,
      height: 64,
      zoneId: 'delivery-targets',
      focal: true,
      inspector: isVi
        ? {
            role: 'Môi trường Vận hành Sản xuất 5 Mạng Cô lập',
            packageOrPort: 'infra/compose/prod.yml · 5 internal/edge networks',
            protocol: 'HTTPS · MQTT · NGSI-LD · OTLP',
            payloadOrSchema: 'edge | app | data | scanner | iiot-net',
            responsibilities:
              'Vận hành toàn bộ 6 mặt phẳng DX-OS với mật khẩu và digest ghim cứng, cơ sở dữ liệu phân quyền tối thiểu và sao lưu WAL.',
          }
        : {
            role: 'Production Runtime with 5 Segmented Networks',
            packageOrPort: 'infra/compose/prod.yml · 5 internal/edge networks',
            protocol: 'HTTPS · MQTT · NGSI-LD · OTLP',
            payloadOrSchema: 'edge | app | data | scanner | iiot-net',
            responsibilities:
              'Operates all 6 DX-OS planes with digest-pinned containers, non-superuser PostgreSQL roles, and WAL archiving.',
          },
    },
    {
      id: 'tgt-pages',
      title: 'GitHub Pages',
      sub: 'ctu-openpaw.github.io',
      icon: 'check-circle',
      x: 320,
      y: 296,
      width: 240,
      height: 64,
      zoneId: 'delivery-targets',
      inspector: isVi
        ? {
            role: 'Trang Tài liệu Tĩnh Song ngữ Công khai',
            packageOrPort: 'ctu-openpaw.github.io/lattice-docs/',
            protocol: 'HTTPS CDN · ignoreDeadLinks: false',
            payloadOrSchema: '/ (vi-VN) | /en/ (en-US)',
            responsibilities:
              'Phát hành tự động từ nhánh chính của lattice-docs với chỉ mục tìm kiếm cục bộ và kiểm tra liên kết chết nghiêm ngặt.',
          }
        : {
            role: 'Public Bilingual Documentation Deployment',
            packageOrPort: 'ctu-openpaw.github.io/lattice-docs/',
            protocol: 'HTTPS CDN · ignoreDeadLinks: false',
            payloadOrSchema: '/ (vi-VN) | /en/ (en-US)',
            responsibilities:
              'Built and deployed from lattice-docs with local search indexing and zero broken internal links across VI and EN locales.',
          },
    },
    {
      id: 'tgt-osi',
      title: isVi ? 'Ranh giới Pure-OSI' : 'Pure-OSI Boundary',
      sub: 'Apache-2.0 · Clause 5.2',
      icon: 'lock',
      x: 604,
      y: 296,
      width: 240,
      height: 64,
      zoneId: 'delivery-targets',
      inspector: isVi
        ? {
            role: 'Đảm bảo Tuân thủ Giấy phép Mở & Ghi nhận Nguồn',
            packageOrPort: 'Apache-2.0 · Valkey BSD-3-Clause · MIT',
            protocol: 'SPDX · NocoBase Clause 5.2 Attribution',
            payloadOrSchema: '0 BSL-1.1 | 0 AGPL | Powered by NocoBase v2.2.50',
            responsibilities:
              'Loại bỏ hoàn toàn phụ thuộc BSL-1.1/độc quyền, dùng Valkey 8.1 thay Redis bản quyền và giữ nguyên thông tin Điều 5.2.',
          }
        : {
            role: 'Open-Source License Hygiene & Attribution Guarantee',
            packageOrPort: 'Apache-2.0 · Valkey BSD-3-Clause · MIT',
            protocol: 'SPDX · NocoBase Clause 5.2 Attribution',
            payloadOrSchema: '0 BSL-1.1 | 0 AGPL | Powered by NocoBase v2.2.50',
            responsibilities:
              'Maintains zero BSL-1.1 or proprietary runtime dependencies while preserving NocoBase 2.2.50 Clause 5.2 attribution.',
          },
    },
  ];
});

const repoEdges = computed<DiagramEdge[]>(() => [
  {
    id: 're-core-nocobase',
    from: 'repo-core',
    to: 'ext-nocobase',
    label: 'Mount :ro',
    kind: 'primary',
    points: [
      [260, 72],
      [288, 72],
      [288, 36],
      [568, 36],
      [568, 72],
      [604, 72],
    ],
  },
  {
    id: 're-core-docs',
    from: 'repo-core',
    to: 'repo-docs',
    label: 'Spec',
    kind: 'flow',
    points: [
      [260, 92],
      [312, 92],
    ],
  },
  {
    id: 're-tpl-core',
    from: 'repo-templates',
    to: 'repo-core',
    label: 'Bundle v3',
    kind: 'primary',
    points: [
      [148, 152],
      [148, 116],
    ],
  },
  {
    id: 're-docs-pages',
    from: 'repo-docs',
    to: 'tgt-pages',
    kind: 'flow',
    points: [
      [424, 116],
      [424, 136],
      [552, 136],
      [552, 248],
      [440, 248],
      [440, 296],
    ],
  },
  {
    id: 're-nocobase-cluster',
    from: 'ext-nocobase',
    to: 'tgt-cluster',
    kind: 'primary',
    points: [
      [724, 116],
      [724, 136],
      [568, 136],
      [568, 248],
      [156, 248],
      [156, 296],
    ],
  },
  {
    id: 're-ci-osi',
    from: 'ext-ci',
    to: 'tgt-osi',
    label: 'Audit',
    kind: 'dashed',
    points: [
      [724, 216],
      [724, 296],
    ],
  },
  {
    id: 're-github-ci',
    from: 'repo-github',
    to: 'ext-ci',
    label: 'Policy',
    kind: 'dashed',
    points: [
      [536, 184],
      [604, 184],
    ],
  },
]);

const repoSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'es-1',
          title: 'Tách biệt Lõi & Runtime OCI',
          activeNodes: ['repo-core', 'ext-nocobase', 'tgt-cluster'],
          activeEdges: ['re-core-nocobase', 're-nocobase-cluster'],
          description:
            'lattice-dx chứa 7 plugin Apache-2.0 được gắn chỉ đọc vào image ngoài nocobase/nocobase:2.2.50 để vận hành cụm DX-OS.',
          route: 'plugins/nocobase/* -> /app/nocobase/node_modules/@latticedx/*',
          chips: ['sdkProvidedByHost: true', 'v0.4.2', 'SHA-256 Digest'],
        },
        {
          id: 'es-2',
          title: 'Đồng bộ Mẫu Solution Bundle v3',
          activeNodes: ['repo-templates', 'repo-core', 'tgt-cluster'],
          activeEdges: ['re-tpl-core'],
          description:
            'lattice-templates cung cấp 43 tài nguyên JSON (blueprint LatticeFlow, luồng n8n, bảng DMN, gói nghiệp vụ) nhập trực tiếp vào Control Studio.',
          route: 'POST /api/dxosStudio:solutionBundleImport',
          chips: ['43 JSON Artifacts', 'dryRun: true', 'Snapshot Rollback'],
        },
        {
          id: 'es-3',
          title: 'Tài liệu Song ngữ & Kiểm định Pure-OSI',
          activeNodes: ['repo-docs', 'repo-github', 'ext-ci', 'tgt-pages', 'tgt-osi'],
          activeEdges: ['re-core-docs', 're-docs-pages', 're-github-ci', 're-ci-osi'],
          description:
            'lattice-docs xuất bản cổng VitePress song ngữ lên GitHub Pages, trong khi CodeQL, SPDX và CycloneDX kiểm soát ranh giới Pure-OSI.',
          route: 'pnpm docs:build && pnpm pof:check',
          chips: ['ignoreDeadLinks: false', 'Apache-2.0', 'Clause 5.2'],
        },
      ]
    : [
        {
          id: 'es-1',
          title: 'Core Plugins & External OCI Host',
          activeNodes: ['repo-core', 'ext-nocobase', 'tgt-cluster'],
          activeEdges: ['re-core-nocobase', 're-nocobase-cluster'],
          description:
            'lattice-dx builds 7 Apache-2.0 plugins mounted read-only into external digest-pinned nocobase/nocobase:2.2.50 for the DX-OS cluster.',
          route: 'plugins/nocobase/* -> /app/nocobase/node_modules/@latticedx/*',
          chips: ['sdkProvidedByHost: true', 'v0.4.2', 'SHA-256 Digest'],
        },
        {
          id: 'es-2',
          title: 'GitOps Solution Bundle v3 Delivery',
          activeNodes: ['repo-templates', 'repo-core', 'tgt-cluster'],
          activeEdges: ['re-tpl-core'],
          description:
            'lattice-templates ships 43 validated JSON artifacts (LatticeFlow blueprints, n8n workflows, DMN tables, and business packs) into Control Studio.',
          route: 'POST /api/dxosStudio:solutionBundleImport',
          chips: ['43 JSON Artifacts', 'dryRun: true', 'Snapshot Rollback'],
        },
        {
          id: 'es-3',
          title: 'Bilingual Docs & Pure-OSI Governance',
          activeNodes: ['repo-docs', 'repo-github', 'ext-ci', 'tgt-pages', 'tgt-osi'],
          activeEdges: ['re-core-docs', 're-docs-pages', 're-github-ci', 're-ci-osi'],
          description:
            'lattice-docs builds bilingual VI/EN static docs to GitHub Pages while CodeQL, SPDX checks, and CycloneDX SBOM enforce Pure-OSI compliance.',
          route: 'pnpm docs:build && pnpm pof:check',
          chips: ['ignoreDeadLinks: false', 'Apache-2.0', 'Clause 5.2'],
        },
      ],
);

const gitopsZones = computed<DiagramZone[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'gz-source',
          label: 'Kho lattice-templates & Xác thực CI',
          x: 16,
          y: 12,
          width: 848,
          height: 124,
          kind: 'external',
        },
        {
          id: 'gz-runtime',
          label: 'Triển khai An toàn vào DX-OS Control Studio',
          x: 16,
          y: 160,
          width: 848,
          height: 132,
          kind: 'admin',
        },
      ]
    : [
        {
          id: 'gz-source',
          label: 'lattice-templates Source & CI Validation',
          x: 16,
          y: 12,
          width: 848,
          height: 124,
          kind: 'external',
        },
        {
          id: 'gz-runtime',
          label: 'Safe Dry-Run Import & Snapshot Rollback in Studio',
          x: 16,
          y: 160,
          width: 848,
          height: 132,
          kind: 'admin',
        },
      ],
);

const gitopsNodes = computed<DiagramNode[]>(() => {
  const isVi = locale.value === 'vi';
  return [
    {
      id: 'g-catalog',
      title: isVi ? 'Danh mục 43 Mẫu' : '43-Artifact Catalog',
      sub: '6 Categories · JSON',
      icon: 'layers',
      x: 40,
      y: 52,
      width: 216,
      height: 64,
      zoneId: 'gz-source',
      inspector: isVi
        ? {
            role: 'Kho chứa mẫu cấu hình phân nhóm theo 6 danh mục',
            packageOrPort: 'CTU-OpenPaw/lattice-templates',
            protocol: 'JSON Schema · Git Versioned',
            payloadOrSchema: 'latticeflow-blueprints | n8n-workflows | dmn-tables | business-packs',
            responsibilities:
              'Cung cấp các gói cấu hình tham chiếu chuẩn hóa cho kho lạnh, CMMS, ITSM, phê duyệt HITL và biểu mẫu công khai.',
          }
        : {
            role: 'Versioned Template Catalog Across 6 Categories',
            packageOrPort: 'CTU-OpenPaw/lattice-templates',
            protocol: 'JSON Schema · Git Versioned',
            payloadOrSchema: 'latticeflow-blueprints | n8n-workflows | dmn-tables | business-packs',
            responsibilities:
              'Stores validated templates for cold-chain logistics, CMMS, ITSM, HITL approvals, and public intake forms.',
          },
    },
    {
      id: 'g-validate',
      title: isVi ? 'Kiểm định CLI' : 'Validate CLI',
      sub: 'validate-templates.mjs',
      icon: 'check-circle',
      x: 332,
      y: 52,
      width: 216,
      height: 64,
      zoneId: 'gz-source',
      inspector: isVi
        ? {
            role: 'Cổng kiểm tra cấu trúc và an toàn trước phát hành',
            packageOrPort: 'scripts/validate-templates.mjs · npm run validate',
            protocol: 'Node.js CLI · GitHub Actions CI',
            payloadOrSchema: 'Schema check · No secrets · No admin wildcard',
            responsibilities:
              'Kiểm tra tính toàn vẹn JSON, khóa bí mật rò rỉ, quyền admin bị cấm và tham chiếu chéo giữa các gói.',
          }
        : {
            role: 'Pre-Merge Schema & Security Gate',
            packageOrPort: 'scripts/validate-templates.mjs · npm run validate',
            protocol: 'Node.js CLI · GitHub Actions CI',
            payloadOrSchema: 'Schema check · No secrets · No admin wildcard',
            responsibilities:
              'Rejects malformed schemas, leaked secret fields, disallowed admin role bindings, and broken cross-references.',
          },
    },
    {
      id: 'g-bundle',
      title: 'Solution Bundle v3',
      sub: 'contentSha256 · 8 Keys',
      icon: 'box',
      x: 624,
      y: 52,
      width: 216,
      height: 64,
      zoneId: 'gz-source',
      focal: true,
      inspector: isVi
        ? {
            role: 'Định dạng gói GitOps đồng nhất',
            packageOrPort: 'latticedx.solution-bundle/v3',
            protocol: 'Canonical JSON + SHA-256 Digest',
            payloadOrSchema: 'roles, portals, workflows, aiProfiles, customCollections, governance',
            responsibilities:
              'Đóng gói toàn bộ cấu hình tenant theo 8 khóa chuẩn hóa kèm băm contentSha256 để so sánh diff giữa các môi trường.',
          }
        : {
            role: 'Deterministic Multi-Artifact GitOps Package',
            packageOrPort: 'latticedx.solution-bundle/v3',
            protocol: 'Canonical JSON + SHA-256 Digest',
            payloadOrSchema: 'roles, portals, workflows, aiProfiles, customCollections, governance',
            responsibilities:
              'Packages 8 tenant configuration domains with contentSha256 digests for deterministic diffing across environments.',
          },
    },
    {
      id: 'g-import',
      title: isVi ? 'Nhập Dry-Run' : 'Studio Dry-Run',
      sub: 'dxosStudio:solutionBundleImport',
      icon: 'workflow',
      x: 624,
      y: 204,
      width: 216,
      height: 64,
      zoneId: 'gz-runtime',
      focal: true,
      inspector: isVi
        ? {
            role: 'Bộ nạp kiểm tra và loại bỏ khóa nhạy cảm',
            packageOrPort: '@latticedx/plugin-dxos-studio · solution-bundle.js',
            protocol: 'POST /api/dxosStudio:solutionBundleImport',
            payloadOrSchema: 'dryRun: true (default) | solutionBundleDiff',
            responsibilities:
              'Tự động loại bỏ khóa bí mật (SECRET_KEY_RE), chặn quyền root/ldx_admin và mô phỏng diff trước khi ghi vào DB.',
          }
        : {
            role: 'Sanitized Import & Diff Validation Engine',
            packageOrPort: '@latticedx/plugin-dxos-studio · solution-bundle.js',
            protocol: 'POST /api/dxosStudio:solutionBundleImport',
            payloadOrSchema: 'dryRun: true (default) | solutionBundleDiff',
            responsibilities:
              'Strips secret keys, blocks privileged role escalation, and computes an exact dry-run diff before applying changes.',
          },
    },
    {
      id: 'g-snapshot',
      title: isVi ? 'Ảnh chụp Khôi phục' : 'UI Snapshot Guard',
      sub: 'latticeUiSnapshots',
      icon: 'lock',
      x: 332,
      y: 204,
      width: 216,
      height: 64,
      zoneId: 'gz-runtime',
      inspector: isVi
        ? {
            role: 'Điểm khôi phục nguyên tử trước khi áp dụng gói',
            packageOrPort: 'latticeUiSnapshots · __gitops_bundle__',
            protocol: 'POST /api/dxosStudio:solutionBundleRollback',
            payloadOrSchema: 'portalSlug: __gitops_bundle__ · FORCE RLS',
            responsibilities:
              'Chụp trạng thái trước khi nhập gói để có thể hoàn tác toàn bộ cổng, khối, bảng và quy trình về phiên bản cũ.',
          }
        : {
            role: 'Atomic Pre-Import Snapshot & Rollback Store',
            packageOrPort: 'latticeUiSnapshots · __gitops_bundle__',
            protocol: 'POST /api/dxosStudio:solutionBundleRollback',
            payloadOrSchema: 'portalSlug: __gitops_bundle__ · FORCE RLS',
            responsibilities:
              'Captures pre-import portal and schema state so operators can revert newly created or modified artifacts atomically.',
          },
    },
    {
      id: 'g-live',
      title: isVi ? 'Cổng & Luồng Thực thi' : 'Live Portals & Flows',
      sub: '/p/* · Flow v2 · DMN',
      icon: 'server',
      x: 40,
      y: 204,
      width: 216,
      height: 64,
      zoneId: 'gz-runtime',
      inspector: isVi
        ? {
            role: 'Cổng người dùng và luật tự động hóa đang chạy',
            packageOrPort: 'NocoBase 2.2.50 · PG16 FORCE RLS',
            protocol: 'HTTPS · CloudEvents 1.0 · FEEL DMN',
            payloadOrSchema: 'latticeCustom* | latticeDecisionTables | latticeAutomationRules',
            responsibilities:
              'Kích hoạt các cổng /p/*, bảng tùy chỉnh có FORCE RLS, luật DMN và luồng LatticeFlow v2 ngay sau khi áp dụng gói.',
          }
        : {
            role: 'Active Multi-Portal Workspace & Automation Runtime',
            packageOrPort: 'NocoBase 2.2.50 · PG16 FORCE RLS',
            protocol: 'HTTPS · CloudEvents 1.0 · FEEL DMN',
            payloadOrSchema: 'latticeCustom* | latticeDecisionTables | latticeAutomationRules',
            responsibilities:
              'Activates role portals, RLS-protected custom collections, DMN tables, and LatticeFlow v2 rules in the target tenant.',
          },
    },
  ];
});

const gitopsEdges = computed<DiagramEdge[]>(() => [
  {
    id: 'ge-1',
    from: 'g-catalog',
    to: 'g-validate',
    label: 'Lint',
    kind: 'flow',
    points: [
      [256, 84],
      [332, 84],
    ],
  },
  {
    id: 'ge-2',
    from: 'g-validate',
    to: 'g-bundle',
    label: 'SHA-256',
    kind: 'flow',
    points: [
      [548, 84],
      [624, 84],
    ],
  },
  {
    id: 'ge-3',
    from: 'g-bundle',
    to: 'g-import',
    label: 'Import',
    kind: 'primary',
    points: [
      [732, 116],
      [732, 204],
    ],
  },
  {
    id: 'ge-4',
    from: 'g-import',
    to: 'g-snapshot',
    label: 'Snapshot',
    kind: 'primary',
    points: [
      [624, 236],
      [548, 236],
    ],
  },
  {
    id: 'ge-5',
    from: 'g-snapshot',
    to: 'g-live',
    label: 'Apply',
    kind: 'primary',
    points: [
      [332, 236],
      [256, 236],
    ],
  },
]);

const gitopsSteps = computed<DiagramStep[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'gs-1',
          title: 'Xác thực 43 Tài nguyên & Đóng gói v3',
          activeNodes: ['g-catalog', 'g-validate', 'g-bundle'],
          activeEdges: ['ge-1', 'ge-2'],
          description:
            'validate-templates.mjs kiểm tra lược đồ JSON và tính an toàn trước khi phát hành gói latticedx.solution-bundle/v3 có mã băm contentSha256.',
          route: 'npm run validate',
          chips: ['43 Artifacts', 'Bundle v3', 'SHA-256'],
        },
        {
          id: 'gs-2',
          title: 'Dry-Run & Chụp Ảnh khôi phục',
          activeNodes: ['g-bundle', 'g-import', 'g-snapshot'],
          activeEdges: ['ge-3', 'ge-4'],
          description:
            'dxosStudio:solutionBundleImport mặc định chạy dryRun: true, loại bỏ khóa bí mật và lưu bản chụp vào latticeUiSnapshots trước khi ghi.',
          route: 'POST /api/dxosStudio:solutionBundleImport',
          payload: '{ "dryRun": true, "bundle": { "metadata": { "schemaVersion": "latticedx.solution-bundle/v3" } } }',
          chips: ['dryRun: true', 'Sanitized', 'Rollback Ready'],
        },
        {
          id: 'gs-3',
          title: 'Kích hoạt Cổng & Bảng FORCE RLS',
          activeNodes: ['g-snapshot', 'g-live'],
          activeEdges: ['ge-5'],
          description:
            'Các cổng /p/*, bảng latticeCustom* có FORCE RLS, luật DMN và quy trình LatticeFlow v2 được kích hoạt đồng bộ cho tenant.',
          route: 'POST /api/dxosStudio:solutionBundleRollback',
          chips: ['FORCE RLS', 'DMN + Flow v2', 'Zero Downtime'],
        },
      ]
    : [
        {
          id: 'gs-1',
          title: 'CLI Validation & Bundle v3 Packaging',
          activeNodes: ['g-catalog', 'g-validate', 'g-bundle'],
          activeEdges: ['ge-1', 'ge-2'],
          description:
            'validate-templates.mjs verifies all 43 JSON templates before packaging a contentSha256-verified latticedx.solution-bundle/v3 payload.',
          route: 'npm run validate',
          chips: ['43 Artifacts', 'Bundle v3', 'SHA-256'],
        },
        {
          id: 'gs-2',
          title: 'Sanitized Dry-Run & Snapshot Capture',
          activeNodes: ['g-bundle', 'g-import', 'g-snapshot'],
          activeEdges: ['ge-3', 'ge-4'],
          description:
            'dxosStudio:solutionBundleImport defaults to dryRun: true, strips sensitive keys, and saves a pre-import snapshot in latticeUiSnapshots.',
          route: 'POST /api/dxosStudio:solutionBundleImport',
          payload: '{ "dryRun": true, "bundle": { "metadata": { "schemaVersion": "latticedx.solution-bundle/v3" } } }',
          chips: ['dryRun: true', 'Sanitized', 'Rollback Ready'],
        },
        {
          id: 'gs-3',
          title: 'Activate Tenant Portals & Automations',
          activeNodes: ['g-snapshot', 'g-live'],
          activeEdges: ['ge-5'],
          description:
            'Role portals, RLS-protected custom collections, DMN tables, and LatticeFlow v2 rules become active with atomic rollback support.',
          route: 'POST /api/dxosStudio:solutionBundleRollback',
          chips: ['FORCE RLS', 'DMN + Flow v2', 'Zero Downtime'],
        },
      ],
);

const modes = computed<DiagramMode[]>(() =>
  locale.value === 'vi'
    ? [
        {
          id: 'repos',
          label: 'Cấu trúc 4 Kho mã',
          summary: 'Apache-2.0 · Pure-OSI',
          zones: repoZones.value,
          nodes: repoNodes.value,
          edges: repoEdges.value,
          steps: repoSteps.value,
        },
        {
          id: 'gitops',
          label: 'Luồng GitOps Bundle v3',
          summary: 'lattice-templates -> Studio',
          zones: gitopsZones.value,
          nodes: gitopsNodes.value,
          edges: gitopsEdges.value,
          steps: gitopsSteps.value,
        },
      ]
    : [
        {
          id: 'repos',
          label: '4-Repo Topology',
          summary: 'Apache-2.0 · Pure-OSI',
          zones: repoZones.value,
          nodes: repoNodes.value,
          edges: repoEdges.value,
          steps: repoSteps.value,
        },
        {
          id: 'gitops',
          label: 'Solution Bundle v3 GitOps',
          summary: 'lattice-templates -> Studio',
          zones: gitopsZones.value,
          nodes: gitopsNodes.value,
          edges: gitopsEdges.value,
          steps: gitopsSteps.value,
        },
      ],
);

const titleText = computed(() =>
  locale.value === 'vi'
    ? 'Hệ sinh thái Nguồn mở CTU-OpenPaw'
    : 'CTU-OpenPaw Open-Source Ecosystem Topology',
);

const captionText = computed(() =>
  locale.value === 'vi'
    ? 'Bốn kho mã nguồn mở tách biệt hoàn toàn với container NocoBase ngoài nhằm bảo đảm tuân thủ Pure-OSI Apache-2.0.'
    : 'Four Apache-2.0 repositories cleanly isolated from the external NocoBase OCI runtime to maintain a Pure-OSI distribution boundary.',
);
</script>

<template>
  <DiagramCanvas
    :title="titleText"
    :caption="captionText"
    view-box="0 0 880 396"
    :modes="modes"
    :compact="props.compact"
    :lang="locale"
  />
</template>
