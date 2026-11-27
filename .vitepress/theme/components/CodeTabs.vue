<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, useId, watch } from 'vue';
import { dataSymbol } from 'vitepress';
import type { DiagramLocale } from './diagramTypes';

export interface CodeTabItem {
  label: string;
  lang?: string;
  code: string;
}

const props = defineProps<{
  tabs: CodeTabItem[];
  uiLang?: DiagramLocale;
}>();

const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.uiLang === 'vi' || props.uiLang === 'en') return props.uiLang;
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const rawUid = useId();
const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, '') || 'ctabs';

const activeIndex = ref(0);
const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.tabs.length,
  (len) => {
    if (activeIndex.value >= len) {
      activeIndex.value = 0;
    }
  },
);

const activeTab = computed<CodeTabItem | null>(() => {
  if (!props.tabs || props.tabs.length === 0) return null;
  return props.tabs[activeIndex.value] ?? props.tabs[0] ?? null;
});

function selectTab(idx: number) {
  activeIndex.value = idx;
  copied.value = false;
}

function onTabKeydown(e: KeyboardEvent, idx: number) {
  if (!props.tabs || props.tabs.length <= 1) return;
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    selectTab((idx + 1) % props.tabs.length);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    selectTab((idx - 1 + props.tabs.length) % props.tabs.length);
  }
}

async function copyCode() {
  if (!activeTab.value || typeof navigator === 'undefined' || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(activeTab.value.code);
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

const labels = computed(() =>
  resolvedLang.value === 'vi'
    ? {
        copy: 'Sao chép',
        copied: 'Đã chép',
        tablist: 'Chọn đoạn mã',
      }
    : {
        copy: 'Copy',
        copied: 'Copied',
        tablist: 'Code examples',
      },
);
</script>

<template>
  <div class="ldx-code-tabs">
    <div class="ldx-code-header">
      <div class="ldx-tab-list" role="tablist" :aria-label="labels.tablist">
        <button
          v-for="(tab, idx) in tabs"
          :id="`ldx-tab-${uid}-${idx}`"
          :key="`${tab.label}-${idx}`"
          type="button"
          role="tab"
          class="ldx-tab-btn"
          :class="{ 'is-active': idx === activeIndex }"
          :aria-selected="idx === activeIndex"
          :aria-controls="`ldx-panel-${uid}`"
          @click="selectTab(idx)"
          @keydown="onTabKeydown($event, idx)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="ldx-code-actions">
        <span v-if="activeTab?.lang" class="ldx-code-lang">{{ activeTab.lang }}</span>
        <button
          type="button"
          class="ldx-copy-btn"
          :class="{ 'is-copied': copied }"
          :aria-label="copied ? labels.copied : labels.copy"
          :title="copied ? labels.copied : labels.copy"
          @click="copyCode"
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
          <span class="ldx-copy-text">{{ copied ? labels.copied : labels.copy }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="activeTab"
      :id="`ldx-panel-${uid}`"
      role="tabpanel"
      :aria-labelledby="`ldx-tab-${uid}-${activeIndex}`"
      class="ldx-code-body"
    >
      <pre class="ldx-pre"><code :class="activeTab.lang ? `language-${activeTab.lang}` : undefined">{{ activeTab.code }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.ldx-code-tabs {
  margin: 1.25rem 0;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 6px;
  background-color: var(--ldx-surface, #FFFFFF);
  overflow: hidden;
}

.ldx-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px 0 6px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-tab-list {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 2px;
}

.ldx-tab-btn {
  position: relative;
  flex-shrink: 0;
  max-width: 100%;
  padding: 9px 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ldx-muted, #78716C);
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.78125rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: color 140ms ease, border-color 140ms ease;
}

.ldx-tab-btn:hover {
  color: var(--ldx-ink, #0C0A09);
}

.ldx-tab-btn.is-active {
  color: var(--ldx-ink, #0C0A09);
  font-weight: 600;
  border-bottom-color: var(--ldx-accent, #D94E1F);
}

.ldx-code-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 6px 0;
}

.ldx-code-lang {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ldx-muted, #78716C);
}

.ldx-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 4px;
  background-color: var(--ldx-surface, #FFFFFF);
  color: var(--ldx-ink-2, #44403C);
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
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

.ldx-code-body {
  background-color: var(--ldx-surface, #FFFFFF);
}

.ldx-pre {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--ldx-ink, #0C0A09);
  background: transparent;
}

.ldx-pre code {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  background: transparent;
  padding: 0;
}

@media (max-width: 640px) {
  .ldx-code-header {
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 8px;
  }

  .ldx-tab-list {
    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: wrap;
    overflow-x: visible;
    gap: 4px;
  }

  .ldx-tab-btn {
    padding: 5px 10px;
    border: 1px solid transparent;
    border-radius: 4px;
    white-space: normal;
    text-align: left;
    line-height: 1.35;
    flex-shrink: 0;
  }

  .ldx-tab-btn.is-active {
    border-color: var(--ldx-accent, #D94E1F);
    background-color: var(--ldx-accent-soft, rgba(217, 78, 31, 0.1));
    color: var(--ldx-accent-text, #AF4204);
  }

  .ldx-code-actions {
    margin-left: auto;
    padding: 0;
  }

  .ldx-copy-text {
    display: none;
  }
}
</style>
