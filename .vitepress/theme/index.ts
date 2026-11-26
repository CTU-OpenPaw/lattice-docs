/**
 * @file LatticeDX Docs — Custom VitePress Theme Entry
 * @copyright (C) 2026 CTU-OpenPaw
 * @license Apache-2.0
 * SPDX-License-Identifier: Apache-2.0
 */

import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import './custom.css';

import DiagramCanvas from './components/DiagramCanvas.vue';
import StrokeIcon from './components/StrokeIcon.vue';
import ApiEndpoint from './components/ApiEndpoint.vue';
import ParamGrid from './components/ParamGrid.vue';
import CodeTabs from './components/CodeTabs.vue';
import HomeLanding from './components/HomeLanding.vue';

import PlatformPlanesDiagram from './components/PlatformPlanesDiagram.vue';
import EcosystemTopologyDiagram from './components/EcosystemTopologyDiagram.vue';
import PluginHostDiagram from './components/PluginHostDiagram.vue';
import ZeroTrustRlsDiagram from './components/ZeroTrustRlsDiagram.vue';
import PkiMerkleDiagram from './components/PkiMerkleDiagram.vue';
import DeploymentStackDiagram from './components/DeploymentStackDiagram.vue';
import LatticeFlowDagDiagram from './components/LatticeFlowDagDiagram.vue';
import DmnDecisionDiagram from './components/DmnDecisionDiagram.vue';
import N8nBridgeDiagram from './components/N8nBridgeDiagram.vue';
import AiStudioLifecycleDiagram from './components/AiStudioLifecycleDiagram.vue';
import ParaHybridRagDiagram from './components/ParaHybridRagDiagram.vue';
import IiotDigitalTwinDiagram from './components/IiotDigitalTwinDiagram.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DiagramCanvas', DiagramCanvas);
    app.component('StrokeIcon', StrokeIcon);
    app.component('ApiEndpoint', ApiEndpoint);
    app.component('ParamGrid', ParamGrid);
    app.component('CodeTabs', CodeTabs);
    app.component('HomeLanding', HomeLanding);

    app.component('PlatformPlanesDiagram', PlatformPlanesDiagram);
    app.component('EcosystemTopologyDiagram', EcosystemTopologyDiagram);
    app.component('PluginHostDiagram', PluginHostDiagram);
    app.component('ZeroTrustRlsDiagram', ZeroTrustRlsDiagram);
    app.component('PkiMerkleDiagram', PkiMerkleDiagram);
    app.component('DeploymentStackDiagram', DeploymentStackDiagram);
    app.component('LatticeFlowDagDiagram', LatticeFlowDagDiagram);
    app.component('DmnDecisionDiagram', DmnDecisionDiagram);
    app.component('N8nBridgeDiagram', N8nBridgeDiagram);
    app.component('AiStudioLifecycleDiagram', AiStudioLifecycleDiagram);
    app.component('ParaHybridRagDiagram', ParaHybridRagDiagram);
    app.component('IiotDigitalTwinDiagram', IiotDigitalTwinDiagram);
  },
} satisfies Theme;
