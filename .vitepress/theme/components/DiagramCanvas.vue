<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject, ref, useId, watch } from 'vue';
import { dataSymbol } from 'vitepress';
import StrokeIcon from './StrokeIcon.vue';
import type {
  DiagramEdge,
  DiagramLocale,
  DiagramMode,
  DiagramNode,
  DiagramStep,
  DiagramZone,
} from './diagramTypes';

const props = withDefaults(
  defineProps<{
    title: string;
    caption?: string;
    viewBox?: string;
    modes?: DiagramMode[];
    zones?: DiagramZone[];
    nodes?: DiagramNode[];
    edges?: DiagramEdge[];
    steps?: DiagramStep[];
    initialStep?: number;
    compact?: boolean;
    lang?: DiagramLocale;
  }>(),
  {
    viewBox: '0 0 960 400',
    compact: false,
  },
);

const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') {
    return props.lang;
  }
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const labels = computed(() =>
  resolvedLang.value === 'vi'
    ? {
        overview: 'Tổng quan',
        stepPrefix: 'Bước',
        selectedNode: 'Đang chọn',
        inspectorBadge: 'Chi tiết khối',
        inspectorHint: 'Nhấn vào từng khối để xem giao diện & trách nhiệm',
        reset: 'Đặt lại',
        route: 'Tuyến',
        role: 'Vai trò',
        packageOrPort: 'Gói / Cổng',
        protocol: 'Giao thức',
        payloadOrSchema: 'Payload / Schema',
        responsibilities: 'Trách nhiệm',
        modeSelector: 'Chế độ hiển thị',
        stepWalkthrough: 'Các bước thực thi',
      }
    : {
        overview: 'Overview',
        stepPrefix: 'Step',
        selectedNode: 'Selected',
        inspectorBadge: 'Inspector',
        inspectorHint: 'Click any component to inspect bindings & boundaries',
        reset: 'Reset',
        route: 'Route',
        role: 'Role',
        packageOrPort: 'Package / Port',
        protocol: 'Protocol',
        payloadOrSchema: 'Payload / Schema',
        responsibilities: 'Responsibilities',
        modeSelector: 'Diagram view modes',
        stepWalkthrough: 'Execution walkthrough',
      },
);

const rawUid = useId();
const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '') || 'ldx';

const arrowNeutralId = `ldx-arrow-neutral-${uid}`;
const arrowMutedId = `ldx-arrow-muted-${uid}`;
const arrowFlowId = `ldx-arrow-flow-${uid}`;
const arrowAccentId = `ldx-arrow-accent-${uid}`;
const arrowReturnId = `ldx-arrow-return-${uid}`;

const activeModeIndex = ref(0);
const selectedStepIndex = ref<number | null>(null);
const selectedNodeId = ref<string | null>(null);

const hasModes = computed(() => Array.isArray(props.modes) && props.modes.length > 0);
const activeMode = computed<DiagramMode | null>(() => {
  if (!hasModes.value || !props.modes) return null;
  return props.modes[activeModeIndex.value] ?? props.modes[0] ?? null;
});

const resolvedViewBox = computed(() => activeMode.value?.viewBox ?? props.viewBox ?? '0 0 960 400');

const viewBoxDims = computed(() => {
  const parts = resolvedViewBox.value
    .trim()
    .split(/\s+/)
    .map((n) => Number(n));
  const width = Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : 960;
  const height = Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : 400;
  return { width, height };
});

const mobileStageMinWidth = computed(() => `${Math.max(580, Math.round(viewBoxDims.value.width * 0.68))}px`);

const currentZones = computed<DiagramZone[]>(() => activeMode.value?.zones ?? props.zones ?? []);
const currentNodes = computed<DiagramNode[]>(() => activeMode.value?.nodes ?? props.nodes ?? []);
const currentEdges = computed<DiagramEdge[]>(() => activeMode.value?.edges ?? props.edges ?? []);
const currentSteps = computed<DiagramStep[]>(() => activeMode.value?.steps ?? props.steps ?? []);

watch(
  () => activeModeIndex.value,
  () => {
    selectedStepIndex.value = null;
    selectedNodeId.value = null;
  },
);

const currentStep = computed<DiagramStep | null>(() => {
  if (selectedStepIndex.value === null) return null;
  return currentSteps.value[selectedStepIndex.value] ?? null;
});

const isFiltering = computed(
  () => selectedNodeId.value !== null || currentStep.value !== null,
);

const stepActiveNodeSet = computed(() => new Set(currentStep.value?.activeNodes ?? []));
const stepActiveEdgeSet = computed(() => new Set(currentStep.value?.activeEdges ?? []));

