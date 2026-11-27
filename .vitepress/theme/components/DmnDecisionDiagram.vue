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

const title = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Động cơ Quyết định Visual DMN & Biểu thức FEEL'
    : 'Visual DMN Decision Table & FEEL Evaluation',
);

const caption = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Đường ống 5 bước đánh giá bảng quyết định FEEL không dùng eval(); mỗi lần phát hành qua dxosDmn:saveTable tự động tăng version và ghi sự kiện dmn.table_saved vào sổ cái Ed25519 (latticeCryptoLedger).'
    : '5-stage deterministic DMN evaluation without eval(); publishing via dxosDmn:saveTable auto-increments version and logs dmn.table_saved to the Ed25519 ledger (latticeCryptoLedger).',
);

const zones = computed<DiagramZone[]>(() =>
  resolvedLang.value === 'vi'
    ? [
        { id: 'caller', label: 'Đầu vào Facts', x: 12, y: 20, width: 200, height: 224, kind: 'admin' },
        { id: 'dmn-engine', label: 'Động cơ DMN (dmn-engine.js · FORCE RLS)', x: 248, y: 20, width: 672, height: 224, kind: 'traffic' },
        { id: 'output', label: 'Ngữ cảnh Đầu ra', x: 956, y: 20, width: 200, height: 224, kind: 'admin' },
      ]
    : [
        { id: 'caller', label: 'Caller Input', x: 12, y: 20, width: 200, height: 224, kind: 'admin' },
        { id: 'dmn-engine', label: 'DMN Engine (dmn-engine.js · FORCE RLS)', x: 248, y: 20, width: 672, height: 224, kind: 'traffic' },
        { id: 'output', label: 'Flow / API Output', x: 956, y: 20, width: 200, height: 224, kind: 'admin' },
      ],
);

