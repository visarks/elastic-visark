<script setup lang="ts">
import {
  NButton, NIcon, NEmpty, useMessage
} from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import JsonViewer from '@/components/JsonViewer.vue'

const props = defineProps<{
  indexName: string
  settings: any
}>()

const message = useMessage()

// 复制设置
async function copySettings() {
  if (!props.settings) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.settings, null, 2))
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}
</script>

<template>
  <div class="settings-tab">
    <div class="tab-toolbar">
      <div class="toolbar-left"></div>
      <div class="toolbar-right">
        <n-button size="small" quaternary :disabled="!settings" @click="copySettings">
          <template #icon>
            <n-icon :component="CopyOutline" />
          </template>
          复制
        </n-button>
      </div>
    </div>

    <div class="tab-content">
      <JsonViewer v-if="settings" :content="settings" height="calc(100vh - 350px)" />
      <n-empty v-else description="暂无设置数据" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tab-content {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}

:root[data-theme='light'] {
  .tab-toolbar {
    border-bottom-color: #e0e0e0;
  }
}
</style>