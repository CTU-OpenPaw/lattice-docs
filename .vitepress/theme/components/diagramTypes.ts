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

export type DiagramZoneKind = 'admin' | 'traffic' | 'external';

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
   * 'admin': rx=0 with 24px header strip
   * 'traffic': rx=8 solid hairline
   * 'external': rx=8 dashed hairline
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

export interface DiagramNode {
  id: string;
  /** Concise 1-3 word title */
  title: string;
  /** Single monospace technical tag (port, protocol, package, or collection) */
  sub: string;
  icon: IconName;
  /** X coordinate on a 4px grid */
  x: number;
  /** Y coordinate on a 4px grid */
  y: number;
  /** Width on a 4px grid (defaults to 160) */
  width?: number;
  /** Height on a 4px grid (defaults to 64) */
  height?: number;
  zoneId?: string;
  focal?: boolean;
  inspector: DiagramNodeInspector;
}

export type DiagramEdgeKind = 'primary' | 'flow' | 'dashed';

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  /** Concise 1-2 word edge label */
  label?: string;
  kind?: DiagramEdgeKind;
  /** Explicit routed waypoints [[x, y], ...] */
  points?: Array<[number, number]>;
  /** Renders a clean loop arc above or below a single node */
  selfLoop?: 'top' | 'bottom';
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
  zones?: DiagramZone[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  steps: DiagramStep[];
}
