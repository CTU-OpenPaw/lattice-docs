<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
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
    viewBox: '0 0 880 440',
    initialStep: 0,
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
        play: 'Phát',
        pause: 'Tạm dừng',
        prev: 'Trước',
        next: 'Tiếp',
        replay: 'Phát lại',
        static: 'Tĩnh',
        activeStep: 'Bước hiện tại',
        selectedNode: 'Node đang chọn',
        clearSelection: 'Bỏ chọn',
        route: 'Tuyến',
        payload: 'Payload',
        role: 'Vai trò',
        packageOrPort: 'Gói / Cổng',
        protocol: 'Giao thức',
        payloadOrSchema: 'Payload / Schema',
        responsibilities: 'Trách nhiệm',
        diagramControls: 'Điều khiển sơ đồ',
        modeSelector: 'Chế độ hiển thị',
      }
    : {
        play: 'Play',
        pause: 'Pause',
        prev: 'Prev',
        next: 'Next',
        replay: 'Replay',
        static: 'Static',
        activeStep: 'Active Step',
        selectedNode: 'Selected Node',
        clearSelection: 'Reset',
        route: 'Route',
        payload: 'Payload',
        role: 'Role',
        packageOrPort: 'Package / Port',
        protocol: 'Protocol',
        payloadOrSchema: 'Payload / Schema',
        responsibilities: 'Responsibilities',
        diagramControls: 'Diagram playback controls',
        modeSelector: 'Diagram view modes',
      },
);

const rawUid = useId();
const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '') || 'ldx';

const arrowNeutralId = `ldx-arrow-neutral-${uid}`;
const arrowFlowId = `ldx-arrow-flow-${uid}`;
const arrowAccentId = `ldx-arrow-accent-${uid}`;

const activeModeIndex = ref(0);
const activeStepIndex = ref(Math.max(0, props.initialStep));
const selectedNodeId = ref<string | null>(null);
const isPlaying = ref(false);
const isMounted = ref(false);
const prefersReducedMotion = ref(false);
const animEpoch = ref(0);

const hasModes = computed(() => Array.isArray(props.modes) && props.modes.length > 0);
const activeMode = computed<DiagramMode | null>(() => {
  if (!hasModes.value || !props.modes) return null;
  return props.modes[activeModeIndex.value] ?? props.modes[0] ?? null;
});

const currentZones = computed<DiagramZone[]>(() => activeMode.value?.zones ?? props.zones ?? []);
const currentNodes = computed<DiagramNode[]>(() => activeMode.value?.nodes ?? props.nodes ?? []);
const currentEdges = computed<DiagramEdge[]>(() => activeMode.value?.edges ?? props.edges ?? []);
const currentSteps = computed<DiagramStep[]>(() => activeMode.value?.steps ?? props.steps ?? []);

watch(
  () => props.initialStep,
  (val) => {
    const maxIdx = Math.max(0, currentSteps.value.length - 1);
    activeStepIndex.value = Math.min(Math.max(0, val ?? 0), maxIdx);
  },
);

const clampedStepIndex = computed(() => {
  if (currentSteps.value.length === 0) return 0;
  return Math.min(Math.max(0, activeStepIndex.value), currentSteps.value.length - 1);
});

const currentStep = computed<DiagramStep | null>(() => {
  if (currentSteps.value.length === 0) return null;
  return currentSteps.value[clampedStepIndex.value] ?? null;
});

const stepCounterText = computed(() => {
  const total = currentSteps.value.length;
  if (total === 0) return '00 / 00';
  const cur = String(clampedStepIndex.value + 1).padStart(2, '0');
  const tot = String(total).padStart(2, '0');
  return `${cur} / ${tot}`;
});

const nodeMap = computed(() => {
  const map = new Map<string, DiagramNode>();
  for (const node of currentNodes.value) {
    map.set(node.id, node);
  }
  return map;
});

const stepActiveNodeSet = computed(() => new Set(currentStep.value?.activeNodes ?? []));
const stepActiveEdgeSet = computed(() => new Set(currentStep.value?.activeEdges ?? []));

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
  return Boolean(nodeMap.value.get(nodeId)?.focal);
}

