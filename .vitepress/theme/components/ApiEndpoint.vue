<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { dataSymbol } from 'vitepress';
import type { DiagramLocale } from './diagramTypes';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const props = defineProps<{
  method: HttpMethod;
  path: string;
  auth?: string;
  scope?: string;
  summary?: string;
  lang?: DiagramLocale;
}>();

const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') return props.lang;
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

async function copyPath() {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(props.path);
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch {
    copied.value = false;
  }
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer);
});

const methodClass = computed(() => `is-${props.method.toLowerCase()}`);

const copyLabel = computed(() =>
  resolvedLang.value === 'vi'
    ? copied.value
      ? 'Đã chép'
      : 'Chép đường dẫn'
    : copied.value
      ? 'Copied'
      : 'Copy path',
);
</script>

<template>
  <div class="ldx-api-endpoint">
    <div class="ldx-api-main">
      <div class="ldx-api-left">
        <span class="ldx-method-pill" :class="methodClass">{{ method }}</span>
        <code class="ldx-api-path">{{ path }}</code>
        <button
          type="button"
          class="ldx-copy-btn"
          :class="{ 'is-copied': copied }"
          :aria-label="copyLabel"
          :title="copyLabel"
          @click="copyPath"
        >
          <svg
            v-if="copied"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
            <path d="M10.5 5.5V3.7C10.5 3.04 9.96 2.5 9.3 2.5H3.7C3.04 2.5 2.5 3.04 2.5 3.7V9.3C2.5 9.96 3.04 10.5 3.7 10.5H5.5" />
          </svg>
        </button>
      </div>

      <div v-if="auth || scope" class="ldx-api-right">
        <span v-if="auth" class="ldx-api-tag">{{ auth }}</span>
        <span v-if="scope" class="ldx-api-tag is-scope">{{ scope }}</span>
      </div>
    </div>

    <div v-if="summary" class="ldx-api-summary">
      {{ summary }}
    </div>
  </div>
</template>

<style scoped>
.ldx-api-endpoint {
  margin: 1rem 0;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 6px;
  background-color: var(--ldx-surface, #FFFFFF);
  overflow: hidden;
}

.ldx-api-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 12px;
}

.ldx-api-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.ldx-method-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.ldx-method-pill.is-get {
  color: var(--ldx-flow, #2563EB);
  background-color: var(--ldx-flow-soft, rgba(37, 99, 235, 0.1));
}

.ldx-method-pill.is-post {
  color: #047857;
  background-color: rgba(4, 120, 87, 0.1);
}

.ldx-method-pill.is-patch,
.ldx-method-pill.is-put {
  color: #B45309;
  background-color: rgba(180, 83, 9, 0.1);
}

.ldx-method-pill.is-delete {
  color: #B91C1C;
  background-color: rgba(185, 28, 28, 0.1);
}

:global(.dark) .ldx-method-pill.is-post {
  color: #34D399;
  background-color: rgba(52, 211, 153, 0.14);
}

:global(.dark) .ldx-method-pill.is-patch,
:global(.dark) .ldx-method-pill.is-put {
  color: #FBBF24;
  background-color: rgba(251, 191, 36, 0.14);
}

:global(.dark) .ldx-method-pill.is-delete {
  color: #F87171;
  background-color: rgba(248, 113, 113, 0.14);
}

.ldx-api-path {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ldx-ink, #0C0A09);
  background: transparent;
  padding: 0;
  overflow-x: auto;
  white-space: nowrap;
}

.ldx-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: var(--ldx-bg, #FAFAF9);
  color: var(--ldx-muted, #78716C);
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 140ms ease, color 140ms ease;
}

.ldx-copy-btn:hover {
  border-color: var(--ldx-border-strong, #D6D3D1);
  color: var(--ldx-ink, #0C0A09);
}

.ldx-copy-btn.is-copied {
  border-color: #047857;
  color: #047857;
}

:global(.dark) .ldx-copy-btn.is-copied {
  border-color: #34D399;
  color: #34D399;
}

.ldx-api-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.ldx-api-tag {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.72rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
  color: var(--ldx-ink-2, #44403C);
}

.ldx-api-tag.is-scope {
  border-color: var(--ldx-accent, #D94E1F);
  background-color: var(--ldx-accent-soft, rgba(217, 78, 31, 0.1));
  color: var(--ldx-accent-text, #AF4204);
}

.ldx-api-summary {
  padding: 8px 12px;
  border-top: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
  font-size: 0.84375rem;
  line-height: 1.55;
  color: var(--ldx-ink-2, #44403C);
}
</style>