// Text wrapping utilities (zero <clipPath> truncation)
function splitLongToken(token: string, maxChars: number): string[] {
  if (token.length <= maxChars) return [token];
  const parts: string[] = [];
  let remaining = token;
  while (remaining.length > maxChars) {
    let splitAt = -1;
    for (let i = Math.min(maxChars, remaining.length - 1); i >= Math.max(4, Math.floor(maxChars * 0.45)); i--) {
      const ch = remaining[i];
      if (ch === '/' || ch === '·' || ch === '_' || ch === '-' || ch === '.' || ch === ':') {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt === -1) {
      splitAt = maxChars;
    }
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function wrapLines(
  input: string | string[] | undefined,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  if (!input) return [];
  const rawSegments = Array.isArray(input)
    ? input.flatMap((line) => String(line).split('\n'))
    : String(input).split('\n');

  const lines: string[] = [];
  for (const segment of rawSegments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    let current = '';

    for (const word of words) {
      const chunks = splitLongToken(word, maxCharsPerLine);
      for (const chunk of chunks) {
        if (!current) {
          current = chunk;
        } else if (current.length + 1 + chunk.length <= maxCharsPerLine) {
          current = `${current} ${chunk}`;
        } else {
          lines.push(current);
          current = chunk;
        }
      }
    }
    if (current) lines.push(current);
  }

  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, maxLines - 1);
  const tail = lines.slice(maxLines - 1).join(' ');
  return [...head, tail];
}

interface ComputedNode {
  node: DiagramNode;
  x: number;
  y: number;
  w: number;
  h: number;
  titleLines: string[];
  subLines: string[];
  titleStartY: number;
  subStartY: number;
  iconY: number;
  subText: string;
}

const TITLE_LINE_HEIGHT = 15;
const SUB_LINE_HEIGHT = 13.5;
const TITLE_SUB_GAP = 4;

const computedNodes = computed<ComputedNode[]>(() => {
  return currentNodes.value.map((node) => {
    const w = node.width ?? 160;
    const baseH = node.height ?? 64;
    const textAvailW = Math.max(64, w - 46);
    const maxTitleChars = Math.max(11, Math.floor(textAvailW / 7.6));
    const maxSubChars = Math.max(13, Math.floor(textAvailW / 6.05));

    const titleLines = wrapLines(node.title, maxTitleChars, 2);
    const subLines = wrapLines(node.sub, maxSubChars, 3);

    const titleBlockH = titleLines.length * TITLE_LINE_HEIGHT;
    const subBlockH = subLines.length > 0 ? TITLE_SUB_GAP + subLines.length * SUB_LINE_HEIGHT : 0;
    const totalTextH = titleBlockH + subBlockH;

    const h = Math.max(baseH, Math.ceil(totalTextH + 16));
    const topY = node.y + Math.round((h - totalTextH) / 2);
    const titleStartY = topY + 11.5;
    const subStartY = topY + titleBlockH + TITLE_SUB_GAP + 10;
    const iconY = node.y + Math.round((h - 16) / 2);
    const subText = Array.isArray(node.sub) ? node.sub.join(' · ') : (node.sub ?? '');

    return {
      node,
      x: node.x,
      y: node.y,
      w,
      h,
      titleLines,
      subLines,
      titleStartY,
      subStartY,
      iconY,
      subText,
    };
  });
});

const nodeMap = computed(() => {
  const map = new Map<string, ComputedNode>();
  for (const item of computedNodes.value) {
    map.set(item.node.id, item);
  }
  return map;
});

function isNodeHighlighted(nodeId: string): boolean {
  if (selectedNodeId.value) {
    if (selectedNodeId.value === nodeId) return true;
    return currentEdges.value.some(
      (e) =>
        (e.from === selectedNodeId.value && e.to === nodeId) ||
        (e.to === selectedNodeId.value && e.from === nodeId),
    );
  }
  if (currentStep.value) {
    return stepActiveNodeSet.value.has(nodeId);
  }
  return Boolean(nodeMap.value.get(nodeId)?.node.focal);
}

function isNodeDimmed(nodeId: string): boolean {
  if (selectedNodeId.value) {
    return !isNodeHighlighted(nodeId);
  }
  if (currentStep.value && currentStep.value.activeNodes.length > 0) {
    return !stepActiveNodeSet.value.has(nodeId);
  }
  return false;
}

function isEdgeActive(edge: DiagramEdge): boolean {
  if (selectedNodeId.value) {
    return edge.from === selectedNodeId.value || edge.to === selectedNodeId.value;
  }
  if (currentStep.value) {
    return stepActiveEdgeSet.value.has(edge.id);
  }
  return true;
}

function isEdgeDimmed(edge: DiagramEdge): boolean {
  return isFiltering.value && !isEdgeActive(edge);
}

const inspectedNode = computed<DiagramNode | null>(() => {
  if (selectedNodeId.value) {
    const found = nodeMap.value.get(selectedNodeId.value);
    if (found) return found.node;
  }
  if (currentStep.value && currentStep.value.activeNodes.length > 0) {
    const activeList = currentStep.value.activeNodes
      .map((id) => nodeMap.value.get(id)?.node)
      .filter((n): n is DiagramNode => Boolean(n));
    const focalInStep = activeList.find((n) => n.focal);
    if (focalInStep) return focalInStep;
    if (activeList[0]) return activeList[0];
  }
  const anyFocal = currentNodes.value.find((n) => n.focal);
  return anyFocal ?? currentNodes.value[0] ?? null;
});

function buildRoundedOrthogonalPath(pts: Array<[number, number]>, radius = 6): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;

  const segments: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const v1x = curr[0] - prev[0];
    const v1y = curr[1] - prev[1];
    const v2x = next[0] - curr[0];
    const v2y = next[1] - curr[1];

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 0.5 || len2 < 0.5) {
      segments.push(`L ${curr[0]} ${curr[1]}`);
      continue;
    }

    const r = Math.min(radius, len1 / 2, len2 / 2);
    const p1x = curr[0] - (v1x / len1) * r;
    const p1y = curr[1] - (v1y / len1) * r;
    const p2x = curr[0] + (v2x / len2) * r;
    const p2y = curr[1] + (v2y / len2) * r;

    segments.push(`L ${p1x.toFixed(1)} ${p1y.toFixed(1)}`);
    segments.push(`Q ${curr[0]} ${curr[1]} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`);
  }

  const last = pts[pts.length - 1];
  segments.push(`L ${last[0]} ${last[1]}`);
  return segments.join(' ');
}