function isNodeDimmed(nodeId: string): boolean {
  if (prefersReducedMotion.value) return false;
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
  return edge.kind === 'primary';
}

const inspectedNode = computed<DiagramNode | null>(() => {
  if (selectedNodeId.value) {
    const found = nodeMap.value.get(selectedNodeId.value);
    if (found) return found;
  }
  if (currentStep.value && currentStep.value.activeNodes.length > 0) {
    const activeList = currentStep.value.activeNodes
      .map((id) => nodeMap.value.get(id))
      .filter((n): n is DiagramNode => Boolean(n));
    const focalInStep = activeList.find((n) => n.focal);
    if (focalInStep) return focalInStep;
    if (activeList[0]) return activeList[0];
  }
  const anyFocal = currentNodes.value.find((n) => n.focal);
  return anyFocal ?? currentNodes.value[0] ?? null;
});

function getNodeBox(node: DiagramNode) {
  return {
    x: node.x,
    y: node.y,
    w: node.width ?? 160,
    h: node.height ?? 64,
  };
}

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

function computeAutoEdgePoints(fromNode: DiagramNode, toNode: DiagramNode): Array<[number, number]> {
  const from = getNodeBox(fromNode);
  const to = getNodeBox(toNode);
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

function polylineMidpoint(pts: Array<[number, number]>): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  const total = polylineLength(pts);
  if (total === 0) return pts[0];
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (half <= segLen) {
      const t = segLen === 0 ? 0 : half / segLen;
      return [
        Math.round(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t),
        Math.round(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t),
      ];
    }
    half -= segLen;
  }
  return pts[pts.length - 1];
}

interface ComputedEdge {
  edge: DiagramEdge;
  pathD: string;
  length: number;
  labelPoint: [number, number];
  duration: string;
  beginDelay: string;
}

const computedEdges = computed<ComputedEdge[]>(() => {
  const result: ComputedEdge[] = [];
  let activeCounter = 0;

  for (const edge of currentEdges.value) {
    const fromNode = nodeMap.value.get(edge.from);
    const toNode = nodeMap.value.get(edge.to);
    if (!fromNode || !toNode) continue;

    let pathD = '';
    let length = 120;
    let labelPoint: [number, number] = [0, 0];

    if (edge.selfLoop || edge.from === edge.to) {
      const box = getNodeBox(fromNode);
      const cx = box.x + box.w / 2;
      const side = edge.selfLoop === 'bottom' ? 'bottom' : 'top';
      const yEdge = side === 'top' ? box.y : box.y + box.h;
      const dir = side === 'top' ? -1 : 1;
      const x1 = cx - 20;
      const x2 = cx + 20;
      const cy = yEdge + dir * 32;
      pathD = `M ${x1} ${yEdge} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${yEdge}`;
      length = 104;
      labelPoint = [cx, yEdge + dir * 30];
    } else {
      const pts =
        edge.points && edge.points.length >= 2
          ? edge.points
          : computeAutoEdgePoints(fromNode, toNode);
      pathD = buildRoundedOrthogonalPath(pts, 6);
      length = Math.max(40, polylineLength(pts));
      labelPoint = polylineMidpoint(pts);
    }

    const active = isEdgeActive(edge);
    const durSec = Math.max(0.42, Math.min(1.5, length / 280)).toFixed(2);
    const delaySec = active ? (activeCounter * 0.1).toFixed(1) : '0';
    if (active) activeCounter += 1;

    result.push({
      edge,
      pathD,
      length,
      labelPoint,
      duration: `${durSec}s`,
      beginDelay: `${delaySec}s`,
    });
  }

  return result;
});

function edgeStrokeColor(edge: DiagramEdge, active: boolean): string {
  if (!active) {
    return edge.kind === 'dashed'
      ? 'var(--ldx-muted, #78716C)'
      : 'var(--ldx-border-strong, #D6D3D1)';
  }
  return edge.kind === 'primary' ? 'var(--ldx-accent, #D94E1F)' : 'var(--ldx-flow, #2563EB)';
}

