/**
 * @file LatticeDX Docs — VitePress Site Configuration
 * @copyright (C) 2026 CTU-OpenPaw
 * @license Apache-2.0
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitepress';

export default defineConfig({
  srcDir: 'docs',
  outDir: '.vitepress/dist',
  base: '/lattice-docs/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/lattice-docs/images/favicon.svg' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/lattice-docs/images/favicon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'LatticeDX Docs' }],
    ['meta', { property: 'og:title', content: 'LatticeDX Docs — v0.4.2' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Technical documentation for LatticeDX v0.4.2 — Open Enterprise Operating Platform (Apache-2.0)',
      },
    ],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://ctu-openpaw.github.io/lattice-docs/images/openpaw-logo.png',
      },
    ],
    ['meta', { name: 'theme-color', content: '#D94E1F' }],
  ],

  themeConfig: {
    logo: '/images/openpaw-logo.png',
    siteTitle: 'LatticeDX',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CTU-OpenPaw/lattice-docs' },
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Tìm kiếm',
                buttonAriaLabel: 'Tìm kiếm',
              },
              modal: {
                noResultsText: 'Không tìm thấy kết quả cho',
                resetButtonTitle: 'Xóa bộ lọc',
                footer: {
                  selectText: 'để chọn',
                  navigateText: 'để di chuyển',
                  closeText: 'để đóng',
                },
              },
            },
          },
          en: {
            translations: {
              button: {
                buttonText: 'Search',
                buttonAriaLabel: 'Search',
              },
              modal: {
                noResultsText: 'No results for',
                resetButtonTitle: 'Reset',
                footer: {
                  selectText: 'to select',
                  navigateText: 'to navigate',
                  closeText: 'to close',
                },
              },
            },
          },
        },
      },
    },
  },

  locales: {
    root: {
      label: 'Tiếng Việt',
      lang: 'vi-VN',
      title: 'LatticeDX Docs',
      description:
        'Tài liệu kỹ thuật LatticeDX v0.4.2 — Nền tảng Điều hành Doanh nghiệp Mở Apache-2.0',
      themeConfig: {
        editLink: {
          pattern: 'https://github.com/CTU-OpenPaw/lattice-docs/edit/main/docs/:path',
          text: 'Chỉnh sửa trang này trên GitHub',
        },
        docFooter: {
          prev: 'Trang trước',
          next: 'Trang tiếp',
        },
        outline: {
          label: 'Mục lục trang',
          level: [2, 3],
        },
        lastUpdated: {
          text: 'Cập nhật lần cuối',
        },
        returnToTopLabel: 'Về đầu trang',
        sidebarMenuLabel: 'Danh mục',
        darkModeSwitchLabel: 'Giao diện',
        langMenuLabel: 'Ngôn ngữ',
        footer: {
          message:
            'Apache-2.0 · LatticeDX v0.4.2 · Powered by <a href="https://www.nocobase.com" target="_blank" rel="noopener">NocoBase</a> · v2.2.50 · Apache-2.0 (Clause 5.2)',
          copyright: 'Copyright © 2026 CTU-OpenPaw',
        },
        nav: [
          {
            text: 'Bắt đầu',
            link: '/getting-started/introduction',
            activeMatch: '^/getting-started/',
          },
          {
            text: 'Kiến trúc',
            link: '/architecture/overview',
            activeMatch: '^/architecture/',
          },
          {
            text: 'Studio & Flow',
            link: '/studio/multi-portal',
            activeMatch: '^/(studio|automation)/',
          },
          {
            text: 'AI & IIoT',
            link: '/ai/overview-and-profiles',
            activeMatch: '^/(ai|domains)/',
          },
          {
            text: 'API & Vận hành',
            link: '/reference/rest-api',
            activeMatch: '^/(reference|operations|open-source)/',
          },
          { text: 'lattice-dx ↗', link: 'https://github.com/CTU-OpenPaw/lattice-dx' },
        ],
        sidebar: [
          {
            text: '1. Bắt đầu',
            collapsed: false,
            items: [
              { text: 'Giới thiệu LatticeDX', link: '/getting-started/introduction' },
              { text: 'Cài đặt nhanh', link: '/getting-started/quickstart' },
              { text: 'Hồ sơ triển khai Compose', link: '/getting-started/installation-profiles' },
              { text: 'Cấu hình biến môi trường', link: '/getting-started/configuration' },
              { text: 'Triển khai Production Zero-Trust', link: '/getting-started/production-deployment' },
              { text: 'Quy trình nâng cấp', link: '/getting-started/upgrading' },
            ],
          },
          {
            text: '2. Kiến trúc cốt lõi',
            collapsed: false,
            items: [
              { text: 'Tổng quan Kiến trúc 4 Tầng', link: '/architecture/overview' },
              { text: 'Hệ thống 7 Plugin Apache-2.0', link: '/architecture/plugin-system' },
              { text: 'Đa tenant & PostgreSQL FORCE RLS', link: '/architecture/multi-tenancy-rls' },
              { text: 'Mô hình dữ liệu & Công thức AST', link: '/architecture/data-model' },
              { text: 'CloudEvents 1.0 & Outbox', link: '/architecture/events-and-outbox' },
              { text: 'Mô hình bảo mật Zero-Trust', link: '/architecture/security-model' },
            ],
          },
          {
            text: '3. Studio & Ứng dụng',
            collapsed: true,
            items: [
              { text: 'Cổng đa vai trò (Multi-Portal)', link: '/studio/multi-portal' },
              { text: '12 Native v2 BlockModels', link: '/studio/native-blocks' },
              { text: 'Biểu mẫu công khai (/v/form)', link: '/studio/public-forms' },
              { text: 'Mobile Field PWA (/v/mobile)', link: '/studio/mobile-pwa' },
              { text: 'Bảng tùy biến & Công thức AST', link: '/studio/custom-collections-formulas' },
              { text: 'Solution Bundles v3 (GitOps)', link: '/studio/solution-bundles' },
            ],
          },
          {
            text: '4. Tự động hóa & Quyết định',
            collapsed: true,
            items: [
              { text: 'Tổng quan LatticeFlow v2', link: '/automation/latticeflow-overview' },
              { text: 'Tham chiếu 24 loại Node', link: '/automation/node-reference' },
              { text: 'Biểu thức, Vòng lặp & HITL', link: '/automation/expressions-and-control-flow' },
              { text: 'Visual DMN & FEEL', link: '/automation/visual-dmn' },
              { text: 'Tích hợp Stock n8n', link: '/automation/n8n-integration' },
              { text: 'Webhooks & Lịch định kỳ', link: '/automation/webhooks-and-schedules' },
            ],
          },
          {
            text: '5. AI Studio, Agents & Tri thức',
            collapsed: true,
            items: [
              { text: 'Kiến trúc AI & 7 Hồ sơ Tác nhân', link: '/ai/overview-and-profiles' },
              { text: 'App Builder 2.0', link: '/ai/app-builder' },
              { text: '20 Công cụ hợp nhất (Unified Tools)', link: '/ai/unified-tools' },
              { text: 'MCP Gateway (JSON-RPC 2.0)', link: '/ai/mcp-gateway' },
              { text: 'Giao thức A2A', link: '/ai/a2a-protocol' },
              { text: 'Kho tri thức P.A.R.A. & Hybrid RAG', link: '/ai/para-knowledge-rag' },
              { text: 'Eval Lab & Rào chắn an toàn', link: '/ai/eval-and-guardrails' },
            ],
          },
          {
            text: '6. Nghiệp vụ Miền & IIoT',
            collapsed: true,
            items: [
              { text: 'Chuỗi lạnh OMS, WMS & FEFO', link: '/domains/cold-chain-oms-wms' },
              { text: 'ePOD & Xác thực QR Ed25519', link: '/domains/epod-and-qr-verification' },
              { text: 'Phê duyệt M-of-N & Ủy quyền', link: '/domains/approvals-and-delegations' },
              { text: 'Thông báo đa kênh (dxosNotify)', link: '/domains/notifications' },
              { text: 'Bản sao số IIoT & Arrhenius MKT', link: '/domains/iiot-digital-twin' },
            ],
          },
          {
            text: '7. Tham chiếu API & Nhà phát triển',
            collapsed: true,
            items: [
              { text: 'Quy ước REST Resource/Action', link: '/reference/rest-api' },
              { text: 'Khóa API theo phạm vi (ldx_pat_*)', link: '/reference/api-keys' },
              { text: 'OpenAPI 3.1 & AsyncAPI 3.0', link: '/reference/openapi-asyncapi' },
              { text: 'Sổ cái PKI Ed25519 & Merkle', link: '/reference/pki-merkle-ledger' },
              { text: 'Plugin SDK & Vòng đời nạp', link: '/reference/plugin-sdk' },
            ],
          },
          {
            text: '8. Vận hành & Độ tin cậy',
            collapsed: true,
            items: [
              { text: 'Observability (OTel, Prometheus, Grafana)', link: '/operations/observability' },
              { text: 'Sao lưu PostgreSQL & PITR WAL', link: '/operations/backup-and-pitr' },
              { text: 'Kiểm thử & Xác minh hệ thống', link: '/operations/testing-and-verification' },
              { text: 'Xử lý sự cố vận hành', link: '/operations/troubleshooting' },
            ],
          },
          {
            text: '9. Mã nguồn mở & Quản trị',
            collapsed: true,
            items: [
              { text: 'Giấy phép Apache-2.0 & Pure-OSI', link: '/open-source/licensing' },
              { text: 'NocoBase 2.2.50 (Điều 5.2) & Bên thứ ba', link: '/open-source/third-party-and-nocobase' },
              { text: 'CycloneDX SBOM & Build từ mã nguồn', link: '/open-source/sbom-and-source-build' },
              { text: 'Đóng góp & Chính sách bảo mật', link: '/open-source/contributing-and-security' },
            ],
          },
        ],
      },
    },

    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'LatticeDX Docs',
      description:
        'Technical documentation for LatticeDX v0.4.2 — Open Enterprise Operating Platform (Apache-2.0)',
      themeConfig: {
        editLink: {
          pattern: 'https://github.com/CTU-OpenPaw/lattice-docs/edit/main/docs/:path',
          text: 'Edit this page on GitHub',
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        outline: {
          label: 'On this page',
          level: [2, 3],
        },
        lastUpdated: {
          text: 'Last updated',
        },
        footer: {
          message:
            'Apache-2.0 · LatticeDX v0.4.2 · Powered by <a href="https://www.nocobase.com" target="_blank" rel="noopener">NocoBase</a> · v2.2.50 · Apache-2.0 (Clause 5.2)',
          copyright: 'Copyright © 2026 CTU-OpenPaw',
        },
        nav: [
          {
            text: 'Getting Started',
            link: '/en/getting-started/introduction',
            activeMatch: '^/en/getting-started/',
          },
          {
            text: 'Architecture',
            link: '/en/architecture/overview',
            activeMatch: '^/en/architecture/',
          },
          {
            text: 'Studio & Flow',
            link: '/en/studio/multi-portal',
            activeMatch: '^/en/(studio|automation)/',
          },
          {
            text: 'AI & IIoT',
            link: '/en/ai/overview-and-profiles',
            activeMatch: '^/en/(ai|domains)/',
          },
          {
            text: 'API & Ops',
            link: '/en/reference/rest-api',
            activeMatch: '^/en/(reference|operations|open-source)/',
          },
          { text: 'lattice-dx ↗', link: 'https://github.com/CTU-OpenPaw/lattice-dx' },
        ],
        sidebar: [
          {
            text: '1. Getting Started',
            collapsed: false,
            items: [
              { text: 'Introduction', link: '/en/getting-started/introduction' },
              { text: 'Quickstart', link: '/en/getting-started/quickstart' },
              { text: 'Installation Profiles', link: '/en/getting-started/installation-profiles' },
              { text: 'Configuration Reference', link: '/en/getting-started/configuration' },
              { text: 'Production Deployment', link: '/en/getting-started/production-deployment' },
              { text: 'Upgrading', link: '/en/getting-started/upgrading' },
            ],
          },
          {
            text: '2. Core Architecture & Concepts',
            collapsed: false,
            items: [
              { text: '4-Tier Architecture Overview', link: '/en/architecture/overview' },
              { text: 'Plugin System', link: '/en/architecture/plugin-system' },
              { text: 'Multi-Tenancy & FORCE RLS', link: '/en/architecture/multi-tenancy-rls' },
              { text: 'Data Model & AST Formulas', link: '/en/architecture/data-model' },
              { text: 'Events & Transactional Outbox', link: '/en/architecture/events-and-outbox' },
              { text: 'Zero-Trust Security Model', link: '/en/architecture/security-model' },
            ],
          },
          {
            text: '3. Studio & Applications',
            collapsed: true,
            items: [
              { text: 'Multi-Portal Routing', link: '/en/studio/multi-portal' },
              { text: '12 Native v2 BlockModels', link: '/en/studio/native-blocks' },
              { text: 'Public Forms (/v/form)', link: '/en/studio/public-forms' },
              { text: 'Mobile Field PWA (/v/mobile)', link: '/en/studio/mobile-pwa' },
              { text: 'Custom Collections & Formulas', link: '/en/studio/custom-collections-formulas' },
              { text: 'Solution Bundles v3', link: '/en/studio/solution-bundles' },
            ],
          },
          {
            text: '4. Workflow & Decision Automation',
            collapsed: true,
            items: [
              { text: 'LatticeFlow v2 Overview', link: '/en/automation/latticeflow-overview' },
              { text: '24-Node Reference', link: '/en/automation/node-reference' },
              { text: 'Expressions, Loops & HITL', link: '/en/automation/expressions-and-control-flow' },
              { text: 'Visual DMN & FEEL', link: '/en/automation/visual-dmn' },
              { text: 'Stock n8n Integration', link: '/en/automation/n8n-integration' },
              { text: 'Webhooks & Schedules', link: '/en/automation/webhooks-and-schedules' },
            ],
          },
          {
            text: '5. AI Studio, Agents & Knowledge',
            collapsed: true,
            items: [
              { text: 'AI Overview & 7 Agent Profiles', link: '/en/ai/overview-and-profiles' },
              { text: 'App Builder 2.0', link: '/en/ai/app-builder' },
              { text: '20 Unified Tools', link: '/en/ai/unified-tools' },
              { text: 'MCP Gateway (JSON-RPC 2.0)', link: '/en/ai/mcp-gateway' },
              { text: 'A2A Protocol', link: '/en/ai/a2a-protocol' },
              { text: 'P.A.R.A. Knowledge & Hybrid RAG', link: '/en/ai/para-knowledge-rag' },
              { text: 'Eval Lab & Guardrails', link: '/en/ai/eval-and-guardrails' },
            ],
          },
          {
            text: '6. Domain Operations & IIoT',
            collapsed: true,
            items: [
              { text: 'Cold-Chain OMS, WMS & FEFO', link: '/en/domains/cold-chain-oms-wms' },
              { text: 'ePOD & QR Verification', link: '/en/domains/epod-and-qr-verification' },
              { text: 'Approvals & Delegations', link: '/en/domains/approvals-and-delegations' },
              { text: 'Omnichannel Notifications', link: '/en/domains/notifications' },
              { text: 'IIoT Digital Twin & MKT', link: '/en/domains/iiot-digital-twin' },
            ],
          },
          {
            text: '7. API & Developer Reference',
            collapsed: true,
            items: [
              { text: 'REST Resource/Action API', link: '/en/reference/rest-api' },
              { text: 'Scoped API Keys (ldx_pat_*)', link: '/en/reference/api-keys' },
              { text: 'OpenAPI 3.1 & AsyncAPI 3.0', link: '/en/reference/openapi-asyncapi' },
              { text: 'Ed25519 & Merkle PKI Ledger', link: '/en/reference/pki-merkle-ledger' },
              { text: 'Plugin SDK', link: '/en/reference/plugin-sdk' },
            ],
          },
          {
            text: '8. Operations & Reliability',
            collapsed: true,
            items: [
              { text: 'Observability (OTel, Prometheus, Grafana)', link: '/en/operations/observability' },
              { text: 'Backups & PostgreSQL PITR', link: '/en/operations/backup-and-pitr' },
              { text: 'Testing & Verification', link: '/en/operations/testing-and-verification' },
              { text: 'Troubleshooting Playbooks', link: '/en/operations/troubleshooting' },
            ],
          },
          {
            text: '9. Open Source & Governance',
            collapsed: true,
            items: [
              { text: 'Licensing & Pure-OSI Policy', link: '/en/open-source/licensing' },
              { text: 'NocoBase 2.2.50 (Clause 5.2) & Third-Party', link: '/en/open-source/third-party-and-nocobase' },
              { text: 'CycloneDX SBOM & Source Build', link: '/en/open-source/sbom-and-source-build' },
              { text: 'Contributing & Security', link: '/en/open-source/contributing-and-security' },
            ],
          },
        ],
      },
    },
  },
});
