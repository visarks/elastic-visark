<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useConnectionStore } from '@/store/modules/connection'
import LogoIcon from '@/assets/logo.svg'
import AboutDialog from '@/components/AboutDialog.vue'

const { t } = useI18n()
const connectionStore = useConnectionStore()

const appWindow = getCurrentWindow()
const isMaximized = ref(false)

// 检查最大化状态
async function checkMaximized() {
  try {
    isMaximized.value = await appWindow.isMaximized()
  } catch (e) {
    console.error('checkMaximized error:', e)
  }
}

// 初始化时检查最大化状态
checkMaximized()

// 当前连接列表
const activeConnectionList = computed(() => connectionStore.activeConnectionList)
const currentConnectionId = computed(() => connectionStore.currentConnectionId)

// 切换当前连接
function switchConnection(id: string) {
  connectionStore.setCurrentConnection(id)
}

// 断开指定连接
function disconnect(id: string, e: Event) {
  e.stopPropagation()
  connectionStore.removeActiveConnection(id)
}

// 窗口控制
async function minimize() {
  try {
    await appWindow.minimize()
  } catch (e) {
    console.error('minimize error:', e)
  }
}

async function toggleMaximize() {
  try {
    await appWindow.toggleMaximize()
    isMaximized.value = !isMaximized.value
  } catch (e) {
    console.error('toggleMaximize error:', e)
  }
}

async function closeWindow() {
  try {
    await appWindow.close()
  } catch (e) {
    console.error('close error:', e)
  }
}

// 双击检测
let lastClickTime = 0
const DOUBLE_CLICK_INTERVAL = 300

// 拖拽窗口（支持双击最大化）
async function startDragging(e: MouseEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.window-btn') || target.closest('.n-button') || target.closest('.n-dropdown') || target.closest('.cluster-tag') || target.closest('.app-logo')) return

  const now = Date.now()
  if (now - lastClickTime < DOUBLE_CLICK_INTERVAL) {
    // 双击 - 切换最大化
    await toggleMaximize()
    lastClickTime = 0
    return
  }
  lastClickTime = now

  try {
    await appWindow.startDragging()
  } catch (err) {
    console.error('startDragging error:', err)
  }
}

// About dialog
const showAbout = ref(false)

// Logo dropdown menu options
const logoMenuOptions = computed(() => [
  {
    label: t('about.title'),
    key: 'about'
  }
])

// Handle logo menu selection
function handleLogoMenuSelect(key: string) {
  if (key === 'about') {
    showAbout.value = true
  }
}
</script>

<template>
  <div class="titlebar" @mousedown="startDragging">
    <!-- 左侧：Logo 和集群标签 -->
    <div class="titlebar-left">
      <n-dropdown trigger="click" :options="logoMenuOptions" @select="handleLogoMenuSelect">
        <div class="app-logo" @mousedown.stop>
          <img :src="LogoIcon" alt="elastic-visark" class="logo-icon" />
          <span class="logo-text">elastic-visark</span>
        </div>
      </n-dropdown>

      <!-- 已连接的集群标签 -->
      <div class="cluster-tags">
        <div
          v-for="active in activeConnectionList"
          :key="active.connection.id"
          class="cluster-tag"
          :class="{ active: currentConnectionId === active.connection.id }"
          @click.stop="switchConnection(active.connection.id)"
        >
          <span class="cluster-name">{{ active.connection.name }}</span>
          <span class="cluster-close" @click="disconnect(active.connection.id, $event)">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
          </span>
        </div>
      </div>
    </div>

    <!-- 右侧：窗口控制 -->
    <div class="titlebar-right">
      <!-- 窗口控制按钮 -->
      <div class="window-controls">
        <button class="window-btn minimize" @click.stop="minimize" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="window-btn maximize" @click.stop="toggleMaximize" :title="isMaximized ? '还原' : '最大化'">
          <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="4" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1"/>
            <path d="M4 4V2h6v6h-2" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="window-btn close" @click.stop="closeWindow" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- About Dialog - rendered via Teleport -->
    <teleport to="body">
      <about-dialog v-model:show="showAbout" />
    </teleport>
  </div>
</template>

<style scoped lang="scss">
.titlebar {
  height: 64px;
  background-color: #1e1e1e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 0 12px;
  user-select: none;
  border-bottom: 1px solid #333;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.logo-icon {
  width: 32px;
  height: 32px;
}

.logo-text {
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
  letter-spacing: 0.5px;
}

.cluster-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  padding-left: 16px;
  border-left: 1px solid #444;
}

.cluster-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background-color: #2d2d2d;
  border-radius: 6px;
  border: 1px solid #444;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #3d3d3d;
    border-color: #555;
  }

  &.active {
    background-color: #1a5c3a;
    border-color: #4caf50;

    .cluster-name {
      color: #fff;
    }
  }
}

.cluster-name {
  font-size: 13px;
  color: #ccc;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cluster-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  color: #888;
  cursor: pointer;

  &:hover {
    background-color: #ff5f56;
    color: #fff;
  }
}

.titlebar-right {
  display: flex;
  align-items: center;
}

.window-controls {
  display: flex;
  align-items: center;
}

.window-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 24px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;

  &:hover {
    color: #fff;
  }

  &.close:hover {
    background-color: #e81123;
    color: #fff;
  }
}

// 浅色主题
:root[data-theme='light'] {
  .titlebar {
    background-color: #f3f3f3;
    border-bottom-color: #ddd;
  }

  .app-logo {
    &:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
  }

  .logo-text {
    color: #333;
  }

  .cluster-tags {
    border-left-color: #ddd;
  }

  .cluster-tag {
    background-color: #e8e8e8;
    border-color: #ccc;

    &:hover {
      background-color: #ddd;
    }

    &.active {
      background-color: #c8e6c9;
      border-color: #4caf50;

      .cluster-name {
        color: #1b5e20;
      }
    }
  }

  .cluster-name {
    color: #555;
  }

  .window-btn {
    color: #666;

    &:hover {
      color: #333;
    }

    &.close:hover {
      background-color: #e81123;
      color: #fff;
    }
  }
}
</style>