function edgeMarkerEnd(edge: DiagramEdge, active: boolean): string {
  if (!active) return `url(#${arrowNeutralId})`;
  return edge.kind === 'primary' ? `url(#${arrowAccentId})` : `url(#${arrowFlowId})`;
}

function labelPillWidth(text: string): number {
  return Math.max(40, Math.ceil(text.length * 6.4 + 14));
}

function selectMode(idx: number) {
  activeModeIndex.value = idx;
  activeStepIndex.value = 0;
  selectedNodeId.value = null;
  animEpoch.value += 1;
}

function selectNode(nodeId: string) {
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = null;
  } else {
    selectedNodeId.value = nodeId;
    isPlaying.value = false;
  }
}

function clearNodeSelection() {
  selectedNodeId.value = null;
}

function prevStep() {
  if (currentSteps.value.length === 0) return;
  selectedNodeId.value = null;
  activeStepIndex.value =
    (clampedStepIndex.value - 1 + currentSteps.value.length) % currentSteps.value.length;
  animEpoch.value += 1;
}

function nextStep() {
  if (currentSteps.value.length === 0) return;
  selectedNodeId.value = null;
  activeStepIndex.value = (clampedStepIndex.value + 1) % currentSteps.value.length;
  animEpoch.value += 1;
}

function togglePlay() {
  if (prefersReducedMotion.value) return;
  selectedNodeId.value = null;
  isPlaying.value = !isPlaying.value;
}

function replay() {
  selectedNodeId.value = null;
  activeStepIndex.value = 0;
  animEpoch.value += 1;
  if (!prefersReducedMotion.value) {
    isPlaying.value = true;
  }
}

function onContainerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    nextStep();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevStep();
  }
}

let stepTimer: ReturnType<typeof setInterval> | null = null;
let mediaQueryList: MediaQueryList | null = null;

function stopTimer() {
  if (stepTimer !== null) {
    clearInterval(stepTimer);
    stepTimer = null;
  }
}

function syncTimer() {
  stopTimer();
  if (!isMounted.value || !isPlaying.value || prefersReducedMotion.value) return;
  if (currentSteps.value.length <= 1) return;
  stepTimer = setInterval(() => {
    activeStepIndex.value = (clampedStepIndex.value + 1) % currentSteps.value.length;
    animEpoch.value += 1;
  }, 3800);
}

watch([isPlaying, prefersReducedMotion, () => currentSteps.value.length, activeModeIndex], () => {
  syncTimer();
});

function handleReducedMotionChange(ev: MediaQueryListEvent) {
  prefersReducedMotion.value = ev.matches;
  if (ev.matches) {
    isPlaying.value = false;
  }
}

onMounted(() => {
  isMounted.value = true;
  const searchStill =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('motion') === 'still';

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.value = searchStill || mediaQueryList.matches;
    mediaQueryList.addEventListener?.('change', handleReducedMotionChange);
  } else {
    prefersReducedMotion.value = searchStill;
  }

  if (!prefersReducedMotion.value) {
    isPlaying.value = true;
  }
  syncTimer();
});

onBeforeUnmount(() => {
  stopTimer();
  mediaQueryList?.removeEventListener?.('change', handleReducedMotionChange);
});
</script>

