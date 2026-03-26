<script setup lang="ts">
import { ref, h } from 'vue'
import { NTooltip, NIcon, NDropdown, useMessage } from 'naive-ui'
import { SettingsOutline, MoonOutline, SunnyOutline, TimeOutline, ServerOutline, InformationCircleOutline, CloudDownloadOutline } from '@vicons/ionicons5'
import { useSettingsStore } from '@/store/modules/settings'
import { useConnectionStore } from '@/store/modules/connection'
import SettingsModal from '@/components/SettingsModal.vue'
import HistoryModal from '@/components/HistoryModal.vue'
import { checkForUpdate } from '@/services/updater'

const settingsStore = useSettingsStore()
const connectionStore = useConnectionStore()
const message = useMessage()

const settingsModalRef = ref<InstanceType<typeof SettingsModal> | null>(null)
const historyModalRef = ref<InstanceType<typeof HistoryModal> | null>(null)

// 定义事件
const emit = defineEmits<{
  openAbout: []
}>()

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

// 检查更新
async function handleCheckUpdate() {
  console.log('handleCheckUpdate called')
  const info = await checkForUpdate()
  console.log('checkForUpdate result:', info)
  if (info && info.available) {
    // Update notification modal will show automatically via UpdateNotification.vue
    console.log('Update available, modal should show')
  } else if (info === null) {
    // Error occurred
    console.log('Update check returned null')
    message.error('检查更新失败')
  } else {
    // No update available
    console.log('No update available')
    message.success('当前已是最新版本')
  }
}

// 打开关于对话框
function openAbout() {
  emit('openAbout')
}

// 设置下拉菜单选项
const settingsDropdownOptions = [
  {
    label: '设置',
    key: 'settings',
    icon: () => h(NIcon, null, { default: () => h(SettingsOutline) })
  },
  {
    label: '检查更新',
    key: 'checkUpdate',
    icon: () => h(NIcon, null, { default: () => h(CloudDownloadOutline) })
  },
  {
    type: 'divider',
    key: 'd1'
  },
  {
    label: '关于',
    key: 'about',
    icon: () => h(NIcon, null, { default: () => h(InformationCircleOutline) })
  }
]

// 处理下拉菜单选择
function handleSettingsSelect(key: string) {
  switch (key) {
    case 'settings':
      openSettings()
      break
    case 'checkUpdate':
      handleCheckUpdate()
      break
    case 'about':
      openAbout()
      break
  }
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

      <!-- 设置下拉菜单 -->
      <n-dropdown
        trigger="click"
        :options="settingsDropdownOptions"
        @select="handleSettingsSelect"
        placement="right-start"
      >
        <n-tooltip placement="right" trigger="hover">
          <template #trigger>
            <div class="activity-item">
              <n-icon :component="SettingsOutline" size="20" />
            </div>
          </template>
          设置
        </n-tooltip>
      </n-dropdown>
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