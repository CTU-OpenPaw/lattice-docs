/**
 * @file LatticeDX Docs — VitePress Site Configuration
 * @copyright (C) 2026 CTU-OpenPaw
 * @license Apache-2.0
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    srcDir: 'docs',
    outDir: '.vitepress/dist',
    base: '/lattice-docs/',
    cleanUrls: true,
    lastUpdated: true,

    vite: {
      optimizeDeps: {
        include: ['mermaid'],
      },
      ssr: {
        noExternal: ['vitepress-plugin-mermaid'],
      },
    },

    head: [
      ['link', { rel: 'icon', type: 'image/png', href: '/lattice-docs/images/favicon.png' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: 'LatticeDX Docs — v0.4.2' }],
      [
        'meta',
        {
          property: 'og:description',
          content:
            'Official Technical Documentation for LatticeDX v0.4.2 — Pure-OSI Open Enterprise Operating Platform (Apache-2.0)',
        },
      ],
      ['meta', { name: 'theme-color', content: '#ea580c' }],
    ],

    themeConfig: {
      logo: '/images/openpaw-logo.png',
      siteTitle: 'LatticeDX Docs',

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
          'Tài liệu kỹ thuật chính thức LatticeDX v0.4.2 — Nền tảng Số Doanh nghiệp Mở Pure-OSI',
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
              'Phát hành theo giấy phép Pure-OSI <strong>Apache-2.0</strong> (v0.4.2) · Powered by <a href="https://www.nocobase.com" target="_blank" rel="noopener">NocoBase 2.2.50</a> (Clause 5.2 Attribution).',
            copyright: 'Copyright © 2026 CTU-OpenPaw',
          },
          nav: [
            { text: 'Tổng quan', link: '/guide/what-is-latticedx', activeMatch: '^/guide/' },
            {
              text: 'Bắt đầu',
              link: '/getting-started/requirements',
              activeMatch: '^/getting-started/',
            },
            { text: 'Phân hệ', link: '/modules/multi-portal-blocks', activeMatch: '^/modules/' },
            {
              text: 'Bảo mật & API',
              link: '/security/multi-tenant-rls',
              activeMatch: '^/security/',
            },
            { text: 'Vận hành', link: '/operations/observability', activeMatch: '^/operations/' },
            { text: 'Nguồn mở (OSI)', link: '/oss/pure-osi-policy', activeMatch: '^/oss/' },
            { text: 'lattice-dx ↗', link: 'https://github.com/CTU-OpenPaw/lattice-dx' },
          ],
          sidebar: [
            {
              text: '1. Tổng quan & Kiến trúc',
              collapsed: false,
              items: [
                { text: 'LatticeDX là gì?', link: '/guide/what-is-latticedx' },
                { text: 'Kiến trúc 6 lớp (6-Plane)', link: '/guide/architecture' },
                { text: '7 Plugin Apache-2.0 & Modularity', link: '/guide/plugins-modularity' },
                { text: 'Công nghệ & Ranh giới Pure-OSI', link: '/guide/tech-stack-and-osi' },
              ],
            },
            {
              text: '2. Bắt đầu & Triển khai',
              collapsed: false,
              items: [
                { text: 'Yêu cầu hệ thống', link: '/getting-started/requirements' },
                { text: 'Cài đặt nhanh (1 lệnh)', link: '/getting-started/quick-start' },
                {
                  text: 'Triển khai Production Zero-Trust',
                  link: '/getting-started/production-deployment',
                },
                { text: 'Cấu hình môi trường', link: '/getting-started/configuration' },
              ],
            },
            {
              text: '3. Phân hệ & Tính năng cốt lõi',
              collapsed: false,
              items: [
                { text: 'Multi-Portal & 12 BlockModels v2', link: '/modules/multi-portal-blocks' },
                { text: 'OMS / WMS / FEFO / ePOD & Ed25519', link: '/modules/oms-wms-fefo-epod' },
                { text: 'LatticeFlow v2 DAG Engine', link: '/modules/latticeflow-v2' },
                { text: 'Visual DMN Decision Engine', link: '/modules/visual-dmn' },
                { text: 'DX-OS AI Studio & App Builder 2.0', link: '/modules/ai-studio-app-builder' },
                { text: 'P.A.R.A. Knowledge Vault & OCR RAG', link: '/modules/para-knowledge-ocr' },
                {
                  text: 'Approvals, Notify, Forms & Mobile PWA',
                  link: '/modules/approvals-notify-forms-pwa',
                },
                { text: 'IIoT, Digital Twin 2 chiều & n8n', link: '/modules/iiot-digital-twin-n8n' },
              ],
            },
            {
              text: '4. Bảo mật, Đa thuê bao & API',
              collapsed: false,
              items: [
                { text: 'Multi-Tenant PostgreSQL FORCE RLS', link: '/security/multi-tenant-rls' },
                { text: 'PKI Ledger (Ed25519/Merkle) & API Keys', link: '/security/pki-ledger-api-keys' },
                { text: 'Xác thực OIDC/PKCE & Hardening', link: '/security/auth-oidc-hardening' },
                { text: 'API Contracts (OpenAPI & AsyncAPI)', link: '/security/api-contracts' },
              ],
            },
            {
              text: '5. Vận hành, Kiểm thử & DR',
              collapsed: false,
              items: [
                { text: 'Observability (OTel, Prometheus, Grafana)', link: '/operations/observability' },
                { text: 'Sao lưu, PITR WAL & Phục hồi DR', link: '/operations/backup-pitr-dr' },
                { text: 'Hướng dẫn Kiểm thử E2E', link: '/operations/testing-e2e-guide' },
                {
                  text: 'Demo Pack, Kịch bản 15p & Sự cố',
                  link: '/operations/demo-pack-troubleshooting',
                },
              ],
            },
            {
              text: '6. Quản trị Nguồn mở & PoF',
              collapsed: false,
              items: [
                { text: 'Chính sách Pure-OSI & Apache-2.0', link: '/oss/pure-osi-policy' },
                { text: 'Ghi công NocoBase 2.2.50 (Clause 5.2)', link: '/oss/nocobase-clause-5-2' },
                { text: 'CycloneDX SBOM & Build-from-Source', link: '/oss/sbom-and-build-from-source' },
                {
                  text: 'Đóng góp, Bảo mật & Changelog (<1.0.0)',
                  link: '/oss/contributing-security-changelog',
                },
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
          'Official Technical Documentation for LatticeDX v0.4.2 — Pure-OSI Open Enterprise Operating Platform',
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
              'Released under Pure-OSI <strong>Apache-2.0</strong> (v0.4.2) · Powered by <a href="https://www.nocobase.com" target="_blank" rel="noopener">NocoBase 2.2.50</a> (Clause 5.2 Attribution).',
            copyright: 'Copyright © 2026 CTU-OpenPaw',
          },
          nav: [
            { text: 'Guide', link: '/en/guide/what-is-latticedx', activeMatch: '^/en/guide/' },
            {
              text: 'Getting Started',
              link: '/en/getting-started/requirements',
              activeMatch: '^/en/getting-started/',
            },
            { text: 'Modules', link: '/en/modules/multi-portal-blocks', activeMatch: '^/en/modules/' },
            {
              text: 'Security & API',
              link: '/en/security/multi-tenant-rls',
              activeMatch: '^/en/security/',
            },
            {
              text: 'Operations',
              link: '/en/operations/observability',
              activeMatch: '^/en/operations/',
            },
            { text: 'Open Source (OSI)', link: '/en/oss/pure-osi-policy', activeMatch: '^/en/oss/' },
            { text: 'lattice-dx ↗', link: 'https://github.com/CTU-OpenPaw/lattice-dx' },
          ],
          sidebar: [
            {
              text: '1. Overview & Architecture',
              collapsed: false,
              items: [
                { text: 'What is LatticeDX?', link: '/en/guide/what-is-latticedx' },
                { text: '6-Plane Architecture', link: '/en/guide/architecture' },
                { text: '7 Apache-2.0 Plugins & Modularity', link: '/en/guide/plugins-modularity' },
                { text: 'Tech Stack & Pure-OSI Boundary', link: '/en/guide/tech-stack-and-osi' },
              ],
            },
            {
              text: '2. Getting Started & Deployment',
              collapsed: false,
              items: [
                { text: 'System Requirements', link: '/en/getting-started/requirements' },
                { text: 'Quick Start (1-Command)', link: '/en/getting-started/quick-start' },
                {
                  text: 'Production Zero-Trust Deployment',
                  link: '/en/getting-started/production-deployment',
                },
                { text: 'Environment Configuration', link: '/en/getting-started/configuration' },
              ],
            },
            {
              text: '3. Core Modules & Features',
              collapsed: false,
              items: [
                { text: 'Multi-Portal & 12 BlockModels v2', link: '/en/modules/multi-portal-blocks' },
                { text: 'OMS / WMS / FEFO / ePOD & Ed25519', link: '/en/modules/oms-wms-fefo-epod' },
                { text: 'LatticeFlow v2 DAG Engine', link: '/en/modules/latticeflow-v2' },
                { text: 'Visual DMN Decision Engine', link: '/en/modules/visual-dmn' },
                { text: 'DX-OS AI Studio & App Builder 2.0', link: '/en/modules/ai-studio-app-builder' },
                { text: 'P.A.R.A. Knowledge Vault & OCR RAG', link: '/en/modules/para-knowledge-ocr' },
                {
                  text: 'Approvals, Notify, Forms & Mobile PWA',
                  link: '/en/modules/approvals-notify-forms-pwa',
                },
                { text: 'IIoT, 2-Way Digital Twin & n8n', link: '/en/modules/iiot-digital-twin-n8n' },
              ],
            },
            {
              text: '4. Security, Multi-Tenant & API',
              collapsed: false,
              items: [
                { text: 'Multi-Tenant PostgreSQL FORCE RLS', link: '/en/security/multi-tenant-rls' },
                {
                  text: 'PKI Ledger (Ed25519/Merkle) & API Keys',
                  link: '/en/security/pki-ledger-api-keys',
                },
                { text: 'OIDC/PKCE Auth & Hardening', link: '/en/security/auth-oidc-hardening' },
                { text: 'API Contracts (OpenAPI & AsyncAPI)', link: '/en/security/api-contracts' },
              ],
            },
            {
              text: '5. Operations, Testing & DR',
              collapsed: false,
              items: [
                {
                  text: 'Observability (OTel, Prometheus, Grafana)',
                  link: '/en/operations/observability',
                },
                { text: 'Backup, PITR WAL & Stack DR', link: '/en/operations/backup-pitr-dr' },
                { text: 'End-to-End Testing Guide', link: '/en/operations/testing-e2e-guide' },
                {
                  text: 'Demo Pack, 15-Min Script & Troubleshooting',
                  link: '/en/operations/demo-pack-troubleshooting',
                },
              ],
            },
            {
              text: '6. Open-Source Governance & PoF',
              collapsed: false,
              items: [
                { text: 'Pure-OSI & Apache-2.0 Policy', link: '/en/oss/pure-osi-policy' },
                { text: 'NocoBase 2.2.50 Attribution (Clause 5.2)', link: '/en/oss/nocobase-clause-5-2' },
                { text: 'CycloneDX SBOM & Build-from-Source', link: '/en/oss/sbom-and-build-from-source' },
                {
                  text: 'Contributing, Security & Changelog (<1.0.0)',
                  link: '/en/oss/contributing-security-changelog',
                },
              ],
            },
          ],
        },
      },
    },
  }),
);
