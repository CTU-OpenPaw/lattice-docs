---
title: Phê duyệt Thống nhất & Ủy quyền
description: Bộ máy phê duyệt đa cấp M-of-N (dxosApprovals), hộp thư hợp nhất 4 nguồn và ủy quyền giới hạn tối đa 90 ngày (dxosDelegations).
---

<script setup>
const approvalPolicyTabs = [
  {
    label: 'Tạo chính sách 2-of-3 (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosApprovals:savePolicy \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "policyKey": "coldchain-qa-release",
    "name": "Phe duyet mo khoa lo lanh",
    "targetCollection": "latticeStockLots",
    "operation": "custom",
    "stagesJson": [
      {
        "mode": "parallel",
        "approverRoles": ["ldx_manager", "ldx_director"],
        "requiredApprovals": 2,
        "slaMinutes": 120,
        "escalateToRole": "ldx_director",
        "allowDelegation": true
      }
    ]
  }'`,
  },
  {
    label: 'Gửi quyết định duyệt (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosApprovals:decide \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "business",
    "requestUid": "APR-9A2B1C3D",
    "decision": "approve",
    "comment": "Dat ket qua kiem tra nhiet do bo sung"
  }'`,
  },
];

const delegationTabs = [
  {
    label: 'Tạo ủy quyền (cURL)',
    lang: 'bash',
    code: `curl -X POST https://app.example.com/api/dxosDelegations:create \\
  -H "Authorization: Bearer ldx_pat_a1b2c3d4_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "delegateUserId": 14,
    "roleName": "ldx_manager",
    "scopeCollection": "latticeOrders",
    "startsAt": "2026-12-01T00:00:00Z",
    "endsAt": "2026-12-15T23:59:59Z",
    "reason": "Cong tac kho lanh khu vuc mien Trung"
  }'`,
  },
  {
    label: 'Phản hồi ủy quyền (JSON)',
    lang: 'json',
    code: `{
  "data": {
    "delegation": {
      "id": 9,
      "delegationUid": "DLG-7C3E91A2B410",
      "delegatorUserId": 7,
      "delegateUserId": 14,
      "roleName": "ldx_manager",
      "scopeCollection": "latticeOrders",
      "status": "active",
      "active": true
    }
  }
}`,
  },
];
</script>

# Phê duyệt Thống nhất & Ủy quyền

Phân hệ phê duyệt thống nhất (`@latticedx/plugin-lattice-foundation`, `approval-engine.js`) và ủy quyền theo thời hạn (`@latticedx/plugin-dxos-studio`, `delegation-engine.js`) hợp nhất toàn bộ quyết định nghiệp vụ, hàng đợi giám sát con người (HITL) của AI Studio, nút tạm dừng quy trình LatticeFlow v2 và đề xuất tác nhân vào một hộp thư chung duy nhất. Mọi chính sách phê duyệt hỗ trợ quy tắc ngưỡng `M-of-N` theo từng giai đoạn, ngăn tự phê duyệt theo mặc định và ghi nhận toàn bộ chữ ký quyết định vào sổ cái Ed25519 `latticeCryptoLedger`.

## Hộp thư hợp nhất bốn nguồn và rào chắn truy cập

Endpoint `dxosApprovals:listInbox` truy vấn và chuẩn hóa yêu cầu chờ xử lý từ bốn nguồn dữ liệu khác nhau theo phạm vi `organizationId`, hỗ trợ lọc theo `source`, `status`, `assignedToMe` và từ khóa tìm kiếm `search`. Truy cập CRUD trực tiếp vào `latticeApprovalPolicies` và `latticeApprovalRequests` bị chặn bởi `dxosApprovalsDirectGuard`; toàn bộ thao tác phải đi qua tài nguyên `dxosApprovals`.

| Giá trị `source` | Bảng dữ liệu nguồn | Ngữ cảnh áp dụng | Cách xử lý khi `decide` |
| :--- | :--- | :--- | :--- |
| `business` | `latticeApprovalRequests` | Yêu cầu phê duyệt gắn với chính sách `latticeApprovalPolicies`. | Đánh giá ngưỡng `M-of-N` của giai đoạn hiện tại và chuyển bước hoặc kết thúc. |
| `ai_hitl` | `latticeAiApprovalQueue` | Tác vụ rủi ro cao từ AI hoặc thay đổi setpoint Digital Twin vượt `2.0°C`. | Xác nhận hoặc từ chối thực thi công cụ AI / lệnh điều khiển thiết bị. |
| `flow` | `latticeAutomationRuns` | Luồng LatticeFlow v2 tạm dừng tại nút `control.approval`. | Gọi `verifyApprovalResumeAuthority` và nối lại luồng từ `loopCursors`. |
| `proposals` | `latticeAgentProposals` | Đề xuất phân tích sự cố hoặc hành động do AI tổng hợp. | Chuyển trạng thái đề xuất và ghi vết người thẩm định. |

