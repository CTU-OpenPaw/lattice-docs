<!--
SPDX-License-Identifier: Apache-2.0
Copyright (C) 2026 CTU-OpenPaw
-->
<script setup lang="ts">
import { computed, inject } from 'vue';
import { dataSymbol } from 'vitepress';
import type { DiagramLocale } from './diagramTypes';

export interface ParamItem {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description: string;
}

const props = defineProps<{
  title?: string;
  items: ParamItem[];
  lang?: DiagramLocale;
}>();

const vpData = inject(dataSymbol, null);

const resolvedLang = computed<DiagramLocale>(() => {
  if (props.lang === 'vi' || props.lang === 'en') return props.lang;
  const siteLang = vpData?.lang?.value?.toLowerCase() ?? 'en';
  return siteLang.startsWith('vi') ? 'vi' : 'en';
});

const labels = computed(() =>
  resolvedLang.value === 'vi'
    ? {
        param: 'Tham số',
        type: 'Kiểu',
        defaultVal: 'Mặc định',
        description: 'Mô tả',
        required: 'bắt buộc',
        empty: '—',
      }
    : {
        param: 'Parameter',
        type: 'Type',
        defaultVal: 'Default',
        description: 'Description',
        required: 'required',
        empty: '—',
      },
);
</script>

<template>
  <div class="ldx-param-grid">
    <div v-if="title" class="ldx-param-header">
      <span class="ldx-param-title">{{ title }}</span>
    </div>
    <div class="ldx-param-scroll">
      <table class="ldx-param-table">
        <thead>
          <tr>
            <th scope="col">{{ labels.param }}</th>
            <th scope="col">{{ labels.type }}</th>
            <th scope="col">{{ labels.defaultVal }}</th>
            <th scope="col">{{ labels.description }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.name">
            <td class="ldx-col-name">
              <div class="ldx-name-wrap">
                <code class="ldx-mono-name">{{ item.name }}</code>
                <span v-if="item.required" class="ldx-req-badge">{{ labels.required }}</span>
              </div>
            </td>
            <td class="ldx-col-type">
              <code class="ldx-mono-type">{{ item.type }}</code>
            </td>
            <td class="ldx-col-default">
              <code v-if="item.default !== undefined && item.default !== ''" class="ldx-mono-default">
                {{ item.default }}
              </code>
              <span v-else class="ldx-empty">{{ labels.empty }}</span>
            </td>
            <td class="ldx-col-desc">{{ item.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.ldx-param-grid {
  margin: 1.25rem 0;
  border: 1px solid var(--ldx-border, #E7E5E4);
  border-radius: 6px;
  background-color: var(--ldx-surface, #FFFFFF);
  overflow: hidden;
}

.ldx-param-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-param-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ldx-ink, #0C0A09);
}

.ldx-param-scroll {
  width: 100%;
  overflow-x: auto;
}

.ldx-param-table {
  display: table;
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 0.875rem;
  line-height: 1.55;
}

.ldx-param-table thead tr {
  background-color: var(--ldx-surface-alt, #F2F0EA);
}

.ldx-param-table th,
.ldx-param-table td {
  border: 0;
  border-bottom: 1px solid var(--ldx-border, #E7E5E4);
  padding: 9px 12px;
  text-align: left;
  vertical-align: top;
}

.ldx-param-table tbody tr:last-child td {
  border-bottom: 0;
}

.ldx-param-table th {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ldx-muted, #78716C);
  white-space: nowrap;
}

.ldx-name-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.ldx-mono-name {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ldx-ink, #0C0A09);
  background: transparent;
  padding: 0;
  white-space: nowrap;
}

.ldx-req-badge {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 1px 5px;
  border-radius: 4px;
  background-color: var(--ldx-accent-soft, rgba(217, 78, 31, 0.1));
  color: var(--ldx-accent-text, #AF4204);
  white-space: nowrap;
}

.ldx-mono-type {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ldx-flow, #2563EB);
  background-color: var(--ldx-flow-soft, rgba(37, 99, 235, 0.1));
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.ldx-mono-default {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  color: var(--ldx-ink-2, #44403C);
  background-color: var(--ldx-surface-alt, #F2F0EA);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.ldx-empty {
  font-family: var(--vp-font-family-mono, 'JetBrains Mono', monospace);
  font-size: 0.75rem;
  color: var(--ldx-muted, #78716C);
}

.ldx-col-desc {
  color: var(--ldx-ink-2, #44403C);
  min-width: 220px;
}
</style>
