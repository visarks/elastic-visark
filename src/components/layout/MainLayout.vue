<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent } from 'vue'
import TitleBar from './TitleBar.vue'
import ActivityBar from './ActivityBar.vue'
import TabBar from './TabBar.vue'
import SideTree from './SideTree.vue'
import { useConnectionStore } from '@/store/modules/connection'
import { useTabInstanceStore } from '@/store/modules/tabInstance'
import LogoIcon from '@/assets/logo.svg'

// 定义事件
const emit = defineEmits<{
  openAbout: []
}>()

function handleOpenAbout() {
  emit('openAbout')
}

// 异步加载组件
const OverviewPage = defineAsyncComponent(() => import('@/views/OverviewPage.vue'))
const NodesPage = defineAsyncComponent(() => import('@/views/NodesPage.vue'))
const ShardsPage = defineAsyncComponent(() => import('@/views/ShardsPage.vue'))
const IndicesPage = defineAsyncComponent(() => import('@/views/IndicesPage.vue'))
const SearchPage = defineAsyncComponent(() => import('@/views/search/index.vue'))
const RestPage = defineAsyncComponent(() => import('@/views/rest/index.vue'))
const SqlPage = defineAsyncComponent(() => import('@/views/sql/index.vue'))
const TemplatePage = defineAsyncComponent(() => import('@/views/template/index.vue'))
const ClusterSettingsPage = defineAsyncComponent(() => import('@/views/cluster/ClusterSettingsPage.vue'))

// 组件映射
const componentMap: Record<string, any> = {
  'overview': OverviewPage,
  'nodes': NodesPage,
  'shards': ShardsPage,
  'indices': IndicesPage,
  'search': SearchPage,
  'rest': RestPage,
  'sql': SqlPage,
  'templates': TemplatePage,
  'cluster-settings': ClusterSettingsPage
}

const connectionStore = useConnectionStore()
const tabInstanceStore = useTabInstanceStore()

// 左侧面板宽度
const sideTreeWidth = ref(290)

// 拖拽调整宽度
const isDragging = ref(false)
const startX = ref(0)
const startWidth = ref(0)

function startResize(e: MouseEvent) {
  isDragging.value = true
  startX.value = e.clientX
  startWidth.value = sideTreeWidth.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleResize(e: MouseEvent) {
  if (!isDragging.value) return
  const diff = e.clientX - startX.value
  const newWidth = Math.max(200, Math.min(600, startWidth.value + diff))
  sideTreeWidth.value = newWidth
}

function stopResize() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 当前激活的标签
const activeTab = computed(() => tabInstanceStore.activeTab)

// 当前激活的组件
const activeComponent = computed(() => {
  if (!activeTab.value) return null
  return componentMap[activeTab.value.type] || null
})

// 监听连接变化
watch(
  () => connectionStore.currentConnectionId,
  async (newId, oldId) => {
    if (newId) {
      // 新连接，尝试恢复标签或初始化
      const restored = await tabInstanceStore.loadFromStorage(newId)
      if (!restored) {
        // 没有恢复的标签，初始化概览
        tabInstanceStore.initFixedTabs(newId)
      }
    } else if (oldId) {
      // 断开连接，重置标签
      tabInstanceStore.resetTabs()
    }
  },
  { immediate: true }
)

// 监听连接断开
watch(
  () => connectionStore.activeConnectionList.length,
  (len) => {
    if (len === 0) {
      tabInstanceStore.resetTabs()
    }
  }
)
</script>

<template>
  <div class="app-container">
    <!-- 自定义标题栏 -->
    <title-bar />

    <!-- 主内容区 -->
    <div class="main-content">
      <div class="content-layout">
        <!-- 左侧活动栏 -->
        <activity-bar @open-about="handleOpenAbout" />

        <!-- 左侧树面板 -->
        <div
          class="side-tree-wrapper"
          :class="{ collapsed: !connectionStore.showSideTree }"
          :style="{ width: connectionStore.showSideTree ? `${sideTreeWidth}px` : '0px' }"
        >
          <side-tree v-show="connectionStore.showSideTree" />
          <!-- 拖拽调整宽度的把手 -->
          <div
            v-if="connectionStore.showSideTree"
            class="resize-handle"
            @mousedown="startResize"
          ></div>
        </div>

        <!-- 右侧内容区 -->
        <div class="right-layout">
          <div class="layout-content">
            <!-- 未连接时显示欢迎页 -->
            <div v-if="!connectionStore.activeConnection" class="welcome-page">
              <div class="welcome-content">
                <img :src="LogoIcon" alt="elastic-visark" class="hero-logo" />
                <h1>elastic-visark</h1>
                <p class="subtitle">Elasticsearch 可视化管理工具</p>
              </div>
            </div>

            <!-- 连接后显示标签页 -->
            <template v-else>
              <tab-bar />
              <div class="tabs-content">
                <KeepAlive>
                  <component
                    v-if="activeComponent && activeTab"
                    :is="activeComponent"
                    :key="activeTab.id"
                    :tab-id="activeTab.id"
                  />
                </KeepAlive>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.content-layout {
  display: flex;
  height: 100%;
}

.side-tree-wrapper {
  position: relative;
  min-width: 0;
  transition: width 0.2s ease;
  border-right: 1px solid #333;

  &.collapsed {
    border-right: none;
  }
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background-color: transparent;
  transition: background-color 0.2s;
  z-index: 10;

  &:hover {
    background-color: #63e2b7;
  }
}

.right-layout {
  flex: 1;
  min-width: 0;
  background-color: #1a1a1a;
}

.layout-content {
  height: calc(100vh - 64px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.welcome-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  flex: 1;
}

.welcome-content {
  text-align: center;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  .hero-logo {
    width: 64px;
    height: 64px;
    margin-bottom: 24px;
  }

  h1 {
    font-size: 32px;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #63e2b7 0%, #4caf50 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #888;
    font-size: 16px;
    margin-bottom: 16px;
  }
}

.tabs-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;

  > * {
    flex: 1;
    min-height: 0;
  }
}

// 浅色主题
:root[data-theme='light'] {
  .app-container {
    background-color: #f5f5f5;
  }

  .side-tree-wrapper {
    border-right-color: #e0e0e0;
  }

  .resize-handle {
    &:hover {
      background-color: #18a058;
    }
  }

  .collapse-btn,
  .expand-btn {
    background-color: #e0e0e0;
    color: #666;

    &:hover {
      background-color: #d0d0d0;
      color: #333;
    }
  }

  .right-layout {
    background-color: #f5f5f5;
  }

  .welcome-content {
    h1 {
      background: linear-gradient(135deg, #18a058 0%, #4caf50 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      color: #666;
    }
  }
}
</style>