<script setup lang="ts">
import { computed, h } from 'vue'
import { NButton, NButtonGroup, NDropdown, NIcon, useMessage } from 'naive-ui'
import { AddOutline, CloseOutline, SearchOutline, CodeOutline, DocumentTextOutline, SettingsOutline, FileTrayFullOutline, GridOutline, ServerOutline, FolderOutline, LayersOutline } from '@vicons/ionicons5'
import { useTabInstanceStore, type TabType } from '@/store/modules/tabInstance'
import { useConnectionStore } from '@/store/modules/connection'

const tabInstanceStore = useTabInstanceStore()
const connectionStore = useConnectionStore()
const message = useMessage()

// 新建标签下拉菜单选项
const newTabOptions = [
  { label: '搜索', key: 'search' },
  { label: 'REST', key: 'rest' },
  { label: 'SQL', key: 'sql' }
]

// 图标映射
const iconMap: Record<string, any> = {
  'overview': GridOutline,
  'nodes': ServerOutline,
  'indices': FolderOutline,
  'shards': LayersOutline,
  'search': SearchOutline,
  'rest': CodeOutline,
  'sql': DocumentTextOutline,
  'templates': FileTrayFullOutline,
  'cluster-settings': SettingsOutline
}

// 当前标签列表
const tabs = computed(() => tabInstanceStore.tabs)

// 当前激活的标签ID
const activeTabId = computed(() => tabInstanceStore.activeTabId)

// 处理新建标签
function handleNewTab(key: TabType) {
  const connectionId = connectionStore.currentConnectionId
  if (!connectionId) {
    message.warning('请先连接集群')
    return
  }

  tabInstanceStore.createTab(key, connectionId)
}

// 处理标签点击
function handleTabClick(tabId: string) {
  tabInstanceStore.activateTab(tabId)
}

// 处理标签关闭
function handleTabClose(tabId: string, e: Event) {
  e.stopPropagation()
  tabInstanceStore.closeTab(tabId)
}

// 渲染下拉菜单图标
function renderDropdownIcon(option: any) {
  return h(NIcon, null, { default: () => h(iconMap[option.key] || SearchOutline) })
}
</script>

<template>
  <div class="tab-bar">
    <div class="tabs-list">
      <n-button-group size="small">
        <n-button
          v-for="tab in tabs"
          :key="tab.id"
          :type="activeTabId === tab.id ? 'primary' : 'default'"
          :tertiary="activeTabId !== tab.id"
          size="small"
          class="tab-button"
          @click="handleTabClick(tab.id)"
        >
          <template #icon>
            <n-icon v-if="iconMap[tab.type]" :component="iconMap[tab.type]" />
          </template>
          <span class="tab-title">{{ tab.title }}</span>
          <n-icon
            v-if="tab.closable"
            :component="CloseOutline"
            class="tab-close"
            @click.stop="handleTabClose(tab.id, $event)"
          />
        </n-button>
      </n-button-group>
    </div>

    <div class="tab-actions">
      <n-dropdown
        trigger="click"
        :options="newTabOptions"
        :render-icon="renderDropdownIcon"
        @select="handleNewTab"
      >
        <n-button size="small" quaternary>
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
        </n-button>
      </n-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  background-color: #252525;
  border-bottom: 1px solid #333;
  padding: 0 8px;
  height: 36px;
}

.tabs-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
  gap: 2px;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #444;
    border-radius: 2px;
  }

  :deep(.n-button-group) {
    display: flex;
    flex-wrap: nowrap;
  }
}

.tab-button {
  max-width: 200px;
  min-width: 80px;

  :deep(.n-button__content) {
    overflow: hidden;
  }
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.tab-close {
  margin-left: 4px;
  font-size: 14px;
  opacity: 0.6;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    color: #f44336;
  }
}

.tab-actions {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

// 浅色主题
:root[data-theme='light'] {
  .tab-bar {
    background-color: #f5f5f5;
    border-bottom-color: #e0e0e0;
  }
}
</style>