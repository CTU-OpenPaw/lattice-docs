<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol, withBase } from 'vitepress';
import StrokeIcon from './StrokeIcon.vue';
import CodeTabs from './CodeTabs.vue';
import PlatformPlanesDiagram from './PlatformPlanesDiagram.vue';
import type { DiagramLocale, IconName } from './diagramTypes';

interface QuickstartTab {
  label: string;
  lang?: string;
  code: string;
}

interface CapabilityCard {
  icon: IconName;
  title: string;
  description: string;
  link: string;
  linkLabel: string;
}

interface EcosystemRow {
  repo: string;
  repoUrl: string;
  role: string;
  license: string;
  docsUrl: string;
  docsLabel: string;
  external?: boolean;
}

const props = defineProps<{
  lang?: DiagramLocale;
}>();

const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

function resolveHref(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return vpData ? withBase(path) : path;
}

const content = computed(() => {
  if (resolvedLang.value === 'vi') {
    const quickstartTabs: QuickstartTab[] = [
      {
        label: 'Cài đặt sạch',
        lang: 'bash',
        code: [
          'git clone https://github.com/CTU-OpenPaw/lattice-dx.git',
          'cd lattice-dx && pnpm install --frozen-lockfile',
          'pnpm native:clean --port=13014 --blank-slate --keep',
        ].join('\n'),
      },
      {
        label: 'Compose Stack',
        lang: 'bash',
        code: [
          'cp infra/compose/prod.env.example .env',
          'docker compose -f infra/compose/prod.yml up -d',
        ].join('\n'),
      },
      {
        label: 'Kiểm tra',
        lang: 'bash',
        code: [
          'pnpm check && pnpm pof:check',
          'curl -fsS http://127.0.0.1:13014/api/dxos:health',
        ].join('\n'),
      },
    ];

    const capabilities: CapabilityCard[] = [
      {
        icon: 'layers',
        title: 'Kiến trúc 4 Tầng DX-OS',
        description:
          'Bảy plugin Apache-2.0 nạp qua sdkProvidedByHost lên host NocoBase 2.2.50, phân tách trên 5 vùng mạng Docker cô lập.',
        link: '/architecture/overview',
        linkLabel: 'Kiến trúc tổng thể',
      },
      {
        icon: 'shield',
        title: 'PostgreSQL 16 FORCE RLS',
        description:
          'Cô lập đa tenant theo giao dịch qua biến app.current_org trên 56 bảng tĩnh và bảng động latticeCustom* dưới role nocobase_app.',
        link: '/architecture/multi-tenancy-rls',
        linkLabel: 'Chính sách RLS',
      },
      {
        icon: 'workflow',
        title: 'LatticeFlow & Visual DMN',
        description:
          'Bộ thực thi DAG 24 loại node với loopCursor bền vững, bảng quyết định DMN FEEL và cầu nối Stock n8n REST v1.',
        link: '/automation/latticeflow-overview',
        linkLabel: 'Luồng tự động hóa',
      },
      {
        icon: 'bot',
        title: 'AI Studio & MCP / A2A',
        description:
          'Bảy hồ sơ tác nhân, 20 công cụ hợp nhất, App Builder, cổng MCP JSON-RPC 2.0, A2A và Hybrid RAG trên pgvector.',
        link: '/ai/overview-and-profiles',
        linkLabel: 'Tác nhân & tri thức',
      },
      {
        icon: 'radio',
        title: 'Bản sao số IIoT',
        description:
          'Đồng bộ hai chiều qua Mosquitto DynSec MQTT, FIWARE Orion-LD NGSI-LD outbox, tính toán MKT Arrhenius và Node-RED.',
        link: '/domains/iiot-digital-twin',
        linkLabel: 'Vận hành IIoT',
      },
      {
        icon: 'key',
        title: 'Sổ cái PKI Ed25519',
        description:
          'Chuỗi băm bất biến Merkle per-org, khóa API ldx_pat_* theo phạm vi và cổng xác thực QR ePOD công khai.',
        link: '/reference/pki-merkle-ledger',
        linkLabel: 'Đặc tả PKI Ledger',
      },
    ];

    const ecosystem: EcosystemRow[] = [
      {
        repo: 'CTU-OpenPaw/lattice-dx',
        repoUrl: 'https://github.com/CTU-OpenPaw/lattice-dx',
        role: 'Mã nguồn lõi DX-OS, 7 plugin NocoBase 2.2.50, Fastify API, worker, trình quét ClamAV và Docker Compose.',
        license: 'Apache-2.0',
        docsUrl: '/architecture/plugin-system',
        docsLabel: 'Hệ plugin',
      },
      {
        repo: 'CTU-OpenPaw/lattice-docs',
        repoUrl: 'https://github.com/CTU-OpenPaw/lattice-docs',
        role: 'Cổng tài liệu kỹ thuật song ngữ Tiếng Việt và English kèm sơ đồ tương tác và tham chiếu API.',
        license: 'Apache-2.0',
        docsUrl: '/getting-started/introduction',
        docsLabel: 'Giới thiệu',
      },
      {
        repo: 'CTU-OpenPaw/lattice-templates',
        repoUrl: 'https://github.com/CTU-OpenPaw/lattice-templates',
        role: 'Kho mẫu chuẩn hóa gồm blueprint LatticeFlow, bảng DMN, workflow n8n, Business Pack và Solution Bundle v3.',
        license: 'Apache-2.0',
        docsUrl: '/studio/solution-bundles',
        docsLabel: 'Solution Bundles',
      },
      {
        repo: 'CTU-OpenPaw/.github',
        repoUrl: 'https://github.com/CTU-OpenPaw',
        role: 'Hồ sơ tổ chức, chuẩn đóng góp, quy trình tiếp nhận lỗ hổng bảo mật và quản trị cộng đồng.',
        license: 'Apache-2.0',
        docsUrl: '/open-source/contributing-and-security',
        docsLabel: 'Quản trị',
      },
    ];

    return {
      eyebrow: 'Apache-2.0 · LatticeDX v0.4.2',
      title: 'Nền tảng Điều hành Doanh nghiệp Mở',
      summary:
        'Kiến trúc 4 tầng hợp nhất vận hành đa cổng, tự động hóa DAG và DMN, cô lập PostgreSQL 16 FORCE RLS, bản sao số IIoT và tác nhân AI có kiểm soát trên NocoBase 2.2.50.',
      primaryCta: 'Bắt đầu nhanh',
      primaryLink: '/getting-started/quickstart',
      secondaryCta: 'Kiến trúc hệ thống',
      secondaryLink: '/architecture/overview',
      heroDiagramNote: 'Nhấn vào từng phân hệ hoặc bước luồng để kiểm tra gói, cổng và trách nhiệm.',
      capabilitiesEyebrow: '01 · NĂNG LỰC CỐT LÕI',
      capabilitiesHeading: 'Các phân hệ kỹ thuật chính',
      ecosystemEyebrow: '02 · HỆ SINH THÁI',
      ecosystemHeading: 'Cấu trúc kho mã nguồn CTU-OpenPaw',
      tableHeaders: {
        repo: 'Kho mã nguồn',
        role: 'Vai trò kỹ thuật',
        license: 'Giấy phép',
        reference: 'Tài liệu',
      },
      attributionEyebrow: '03 · GHI CÔNG & GIẤY PHÉP',
      attributionTitle: 'Ranh giới Pure-OSI và Ghi công NocoBase 2.2.50',
      attributionBody:
        'Toàn bộ mã nguồn LatticeDX v0.4.2 phát hành theo giấy phép Apache-2.0, không chứa phụ thuộc BSL-1.1 hoặc AGPL. Hạ tầng host NocoBase 2.2.50 chạy dưới dạng OCI container độc lập và giữ nguyên ghi công Powered by NocoBase theo Điều 5.2.',
      attributionLinks: [
        { label: 'Chính sách cấp phép', href: '/open-source/licensing' },
        { label: 'Điều 5.2 & Thành phần bên thứ ba', href: '/open-source/third-party-and-nocobase' },
      ],
      quickstartTabs,
      capabilities,
      ecosystem,
    };
  }

  const quickstartTabs: QuickstartTab[] = [
    {
      label: 'Clean Install',
      lang: 'bash',
      code: [
        'git clone https://github.com/CTU-OpenPaw/lattice-dx.git',
        'cd lattice-dx && pnpm install --frozen-lockfile',
        'pnpm native:clean --port=13014 --blank-slate --keep',
      ].join('\n'),
    },
    {
      label: 'Compose Stack',
      lang: 'bash',
      code: [
        'cp infra/compose/prod.env.example .env',
        'docker compose -f infra/compose/prod.yml up -d',
      ].join('\n'),
    },
    {
      label: 'Verify',
      lang: 'bash',
      code: [
        'pnpm check && pnpm pof:check',
        'curl -fsS http://127.0.0.1:13014/api/dxos:health',
      ].join('\n'),
    },
  ];

  const capabilities: CapabilityCard[] = [
    {
      icon: 'layers',
      title: '4-Tier DX-OS Architecture',
      description:
        'Seven Apache-2.0 plugins mounted onto NocoBase 2.2.50 via sdkProvidedByHost across five isolated Compose networks.',
      link: '/en/architecture/overview',
      linkLabel: 'Architecture',
    },
    {
      icon: 'shield',
      title: 'Tenant FORCE RLS',
      description:
        'Transaction-local app.current_org isolation across 56 static tables and dynamic latticeCustom* tables under nocobase_app.',
      link: '/en/architecture/multi-tenancy-rls',
      linkLabel: 'RLS Isolation',
    },
    {
      icon: 'workflow',
      title: 'LatticeFlow & DMN',
      description:
        '24-node DAG execution engine with durable loopCursor HITL, Visual DMN FEEL tables, and optional Stock n8n REST v1 bridge.',
      link: '/en/automation/latticeflow-overview',
      linkLabel: 'Automation',
    },
    {
      icon: 'bot',
      title: 'AI Studio & MCP',
      description:
        'Seven agent profiles, 20 unified tools, App Builder lifecycle, JSON-RPC MCP gateway, A2A discovery, and pgvector RAG.',
      link: '/en/ai/overview-and-profiles',
      linkLabel: 'AI & Knowledge',
    },
    {
      icon: 'radio',
      title: 'IIoT Digital Twin',
      description:
        'Bidirectional telemetry across Mosquitto DynSec MQTT, FIWARE Orion-LD NGSI-LD outbox, Arrhenius MKT, and Node-RED.',
      link: '/en/domains/iiot-digital-twin',
      linkLabel: 'IIoT Twin',
    },
    {
      icon: 'key',
      title: 'Ed25519 PKI Ledger',
      description:
        'Per-organization hash-chained Merkle audit ledger, scoped ldx_pat_* API keys, and public QR ePOD verification.',
      link: '/en/reference/pki-merkle-ledger',
      linkLabel: 'PKI Reference',
    },
  ];

  const ecosystem: EcosystemRow[] = [
    {
      repo: 'CTU-OpenPaw/lattice-dx',
      repoUrl: 'https://github.com/CTU-OpenPaw/lattice-dx',
      role: 'Core DX-OS runtime, 7 NocoBase 2.2.50 plugins, Fastify API, worker, ClamAV scanner, and Compose stacks.',
      license: 'Apache-2.0',
      docsUrl: '/en/architecture/plugin-system',
      docsLabel: 'Plugin System',
    },
    {
      repo: 'CTU-OpenPaw/lattice-docs',
      repoUrl: 'https://github.com/CTU-OpenPaw/lattice-docs',
      role: 'Bilingual VitePress documentation portal (Vietnamese / and English /en/) with interactive architecture diagrams.',
      license: 'Apache-2.0',
      docsUrl: '/en/getting-started/introduction',
      docsLabel: 'Introduction',
    },
    {
      repo: 'CTU-OpenPaw/lattice-templates',
      repoUrl: 'https://github.com/CTU-OpenPaw/lattice-templates',
      role: 'Validated LatticeFlow blueprints, DMN tables, n8n workflows, Business Packs, Public Forms, and Solution Bundles v3.',
      license: 'Apache-2.0',
      docsUrl: '/en/studio/solution-bundles',
      docsLabel: 'Solution Bundles',
    },
    {
      repo: 'CTU-OpenPaw/.github',
      repoUrl: 'https://github.com/CTU-OpenPaw',
      role: 'Organization profile, contribution standards, security disclosure policy, and community governance.',
      license: 'Apache-2.0',
      docsUrl: '/en/open-source/contributing-and-security',
      docsLabel: 'Governance',
    },
  ];

  return {
    eyebrow: 'Apache-2.0 · LatticeDX v0.4.2',
    title: 'Open Enterprise Operating Platform',
    summary:
      'Four-tier architecture uniting multi-portal operations, DAG and DMN automation, PostgreSQL 16 FORCE RLS, IIoT digital twins, and governed AI agents on NocoBase 2.2.50.',
    primaryCta: 'Quickstart',
    primaryLink: '/en/getting-started/quickstart',
    secondaryCta: 'Architecture',
    secondaryLink: '/en/architecture/overview',
    heroDiagramNote: 'Select any tier module or flow step to inspect package bindings, ports, and boundaries.',
    capabilitiesEyebrow: '01 · CAPABILITIES',
    capabilitiesHeading: 'Core platform subsystems',
    ecosystemEyebrow: '02 · ECOSYSTEM',
    ecosystemHeading: 'CTU-OpenPaw repository topology',
    tableHeaders: {
      repo: 'Repository',
      role: 'Technical Role',
      license: 'License',
      reference: 'Reference',
    },
    attributionEyebrow: '03 · ATTRIBUTION & LICENSE',
    attributionTitle: 'Pure-OSI Boundary & NocoBase 2.2.50 Attribution',
    attributionBody:
      'LatticeDX v0.4.2 is distributed under the Apache-2.0 license with zero BSL-1.1 or AGPL dependencies. The external NocoBase 2.2.50 host runtime runs as an isolated OCI container preserving Powered by NocoBase attribution under Clause 5.2.',
    attributionLinks: [
      { label: 'Licensing Policy', href: '/en/open-source/licensing' },
      { label: 'Clause 5.2 & Third-Party', href: '/en/open-source/third-party-and-nocobase' },
    ],
    quickstartTabs,
    capabilities,
    ecosystem,
  };
});
</script>

