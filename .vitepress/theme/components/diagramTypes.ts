/**
 * @file LatticeDX Docs — Shared Interactive Diagram Engine Types
 * @copyright (C) 2026 CTU-OpenPaw
 * @license Apache-2.0
 * SPDX-License-Identifier: Apache-2.0
 */

export type IconName =
  | 'layers'
  | 'shield'
  | 'database'
  | 'cpu'
  | 'workflow'
  | 'box'
  | 'key'
  | 'globe'
  | 'radio'
  | 'file-text'
  | 'git-branch'
  | 'terminal'
  | 'server'
  | 'check-circle'
  | 'activity'
  | 'bot'
  | 'lock'
  | 'truck'
  | 'bell'
  | 'plug';

export type DiagramLocale = 'vi' | 'en';

export type DiagramZoneKind = 'admin' | 'traffic' | 'external' | 'band';

export interface DiagramZone {
  id: string;
  label: string;
  /** X coordinate on a 4px grid */
  x: number;
  /** Y coordinate on a 4px grid */
  y: number;
  /** Width on a 4px grid */
  width: number;
  /** Height on a 4px grid */
  height: number;
  /**
   * 'admin': subtle filled panel with header rule
   * 'traffic': rx=6 solid hairline container
   * 'external': rx=6 dashed hairline container
   * 'band': full-width horizontal layer band
   */
  kind: DiagramZoneKind;
}

export interface DiagramNodeInspector {
  role: string;
  packageOrPort: string;
  protocol: string;
  payloadOrSchema: string;
  responsibilities: string;
}

export type DiagramNodeTone = 'default' | 'accent' | 'flow' | 'muted';

export interface DiagramNode {
  id: string;
  /** Concise title (auto-wraps cleanly up to 2 lines) */
  title: string;
  /** Monospace technical tag(s) — single string or multi-line array */
  sub?: string | string[];
  icon: IconName;
  /** X coordinate on a 4px grid */
  x: number;
  /** Y coordinate on a 4px grid */
  y: number;
  /** Width on a 4px grid (defaults to 160) */
  width?: number;
  /** Height on a 4px grid (defaults to 64; expands automatically if multi-line text needs more height) */
  height?: number;
  zoneId?: string;
  focal?: boolean;
  /** Optional dashed card stroke for opt-in / optional subsystems */
  dashed?: boolean;
  /** Optional semantic card tone */
  tone?: DiagramNodeTone;
  inspector: DiagramNodeInspector;
}

export type DiagramEdgeKind = 'primary' | 'flow' | 'dashed' | 'return';

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  /** Concise edge label */
  label?: string;
  kind?: DiagramEdgeKind;
  /** Explicit routed waypoints [[x, y], ...] */
  points?: Array<[number, number]>;
  /** Renders a clean loop arc above or below a single node */
  selfLoop?: 'top' | 'bottom';
  /** Optional [dx, dy] offset for edge label pill */
  labelOffset?: [number, number];
  /** Optional 0..1 fraction along edge path for label placement (default 0.5) */
  labelPosition?: number;
}

export interface DiagramStep {
  id: string;
  title: string;
  activeNodes: string[];
  activeEdges: string[];
  description: string;
  route?: string;
  payload?: string;
  chips?: string[];
}

export interface DiagramMode {
  id: string;
  label: string;
  summary?: string;
  /** Optional per-mode SVG viewBox overriding the canvas default */
  viewBox?: string;
  zones?: DiagramZone[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  steps: DiagramStep[];
}
