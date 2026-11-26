<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import type { IconName } from './diagramTypes';

withDefaults(
  defineProps<{
    name: IconName;
    size?: number | string;
    strokeWidth?: number | string;
  }>(),
  {
    size: 16,
    strokeWidth: 1.5,
  },
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="ldx-stroke-icon"
  >
    <template v-if="name === 'layers'">
      <path d="M8 2L14 5L8 8L2 5L8 2Z" />
      <path d="M2 8L8 11L14 8" />
      <path d="M2 11L8 14L14 11" />
    </template>

    <template v-else-if="name === 'shield'">
      <path d="M8 1.75L13 3.75V7.5C13 10.8 10.9 13.3 8 14.25C5.1 13.3 3 10.8 3 7.5V3.75L8 1.75Z" />
      <path d="M5.75 8L7.25 9.5L10.25 6.5" />
    </template>

    <template v-else-if="name === 'database'">
      <ellipse cx="8" cy="3.5" rx="5" ry="1.75" />
      <path d="M3 3.5V12.5C3 13.47 5.24 14.25 8 14.25C10.76 14.25 13 13.47 13 12.5V3.5" />
      <path d="M3 8C3 8.97 5.24 9.75 8 9.75C10.76 9.75 13 8.97 13 8" />
    </template>

    <template v-else-if="name === 'cpu'">
      <rect x="4" y="4" width="8" height="8" rx="1" />
      <rect x="6.5" y="6.5" width="3" height="3" />
      <path d="M6 1.75V4M10 1.75V4M6 12V14.25M10 12V14.25M1.75 6H4M1.75 10H4M12 6H14.25M12 10H14.25" />
    </template>

    <template v-else-if="name === 'workflow'">
      <rect x="2" y="2" width="4" height="4" rx="1" />
      <rect x="10" y="2" width="4" height="4" rx="1" />
      <rect x="6" y="10" width="4" height="4" rx="1" />
      <path d="M4 6V7.5C4 8.05 4.45 8.5 5 8.5H11C11.55 8.5 12 8.05 12 7.5V6" />
      <path d="M8 8.5V10" />
    </template>

    <template v-else-if="name === 'box'">
      <path d="M8 1.75L13.5 4.75V11.25L8 14.25L2.5 11.25V4.75L8 1.75Z" />
      <path d="M2.5 4.75L8 7.75L13.5 4.75" />
      <path d="M8 7.75V14.25" />
    </template>

    <template v-else-if="name === 'key'">
      <circle cx="5.25" cy="10.75" r="2.75" />
      <path d="M7.2 8.8L13.5 2.5" />
      <path d="M11.25 4.75L13 6.5" />
      <path d="M12.75 3.25L14.25 4.75" />
    </template>

    <template v-else-if="name === 'globe'">
      <circle cx="8" cy="8" r="6" />
      <path d="M2.25 8H13.75" />
      <path d="M8 2C9.65 3.8 10.5 5.85 10.5 8C10.5 10.15 9.65 12.2 8 14C6.35 12.2 5.5 10.15 5.5 8C5.5 5.85 6.35 3.8 8 2Z" />
    </template>

    <template v-else-if="name === 'radio'">
      <circle cx="8" cy="9.5" r="1.25" />
      <path d="M5.2 12.3A4 4 0 0 1 5.2 6.7" />
      <path d="M10.8 6.7A4 4 0 0 1 10.8 12.3" />
      <path d="M3.1 14.2A6.8 6.8 0 0 1 3.1 4.8" />
      <path d="M12.9 4.8A6.8 6.8 0 0 1 12.9 14.2" />
    </template>

    <template v-else-if="name === 'file-text'">
      <path d="M4 2H9.5L12.5 5V14H4V2Z" />
      <path d="M9.5 2V5H12.5" />
      <path d="M6 8H10.5" />
      <path d="M6 10.75H10.5" />
    </template>

    <template v-else-if="name === 'git-branch'">
      <circle cx="4.5" cy="3.5" r="1.5" />
      <circle cx="4.5" cy="12.5" r="1.5" />
      <circle cx="11.5" cy="5.5" r="1.5" />
      <path d="M4.5 5V11" />
      <path d="M11.5 7C11.5 9 9.5 10 4.5 10" />
    </template>

    <template v-else-if="name === 'terminal'">
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M4.75 6.25L7 8.25L4.75 10.25" />
      <path d="M8.5 10.25H11.25" />
    </template>

    <template v-else-if="name === 'server'">
      <rect x="2" y="2.25" width="12" height="4.75" rx="1" />
      <rect x="2" y="9" width="12" height="4.75" rx="1" />
      <path d="M4.5 4.625H4.51M4.5 11.375H4.51" />
      <path d="M8.5 4.625H11.5M8.5 11.375H11.5" />
    </template>

    <template v-else-if="name === 'check-circle'">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8.15L7.2 9.85L10.75 6.25" />
    </template>

    <template v-else-if="name === 'activity'">
      <path d="M1.75 8H4.25L5.75 3.5L8.25 12.5L10.25 6.5L11.75 8H14.25" />
    </template>

    <template v-else-if="name === 'bot'">
      <path d="M8 2V4" />
      <circle cx="8" cy="1.75" r="0.6" />
      <rect x="3" y="4" width="10" height="8.5" rx="2" />
      <path d="M1.5 7.5H3M13 7.5H14.5" />
      <path d="M6 7.5V8.5M10 7.5V8.5" />
      <path d="M6 10.25H10" />
    </template>

    <template v-else-if="name === 'lock'">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.25 7V4.75A2.75 2.75 0 0 1 10.75 4.75V7" />
      <path d="M8 10V11.5" />
    </template>

    <template v-else-if="name === 'truck'">
      <rect x="1.75" y="3.5" width="8.25" height="7" rx="1" />
      <path d="M10 5.5H12.5L14.25 7.75V10.5H10V5.5Z" />
      <circle cx="4.5" cy="11.75" r="1.5" />
      <circle cx="11.75" cy="11.75" r="1.5" />
    </template>

    <template v-else-if="name === 'bell'">
      <path d="M12 6.5A4 4 0 0 0 4 6.5C4 10 2.5 11.25 2.5 11.25H13.5C13.5 11.25 12 10 12 6.5Z" />
      <path d="M6.75 13A1.45 1.45 0 0 0 9.25 13" />
    </template>

    <template v-else-if="name === 'plug'">
      <path d="M6 2V4.75M10 2V4.75" />
      <path d="M4.25 4.75H11.75V7.75A3.75 3.75 0 0 1 8 11.5A3.75 3.75 0 0 1 4.25 7.75V4.75Z" />
      <path d="M8 11.5V14.25" />
    </template>
  </svg>
</template>

<style scoped>
.ldx-stroke-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
