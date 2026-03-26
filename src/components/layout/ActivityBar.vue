<script setup lang="ts">
import { ref } from 'vue'
import { NTooltip, NIcon } from 'naive-ui'
import { SettingsOutline, MoonOutline, SunnyOutline, TimeOutline, ServerOutline } from '@vicons/ionicons5'
import { useSettingsStore } from '@/store/modules/settings'
import { useConnectionStore } from '@/store/modules/connection'
import SettingsModal from '@/components/SettingsModal.vue'
import HistoryModal from '@/components/HistoryModal.vue'

const settingsStore = useSettingsStore()
const connectionStore = useConnectionStore()

const settingsModalRef = ref<InstanceType<typeof SettingsModal> | null>(null)
const historyModalRef = ref<InstanceType<typeof HistoryModal> | null>(null)

// 切换主题
function toggleTheme() {
  settingsStore.setTheme(settingsStore.theme === 'dark' ? 'light' : 'dark')
}

// 打开设置页面
function openSettings() {
  settingsModalRef.value?.open()
}

// 打开历史记录
function openHistory() {
  historyModalRef.value?.open()
}

// 切换左侧集群管理树
function toggleSideTree() {
  connectionStore.toggleSideTree()
}
</script>

<template>
  <div class="activity-bar">
    <div class="activity-top">
      <!-- 集群管理 -->
      <n-tooltip placement="right" trigger="hover">
        <template #trigger>
          <div
            class="activity-item"
            :class="{ active: connectionStore.showSideTree }"
            @click="toggleSideTree"
          >
            <n-icon :component="ServerOutline" size="20" />
          </div>
        </template>
        集群管理
      </n-tooltip>

      <!-- 历史记录 -->
      <n-tooltip placement="right" trigger="hover">
        <template #trigger>
          <div class="activity-item" @click="openHistory">
            <n-icon :component="TimeOutline" size="20" />
          </div>
        </template>
        历史记录
      </n-tooltip>
    </div>

    <div class="activity-bottom">
      <!-- 主题切换 -->
      <n-tooltip placement="right" trigger="hover">
        <template #trigger>
          <div class="activity-item" @click="toggleTheme">
            <n-icon :component="settingsStore.theme === 'dark' ? MoonOutline : SunnyOutline" size="20" />
          </div>
        </template>
        {{ settingsStore.theme === 'dark' ? '深色主题' : '浅色主题' }}
      </n-tooltip>

      <!-- 设置图标 -->
      <n-tooltip placement="right" trigger="hover">
        <template #trigger>
          <div class="activity-item" @click="openSettings">
            <n-icon :component="SettingsOutline" size="20" />
          </div>
        </template>
        设置
      </n-tooltip>
    </div>

    <SettingsModal ref="settingsModalRef" />
    <HistoryModal ref="historyModalRef" />
  </div>
</template>

<style scoped lang="scss">
.activity-bar {
  width: 48px;
  height: calc(100vh - 64px);
  background-color: #333;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  // 确保 NTooltip 的 trigger 包裹层不影响 hover
  :deep(.n-tooltip-trigger) {
    display: block;
  }
}

.activity-top,
.activity-bottom {
  display: flex;
  flex-direction: column;
}

.activity-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  cursor: pointer;
  color: #aaa;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  &.active {
    color: #63e2b7;
    background-color: rgba(99, 226, 183, 0.15);
  }
}

// 浅色主题
:root[data-theme='light'] {
  .activity-bar {
    background-color: #e8e8e8;
  }

  .activity-item {
    color: #666;

    &:hover {
      background-color: rgba(0, 0, 0, 0.08);
      color: #333;
    }

    &.active {
      color: #18a058;
      background-color: rgba(24, 160, 88, 0.15);
    }
  }
}
</style>