function computeAutoEdgePoints(from: ComputedNode, to: ComputedNode): Array<[number, number]> {
  const fx = from.x + from.w / 2;
  const fy = from.y + from.h / 2;
  const tx = to.x + to.w / 2;
  const ty = to.y + to.h / 2;
  const dx = tx - fx;
  const dy = ty - fy;

  if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
    const sx = dx >= 0 ? from.x + from.w : from.x;
    const ex = dx >= 0 ? to.x : to.x + to.w;
    if (Math.abs(fy - ty) <= 4) {
      return [
        [sx, fy],
        [ex, ty],
      ];
    }
    const mx = Math.round((sx + ex) / 2);
    return [
      [sx, fy],
      [mx, fy],
      [mx, ty],
      [ex, ty],
    ];
  }

  const sy = dy >= 0 ? from.y + from.h : from.y;
  const ey = dy >= 0 ? to.y : to.y + to.h;
  if (Math.abs(fx - tx) <= 4) {
    return [
      [fx, sy],
      [tx, ey],
    ];
  }
  const my = Math.round((sy + ey) / 2);
  return [
    [fx, sy],
    [fx, my],
    [tx, my],
    [tx, ey],
  ];
}

function polylineLength(pts: Array<[number, number]>): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

function polylinePointAt(pts: Array<[number, number]>, fraction = 0.5): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  const total = polylineLength(pts);
  if (total === 0) return pts[0];
  const clampedFrac = Math.min(0.92, Math.max(0.08, fraction));
  let target = total * clampedFrac;
  for (let i = 1; i < pts.length; i++) {
    const segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= segLen) {
      const t = segLen === 0 ? 0 : target / segLen;
      return [
        Math.round(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t),
        Math.round(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t),
      ];
    }
    target -= segLen;
  }
  return pts[pts.length - 1];
}

interface ComputedEdge {
  edge: DiagramEdge;
  pathD: string;
  labelPoint: [number, number];
}

const computedEdges = computed<ComputedEdge[]>(() => {
  const result: ComputedEdge[] = [];

  for (const edge of currentEdges.value) {
    const fromNode = nodeMap.value.get(edge.from);
    const toNode = nodeMap.value.get(edge.to);
    if (!fromNode || !toNode) continue;

    let pathD = '';
    let labelPoint: [number, number] = [0, 0];

    if (edge.selfLoop || edge.from === edge.to) {
      const cx = fromNode.x + fromNode.w / 2;
      const side = edge.selfLoop === 'bottom' ? 'bottom' : 'top';
      const yEdge = side === 'top' ? fromNode.y : fromNode.y + fromNode.h;
      const dir = side === 'top' ? -1 : 1;
      const x1 = cx - 20;
      const x2 = cx + 20;
      const cy = yEdge + dir * 32;
      pathD = `M ${x1} ${yEdge} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${yEdge}`;
      labelPoint = [cx, yEdge + dir * 30];
    } else {
      const pts =
        edge.points && edge.points.length >= 2
          ? edge.points
          : computeAutoEdgePoints(fromNode, toNode);
      pathD = buildRoundedOrthogonalPath(pts, 6);
      labelPoint = polylinePointAt(pts, edge.labelPosition ?? 0.5);
    }

    if (edge.labelOffset) {
      labelPoint = [
        labelPoint[0] + edge.labelOffset[0],
        labelPoint[1] + edge.labelOffset[1],
      ];
    }

    result.push({
      edge,
      pathD,
      labelPoint,
    });
  }

  return result;
});

function edgeStrokeColor(edge: DiagramEdge, dimmed: boolean): string {
  if (dimmed) {
    return 'var(--ldx-border-strong, #D6D3D1)';
  }
  if (edge.kind === 'primary') return 'var(--ldx-accent, #D94E1F)';
  if (edge.kind === 'dashed') return 'var(--ldx-muted, #68625D)';
  if (edge.kind === 'return') return 'var(--ldx-return, #475569)';
  return 'var(--ldx-flow, #2563EB)';
}

function edgeStrokeWidth(edge: DiagramEdge, dimmed: boolean): number {
  if (dimmed) return 1;
  if (edge.kind === 'primary') return isFiltering.value ? 1.8 : 1.6;
  if (edge.kind === 'dashed' || edge.kind === 'return') return isFiltering.value ? 1.55 : 1.35;
  return isFiltering.value ? 1.7 : 1.5;
}