const nodes = computed<DiagramNode[]>(() => {
  if (resolvedLang.value === 'vi') {
    return [
      {
        id: 'facts-in',
        title: 'Đầu vào Facts',
        sub: ['logic.dmn hoặc', 'POST :evaluate', '(mô phỏng dry-run)'],
        icon: 'file-text',
        x: 24,
        y: 84,
        width: 176,
        height: 96,
        zoneId: 'caller',
        inspector: {
          role: 'Tập biến đầu vào gửi tới bộ đánh giá DMN',
          packageOrPort: '@latticedx/plugin-dxos-studio · logic.dmn',
          protocol: 'POST /api/dxosDmn:evaluate (live | simulated)',
          payloadOrSchema: '{ tableKey, facts } hoặc { table, facts }',
          responsibilities:
            'Cung cấp facts từ node logic.dmn trong LatticeFlow v2 hoặc API; hỗ trợ mô phỏng bản nháp { simulated: true } không ghi DB.',
        },
      },
      {
        id: 'rule-table',
        title: 'Bảng Quyết định',
        sub: ['PG16 DecisionTables', 'RLS · <=500 luật', 'saveTable -> Ledger'],
        icon: 'database',
        x: 260,
        y: 84,
        width: 176,
        height: 96,
        zoneId: 'dmn-engine',
        inspector: {
          role: 'Kho bảng quyết định có phiên bản theo tenant',
          packageOrPort: 'PostgreSQL 16 FORCE RLS · latticeDecisionTables',
          protocol: 'dxosDmn:{listTables, saveTable, evaluate}',
          payloadOrSchema: '1..50 I/O · <=500 rules · version++',
          responsibilities:
            'Nạp bảng theo (organizationId, tableKey); mỗi lần gọi dxosDmn:saveTable tăng version và ký dmn.table_saved vào latticeCryptoLedger.',
        },
      },
      {
        id: 'feel-match',
        title: 'So khớp FEEL',
        sub: ['eq · neq · gt..lte', 'between · in · not_in', 'contains · * (safe)'],
        icon: 'git-branch',
        x: 496,
        y: 84,
        width: 176,
        height: 96,
        zoneId: 'dmn-engine',
        focal: true,
        inspector: {
          role: 'Bộ phân tích & đối chiếu điều kiện FEEL không dùng eval()',
          packageOrPort: '@latticedx/plugin-dxos-studio · dmn-engine.js',
          protocol: 'Zero-Eval AST Matcher · Object.hasOwn',
          payloadOrSchema: 'ALLOWED_OPERATORS (11 toán tử · chặn prototype)',
          responsibilities:
            'Biên dịch biểu thức chuỗi hoặc JSON sang { op, value }, đọc thuộc tính an toàn bằng Object.hasOwn và lọc các dòng thỏa mãn toàn bộ cột when.',
        },
      },
      {
        id: 'hit-policy',
        title: 'Chọn Hit Policy',
        sub: ['FIRST · COLLECT', 'UNIQUE (409 nếu >1)', 'PRIORITY (trọng số)'],
        icon: 'workflow',
        x: 732,
        y: 84,
        width: 176,
        height: 96,
        zoneId: 'dmn-engine',
        focal: true,
        inspector: {
          role: 'Tổng hợp kết quả theo 4 Hit Policy chuẩn',
          packageOrPort: '@latticedx/plugin-dxos-studio · HIT_POLICIES',
          protocol: 'FIRST | UNIQUE (409) | COLLECT | PRIORITY',
          payloadOrSchema: 'DMN_UNIQUE_POLICY_VIOLATION (HTTP 409 on >1)',
          responsibilities:
            'Dừng ở rule đầu (FIRST), báo lỗi 409 nếu khớp >1 rule (UNIQUE), gom mảng kết quả (COLLECT) hoặc xếp hạng theo priority desc, ruleIndex asc (PRIORITY).',
        },
      },
      {
        id: 'dmn-out',
        title: 'Đầu ra Xác định',
        sub: ['{ matched, result,', '  results[] } ->', '{{dmnResult}}'],
        icon: 'check-circle',
        x: 968,
        y: 84,
        width: 176,
        height: 96,
        zoneId: 'output',
        inspector: {
          role: 'Trả gói kết quả chuẩn hóa cho DAG & phê duyệt',
          packageOrPort: 'LatticeFlow v2 · dxosApprovals',
          protocol: 'JSON Envelope · Flow Context Variables',
          payloadOrSchema: '{ tableKey, version, hitPolicy, matched, result, results[] }',
          responsibilities:
            'Gán kết quả vào biến {{dmn}} và {{dmnResult}} để điều khiển control.if, control.approval hoặc định tuyến ưu tiên CMMS/WMS.',
        },
      },
    ];
  }

  return [
    {
      id: 'facts-in',
      title: 'Input Facts',
      sub: ['logic.dmn or', 'POST :evaluate', '(dry-run simulated)'],
      icon: 'file-text',
      x: 24,
      y: 84,
      width: 176,
      height: 96,
      zoneId: 'caller',
      inspector: {
        role: 'Typed input facts submitted for evaluation',
        packageOrPort: '@latticedx/plugin-dxos-studio · logic.dmn',
        protocol: 'POST /api/dxosDmn:evaluate (live | simulated)',
        payloadOrSchema: '{ tableKey, facts } or { table, facts }',
        responsibilities:
          'Supplies facts from LatticeFlow logic.dmn nodes or REST callers; supports inline { simulated: true } dry-runs without DB writes.',
      },
    },
    {
      id: 'rule-table',
      title: 'Versioned Decision Table',
      sub: ['PG16 DecisionTables', 'RLS · <=500 rules', 'saveTable -> Ledger'],
      icon: 'database',
      x: 260,
      y: 84,
      width: 176,
      height: 96,
      zoneId: 'dmn-engine',
      inspector: {
        role: 'Tenant-isolated versioned DMN table store',
        packageOrPort: 'PostgreSQL 16 FORCE RLS · latticeDecisionTables',
        protocol: 'dxosDmn:{listTables, saveTable, evaluate}',
        payloadOrSchema: '1..50 I/O · <=500 rules · version++',
        responsibilities:
          'Loads active tables scoped by (organizationId, tableKey); dxosDmn:saveTable bumps version and appends dmn.table_saved to latticeCryptoLedger.',
      },
    },
    {
      id: 'feel-match',
      title: 'Zero-Eval FEEL Matcher',
      sub: ['eq · neq · gt..lte', 'between · in · not_in', 'contains · * (safe)'],
      icon: 'git-branch',
      x: 496,
      y: 84,
      width: 176,
      height: 96,
      zoneId: 'dmn-engine',
      focal: true,
      inspector: {
        role: 'Safe AST condition parser & matcher without eval()',
        packageOrPort: '@latticedx/plugin-dxos-studio · dmn-engine.js',
        protocol: 'Zero-Eval AST Matcher · Object.hasOwn',
        payloadOrSchema: 'ALLOWED_OPERATORS (11 operators · prototype-safe)',
        responsibilities:
          'Compiles string or JSON predicates to { op, value }, reads inputs via Object.hasOwn, and collects candidate rows matching all when columns.',
      },
    },
    {
      id: 'hit-policy',
      title: 'Hit Policy Selector',
      sub: ['FIRST · COLLECT', 'UNIQUE (409 on >1)', 'PRIORITY (rank desc)'],
      icon: 'workflow',
      x: 732,
      y: 84,
      width: 176,
      height: 96,
      zoneId: 'dmn-engine',
      focal: true,
      inspector: {
        role: 'Deterministic aggregation across 4 Hit Policies',
        packageOrPort: '@latticedx/plugin-dxos-studio · HIT_POLICIES',
        protocol: 'FIRST | UNIQUE (409) | COLLECT | PRIORITY',
        payloadOrSchema: 'DMN_UNIQUE_POLICY_VIOLATION (HTTP 409 on >1)',
        responsibilities:
          'Short-circuits on first match (FIRST), fails closed with 409 if >1 match (UNIQUE), collects all matches (COLLECT), or sorts priority desc, ruleIndex asc (PRIORITY).',
      },
    },
    {
      id: 'dmn-out',
      title: 'Deterministic Output',
      sub: ['{ matched, result,', '  results[] } ->', '{{dmnResult}}'],
      icon: 'check-circle',
      x: 968,
      y: 84,
      width: 176,
      height: 96,
      zoneId: 'output',
      inspector: {
        role: 'Normalized decision envelope for DAG & approvals',
        packageOrPort: 'LatticeFlow v2 · dxosApprovals',
        protocol: 'JSON Envelope · Flow Context Variables',
        payloadOrSchema: '{ tableKey, version, hitPolicy, matched, result, results[] }',
        responsibilities:
          'Populates {{dmn}} and {{dmnResult}} in execution context to drive control.if, control.approval, or WMS/CMMS priority routing.',
      },
    },
  ];
});

