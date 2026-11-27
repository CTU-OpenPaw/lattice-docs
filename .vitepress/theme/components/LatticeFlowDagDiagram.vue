<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol } from 'vitepress';
import DiagramCanvas from './DiagramCanvas.vue';
import type { DiagramLocale, DiagramMode } from './diagramTypes';

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
    ? 'Động cơ DAG LatticeFlow v2 (24 Loại Node & Checkpoint Bền vững)'
    : 'LatticeFlow v2 DAG Engine (24 Node Types & Durable Checkpoints)',
);

const caption = computed(() =>
  resolvedLang.value === 'vi'
    ? 'Luồng thực thi topo trái-sang-phải qua 24 loại node; chính sách lỗi (errorPolicy: stop | continue), dấu vết nodeStatesJson và phục hồi qua dxosAutomations:replayRun được ghi nhận tại bộ thực thi và checkpoint PG16.'
    : 'Left-to-right topological DAG execution across 24 node types; errorPolicy (stop | continue), step traces, and dxosAutomations:replayRun are enforced by the runner and PG16 checkpoint store.',
);

const modes = computed<DiagramMode[]>(() => {
  if (resolvedLang.value === 'vi') {
    return [
      {
        id: 'dag-pipeline',
        label: 'Đường ống DAG (24 Loại Node)',
        viewBox: '0 0 1168 272',
        zones: [
          { id: 'ingress', label: 'Đầu vào Kích hoạt', x: 12, y: 20, width: 200, height: 228, kind: 'admin' },
          { id: 'dag-core', label: 'Bộ thực thi DAG v2 & Checkpoint PG16', x: 248, y: 20, width: 672, height: 228, kind: 'traffic' },
          { id: 'egress', label: 'Tác vụ & Sự kiện', x: 956, y: 20, width: 200, height: 228, kind: 'admin' },
        ],
        nodes: [
          {
            id: 'triggers',
            title: 'Bộ kích hoạt (5)',
            sub: ['event · record · cron', 'webhook · manual'],
            icon: 'radio',
            x: 24,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'ingress',
            inspector: {
              role: 'Điểm vào kích hoạt luồng DAG (5 loại trigger)',
              packageOrPort: '@latticedx/plugin-dxos-studio · flow/nodes/triggers.js',
              protocol: 'CloudEvents · ORM Hook · Cron · Webhook',
              payloadOrSchema: 'trigger.{event, record, schedule, webhook, manual}',
              responsibilities:
                'Xác thực dxosAutomations:webhookIngress (HMAC-SHA256, Bearer hoặc Standard Webhooks), kiểm tra cooldownSec và nạp triggerPayloadJson.',
            },
          },
          {
            id: 'executor',
            title: 'Bộ chạy Topo DAG',
            sub: ['{{steps.*}} depth<=8', 'maxNodes 50 · policy'],
            icon: 'cpu',
            x: 260,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'dag-core',
            focal: true,
            inspector: {
              role: 'Duyệt đồ thị topo, ngữ cảnh biến & xử lý lỗi',
              packageOrPort: '@latticedx/plugin-dxos-studio · flow/executor.js',
              protocol: 'Kahn Topo Sort · runNodeInRlsSavepoint',
              payloadOrSchema: "errorPolicy: 'stop' | 'continue' · MAX_HARD_DEPTH = 8",
              responsibilities:
                'Thực thi tối đa 50 node trong giao dịch FORCE RLS, phân giải {{steps.*}} an toàn (không eval), định tuyến cổng error theo errorPolicy và lưu trace cho :replayRun.',
            },
          },
          {
            id: 'logic-ctrl',
            title: 'Logic & Điều khiển\n(10 Loại Node)',
            sub: ['logic.dmn · transform', 'if · switch · loop', 'parallel · merge'],
            icon: 'workflow',
            x: 496,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'dag-core',
            inspector: {
              role: 'Đánh giá FEEL, biến đổi và rẽ nhánh (2 logic + 8 control)',
              packageOrPort: '@latticedx/plugin-dxos-studio · control.js · logic.js',
              protocol: 'In-process DAG Ports · MAX_LOOP_ITERATIONS = 100',
              payloadOrSchema: 'logic.{dmn, transform} · control.{if, switch, parallel, merge, loop, delay, approval, subflow}',
              responsibilities:
                'Đánh giá bảng quyết định DMN, biến đổi dữ liệu khai báo, rẽ nhánh có điều kiện, chia/gộp song song, lặp có con trỏ và gọi subflow (độ sâu <= 8).',
            },
          },
          {
            id: 'checkpoint',
            title: 'Tạm dừng & Tiếp PG16',
            sub: ['control.delay · HITL', 'loopCursors · :replay'],
            icon: 'database',
            x: 732,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'dag-core',
            inspector: {
              role: 'Lưu trạng thái tạm dừng, con trỏ vòng lặp & chạy lại',
              packageOrPort: '@latticedx/plugin-dxos-studio · durable-store.js · loop-resume.js',
              protocol: 'PostgreSQL 16 FORCE RLS · :resumeRun · :replayRun',
              payloadOrSchema: 'latticeAutomationRuns (loopCursors, resumeTokenHash, stepTracesJson)',
              responsibilities:
                'Đóng băng snapshot DAG khi gặp control.delay hoặc control.approval, lưu loopCursors JSONB và hỗ trợ phát lại từ trace gốc qua :replayRun.',
            },
          },
          {
            id: 'effects',
            title: 'Tác vụ & Sự kiện\n(9 Loại Node)',
            sub: ['data.* RLS · ai.agent', 'http · twin · notify', 'event.emit (Outbox)'],
            icon: 'plug',
            x: 968,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'egress',
            inspector: {
              role: 'Ghi dữ liệu, suy luận AI & tích hợp (3 data + 2 ai + 4 integration)',
              packageOrPort: '@latticedx/plugin-dxos-studio · data.js · ai.js · integrations.js',
              protocol: 'FORCE RLS · LLM ReAct · SSRF HTTPS · Node-RED · CloudEvents',
              payloadOrSchema: 'data.{query,create,update} · ai.{llm,agent} · http · iot.twin_command · notify.send · event.emit',
              responsibilities:
                'Thao tác bản ghi trong danh sách bảng cho phép, chạy tác nhân AI (maxTurns <= 12), gọi HTTP qua Vault, đẩy lệnh Digital Twin và phát CloudEvents.',
            },
          },
        ],
        edges: [
          {
            id: 'e1',
            from: 'triggers',
            to: 'executor',
            label: 'run',
            kind: 'flow',
            points: [
              [200, 132],
              [260, 132],
            ],
          },
          {
            id: 'e2',
            from: 'executor',
            to: 'logic-ctrl',
            label: 'topo',
            kind: 'primary',
            points: [
              [436, 132],
              [496, 132],
            ],
          },
          {
            id: 'e3',
            from: 'logic-ctrl',
            to: 'checkpoint',
            label: 'park',
            kind: 'flow',
            points: [
              [672, 132],
              [732, 132],
            ],
          },
          {
            id: 'e4',
            from: 'checkpoint',
            to: 'effects',
            label: 'exec',
            kind: 'primary',
            points: [
              [908, 132],
              [968, 132],
            ],
          },
          {
            id: 'e5',
            from: 'logic-ctrl',
            to: 'effects',
            label: 'nhánh tức thì (không chờ)',
            kind: 'dashed',
            points: [
              [584, 180],
              [584, 218],
              [1056, 218],
              [1056, 180],
            ],
          },
        ],
        steps: [
          {
            id: 's1',
            title: 'Nạp Kích hoạt & Lập lịch Topo',
            activeNodes: ['triggers', 'executor'],
            activeEdges: ['e1'],
            description:
              'Nhận một trong 5 trigger.*, khởi tạo ngữ cảnh FORCE RLS và sắp xếp thứ tự topo tối đa 50 node trong DAG.',
            route: 'trigger.* -> executor.js (Kahn Topo Sort)',
            payload: 'maxDepth <= 8 · maxNodes <= 50',
            chips: ['5 Triggers', 'FORCE RLS'],
          },
          {
            id: 's2',
            title: 'Đánh giá Logic & Rẽ nhánh',
            activeNodes: ['executor', 'logic-ctrl', 'effects'],
            activeEdges: ['e2', 'e5'],
            description:
              'Đánh giá logic.dmn / transform và rẽ nhánh qua 8 control.*; nhánh không tạm dừng đi thẳng tới bước tác vụ.',
            route: 'logic.* / control.* -> side effects',
            payload: "errorPolicy: 'stop' | 'continue'",
            chips: ['10 Logic & Control', 'Zero eval()'],
          },
          {
            id: 's3',
            title: 'Checkpoint PG16 & Tác vụ Hạ nguồn',
            activeNodes: ['logic-ctrl', 'checkpoint', 'effects'],
            activeEdges: ['e3', 'e4'],
            description:
              'Khi gặp delay, HITL approval hoặc vòng lặp treo, snapshot ghi vào PG16 trước khi tiếp tục chạy 9 node tác vụ & sự kiện.',
            route: 'PG16 Checkpoint -> data.* / ai.* / integration.*',
            payload: 'loopCursors · :replayRun · CloudEvents 1.0',
            chips: ['Durable PG16', '9 Side Effects'],
          },
        ],
      },
      {
        id: 'durable-checkpoint',
        label: 'Vòng đời Loop & Checkpoint HITL',
        viewBox: '0 0 1168 260',
        zones: [
          { id: 'suspend-zone', label: 'Tạm dừng & Lưu PG16', x: 12, y: 20, width: 436, height: 212, kind: 'admin' },
          { id: 'resume-zone', label: 'Đánh thức & Claim Nguyên tử', x: 484, y: 20, width: 436, height: 212, kind: 'traffic' },
          { id: 'branch-zone', label: 'Nhánh Tiếp tục', x: 956, y: 20, width: 200, height: 212, kind: 'admin' },
        ],
        nodes: [
          {
            id: 'dag-pause',
            title: 'Tạm dừng Thực thi',
            sub: ['control.approval', 'control.loop · delay'],
            icon: 'lock',
            x: 24,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'suspend-zone',
            inspector: {
              role: 'Điểm tạm dừng có kiểm soát trong DAG',
              packageOrPort: '@latticedx/plugin-dxos-studio · control.js',
              protocol: 'suspendRun · ttlHours: 24',
              payloadOrSchema: "control.approval | control.delay | control.loop (<=100)",
              responsibilities:
                'Dừng nhánh thực thi mà không giữ kết nối HTTP hay khóa RAM khi chờ phê duyệt HITL hoặc hết thời gian chờ delay.',
            },
          },
          {
            id: 'pg-suspend',
            title: 'Trạng thái Treo PG16',
            sub: ["status='suspended'", 'SHA-256 · loopCursors'],
            icon: 'database',
            x: 260,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'suspend-zone',
            focal: true,
            inspector: {
              role: 'Lưu snapshot đồ thị, token băm và ngăn xếp vòng lặp',
              packageOrPort: '@latticedx/plugin-dxos-studio · durable-store.js · loop-resume.js',
              protocol: 'PostgreSQL 16 FORCE RLS · SHA-256 (24B hex)',
              payloadOrSchema: '{ approvalId, resumeTokenHash, nodeStatesJson, loopCursors }',
              responsibilities:
                'Chỉ lưu bản băm SHA-256 của resumeToken 24-byte cùng trạng thái từng node và con trỏ currentIndex của control.loop.',
            },
          },
          {
            id: 'hitl-wakeup',
            title: 'Duyệt & Hẹn giờ',
            sub: ['dxosApprovals:decide', 'Scheduler 15s'],
            icon: 'shield',
            x: 496,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'resume-zone',
            inspector: {
              role: 'Xác minh thẩm quyền duyệt hoặc đánh thức theo lịch',
              packageOrPort: 'delegation-engine.js · cron.js (DX_FLOW_DELAY_TICK_MS)',
              protocol: 'RBAC + Delegation (<=90d) · PG Advisory Lock',
              payloadOrSchema: 'dxosApprovals:decide | tickFlowScheduler (15000ms)',
              responsibilities:
                'Kiểm tra vai trò approverRole / ủy quyền hợp lệ (chặn tự duyệt), hoặc bộ quét 15s đánh thức delay và hết hạn TTL.',
            },
          },
          {
            id: 'atomic-claim',
            title: 'Claim Nguyên tử',
            sub: ['POST :resumeRun', 'UPDATE ... RETURNING'],
            icon: 'key',
            x: 732,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'resume-zone',
            focal: true,
            inspector: {
              role: 'Chiếm quyền tiếp tục duy nhất một lần (chống race)',
              packageOrPort: '@latticedx/plugin-dxos-studio · loop-resume.js',
              protocol: 'SQL UPDATE ... RETURNING * · timingSafeEqualHex',
              payloadOrSchema: "WHERE status = 'suspended' -> 'resuming'",
              responsibilities:
                'Thực thi claimSuspendedRun nguyên tử để ngăn hai người duyệt cùng kích hoạt một lượt chạy và nạp resumeLoopStack.',
            },
          },
          {
            id: 'resume-out',
            title: 'Nhánh Hạ nguồn',
            sub: ['approved / rejected', 'loop done (results[])'],
            icon: 'check-circle',
            x: 968,
            y: 84,
            width: 176,
            height: 96,
            zoneId: 'branch-zone',
            inspector: {
              role: 'Tiếp tục thực thi đồ thị hoặc hoàn tất vòng lặp',
              packageOrPort: '@latticedx/plugin-dxos-studio · executor.js · finishLoopNode',
              protocol: 'Ports: approved · rejected · done',
              payloadOrSchema: '{{resumeDecision}} · {{resumePayload}} · loopResults[]',
              responsibilities:
                'Đẩy ngữ cảnh quyết định xuống nhánh approved/rejected hoặc lặp tiếp currentIndex++ và xuất loopResults[] ra cổng done.',
            },
          },
        ],
        edges: [
          {
            id: 'c1',
            from: 'dag-pause',
            to: 'pg-suspend',
            label: 'save',
            kind: 'flow',
            points: [
              [200, 132],
              [260, 132],
            ],
          },
          {
            id: 'c2',
            from: 'pg-suspend',
            to: 'hitl-wakeup',
            label: 'wake',
            kind: 'dashed',
            points: [
              [436, 132],
              [496, 132],
            ],
          },
          {
            id: 'c3',
            from: 'hitl-wakeup',
            to: 'atomic-claim',
            label: 'claim',
            kind: 'primary',
            points: [
              [672, 132],
              [732, 132],
            ],
          },
          {
            id: 'c4',
            from: 'atomic-claim',
            to: 'resume-out',
            label: 'next',
            kind: 'primary',
            points: [
              [908, 132],
              [968, 132],
            ],
          },
        ],
        steps: [
          {
            id: 'dc1',
            title: 'Đóng băng Snapshot vào PG16',
            activeNodes: ['dag-pause', 'pg-suspend'],
            activeEdges: ['c1'],
            description:
              'control.approval, control.delay hoặc control.loop tạm dừng và ghi resumeTokenHash (SHA-256) cùng loopCursors vào PG16.',
            route: 'suspendRun() -> latticeAutomationRuns',
            payload: "status = 'suspended' · ttlHours = 24",
            chips: ['SHA-256 Token', 'loopCursors'],
          },
          {
            id: 'dc2',
            title: 'Đánh thức & Claim Nguyên tử',
            activeNodes: ['pg-suspend', 'hitl-wakeup', 'atomic-claim'],
            activeEdges: ['c2', 'c3'],
            description:
              'Người duyệt hoặc bộ quét 15s kích hoạt :resumeRun; câu lệnh SQL UPDATE ... RETURNING bảo đảm chỉ một tiến trình được tiếp tục.',
            route: 'POST /api/dxosAutomations:resumeRun',
            payload: "UPDATE ... WHERE status = 'suspended' RETURNING *",
            chips: ['Zero Double-Resume', '15s Tick'],
          },
          {
            id: 'dc3',
            title: 'Tiếp tục Nhánh hoặc Thoát Vòng lặp',
            activeNodes: ['atomic-claim', 'resume-out'],
            activeEdges: ['c4'],
            description:
              'Động cơ khôi phục ngữ cảnh {{resumeDecision}} tới nhánh approved/rejected hoặc hoàn tất control.loop và xuất mảng loopResults[].',
            route: 'approved | rejected | done -> downstream',
            payload: 'steps.<loopId>.results = loopResults[]',
            chips: ['Deterministic Resume'],
          },
        ],
      },
    ];
  }

  return [
    {
      id: 'dag-pipeline',
      label: 'DAG Execution Pipeline (24 Node Types)',
      viewBox: '0 0 1168 272',
      zones: [
        { id: 'ingress', label: 'Trigger Ingress', x: 12, y: 20, width: 200, height: 228, kind: 'admin' },
        { id: 'dag-core', label: 'DAG v2 Runtime & PG16 Checkpoints', x: 248, y: 20, width: 672, height: 228, kind: 'traffic' },
        { id: 'egress', label: 'Side Effects & Events', x: 956, y: 20, width: 200, height: 228, kind: 'admin' },
      ],
      nodes: [
        {
          id: 'triggers',
          title: 'Trigger Ingress (5)',
          sub: ['event · record · cron', 'webhook · manual'],
          icon: 'radio',
          x: 24,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'ingress',
          inspector: {
            role: 'Entry points initiating DAG runs (5 trigger types)',
            packageOrPort: '@latticedx/plugin-dxos-studio · flow/nodes/triggers.js',
            protocol: 'CloudEvents · ORM Hook · Cron · Webhook',
            payloadOrSchema: 'trigger.{event, record, schedule, webhook, manual}',
            responsibilities:
              'Authenticates dxosAutomations:webhookIngress (HMAC-SHA256, Bearer, or Standard Webhooks), enforces cooldownSec, and captures triggerPayloadJson.',
          },
        },
        {
          id: 'executor',
          title: 'DAG Topological Runner',
          sub: ['{{steps.*}} depth<=8', 'maxNodes 50 · policy'],
          icon: 'cpu',
          x: 260,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'dag-core',
          focal: true,
          inspector: {
            role: 'Topological graph traversal, template scope & error policy',
            packageOrPort: '@latticedx/plugin-dxos-studio · flow/executor.js',
            protocol: 'Kahn Topo Sort · runNodeInRlsSavepoint',
            payloadOrSchema: "errorPolicy: 'stop' | 'continue' · MAX_HARD_DEPTH = 8",
            responsibilities:
              'Runs up to 50 nodes inside tenant FORCE RLS savepoints, resolves {{steps.*}} safely without eval, routes error edges per errorPolicy, and records traces for :replayRun.',
          },
        },
        {
          id: 'logic-ctrl',
          title: 'Logic & Control\n(10 Node Types)',
          sub: ['logic.dmn · transform', 'if · switch · loop', 'parallel · merge'],
          icon: 'workflow',
          x: 496,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'dag-core',
          inspector: {
            role: 'FEEL evaluation, transforms & graph routing (2 logic + 8 control)',
            packageOrPort: '@latticedx/plugin-dxos-studio · control.js · logic.js',
            protocol: 'In-process DAG Ports · MAX_LOOP_ITERATIONS = 100',
            payloadOrSchema: 'logic.{dmn, transform} · control.{if, switch, parallel, merge, loop, delay, approval, subflow}',
            responsibilities:
              'Evaluates DMN tables, executes declarative transforms, branches deterministically, fans out/merges parallel paths, iterates loops, and invokes subflows (depth <= 8).',
          },
        },
        {
          id: 'checkpoint',
          title: 'PG16 Suspend & Resume',
          sub: ['control.delay · HITL', 'loopCursors · :replay'],
          icon: 'database',
          x: 732,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'dag-core',
          inspector: {
            role: 'Durable suspension state, loop cursors & trace replay',
            packageOrPort: '@latticedx/plugin-dxos-studio · durable-store.js · loop-resume.js',
            protocol: 'PostgreSQL 16 FORCE RLS · :resumeRun · :replayRun',
            payloadOrSchema: 'latticeAutomationRuns (loopCursors, resumeTokenHash, stepTracesJson)',
            responsibilities:
              'Snapshots DAG state on control.delay or control.approval, persists loopCursors JSONB across restarts, and supports full run replay via dxosAutomations:replayRun.',
          },
        },
        {
          id: 'effects',
          title: 'Side Effects & Events (9)',
          sub: ['data.* RLS · ai.agent', 'http · twin · notify', 'event.emit (Outbox)'],
          icon: 'plug',
          x: 968,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'egress',
          inspector: {
            role: 'Scoped mutations, AI agents & integrations (3 data + 2 ai + 4 integration)',
            packageOrPort: '@latticedx/plugin-dxos-studio · data.js · ai.js · integrations.js',
            protocol: 'FORCE RLS · LLM ReAct · SSRF HTTPS · Node-RED · CloudEvents',
            payloadOrSchema: 'data.{query,create,update} · ai.{llm,agent} · http · iot.twin_command · notify.send · event.emit',
            responsibilities:
              'Mutates allowlisted collections, executes bounded ReAct agents (maxTurns <= 12), calls Vault HTTP connectors, sends Digital Twin commands, and emits CloudEvents.',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          from: 'triggers',
          to: 'executor',
          label: 'run',
          kind: 'flow',
          points: [
            [200, 132],
            [260, 132],
          ],
        },
        {
          id: 'e2',
          from: 'executor',
          to: 'logic-ctrl',
          label: 'topo',
          kind: 'primary',
          points: [
            [436, 132],
            [496, 132],
          ],
        },
        {
          id: 'e3',
          from: 'logic-ctrl',
          to: 'checkpoint',
          label: 'park',
          kind: 'flow',
          points: [
            [672, 132],
            [732, 132],
          ],
        },
        {
          id: 'e4',
          from: 'checkpoint',
          to: 'effects',
          label: 'exec',
          kind: 'primary',
          points: [
            [908, 132],
            [968, 132],
          ],
        },
        {
          id: 'e5',
          from: 'logic-ctrl',
          to: 'effects',
          label: 'direct path (no suspend)',
          kind: 'dashed',
          points: [
            [584, 180],
            [584, 218],
            [1056, 218],
            [1056, 180],
          ],
        },
      ],
      steps: [
        {
          id: 's1',
          title: 'Trigger Ingress & Topological Sort',
          activeNodes: ['triggers', 'executor'],
          activeEdges: ['e1'],
          description:
            'Accepts one of 5 trigger.* entry points, initializes tenant FORCE RLS context, and schedules up to 50 nodes in topological order.',
          route: 'trigger.* -> executor.js (Kahn Topo Sort)',
          payload: 'maxDepth <= 8 · maxNodes <= 50',
          chips: ['5 Triggers', 'FORCE RLS'],
        },
        {
          id: 's2',
          title: 'Logic Evaluation & Control Branching',
          activeNodes: ['executor', 'logic-ctrl', 'effects'],
          activeEdges: ['e2', 'e5'],
          description:
            'Evaluates logic.dmn / transform and routes across 8 control.* nodes; non-suspending branches proceed directly to side effects.',
          route: 'logic.* / control.* -> side effects',
          payload: "errorPolicy: 'stop' | 'continue'",
          chips: ['10 Logic & Control', 'Zero eval()'],
        },
        {
          id: 's3',
          title: 'PG16 Checkpoint & Downstream Effects',
          activeNodes: ['logic-ctrl', 'checkpoint', 'effects'],
          activeEdges: ['e3', 'e4'],
          description:
            'Delays, HITL approvals, and suspended loops persist state to PG16 before resuming execution across 9 data, AI, and integration nodes.',
          route: 'PG16 Checkpoint -> data.* / ai.* / integration.*',
          payload: 'loopCursors · :replayRun · CloudEvents 1.0',
          chips: ['Durable PG16', '9 Side Effects'],
        },
      ],
    },
    {
      id: 'durable-checkpoint',
      label: 'Durable Loop & HITL Checkpoint Lifecycle',
      viewBox: '0 0 1168 260',
      zones: [
        { id: 'suspend-zone', label: 'Suspend & Persist (PG16)', x: 12, y: 20, width: 436, height: 212, kind: 'admin' },
        { id: 'resume-zone', label: 'Wakeup & Atomic Claim', x: 484, y: 20, width: 436, height: 212, kind: 'traffic' },
        { id: 'branch-zone', label: 'Resumed Graph', x: 956, y: 20, width: 200, height: 212, kind: 'admin' },
      ],
      nodes: [
        {
          id: 'dag-pause',
          title: 'Execution Pause',
          sub: ['control.approval', 'control.loop · delay'],
          icon: 'lock',
          x: 24,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'suspend-zone',
          inspector: {
            role: 'Controlled DAG suspension gate',
            packageOrPort: '@latticedx/plugin-dxos-studio · control.js',
            protocol: 'suspendRun · ttlHours: 24',
            payloadOrSchema: 'control.approval | control.delay | control.loop (<=100)',
            responsibilities:
              'Halts branch execution without holding open HTTP requests or in-memory timers while awaiting human approval or scheduled delay.',
          },
        },
        {
          id: 'pg-suspend',
          title: 'PG16 Suspended State',
          sub: ["status='suspended'", 'SHA-256 · loopCursors'],
          icon: 'database',
          x: 260,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'suspend-zone',
          focal: true,
          inspector: {
            role: 'Durable graph snapshot, hashed token & loop cursor stack',
            packageOrPort: '@latticedx/plugin-dxos-studio · durable-store.js · loop-resume.js',
            protocol: 'PostgreSQL 16 FORCE RLS · SHA-256 (24B hex)',
            payloadOrSchema: '{ approvalId, resumeTokenHash, nodeStatesJson, loopCursors }',
            responsibilities:
              'Stores only the SHA-256 digest of the 24-byte resumeToken alongside nodeStatesJson and the active control.loop currentIndex stack.',
          },
        },
        {
          id: 'hitl-wakeup',
          title: 'Approver / Delay Wakeup',
          sub: ['dxosApprovals:decide', 'Scheduler 15s'],
          icon: 'shield',
          x: 496,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'resume-zone',
          inspector: {
            role: 'Authority verification or scheduled wakeup trigger',
            packageOrPort: 'delegation-engine.js · cron.js (DX_FLOW_DELAY_TICK_MS)',
            protocol: 'RBAC + Delegation (<=90d) · PG Advisory Lock',
            payloadOrSchema: 'dxosApprovals:decide | tickFlowScheduler (15000ms)',
            responsibilities:
              'Validates approverRole / active delegation (blocking self-approval), or wakes due delays and expires overdue approvals every 15s.',
          },
        },
        {
          id: 'atomic-claim',
          title: 'Atomic Claim & Resume',
          sub: ['POST :resumeRun', 'UPDATE ... RETURNING'],
          icon: 'key',
          x: 732,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'resume-zone',
          focal: true,
          inspector: {
            role: 'Single-winner atomic resumption (race-safe)',
            packageOrPort: '@latticedx/plugin-dxos-studio · loop-resume.js',
            protocol: 'SQL UPDATE ... RETURNING * · timingSafeEqualHex',
            payloadOrSchema: "WHERE status = 'suspended' -> 'resuming'",
            responsibilities:
              'Executes claimSuspendedRun atomically to prevent concurrent double-resume and invokes resumeLoopStack at the saved index.',
          },
        },
        {
          id: 'resume-out',
          title: 'Downstream Branch',
          sub: ['approved / rejected', 'loop done (results[])'],
          icon: 'check-circle',
          x: 968,
          y: 84,
          width: 176,
          height: 96,
          zoneId: 'branch-zone',
          inspector: {
            role: 'Resumed downstream DAG execution or loop completion',
            packageOrPort: '@latticedx/plugin-dxos-studio · executor.js · finishLoopNode',
            protocol: 'Ports: approved · rejected · done',
            payloadOrSchema: '{{resumeDecision}} · {{resumePayload}} · loopResults[]',
            responsibilities:
              'Injects {{resumeDecision}} into approved/rejected branches or finishes control.loop iterations and emits aggregated loopResults[].',
          },
        },
      ],
      edges: [
        {
          id: 'c1',
          from: 'dag-pause',
          to: 'pg-suspend',
          label: 'save',
          kind: 'flow',
          points: [
            [200, 132],
            [260, 132],
          ],
        },
        {
          id: 'c2',
          from: 'pg-suspend',
          to: 'hitl-wakeup',
          label: 'wake',
          kind: 'dashed',
          points: [
            [436, 132],
            [496, 132],
          ],
        },
        {
          id: 'c3',
          from: 'hitl-wakeup',
          to: 'atomic-claim',
          label: 'claim',
          kind: 'primary',
          points: [
            [672, 132],
            [732, 132],
          ],
        },
        {
          id: 'c4',
          from: 'atomic-claim',
          to: 'resume-out',
          label: 'next',
          kind: 'primary',
          points: [
            [908, 132],
            [968, 132],
          ],
        },
      ],
      steps: [
        {
          id: 'dc1',
          title: 'Freeze Snapshot into PG16',
          activeNodes: ['dag-pause', 'pg-suspend'],
          activeEdges: ['c1'],
          description:
            'control.approval, control.delay, or control.loop pauses execution and writes resumeTokenHash (SHA-256) and loopCursors to PG16.',
          route: 'suspendRun() -> latticeAutomationRuns',
          payload: "status = 'suspended' · ttlHours = 24",
          chips: ['SHA-256 Token', 'loopCursors'],
        },
        {
          id: 'dc2',
          title: 'Wakeup & Atomic Claim',
          activeNodes: ['pg-suspend', 'hitl-wakeup', 'atomic-claim'],
          activeEdges: ['c2', 'c3'],
          description:
            'Approver decision or the 15s scheduler triggers :resumeRun; SQL UPDATE ... RETURNING guarantees a single atomic winner.',
          route: 'POST /api/dxosAutomations:resumeRun',
          payload: "UPDATE ... WHERE status = 'suspended' RETURNING *",
          chips: ['Zero Double-Resume', '15s Tick'],
        },
        {
          id: 'dc3',
          title: 'Resume Branch or Exit Loop',
          activeNodes: ['atomic-claim', 'resume-out'],
          activeEdges: ['c4'],
          description:
            'Restores {{resumeDecision}} into approved/rejected paths or completes control.loop iterations and emits loopResults[].',
          route: 'approved | rejected | done -> downstream',
          payload: 'steps.<loopId>.results = loopResults[]',
          chips: ['Deterministic Resume'],
        },
      ],
    },
  ];
});
</script>

<template>
  <DiagramCanvas
    :title="title"
    :caption="caption"
    viewBox="0 0 1168 272"
    :modes="modes"
    :lang="resolvedLang"
  />
</template>