<ApiEndpoint
  method="GET"
  path="/api/dxosApprovals:listInbox"
  auth="Bearer JWT | ldx_pat_*"
  scope="read, write, ai"
  summary="Liệt kê hộp thư phê duyệt hợp nhất từ 4 nguồn (business, ai_hitl, flow, proposals) theo vai trò và ủy quyền hiệu lực."
/>

Hệ thống duy trì danh sách `PROTECTED_TARGET_COLLECTIONS` gồm 25 bảng lõi (như `users`, `roles`, `latticeApiKeys`, `latticeCryptoLedger`, `latticeDelegations`, `latticeConnectors`) không được phép gắn chính sách phê duyệt tùy biến; tên bảng nghiệp vụ hợp lệ phải khớp biểu thức `^lattice[A-Z][A-Za-z0-9]{1,64}$`.

## Chính sách đa giai đoạn và ngưỡng `M-of-N`

Mỗi chính sách trong `latticeApprovalPolicies` định danh bằng `policyKey` (`/^[a-z0-9][a-z0-9_-]{1,62}$/`) và mảng giai đoạn `stagesJson`. Trong một giai đoạn, chế độ `sequential` ép `requiredApprovals = 1`, còn chế độ `parallel` cho phép đặt ngưỡng `M-of-N` (`1..50` phiếu đồng thuận từ tập vai trò `approverRoles` hoặc danh sách `approverUserIds`). Nếu giai đoạn chỉ định `approverUserIds` mà không dùng vai trò, hệ thống chặn cấu hình `requiredApprovals > approverUserIds.length`.

<ParamGrid
  title="Cấu hình mỗi giai đoạn trong stagesJson (latticeApprovalPolicies)"
  :items="[
    { name: 'mode', type: 'string', required: true, default: 'sequential', description: 'Chế độ duyệt của giai đoạn: sequential hoặc parallel.' },
    { name: 'approverRoles', type: 'string[]', description: 'Danh sách vai trò được phép phê duyệt (ví dụ: ldx_manager, ldx_director).' },
    { name: 'approverUserIds', type: 'integer[]', description: 'Danh sách ID người dùng cụ thể được chỉ định phê duyệt.' },
    { name: 'requiredApprovals', type: 'integer', default: '1', description: 'Số lượng phê duyệt M cần đạt trong giai đoạn (1..50; tự động ép bằng 1 nếu sequential).' },
    { name: 'slaMinutes', type: 'integer', description: 'Thời hạn SLA tính bằng phút cho giai đoạn hiện tại (1..43200).' },
    { name: 'escalateToRole', type: 'string', description: 'Vai trò nhận thông báo leo thang khi quá hạn SLA.' },
    { name: 'allowDelegation', type: 'boolean', default: 'true', description: 'Cho phép người được ủy quyền hợp lệ thay mặt phê duyệt.' }
  ]"
/>

Theo mặc định, `allowSelfApproval` mang giá trị `false` để người tạo yêu cầu không thể tự duyệt hồ sơ của chính mình; chỉ người gọi có quyền `root` hoặc `admin` mới có thể bật cờ này khi khởi tạo yêu cầu qua `dxosApprovals:request`. Để tránh điều kiện tranh chấp khi nhiều người cùng duyệt song song một ngưỡng `M-of-N`, hàm `withCanonicalDecisionLock` tuần tự hóa yêu cầu theo khóa bản ghi kết hợp cập nhật lạc quan (`repoUpdateCompat`).

<ApiEndpoint
  method="POST"
  path="/api/dxosApprovals:decide"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Ghi nhận quyết định approve hoặc reject, cập nhật tiến độ M-of-N và phát sự kiện sổ cái."
/>