<template>
  <div class="ldx-home">
    <section class="ldx-hero">
      <div class="ldx-hero-copy">
        <div class="ldx-eyebrow">
          <span class="ldx-eyebrow-dot" aria-hidden="true" />
          <span>{{ content.eyebrow }}</span>
        </div>

        <h1 class="ldx-hero-title">{{ content.title }}</h1>

        <p class="ldx-hero-summary">{{ content.summary }}</p>

        <div class="ldx-hero-actions">
          <a class="ldx-btn ldx-btn-primary" :href="resolveHref(content.primaryLink)">
            <span>{{ content.primaryCta }}</span>
            <span class="ldx-btn-arrow" aria-hidden="true">→</span>
          </a>
          <a class="ldx-btn ldx-btn-secondary" :href="resolveHref(content.secondaryLink)">
            <span>{{ content.secondaryCta }}</span>
          </a>
        </div>

        <div class="ldx-hero-code">
          <CodeTabs :tabs="content.quickstartTabs" :ui-lang="resolvedLang" />
        </div>
      </div>

      <div class="ldx-hero-diagram">
        <PlatformPlanesDiagram :lang="resolvedLang" compact />
        <p class="ldx-diagram-note">{{ content.heroDiagramNote }}</p>
      </div>
    </section>

    <section class="ldx-section">
      <div class="ldx-section-head">
        <span class="ldx-section-eyebrow">{{ content.capabilitiesEyebrow }}</span>
        <h2 class="ldx-section-title">{{ content.capabilitiesHeading }}</h2>
      </div>

      <div class="ldx-cap-grid">
        <a
          v-for="card in content.capabilities"
          :key="card.link"
          class="ldx-cap-card"
          :href="resolveHref(card.link)"
        >
          <div class="ldx-cap-top">
            <span class="ldx-cap-icon">
              <StrokeIcon :name="card.icon" :size="16" />
            </span>
            <h3 class="ldx-cap-title">{{ card.title }}</h3>
          </div>
          <p class="ldx-cap-desc">{{ card.description }}</p>
          <span class="ldx-cap-link">
            <span>{{ card.linkLabel }}</span>
            <span aria-hidden="true">→</span>
          </span>
        </a>
      </div>
    </section>

    <section class="ldx-section">
      <div class="ldx-section-head">
        <span class="ldx-section-eyebrow">{{ content.ecosystemEyebrow }}</span>
        <h2 class="ldx-section-title">{{ content.ecosystemHeading }}</h2>
      </div>

      <div class="ldx-table-wrap">
        <table class="ldx-eco-table">
          <thead>
            <tr>
              <th>{{ content.tableHeaders.repo }}</th>
              <th>{{ content.tableHeaders.role }}</th>
              <th>{{ content.tableHeaders.license }}</th>
              <th>{{ content.tableHeaders.reference }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in content.ecosystem" :key="row.repo">
              <td class="ldx-mono-cell">
                <a :href="row.repoUrl" target="_blank" rel="noopener">{{ row.repo }}</a>
              </td>
              <td>{{ row.role }}</td>
              <td class="ldx-mono-cell">
                <span class="ldx-license-chip">{{ row.license }}</span>
              </td>
              <td class="ldx-mono-cell">
                <a :href="resolveHref(row.docsUrl)">{{ row.docsLabel }} →</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="ldx-section ldx-section-last">
      <div class="ldx-attribution">
        <div class="ldx-attribution-copy">
          <span class="ldx-section-eyebrow">{{ content.attributionEyebrow }}</span>
          <h2 class="ldx-attribution-title">{{ content.attributionTitle }}</h2>
          <p class="ldx-attribution-body">{{ content.attributionBody }}</p>
        </div>
        <div class="ldx-attribution-links">
          <a
            v-for="item in content.attributionLinks"
            :key="item.href"
            class="ldx-btn ldx-btn-secondary"
            :href="resolveHref(item.href)"
          >
            {{ item.label }}
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ldx-home {
  max-width: 1280px;
  margin: 0 auto;
  padding: 36px 24px 16px;
}

.ldx-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 32px;
  align-items: start;
  padding-bottom: 48px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
}