<template>
  <figure
    class="ldx-diagram"
    :class="{ 'is-compact': compact }"
    tabindex="0"
    :aria-label="title"
    @keydown="onContainerKeydown"
  >
    <!-- Single Motion Governor Toolbar (40px) -->
    <div class="ldx-diagram-toolbar" role="toolbar" :aria-label="labels.diagramControls">
      <div class="ldx-toolbar-left">
        <span class="ldx-toolbar-dot" aria-hidden="true" />
        <span class="ldx-toolbar-title">{{ title }}</span>
      </div>

      <div class="ldx-toolbar-controls">
        <span v-if="currentSteps.length > 0" class="ldx-step-counter">{{ stepCounterText }}</span>

        <button
          type="button"
          class="ldx-ctrl-btn"
          :class="{ 'is-active': isPlaying && !prefersReducedMotion }"
          :disabled="prefersReducedMotion"
          :aria-pressed="isPlaying && !prefersReducedMotion"
          :aria-label="prefersReducedMotion ? labels.static : isPlaying ? labels.pause : labels.play"
          @click="togglePlay"
        >
          <svg
            v-if="isPlaying && !prefersReducedMotion"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <rect x="2.5" y="2" width="2.2" height="8" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="7.3" y="2" width="2.2" height="8" rx="0.5" fill="currentColor" stroke="none" />
          </svg>
          <svg
            v-else
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="M3 2.2L9.5 6L3 9.8V2.2Z" fill="currentColor" />
          </svg>
          <span class="ldx-ctrl-label">{{
            prefersReducedMotion ? labels.static : isPlaying ? labels.pause : labels.play
          }}</span>
        </button>

        <button
          v-if="currentSteps.length > 1"
          type="button"
          class="ldx-ctrl-btn ldx-ctrl-icon-only"
          :aria-label="labels.prev"
          :title="labels.prev"
          @click="prevStep"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M7.5 2.5L4 6L7.5 9.5" />
          </svg>
        </button>

        <button
          v-if="currentSteps.length > 1"
          type="button"
          class="ldx-ctrl-btn ldx-ctrl-icon-only"
          :aria-label="labels.next"
          :title="labels.next"
          @click="nextStep"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4.5 2.5L8 6L4.5 9.5" />
          </svg>
        </button>

        <button
          type="button"
          class="ldx-ctrl-btn ldx-ctrl-icon-only"
          :aria-label="labels.replay"
          :title="labels.replay"
          @click="replay"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M2.25 4.5A4.25 4.25 0 1 1 2.4 7.8" />
            <path d="M2 2.2V4.7H4.5" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Optional Mode Selector Tabs -->
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
      <span v-if="activeMode?.summary" class="ldx-mode-summary">{{ activeMode.summary }}</span>
    </div>

    <!-- Static-First Interactive SVG Canvas -->
    <div class="ldx-svg-stage">
      <svg
        :viewBox="viewBox"
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

          <clipPath
            v-for="node in currentNodes"
            :id="`ldx-clip-${uid}-${node.id}`"
            :key="`clip-${node.id}`"
          >
            <rect
              :x="node.x + 36"
              :y="node.y + 4"
              :width="Math.max(40, (node.width ?? 160) - 44)"
              :height="Math.max(24, (node.height ?? 64) - 8)"
            />
          </clipPath>
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
                rx="0"
                fill="var(--ldx-surface-alt, #F2F0EA)"
                fill-opacity="0.45"
                stroke="var(--ldx-border, #E7E5E4)"
                stroke-width="1"
              />
              <rect
                :x="zone.x"
                :y="zone.y"
                :width="zone.width"
                height="24"
                rx="0"
                fill="var(--ldx-surface-alt, #F2F0EA)"
                stroke="var(--ldx-border, #E7E5E4)"
                stroke-width="1"
              />
              <text
                :x="zone.x + 12"
                :y="zone.y + 15.5"
                class="ldx-zone-label"
              >
                {{ zone.label.toUpperCase() }}
              </text>
            </template>

            <template v-else-if="zone.kind === 'external'">
              <rect
                :x="zone.x"
                :y="zone.y"
                :width="zone.width"
                :height="zone.height"
                rx="8"
                fill="none"
                stroke="var(--ldx-border-strong, #D6D3D1)"
                stroke-width="1"
                stroke-dasharray="4 4"
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
                rx="8"
                fill="none"
                stroke="var(--ldx-border, #E7E5E4)"
                stroke-width="1"
              />
              <text :x="zone.x + 12" :y="zone.y + 16" class="ldx-zone-label">
                {{ zone.label.toUpperCase() }}
              </text>
            </template>
          </g>
        </g>

        <!-- Layer 2: Edges & Animated Packet Dots -->
        <g class="ldx-layer-edges">
          <g
            v-for="item in computedEdges"
            :key="`${item.edge.id}-${animEpoch}`"
            class="ldx-edge-group"
            :class="{ 'is-active': isEdgeActive(item.edge) }"
          >
            <!-- Base static-first path -->
            <path
              :d="item.pathD"
              fill="none"
              :stroke="edgeStrokeColor(item.edge, isEdgeActive(item.edge))"
              :stroke-width="isEdgeActive(item.edge) ? (item.edge.kind === 'primary' ? 1.6 : 1.4) : 1"
              :stroke-dasharray="item.edge.kind === 'dashed' ? '4 4' : undefined"
              :marker-end="edgeMarkerEnd(item.edge, isEdgeActive(item.edge))"
              class="ldx-edge-base"
            />

            <!-- Draw-in overlay on active solid paths -->
            <path
              v-if="
                isMounted &&
                isEdgeActive(item.edge) &&
                item.edge.kind !== 'dashed' &&
                !prefersReducedMotion
              "
              :d="item.pathD"
              fill="none"
              :stroke="edgeStrokeColor(item.edge, true)"
              :stroke-width="item.edge.kind === 'primary' ? 1.7 : 1.5"
              pathLength="1"
              class="ldx-edge-draw"
            />

            <!-- Moving 3.5px packet dot when playing -->
            <circle
              v-if="isMounted && isPlaying && !prefersReducedMotion && isEdgeActive(item.edge)"
              r="3.5"
              :fill="
                item.edge.kind === 'primary'
                  ? 'var(--ldx-accent, #D94E1F)'
                  : 'var(--ldx-flow, #2563EB)'
              "
            >
              <animateMotion
                :dur="item.duration"
                :begin="item.beginDelay"
                repeatCount="indefinite"
                :path="item.pathD"
              />
            </circle>

            <!-- Edge label pill -->
            <g v-if="item.edge.label" class="ldx-edge-label-wrap">
              <rect
                :x="item.labelPoint[0] - labelPillWidth(item.edge.label) / 2"
                :y="item.labelPoint[1] - 9"
                :width="labelPillWidth(item.edge.label)"
                height="18"
                rx="4"
                fill="var(--ldx-bg, #FAFAF9)"
                :stroke="
                  isEdgeActive(item.edge)
                    ? edgeStrokeColor(item.edge, true)
                    : 'var(--ldx-border, #E7E5E4)'
                "
                stroke-width="0.8"
              />
              <text
                :x="item.labelPoint[0]"
                :y="item.labelPoint[1] + 3.5"
                text-anchor="middle"
                class="ldx-edge-label"
                :fill="
                  isEdgeActive(item.edge)
                    ? 'var(--ldx-ink, #0C0A09)'
                    : 'var(--ldx-muted, #78716C)'
                "
              >
                {{ item.edge.label }}
              </text>
            </g>
          </g>
        </g>

        <!-- Layer 3: Nodes -->
        <g class="ldx-layer-nodes">
          <g
            v-for="node in currentNodes"
            :key="node.id"
            role="button"
            tabindex="0"
            class="ldx-node"
            :class="{
              'is-focal': Boolean(node.focal),
              'is-active': isNodeHighlighted(node.id),
              'is-selected': selectedNodeId === node.id,
              'is-dimmed': isNodeDimmed(node.id),
            }"
            :aria-label="`${node.title} — ${node.sub}`"
            :aria-pressed="selectedNodeId === node.id"
            @click="selectNode(node.id)"
            @keydown.enter.prevent="selectNode(node.id)"
            @keydown.space.prevent="selectNode(node.id)"
          >
            <!-- Opaque card base so grid/zone lines never bleed through -->
            <rect
              :x="node.x"
              :y="node.y"
              :width="node.width ?? 160"
              :height="node.height ?? 64"
              rx="6"
              fill="var(--ldx-surface, #FFFFFF)"
            />

            <!-- Subtle semantic fill + border -->
            <rect
              :x="node.x"
              :y="node.y"
              :width="node.width ?? 160"
              :height="node.height ?? 64"
              rx="6"
              :fill="
                selectedNodeId === node.id || (node.focal && isNodeHighlighted(node.id))
                  ? 'var(--ldx-accent-soft, rgba(217, 78, 31, 0.10))'
                  : isNodeHighlighted(node.id)
                    ? 'var(--ldx-flow-soft, rgba(37, 99, 235, 0.10))'
                    : 'transparent'
              "
              :stroke="
                selectedNodeId === node.id || (node.focal && isNodeHighlighted(node.id))
                  ? 'var(--ldx-accent, #D94E1F)'
                  : isNodeHighlighted(node.id)
                    ? 'var(--ldx-flow, #2563EB)'
                    : node.focal
                      ? 'var(--ldx-accent, #D94E1F)'
                      : 'var(--ldx-border-strong, #D6D3D1)'
              "
              :stroke-width="
                selectedNodeId === node.id || isNodeHighlighted(node.id) || node.focal ? 1.3 : 1
              "
            />

            <!-- Left icon positioned cleanly in 4px grid -->
            <g
              :transform="`translate(${node.x + 12}, ${node.y + Math.round(((node.height ?? 64) - 16) / 2)})`"
              :style="{
                color:
                  selectedNodeId === node.id || node.focal
                    ? 'var(--ldx-accent-text, #AF4204)'
                    : isNodeHighlighted(node.id)
                      ? 'var(--ldx-flow, #2563EB)'
                      : 'var(--ldx-muted, #78716C)',
              }"
            >
              <StrokeIcon :name="node.icon" :size="16" />
            </g>

            <!-- Node Title + Monospace Sub -->
            <g :clip-path="`url(#ldx-clip-${uid}-${node.id})`">
              <text
                :x="node.x + 36"
                :y="node.y + Math.round((node.height ?? 64) / 2) - 4"
                class="ldx-node-title"
              >
                {{ node.title }}
              </text>
              <text
                :x="node.x + 36"
                :y="node.y + Math.round((node.height ?? 64) / 2) + 13"
                class="ldx-node-sub"
              >
                {{ node.sub }}
              </text>
            </g>
          </g>
        </g>
      </svg>
    </div>

    <!-- Step Progress Strip (when >1 steps) -->
    <div v-if="currentSteps.length > 1" class="ldx-step-rail" role="tablist" :aria-label="labels.activeStep">
      <button
        v-for="(step, idx) in currentSteps"
        :key="step.id"
        type="button"
        role="tab"
        class="ldx-step-pill"
        :class="{ 'is-active': idx === clampedStepIndex }"
        :aria-selected="idx === clampedStepIndex"
        @click="
          selectedNodeId = null;
          activeStepIndex = idx;
          animEpoch += 1;
        "
      >
        <span class="ldx-step-num">{{ String(idx + 1).padStart(2, '0') }}</span>
        <span v-if="!compact" class="ldx-step-name">{{ step.title }}</span>
      </button>
    </div>

    <!-- Interactive 5-Field Node & Step Inspector Drawer -->
    <div v-if="inspectedNode || currentStep" class="ldx-inspector">
      <div v-if="currentStep" class="ldx-inspector-step">
        <div class="ldx-inspector-step-head">
          <span class="ldx-badge-step">
            {{ selectedNodeId ? labels.selectedNode : `${labels.activeStep} ${stepCounterText}` }}
          </span>
          <strong class="ldx-inspector-step-title">
            {{ selectedNodeId && inspectedNode ? inspectedNode.title : currentStep.title }}
          </strong>
          <button
            v-if="selectedNodeId"
            type="button"
            class="ldx-clear-btn"
            @click="clearNodeSelection"
          >
            {{ labels.clearSelection }}
          </button>
        </div>

        <p v-if="!selectedNodeId" class="ldx-inspector-desc">{{ currentStep.description }}</p>

        <div
          v-if="
            !selectedNodeId &&
            (currentStep.route || currentStep.payload || (currentStep.chips && currentStep.chips.length))
          "
          class="ldx-step-meta"
        >
          <code v-if="currentStep.route" class="ldx-meta-chip is-flow">
            {{ labels.route }}: {{ currentStep.route }}
          </code>
          <code v-if="currentStep.payload" class="ldx-meta-chip">
            {{ currentStep.payload }}
          </code>
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