| Endpoint `dxosApprovals` | Phương thức | Quyền / Scope | Chức năng chính |
| :--- | :--- | :--- | :--- |
| `/api/dxosApprovals:listInbox` | `GET` | `read`, `write`, `ai` | Truy vấn hộp thư phê duyệt theo nguồn và trạng thái. |
| `/api/dxosApprovals:request` | `POST` | `write` | Khởi tạo yêu cầu phê duyệt mới gắn với chính sách hoặc danh sách giai đoạn trực tiếp. |
| `/api/dxosApprovals:decide` | `POST` | `write` | Phê duyệt hoặc từ chối hồ sơ thuộc một trong 4 nguồn hộp thư. |
| `/api/dxosApprovals:cancel` | `POST` | `write` | Hủy yêu cầu đang chờ xử lý kèm lý do hủy. |
| `/api/dxosApprovals:listPolicies` | `GET` | `read`, `write` | Liệt kê các chính sách phê duyệt đang hoạt động trong tổ chức. |
| `/api/dxosApprovals:savePolicy` | `POST` | `write` | Tạo hoặc cập nhật chính sách `M-of-N` trên collection nghiệp vụ. |
| `/api/dxosApprovals:deletePolicy` | `POST` | `write` | Xóa chính sách phê duyệt theo `policyId` hoặc `policyKey`. |
| `/api/dxosApprovals:evaluateSlaNow` | `POST` | `write` (Admin/Root) | Đánh giá ngay các hồ sơ quá hạn SLA và kích hoạt leo thang (hỗ trợ `dryRun`). |

<CodeTabs :tabs="approvalPolicyTabs" />

## Ủy quyền giới hạn tối đa 90 ngày (`dxosDelegations`)

Khi người quản lý tạm vắng, `dxosDelegations` cho phép chuyển giao tạm thời quyền phê duyệt thuộc một vai trò đang nắm giữ sang nhân sự khác trong cùng tổ chức. Hệ thống thực thi sáu rào chắn kiểm soát ở tầng máy chủ (`delegation-engine.js`) trước khi phát hành mã `DLG-...`:

| Rào chắn kiểm soát | Quy tắc thực thi và mã lỗi |
| :--- | :--- |
| Giới hạn cửa sổ thời gian | Thời điểm `endsAt` phải lớn hơn `startsAt` và khoảng cách `endsAt - startsAt` không vượt quá `MAX_DELEGATION_MS = 90` ngày (`DELEGATION_WINDOW_EXCEEDED`). |
| Cấm tự ủy quyền | `delegateUserId` phải khác `delegatorUserId` (`DELEGATION_SELF_FORBIDDEN`). |
| Cấm leo thang đặc quyền | Người dùng thường không được ủy quyền các vai trò thuộc `FORBIDDEN_DELEGATION_ROLES` (`root`, `admin`, `ldx_admin`) hoặc vai trò có cờ `allowAll`, `allowConfigure`, hoặc snippet đặc quyền `pm*`, `acl*`, `app*`, `ui*`, `*` (`DELEGATION_ESCALATION_FORBIDDEN`). |
| Kiểm tra vai trò thực giữ | Người ủy quyền phải thực sự đang nắm giữ `roleName` trong bảng `rolesUsers` (`DELEGATION_ROLE_NOT_HELD`). |
| Cô lập cùng tổ chức | Cả người ủy quyền và người nhận ủy quyền phải có hồ sơ `latticeEmployees` đang hoạt động (`active: true`) thuộc cùng `organizationId` (`DELEGATION_CROSS_ORG_FORBIDDEN`). |
| Phạm vi collection tùy chọn | Trường `scopeCollection` giới hạn quyền thay mặt chỉ có hiệu lực trên một bảng nghiệp vụ cụ thể. |

<ApiEndpoint
  method="POST"
  path="/api/dxosDelegations:create"
  auth="Bearer JWT | ldx_pat_*"
  scope="write"
  summary="Tạo bản ghi ủy quyền có thời hạn tối đa 90 ngày, kiểm tra chống leo thang đặc quyền và ghi sổ cái PKI."
/>

<ParamGrid
  title="Tham số đầu vào của dxosDelegations:create"
  :items="[
    { name: 'delegateUserId', type: 'integer', required: true, description: 'ID người dùng nhận ủy quyền (phải khác delegatorUserId và thuộc cùng tổ chức).' },
    { name: 'roleName', type: 'string', required: true, description: 'Tên vai trò được ủy quyền (2..64 ký tự; không thuộc danh sách đặc quyền bị cấm).' },
    { name: 'endsAt', type: 'datetime', required: true, description: 'Thời điểm hết hạn ủy quyền (lớn hơn startsAt và tối đa 90 ngày).' },
    { name: 'startsAt', type: 'datetime', default: 'now()', description: 'Thời điểm bắt đầu hiệu lực ủy quyền.' },
    { name: 'scopeCollection', type: 'string', description: 'Giới hạn ủy quyền cho một collection cụ thể (tùy chọn).' },
    { name: 'reason', type: 'string', description: 'Lý do ủy quyền lưu vào hồ sơ kiểm toán (tối đa 500 ký tự).' }
  ]"