function edgeDashArray(edge: DiagramEdge): string | undefined {
  if (edge.kind === 'dashed') return '5 4';
  if (edge.kind === 'return') return '6 3';
  return undefined;
}

function edgeMarkerEnd(edge: DiagramEdge, dimmed: boolean): string {
  if (dimmed) return `url(#${arrowNeutralId})`;
  if (edge.kind === 'primary') return `url(#${arrowAccentId})`;
  if (edge.kind === 'dashed') return `url(#${arrowMutedId})`;
  if (edge.kind === 'return') return `url(#${arrowReturnId})`;
  return `url(#${arrowFlowId})`;
}

function labelPillWidth(text: string): number {
  return Math.max(36, Math.ceil(text.length * 6.2 + 16));
}

function nodeCardFill(cNode: ComputedNode): string {
  const { node } = cNode;
  if (selectedNodeId.value === node.id) {
    return 'var(--ldx-accent-soft, rgba(217, 78, 31, 0.10))';
  }
  if (isFiltering.value && isNodeHighlighted(node.id)) {
    return node.focal
      ? 'var(--ldx-accent-soft, rgba(217, 78, 31, 0.10))'
      : 'var(--ldx-flow-soft, rgba(37, 99, 235, 0.10))';
  }
  if (node.tone === 'accent' || (!isFiltering.value && node.focal)) {
    return 'var(--ldx-accent-soft, rgba(217, 78, 31, 0.10))';
  }
  if (node.tone === 'flow') {
    return 'var(--ldx-flow-soft, rgba(37, 99, 235, 0.10))';
  }
  if (node.tone === 'muted') {
    return 'var(--ldx-surface-alt, #F2F0EA)';
  }
  return 'transparent';
}

function nodeCardStroke(cNode: ComputedNode): string {
  const { node } = cNode;
  if (selectedNodeId.value === node.id) {
    return 'var(--ldx-accent, #D94E1F)';
  }
  if (isFiltering.value && isNodeHighlighted(node.id)) {
    return node.focal ? 'var(--ldx-accent, #D94E1F)' : 'var(--ldx-flow, #2563EB)';
  }
  if (node.focal || node.tone === 'accent') {
    return 'var(--ldx-accent, #D94E1F)';
  }
  if (node.tone === 'flow') {
    return 'var(--ldx-flow, #2563EB)';
  }
  return 'var(--ldx-border-strong, #D6D3D1)';
}

function nodeCardStrokeWidth(cNode: ComputedNode): number {
  const { node } = cNode;
  if (selectedNodeId.value === node.id) return 1.5;
  if (isFiltering.value && isNodeHighlighted(node.id)) return 1.4;
  if (node.focal || node.tone === 'accent' || node.tone === 'flow') return 1.3;
  return 1;
}

function nodeIconColor(cNode: ComputedNode): string {
  const { node } = cNode;
  if (selectedNodeId.value === node.id || node.focal || node.tone === 'accent') {
    return 'var(--ldx-accent-text, #AF4204)';
  }
  if ((isFiltering.value && isNodeHighlighted(node.id)) || node.tone === 'flow') {
    return 'var(--ldx-flow, #2563EB)';
  }
  return 'var(--ldx-muted, #68625D)';
}

function formatStepTitle(rawTitle: string): string {
  const stripped = rawTitle.replace(/^\d+\s*[.·:)]\s*/, '').trim();
  return stripped || rawTitle;
}

function selectMode(idx: number) {
  activeModeIndex.value = idx;
  selectedStepIndex.value = null;
  selectedNodeId.value = null;
}

function selectOverview() {
  selectedStepIndex.value = null;
  selectedNodeId.value = null;
}

function toggleStep(idx: number) {
  selectedNodeId.value = null;
  if (selectedStepIndex.value === idx) {
    selectedStepIndex.value = null;
  } else {
    selectedStepIndex.value = idx;
  }
}

function selectNode(nodeId: string) {
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = null;
  } else {
    selectedNodeId.value = nodeId;
  }
}

function resetSelection() {
  selectedNodeId.value = null;
  selectedStepIndex.value = null;
}

function onContainerKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isFiltering.value) {
      e.preventDefault();
      resetSelection();
    }
    return;
  }
  if (currentSteps.value.length <= 1) return;
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    selectedNodeId.value = null;
    if (selectedStepIndex.value === null) {
      selectedStepIndex.value = 0;
    } else if (selectedStepIndex.value >= currentSteps.value.length - 1) {
      selectedStepIndex.value = null;
    } else {
      selectedStepIndex.value += 1;
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    selectedNodeId.value = null;
    if (selectedStepIndex.value === null) {
      selectedStepIndex.value = currentSteps.value.length - 1;
    } else if (selectedStepIndex.value <= 0) {
      selectedStepIndex.value = null;
    } else {
      selectedStepIndex.value -= 1;
    }
  }
}
</script>