/* Single Motion Governor Toolbar */
.ldx-diagram-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 0 12px;
  background-color: var(--ldx-surface-alt, #F2F0EA);
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
}

.ldx-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ldx-toolbar-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--ldx-accent, #D94E1F);
  flex-shrink: 0;
}

.ldx-toolbar-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ldx-ink, #0C0A09);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ldx-toolbar-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ldx-step-counter {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ldx-muted, #78716C);
  padding: 0 6px;
}

.ldx-ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: var(--ldx-surface, #FFFFFF);
  color: var(--ldx-ink-2, #44403C);
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
}

.ldx-ctrl-btn.ldx-ctrl-icon-only {
  width: 26px;
  padding: 0;
}

.ldx-ctrl-btn:hover:not(:disabled) {
  border-color: var(--ldx-border-strong, #D6D3D1);
  color: var(--ldx-ink, #0C0A09);
}

.ldx-ctrl-btn.is-active {
  border-color: var(--ldx-accent, #D94E1F);
  color: var(--ldx-accent-text, #AF4204);
  background-color: var(--ldx-accent-soft, rgba(217, 78, 31, 0.1));
}

.ldx-ctrl-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Mode tabs */
.ldx-mode-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface, #FFFFFF);
}

.ldx-mode-tab {
  max-width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: transparent;
  color: var(--ldx-ink-2, #44403C);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
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

.ldx-mode-summary {
  margin-left: auto;
  min-width: 0;
  max-width: 100%;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--ldx-muted, #78716C);
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: right;
}

/* SVG Stage */
.ldx-svg-stage {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  background-color: var(--ldx-bg, #FAFAF9);
}

.ldx-diagram.is-compact .ldx-svg-stage {
  padding: 8px;
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
  fill: var(--ldx-muted, #78716C);
}

.ldx-edge-base {
  transition: stroke 160ms ease, stroke-width 160ms ease;
}

.ldx-edge-draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: ldxEdgeDraw 480ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes ldxEdgeDraw {
  to {
    stroke-dashoffset: 0;
  }
}

.ldx-edge-label {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 500;
}

.ldx-node {
  cursor: pointer;
  transition: opacity 180ms ease;
  outline: none;
}

.ldx-node.is-dimmed {
  opacity: 0.72;
}

.ldx-node:hover,
.ldx-node:focus-visible {
  opacity: 1;
}

.ldx-node-title {
  font-family: var(--vp-font-family-base, 'Be Vietnam Pro', system-ui, sans-serif);
  font-size: 13px;
  font-weight: 600;
  fill: var(--ldx-ink, #0C0A09);
}

.ldx-node-sub {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 10.5px;
  font-weight: 500;
  fill: var(--ldx-muted, #78716C);
}

/* Step Rail */
.ldx-step-rail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-step-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: var(--ldx-surface, #FFFFFF);
  color: var(--ldx-ink-2, #44403C);
  font-size: 0.75rem;
  white-space: nowrap;
  cursor: pointer;
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
  font-size: 0.7rem;
  color: var(--ldx-muted, #78716C);
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

.ldx-clear-btn {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background: transparent;
  color: var(--ldx-muted, #78716C);
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
  color: var(--ldx-muted, #78716C);
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
  color: var(--ldx-muted, #78716C);
}

@media (max-width: 640px) {
  .ldx-ctrl-label {
    display: none;
  }

  .ldx-mode-tab {
    white-space: normal;
    text-align: left;
    line-height: 1.35;
  }

  .ldx-mode-summary {
    flex-basis: 100%;
    margin-left: 0;
    text-align: left;
  }

  .ldx-svg-stage {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .ldx-svg-canvas {
    min-width: 640px;
  }

  .ldx-step-pill {
    white-space: normal;
    text-align: left;
    line-height: 1.35;
  }

  .ldx-inspector-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ldx-edge-draw {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