/>

| Endpoint `dxosDelegations` | Phương thức | Quyền / Scope | Chức năng chính |
| :--- | :--- | :--- | :--- |
| `/api/dxosDelegations:list` | `GET` | `read`, `write` | Liệt kê các ủy quyền liên quan đến người gọi (quản trị viên xem toàn tổ chức). |
| `/api/dxosDelegations:create` | `POST` | `write` | Khởi tạo ủy quyền `DLG-*` mới với thời hạn `<= 90` ngày. |
| `/api/dxosDelegations:revoke` | `POST` | `write` | Thu hồi ngay ủy quyền đang hiệu lực (`status = 'revoked'`, `active = false`). |
| `/api/dxosDelegations:activeForMe` | `GET` | `read`, `write` | Truy vấn tập vai trò ủy quyền hiện đang còn hiệu lực cho người dùng hiện tại. |

<CodeTabs :tabs="delegationTabs" />

## Dấu vết kiểm toán, phân giải ủy quyền và mã lỗi

Khi người dùng gửi quyết định qua `dxosApprovals:decide` hoặc nối lại luồng tạm dừng tại nút `control.approval` của LatticeFlow v2 (`verifyApprovalResumeAuthority`), hệ thống gọi `resolveEffectiveDelegatedRoles` để tổng hợp vai trò gốc trong `rolesUsers` cùng các vai trò ủy quyền đang còn hiệu lực tại thời điểm quyết định (`startsAt <= now < endsAt`, `status = 'active'`, khớp `scopeCollection` nếu có).

Mỗi thao tác khởi tạo, phê duyệt, từ chối, tạo ủy quyền (`auth.delegation_created`) hoặc thu hồi ủy quyền (`auth.delegation_revoked`) đều ghi bản ghi có chữ ký Ed25519 vào `latticeCryptoLedger` thông qua `safeAppendApprovalLedger` hoặc `appendAuditLedger`, đồng thời phát CloudEvent lên `latticeEventBus` và gửi thông báo tới các bên liên quan qua `notification-center.js`. Khi người được ủy quyền phê duyệt hồ sơ, bản ghi kiểm toán lưu kèm `delegationUid` và `delegatedFromUserId` để truy vết rõ người giữ vai trò gốc.

| Mã lỗi | HTTP | Nguồn phát sinh | Nguyên nhân |
| :--- | :---: | :--- | :--- |
| `APPROVAL_COLLECTION_FORBIDDEN` | `400` | `approval-engine.js` | Gắn chính sách lên bảng thuộc `PROTECTED_TARGET_COLLECTIONS` hoặc sai mẫu `lattice*`. |
| `DELEGATION_WINDOW_EXCEEDED` | `400` | `delegation-engine.js` | Khoảng thời gian `endsAt - startsAt` vượt quá giới hạn `90` ngày (`MAX_DELEGATION_MS`). |
| `DELEGATION_SELF_FORBIDDEN` | `400` | `delegation-engine.js` | `delegateUserId` trùng với `delegatorUserId`. |
| `DELEGATION_ESCALATION_FORBIDDEN` | `403` | `delegation-engine.js` | Cố tình ủy quyền `root`, `admin`, `ldx_admin` hoặc vai trò mang snippet `pm*`/`acl*`/`app*`/`ui*`/`*`. |
| `DELEGATION_ROLE_NOT_HELD` | `403` | `delegation-engine.js` | Người ủy quyền không thực sự giữ `roleName` trong `rolesUsers`. |
| `DELEGATION_CROSS_ORG_FORBIDDEN` | `403` | `delegation-engine.js` | Người ủy quyền hoặc người nhận không có hồ sơ `latticeEmployees` hoạt động trong cùng tổ chức. |

## Tài liệu liên quan

- [Biểu thức và luồng điều khiển LatticeFlow v2](/automation/expressions-and-control-flow)
- [Sổ cái PKI Ed25519 và Merkle](/reference/pki-merkle-ledger)
- [Thông báo đa kênh dxosNotify](/domains/notifications)
- [Mô hình bảo mật Zero-Trust](/architecture/security-model)