@media (min-width: 1024px) {
  .ldx-hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 36px;
    padding-top: 12px;
  }
}

.ldx-hero-copy {
  min-width: 0;
}

.ldx-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: var(--ldx-surface-alt, #F2F0EA);
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ldx-ink-2, #44403C);
}

.ldx-eyebrow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--ldx-accent, #D94E1F);
}

.ldx-hero-title {
  margin: 18px 0 14px;
  max-width: 18ch;
  font-size: clamp(2.125rem, 4vw, 3rem);
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: -0.025em;
  color: var(--ldx-ink, #0C0A09);
}

.ldx-hero-summary {
  margin: 0 0 22px;
  max-width: 54ch;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--ldx-ink-2, #44403C);
}

.ldx-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.ldx-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.ldx-btn-primary {
  border: 1px solid var(--ldx-accent, #D94E1F);
  background-color: var(--ldx-accent, #D94E1F);
  color: var(--vp-button-brand-text, #FFFFFF);
}

.ldx-btn-primary:hover {
  border-color: var(--ldx-accent-text, #AF4204);
  background-color: var(--ldx-accent-text, #AF4204);
}

.ldx-btn-secondary {
  border: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface, #FFFFFF);
  color: var(--ldx-ink, #0C0A09);
}

.ldx-btn-secondary:hover {
  border-color: var(--ldx-border-strong, #D6D3D1);
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-btn-arrow {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
}

.ldx-hero-code :deep(.ldx-code-tabs) {
  margin: 0;
}

.ldx-hero-diagram {
  min-width: 0;
}

.ldx-diagram-note {
  margin: 8px 0 0;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ldx-muted, #78716C);
}

/* Below fold sections */
.ldx-section {
  padding: 44px 0;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
}

.ldx-section-last {
  border-bottom: 0;
  padding-bottom: 12px;
}

.ldx-section-head {
  margin-bottom: 24px;
}

.ldx-section-eyebrow {
  display: block;
  margin-bottom: 6px;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ldx-accent-text, #AF4204);
}

.ldx-section-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.015em;
  color: var(--ldx-ink, #0C0A09);
}

/* 2x3 Capabilities Grid */
.ldx-cap-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1023px) {
  .ldx-cap-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .ldx-cap-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.ldx-cap-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 6px;
  background-color: var(--ldx-surface, #FFFFFF);
  text-decoration: none;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.ldx-cap-card:hover {
  border-color: var(--ldx-border-strong, #D6D3D1);
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-cap-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.ldx-cap-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: var(--ldx-accent-soft, rgba(217, 78, 31, 0.1));
  color: var(--ldx-accent-text, #AF4204);
  flex-shrink: 0;
}

.ldx-cap-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--ldx-ink, #0C0A09);
}

.ldx-cap-desc {
  margin: 0 0 14px;
  flex: 1;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--ldx-ink-2, #44403C);
}

.ldx-cap-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--ldx-accent-text, #AF4204);
}

/* Ecosystem Table */
.ldx-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 6px;
  background-color: var(--ldx-surface, #FFFFFF);
}

.ldx-eco-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
}

.ldx-eco-table th {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: left;
  color: var(--ldx-ink, #0C0A09);
  white-space: nowrap;
}

.ldx-eco-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
  color: var(--ldx-ink-2, #44403C);
  vertical-align: top;
}

.ldx-eco-table tbody tr:last-child td {
  border-bottom: 0;
}

.ldx-mono-cell {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.ldx-mono-cell a {
  color: var(--ldx-accent-text, #AF4204);
  text-decoration: none;
  font-weight: 500;
}

.ldx-mono-cell a:hover {
  text-decoration: underline;
}

.ldx-license-chip {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: var(--ldx-surface-alt, #F2F0EA);
  color: var(--ldx-ink, #0C0A09);
  font-size: 0.75rem;
}

/* Attribution & License Notice */
.ldx-attribution {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 6px;
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-attribution-copy {
  max-width: 72ch;
}

.ldx-attribution-title {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--ldx-ink, #0C0A09);
}

.ldx-attribution-body {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--ldx-ink-2, #44403C);
}

.ldx-attribution-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