const edges = computed<DiagramEdge[]>(() => [
  {
    id: 'e1',
    from: 'facts-in',
    to: 'rule-table',
    label: 'load',
    kind: 'flow',
    points: [
      [200, 132],
      [260, 132],
    ],
  },
  {
    id: 'e2',
    from: 'rule-table',
    to: 'feel-match',
    label: 'rules',
    kind: 'primary',
    points: [
      [436, 132],
      [496, 132],
    ],
  },
  {
    id: 'e3',
    from: 'feel-match',
    to: 'hit-policy',
    label: 'match',
    kind: 'primary',
    points: [
      [672, 132],
      [732, 132],
    ],
  },
  {
    id: 'e4',
    from: 'hit-policy',
    to: 'dmn-out',
    label: 'emit',
    kind: 'flow',
    points: [
      [908, 132],
      [968, 132],
    ],
  },
]);

const steps = computed<DiagramStep[]>(() =>
  resolvedLang.value === 'vi'
    ? [
        {
          id: 's1',
          title: 'Nạp Facts & Bảng Phiên bản',
          activeNodes: ['facts-in', 'rule-table'],
          activeEdges: ['e1'],
          description:
            'Nhận facts từ logic.dmn hoặc POST :evaluate và nạp bảng thuộc tenant (1..50 I/O, <=500 luật) dưới FORCE RLS.',
          route: 'POST /api/dxosDmn:evaluate',
          payload: 'latticeDecisionTables · dmn.table_saved',
          chips: ['FORCE RLS', 'Dry-Run Sim'],
        },
        {
          id: 's2',
          title: 'So khớp Điều kiện FEEL An toàn',
          activeNodes: ['rule-table', 'feel-match'],
          activeEdges: ['e2'],
          description:
            'Bộ phân tích không dùng eval() đối chiếu eq, neq, gt..lte, between, in, not_in, contains và * qua Object.hasOwn.',
          route: 'parseStringConditionSpec -> matchedRules[]',
          payload: 'Zero eval() · Prototype-Safe',
          chips: ['11 FEEL Ops'],
        },
        {
          id: 's3',
          title: 'Áp dụng Hit Policy & Xuất Kết quả',
          activeNodes: ['feel-match', 'hit-policy', 'dmn-out'],
          activeEdges: ['e3', 'e4'],
          description:
            'Áp dụng FIRST, UNIQUE (trả HTTP 409 nếu >1 luật khớp), COLLECT hoặc PRIORITY rồi gán vào {{dmnResult}}.',
          route: 'HIT_POLICIES -> {{dmn}} / {{dmnResult}}',
          payload: '{ matched, result, results[] }',
          chips: ['4 Hit Policies', 'HTTP 409 Guard'],
        },
      ]
    : [
        {
          id: 's1',
          title: 'Load Facts & Versioned Table',
          activeNodes: ['facts-in', 'rule-table'],
          activeEdges: ['e1'],
          description:
            'Accepts facts from logic.dmn or POST :evaluate and loads the tenant table (1..50 I/O, <=500 rules) under FORCE RLS.',
          route: 'POST /api/dxosDmn:evaluate',
          payload: 'latticeDecisionTables · dmn.table_saved',
          chips: ['FORCE RLS', 'Dry-Run Sim'],
        },
        {
          id: 's2',
          title: 'Zero-Eval FEEL Matching',
          activeNodes: ['rule-table', 'feel-match'],
          activeEdges: ['e2'],
          description:
            'Evaluates eq, neq, gt..lte, between, in, not_in, contains, and * via AST parsing and Object.hasOwn without eval().',
          route: 'parseStringConditionSpec -> matchedRules[]',
          payload: 'Zero eval() · Prototype-Safe',
          chips: ['11 FEEL Ops'],
        },
        {
          id: 's3',
          title: 'Hit Policy & Deterministic Output',
          activeNodes: ['feel-match', 'hit-policy', 'dmn-out'],
          activeEdges: ['e3', 'e4'],
          description:
            'Resolves FIRST, UNIQUE (HTTP 409 on >1 match), COLLECT, or PRIORITY and binds output to {{dmnResult}}.',
          route: 'HIT_POLICIES -> {{dmn}} / {{dmnResult}}',
          payload: '{ matched, result, results[] }',
          chips: ['4 Hit Policies', 'HTTP 409 Guard'],
        },
      ],
);
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 1168 268"
    :zones="zones"
    :nodes="nodes"
    :edges="edges"
    :steps="steps"
    :lang="resolvedLang"
  />
</template>
