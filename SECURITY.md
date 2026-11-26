# Security Policy / Chính sách bảo mật

## 1. Supported Versions / Phiên bản được hỗ trợ

| Version / Branch | Status / Trạng thái |
| --- | --- |
| `0.4.2` (`main` on `CTU-OpenPaw/lattice-docs`) | Supported with security & compliance updates / Được hỗ trợ cập nhật bảo mật |
| `< 0.4.2` | Unsupported — upgrade to `0.4.2` / Không còn hỗ trợ |

> **Version Lock Notice:** `CTU-OpenPaw/lattice-docs` strictly tracks LatticeDX pre-GA `< 1.0.0` releases (`0.4.2`).

---

## 2. Reporting a Vulnerability / Báo cáo lỗ hổng bảo mật

Please **do not** disclose security vulnerabilities, exposed tokens, secrets, or sensitive deployment configurations in public GitHub Issues or Pull Requests.

Vui lòng **không** công khai lỗ hổng bảo mật, token, secret hoặc thông tin nhạy cảm trong GitHub Issues hoặc Pull Requests.

Report security issues privately via **GitHub Security Advisories**:
- **https://github.com/CTU-OpenPaw/lattice-dx/security/advisories/new**

Include:
1. Affected repository (`CTU-OpenPaw/lattice-docs` or `CTU-OpenPaw/lattice-dx`), URL/file path, and commit SHA.
2. Minimal reproduction steps or impact summary.
3. Any suggested remediation.

---

## 3. Documentation Security & Hygiene Rules / Quy tắc an toàn tài liệu

- **Zero Secrets in Docs:** Never commit `.env` files, real API tokens, `ldx_pat_*` production credentials, OAuth client secrets, private keys (`*.pem`, `*.key`), or PII in Markdown pages, diagrams, screenshots, or YAML templates.
- **Loopback Test Fixtures Only:** Any default credentials documented for local `127.0.0.1` / `localhost` evaluation (`pnpm native:clean`) must be clearly labeled as public loopback fixtures and never recommended for production or Internet-facing deployments.
- **Pure-OSI Static Build:** `lattice-docs` builds purely static HTML/JS/CSS assets using OSI-approved `VitePress` (`MIT`) and `mermaid` (`MIT`), deployed via GitHub Actions OIDC to GitHub Pages (`https://ctu-openpaw.github.io/lattice-docs/`). Do not inject external untrusted `<script>` tags or third-party tracking beacons.