<template>
  <figure
    class="ldx-diagram"
    :class="{ 'is-compact': compact }"
    tabindex="0"
    :aria-label="title"
    @keydown="onContainerKeydown"
  >
    <!-- Clean Editorial Header -->
    <div class="ldx-diagram-toolbar">
      <div class="ldx-toolbar-left">
        <span class="ldx-toolbar-title">{{ title }}</span>
      </div>

      <div v-if="isFiltering" class="ldx-toolbar-controls">
        <button type="button" class="ldx-reset-btn" @click="resetSelection">
          {{ labels.overview }}
        </button>
      </div>
    </div>

    <!-- Optional Segmented Mode Tabs -->
    <div
      v-if="hasModes && modes && modes.length > 1"
      class="ldx-mode-bar"
      role="tablist"
      :aria-label="labels.modeSelector"
    >
      <button
        v-for="(mode, idx) in modes"
        :key="mode.id"
        type="button"
        role="tab"
        class="ldx-mode-tab"
        :class="{ 'is-active': idx === activeModeIndex }"
        :aria-selected="idx === activeModeIndex"
        @click="selectMode(idx)"
      >
        {{ mode.label }}
      </button>
    </div>

    <!-- Static-First Full-Contrast SVG Canvas -->
    <div class="ldx-svg-stage" :style="{ '--ldx-mobile-min-w': mobileStageMinWidth }">
      <svg
        :viewBox="resolvedViewBox"
        class="ldx-svg-canvas"
        role="img"
        :aria-label="title"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            :id="arrowNeutralId"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 1 1.5 L 7 4 L 1 6.5 z" fill="var(--ldx-border-strong, #D6D3D1)" />
          </marker>
          <marker
            :id="arrowMutedId"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 1 1.5 L 7 4 L 1 6.5 z" fill="var(--ldx-muted, #68625D)" />
          </marker>
          <marker
            :id="arrowFlowId"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 1 1.5 L 7 4 L 1 6.5 z" fill="var(--ldx-flow, #2563EB)" />
          </marker>
          <marker
            :id="arrowAccentId"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 1 1.5 L 7 4 L 1 6.5 z" fill="var(--ldx-accent, #D94E1F)" />
          </marker>
          <marker
            :id="arrowReturnId"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 1 1.5 L 7 4 L 1 6.5 z" fill="var(--ldx-return, #475569)" />
          </marker>
        </defs>

        <!-- Layer 1: Containment Zones -->
        <g class="ldx-layer-zones">
          <g v-for="zone in currentZones" :key="zone.id">
            <template v-if="zone.kind === 'admin'">
              <rect
                :x="zone.x"
                :y="zone.y"
                :width="zone.width"
                :height="zone.height"
                rx="6"
                fill="var(--ldx-surface-alt, #F2F0EA)"
                fill-opacity="0.42"
                stroke="var(--ldx-border, #E7E5E4)"
                stroke-width="1"
              />
              <line
                :x1="zone.x"
                :y1="zone.y + 24"
                :x2="zone.x + zone.width"
                :y2="zone.y + 24"
                stroke="var(--ldx-border, #E7E5E4)"
                stroke-width="1"
              />
              <text :x="zone.x + 12" :y="zone.y + 15.5" class="ldx-zone-label">
                {{ zone.label.toUpperCase() }}
              </text>
            </template>

            <template v-else-if="zone.kind === 'external'">
              <rect
                :x="zone.x"
                :y="zone.y"
                :width="zone.width"
                :height="zone.height"
                rx="6"
                fill="none"
                stroke="var(--ldx-border-strong, #D6D3D1)"
                stroke-width="1"
                stroke-dasharray="5 4"
              />
              <text :x="zone.x + 12" :y="zone.y + 16" class="ldx-zone-label">
                {{ zone.label.toUpperCase() }}
              </text>
            </template>

            <template v-else-if="zone.kind === 'band'">
              <rect
                :x="zone.x"
                :y="zone.y"
                :width="zone.width"
                :height="zone.height"
                rx="6"
                fill="var(--ldx-surface-alt, #F2F0EA)"
                fill-opacity="0.28"
                stroke="var(--ldx-border, #E7E5E4)"
                stroke-width="1"
              />
              <text :x="zone.x + 12" :y="zone.y + 16" class="ldx-zone-label">
                {{ zone.label.toUpperCase() }}
              </text>
            </template>

            <template v-else>
              <rect
                :x="zone.x"
                :y="zone.y"
                :width="zone.width"
                :height="zone.height"
                rx="6"
                fill="var(--ldx-surface, #FFFFFF)"
                fill-opacity="0.35"
                stroke="var(--ldx-border, #E7E5E4)"
                stroke-width="1"
              />
              <text :x="zone.x + 12" :y="zone.y + 16" class="ldx-zone-label">
                {{ zone.label.toUpperCase() }}
              </text>
            </template>
          </g>
        </g>

        <!-- Layer 2: Crisp Directional Edges & Masked Label Pills -->
        <g class="ldx-layer-edges">
          <g
            v-for="item in computedEdges"
            :key="item.edge.id"
            class="ldx-edge-group"
            :class="{
              'is-active': isEdgeActive(item.edge),
              'is-dimmed': isEdgeDimmed(item.edge),
            }"
          >
            <path
              :d="item.pathD"
              fill="none"
              :stroke="edgeStrokeColor(item.edge, isEdgeDimmed(item.edge))"
              :stroke-width="edgeStrokeWidth(item.edge, isEdgeDimmed(item.edge))"
              :stroke-dasharray="edgeDashArray(item.edge)"
              :marker-end="edgeMarkerEnd(item.edge, isEdgeDimmed(item.edge))"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="ldx-edge-base"
            />

            <g v-if="item.edge.label" class="ldx-edge-label-wrap">
              <rect
                :x="item.labelPoint[0] - labelPillWidth(item.edge.label) / 2"
                :y="item.labelPoint[1] - 9"
                :width="labelPillWidth(item.edge.label)"
                height="18"
                rx="4"
                fill="var(--ldx-bg, #FAFAF9)"
                :stroke="
                  isFiltering && isEdgeActive(item.edge)
                    ? edgeStrokeColor(item.edge, false)
                    : 'var(--ldx-border-strong, #D6D3D1)'
                "
                stroke-width="0.9"
              />
              <text
                :x="item.labelPoint[0]"
                :y="item.labelPoint[1] + 3.5"
                text-anchor="middle"
                class="ldx-edge-label"
                :fill="
                  isEdgeDimmed(item.edge)
                    ? 'var(--ldx-muted, #68625D)'
                    : 'var(--ldx-ink, #0C0A09)'
                "
              >
                {{ item.edge.label }}
              </text>
            </g>
          </g>
        </g>

        <!-- Layer 3: Multi-line Accessible Nodes (Zero clipPath truncation) -->
        <g class="ldx-layer-nodes">
          <g
            v-for="cNode in computedNodes"
            :key="cNode.node.id"
            role="button"
            tabindex="0"
            class="ldx-node"
            :class="{
              'is-focal': Boolean(cNode.node.focal),
              'is-active': isNodeHighlighted(cNode.node.id),
              'is-selected': selectedNodeId === cNode.node.id,
              'is-dimmed': isNodeDimmed(cNode.node.id),
            }"
            :aria-label="
              cNode.subText ? `${cNode.node.title} — ${cNode.subText}` : cNode.node.title
            "
            :aria-pressed="selectedNodeId === cNode.node.id"
            @click="selectNode(cNode.node.id)"
            @keydown.enter.prevent="selectNode(cNode.node.id)"
            @keydown.space.prevent="selectNode(cNode.node.id)"
          >
            <!-- Opaque card base so grid/zone/edge lines never bleed through -->
            <rect
              :x="cNode.x"
              :y="cNode.y"
              :width="cNode.w"
              :height="cNode.h"
              rx="6"
              fill="var(--ldx-surface, #FFFFFF)"
            />

            <!-- Subtle semantic fill + border -->
            <rect
              :x="cNode.x"
              :y="cNode.y"
              :width="cNode.w"
              :height="cNode.h"
              rx="6"
              :fill="nodeCardFill(cNode)"
              :stroke="nodeCardStroke(cNode)"
              :stroke-width="nodeCardStrokeWidth(cNode)"
              :stroke-dasharray="cNode.node.dashed ? '5 4' : undefined"
            />

            <!-- Left icon -->
            <g
              :transform="`translate(${cNode.x + 12}, ${cNode.iconY})`"
              :style="{ color: nodeIconColor(cNode) }"
            >
              <StrokeIcon :name="cNode.node.icon" :size="16" />
            </g>

            <!-- Multi-line Node Title -->
            <text
              v-if="cNode.titleLines.length > 0"
              :x="cNode.x + 36"
              :y="cNode.titleStartY"
              class="ldx-node-title"
            >
              <tspan
                v-for="(line, lineIdx) in cNode.titleLines"
                :key="`t-${cNode.node.id}-${lineIdx}`"
                :x="cNode.x + 36"
                :dy="lineIdx === 0 ? 0 : TITLE_LINE_HEIGHT"
              >
                {{ line }}
              </tspan>
            </text>

            <!-- Multi-line Monospace Sub -->
            <text
              v-if="cNode.subLines.length > 0"
              :x="cNode.x + 36"
              :y="cNode.subStartY"
              class="ldx-node-sub"
            >
              <tspan
                v-for="(line, lineIdx) in cNode.subLines"
                :key="`s-${cNode.node.id}-${lineIdx}`"
                :x="cNode.x + 36"
                :dy="lineIdx === 0 ? 0 : SUB_LINE_HEIGHT"
              >
                {{ line }}
              </tspan>
            </text>
          </g>
        </g>
      </svg>
    </div>

    <!-- Optional Calm Step Walkthrough Rail (only when steps.length > 1) -->
    <div
      v-if="currentSteps.length > 1"
      class="ldx-step-rail"
      role="tablist"
      :aria-label="labels.stepWalkthrough"
    >
      <button
        type="button"
        role="tab"
        class="ldx-step-pill"
        :class="{ 'is-active': selectedStepIndex === null && selectedNodeId === null }"
        :aria-selected="selectedStepIndex === null && selectedNodeId === null"
        @click="selectOverview"
      >
        <span class="ldx-step-name">{{ labels.overview }}</span>
      </button>

      <button
        v-for="(step, idx) in currentSteps"
        :key="step.id"
        type="button"
        role="tab"
        class="ldx-step-pill"
        :class="{ 'is-active': selectedStepIndex === idx }"
        :aria-selected="selectedStepIndex === idx"
        @click="toggleStep(idx)"
      >
        <span class="ldx-step-num">{{ idx + 1 }}.</span>
        <span class="ldx-step-name">{{ formatStepTitle(step.title) }}</span>
      </button>
    </div>

    <!-- Interactive 5-Field Node & Step Inspector Drawer -->
    <div v-if="inspectedNode || currentStep" class="ldx-inspector">
      <div class="ldx-inspector-step">
        <div class="ldx-inspector-step-head">
          <span class="ldx-badge-step">
            {{
              selectedNodeId
                ? labels.selectedNode
                : currentStep && selectedStepIndex !== null
                  ? `${labels.stepPrefix} ${selectedStepIndex + 1}`
                  : labels.inspectorBadge
            }}
          </span>
          <strong class="ldx-inspector-step-title">
            {{
              selectedNodeId && inspectedNode
                ? inspectedNode.title
                : currentStep
                  ? formatStepTitle(currentStep.title)
                  : inspectedNode?.title
            }}
          </strong>
          <span v-if="!isFiltering" class="ldx-inspector-hint">{{ labels.inspectorHint }}</span>
          <button
            v-if="isFiltering"
            type="button"
            class="ldx-clear-btn"
            @click="resetSelection"
          >
            {{ labels.reset }}
          </button>
        </div>

        <p v-if="!selectedNodeId && currentStep" class="ldx-inspector-desc">
          {{ currentStep.description }}
        </p>

        <div
          v-if="
            !selectedNodeId &&
            currentStep &&
            (currentStep.route || currentStep.payload || (currentStep.chips && currentStep.chips.length))
          "
          class="ldx-step-meta"
        >
          <span v-if="currentStep.route" class="ldx-meta-chip is-flow">
            {{ labels.route }}: {{ currentStep.route }}
          </span>
          <span v-if="currentStep.payload" class="ldx-meta-chip">
            {{ currentStep.payload }}
          </span>
          <span v-for="chip in currentStep.chips" :key="chip" class="ldx-meta-chip">
            {{ chip }}
          </span>
        </div>
      </div>

      <dl v-if="inspectedNode" class="ldx-inspector-grid">
        <div class="ldx-field">
          <dt>{{ labels.role }}</dt>
          <dd>{{ inspectedNode.inspector.role }}</dd>
        </div>
        <div class="ldx-field">
          <dt>{{ labels.packageOrPort }}</dt>
          <dd class="ldx-mono">{{ inspectedNode.inspector.packageOrPort }}</dd>
        </div>
        <div class="ldx-field">
          <dt>{{ labels.protocol }}</dt>
          <dd class="ldx-mono">{{ inspectedNode.inspector.protocol }}</dd>
        </div>
        <div class="ldx-field">
          <dt>{{ labels.payloadOrSchema }}</dt>
          <dd class="ldx-mono">{{ inspectedNode.inspector.payloadOrSchema }}</dd>
        </div>
        <div class="ldx-field ldx-field-wide">
          <dt>{{ labels.responsibilities }}</dt>
          <dd>{{ inspectedNode.inspector.responsibilities }}</dd>
        </div>
      </dl>
    </div>

    <figcaption v-if="caption" class="ldx-diagram-caption">
      {{ caption }}
    </figcaption>
  </figure>
</template>

<style scoped>
.ldx-diagram {
  margin: 1.5rem 0;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 8px;
  background-color: var(--ldx-bg, #FAFAF9);
  color: var(--ldx-ink, #0C0A09);
  overflow: hidden;
  outline: none;
}

.ldx-diagram:focus-visible {
  border-color: var(--ldx-accent, #D94E1F);
}

.ldx-diagram.is-compact {
  margin: 0;
}

/* Calm Editorial Header */
.ldx-diagram-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 6px 14px;
  background-color: var(--ldx-surface-alt, #F2F0EA);
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
}

.ldx-toolbar-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ldx-toolbar-title {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ldx-ink, #0C0A09);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ldx-toolbar-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ldx-reset-btn {
  padding: 2px 9px;
  border: 1px solid var(--ldx-border-strong, #D6D3D1);
  border-radius: 4px;
  background-color: var(--ldx-surface, #FFFFFF);
  color: var(--ldx-ink-2, #44403C);
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
}

.ldx-reset-btn:hover {
  border-color: var(--ldx-accent, #D94E1F);
  color: var(--ldx-ink, #0C0A09);
}

/* Segmented Mode Tabs */
.ldx-mode-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface, #FFFFFF);
}

.ldx-mode-tab {
  max-width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 5px;
  background-color: transparent;
  color: var(--ldx-ink-2, #44403C);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
}

.ldx-mode-tab:hover {
  border-color: var(--ldx-border-strong, #D6D3D1);
  color: var(--ldx-ink, #0C0A09);
}

.ldx-mode-tab.is-active {
  border-color: var(--ldx-accent, #D94E1F);
  background-color: var(--ldx-accent-soft, rgba(217, 78, 31, 0.1));
  color: var(--ldx-accent-text, #AF4204);
  font-weight: 600;
}

/* SVG Stage */
.ldx-svg-stage {
  box-sizing: border-box;
  width: 100%;
  padding: 14px;
  background-color: var(--ldx-bg, #FAFAF9);
}

.ldx-diagram.is-compact .ldx-svg-stage {
  padding: 10px;
}

.ldx-svg-canvas {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
}

.ldx-zone-label {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  fill: var(--ldx-muted, #68625D);
}

.ldx-edge-group {
  transition: opacity 160ms ease;
}

.ldx-edge-group.is-dimmed {
  opacity: 0.32;
}

.ldx-edge-base {
  transition: stroke 160ms ease, stroke-width 160ms ease;
}

.ldx-edge-label {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 500;
}

.ldx-node {
  cursor: pointer;
  transition: opacity 160ms ease;
  outline: none;
}

.ldx-node.is-dimmed {
  opacity: 0.42;
}

.ldx-node:hover,
.ldx-node:focus-visible {
  opacity: 1;
}

.ldx-node-title {
  font-family: var(--vp-font-family-base, 'Be Vietnam Pro', system-ui, sans-serif);
  font-size: 12.5px;
  font-weight: 600;
  fill: var(--ldx-ink, #0C0A09);
}

.ldx-node-sub {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 10.2px;
  font-weight: 500;
  fill: var(--ldx-muted, #68625D);
}

/* Optional Calm Step Walkthrough Rail */
.ldx-step-rail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-top: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-step-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 9px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 5px;
  background-color: var(--ldx-surface, #FFFFFF);
  color: var(--ldx-ink-2, #44403C);
  font-size: 0.75rem;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
}

.ldx-step-pill:hover {
  border-color: var(--ldx-border-strong, #D6D3D1);
  color: var(--ldx-ink, #0C0A09);
}

.ldx-step-pill.is-active {
  border-color: var(--ldx-flow, #2563EB);
  background-color: var(--ldx-flow-soft, rgba(37, 99, 235, 0.1));
  color: var(--ldx-ink, #0C0A09);
  font-weight: 600;
}

.ldx-step-num {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.72rem;
  color: var(--ldx-muted, #68625D);
}

.ldx-step-pill.is-active .ldx-step-num {
  color: var(--ldx-flow, #2563EB);
}

/* Inspector Drawer */
.ldx-inspector {
  border-top: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface, #FFFFFF);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ldx-diagram.is-compact .ldx-inspector {
  padding: 10px 12px;
  gap: 8px;
}

.ldx-inspector-step {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
}

.ldx-diagram.is-compact .ldx-inspector-step {
  padding-bottom: 8px;
  gap: 4px;
}

.ldx-inspector-step-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ldx-badge-step {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--ldx-accent-soft, rgba(217, 78, 31, 0.1));
  color: var(--ldx-accent-text, #AF4204);
}

.ldx-inspector-step-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ldx-ink, #0C0A09);
}

.ldx-inspector-hint {
  margin-left: auto;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.6875rem;
  color: var(--ldx-muted, #68625D);
}

.ldx-clear-btn {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background: transparent;
  color: var(--ldx-ink-2, #44403C);
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.6875rem;
  cursor: pointer;
}

.ldx-clear-btn:hover {
  color: var(--ldx-ink, #0C0A09);
  border-color: var(--ldx-border-strong, #D6D3D1);
}

.ldx-inspector-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--ldx-ink-2, #44403C);
}

.ldx-diagram.is-compact .ldx-inspector-desc {
  font-size: 0.8125rem;
  line-height: 1.5;
}

.ldx-step-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ldx-meta-chip {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
  color: var(--ldx-ink-2, #44403C);
  transition: none;
}

.ldx-meta-chip.is-flow {
  border-color: rgba(37, 99, 235, 0.35);
  background-color: var(--ldx-flow-soft, rgba(37, 99, 235, 0.1));
  color: var(--ldx-ink, #0C0A09);
}

:global(.dark) .ldx-meta-chip.is-flow {
  border-color: rgba(96, 165, 250, 0.35);
}

.ldx-inspector-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.ldx-field {
  min-width: 0;
}

.ldx-field-wide {
  grid-column: 1 / -1;
}

.ldx-field dt {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ldx-muted, #68625D);
  margin-bottom: 2px;
}

.ldx-field dd {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--ldx-ink, #0C0A09);
  word-break: break-word;
}

.ldx-diagram.is-compact .ldx-field dd {
  font-size: 0.78125rem;
}

.ldx-field dd.ldx-mono {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  color: var(--ldx-ink-2, #44403C);
}

.ldx-diagram-caption {
  padding: 8px 14px;
  border-top: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--ldx-muted, #68625D);
}

@media (max-width: 640px) {
  .ldx-diagram-toolbar {
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 8px 12px;
  }

  .ldx-toolbar-left {
    flex: 1 1 auto;
  }

  .ldx-toolbar-title {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    line-height: 1.4;
  }

  .ldx-mode-tab {
    white-space: normal;
    text-align: left;
    line-height: 1.35;
  }

  .ldx-svg-stage {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .ldx-svg-canvas {
    min-width: var(--ldx-mobile-min-w, 640px);
  }

  .ldx-step-pill {
    white-space: normal;
    text-align: left;
    line-height: 1.35;
  }

  .ldx-inspector-hint {
    flex-basis: 100%;
    margin-left: 0;
  }

  .ldx-inspector-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
