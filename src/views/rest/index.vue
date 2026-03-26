<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  NButton, NIcon, NSelect, NSpin, NEmpty, NInput, useMessage
} from 'naive-ui'
import {
  PlayOutline, CopyOutline, DownloadOutline, ChevronBackOutline, ChevronForwardOutline
} from '@vicons/ionicons5'
import * as monaco from 'monaco-editor'
import { useConnectionStore } from '@/store/modules/connection'
import { useTabInstanceStore, type RestTabState } from '@/store/modules/tabInstance'
import { ElasticClient, saveFileWithDialog } from '@/api/elastic'
import JsonViewer from '@/components/JsonViewer.vue'

// 接收 props
const props = defineProps<{
  tabId: string
}>()

const connectionStore = useConnectionStore()
const tabInstanceStore = useTabInstanceStore()
const message = useMessage()

// 获取当前标签状态
const tabState = computed<RestTabState>(() => {
  const state = tabInstanceStore.getTabState(props.tabId)
  return state as RestTabState
})

// 状态更新函数
function updateState(partial: Partial<RestTabState>) {
  tabInstanceStore.updateTabState(props.tabId, partial)
}

// 编辑器容器引用
const requestEditorContainer = ref<HTMLElement | null>(null)
let requestEditor: monaco.editor.IStandaloneCodeEditor | null = null

// 面板状态
const leftPanelWidth = ref(400)
const leftPanelCollapsed = ref(false)
const isResizing = ref(false)

// 响应区域引用
const responseAreaRef = ref<HTMLElement | null>(null)
const responseHeight = ref(400)

// 请求状态（从 tabState 读取）
const method = computed({
  get: () => tabState.value.method,
  set: (val) => updateState({ method: val })
})

const path = computed({
  get: () => tabState.value.path,
  set: (val) => updateState({ path: val })
})

const loading = ref(false)
const response = computed({
  get: () => tabState.value.response,
  set: (val) => updateState({ response: val })
})

const responseType = ref<'json' | 'text'>('json')
const error = ref<string | null>(null)
const duration = computed({
  get: () => tabState.value.duration,
  set: (val) => updateState({ duration: val })
})

const statusCode = computed({
  get: () => tabState.value.statusCode,
  set: (val) => updateState({ statusCode: val })
})

// 方法选项
const methodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'HEAD', value: 'HEAD' },
  { label: 'PATCH', value: 'PATCH' }
]

// 快捷路径选项
const quickPaths = [
  { label: '_cat/indices', value: '_cat/indices?format=json' },
  { label: '_cat/nodes', value: '_cat/nodes?format=json' },
  { label: '_cluster/health', value: '_cluster/health' },
  { label: '_cluster/settings', value: '_cluster/settings' },
  { label: '_cat/templates', value: '_cat/templates?format=json' },
  { label: '_cat/shards', value: '_cat/shards?format=json' },
  { label: '_cat/aliases', value: '_cat/aliases?format=json' },
  { label: '_nodes/stats', value: '_nodes/stats' },
  { label: '_aliases', value: '_aliases' }
]

// 当前活跃连接
const currentActive = computed(() => connectionStore.currentActiveConnection)

// 获取编辑器主题
function getEditorTheme(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'light' ? 'vs' : 'vs-dark'
}

// 初始化请求编辑器
function initRequestEditor() {
  if (!requestEditorContainer.value) return

  if (requestEditor) {
    requestEditor.dispose()
  }

  // 从 tabState 读取 body
  const initialBody = tabState.value.body || '{\n  "query": {\n    "match_all": {}\n  }\n}'

  requestEditor = monaco.editor.create(requestEditorContainer.value, {
    value: initialBody,
    language: 'json',
    theme: getEditorTheme(),
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    folding: true,
    foldingStrategy: 'indentation',
    renderWhitespace: 'none',
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8
    },
    tabSize: 2
  })

  // 监听编辑器内容变化，保存到 tabState
  requestEditor.onDidChangeModelContent(() => {
    updateState({ body: requestEditor?.getValue() || '' })
  })
}

// 执行请求
async function executeRequest() {
  const active = currentActive.value
  if (!active) {
    message.warning('请先连接集群')
    return
  }

  if (!path.value) {
    message.warning('请输入请求路径')
    return
  }

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  loading.value = true
  error.value = null
  updateState({ response: null, statusCode: null })

  const startTime = Date.now()
  let body: any = undefined

  // 获取请求体
  if (['POST', 'PUT', 'PATCH'].includes(method.value)) {
    const bodyText = requestEditor?.getValue() || ''
    if (bodyText.trim()) {
      try {
        body = JSON.parse(bodyText)
      } catch (e) {
        message.error('请求体 JSON 格式错误')
        loading.value = false
        return
      }
    }
  }

  try {
    const result = await client.execute(method.value, path.value.startsWith('/') ? path.value : `/${path.value}`, body)

    // 检测响应类型
    if (typeof result === 'string') {
      // 尝试解析为 JSON
      try {
        updateState({ response: JSON.parse(result) })
        responseType.value = 'json'
      } catch {
        // 不是 JSON，作为文本处理
        updateState({ response: result })
        responseType.value = 'text'
      }
    } else {
      updateState({ response: result })
      responseType.value = 'json'
    }

    const dur = Date.now() - startTime
    updateState({ statusCode: 200, duration: dur })

    message.success(`请求成功 (${dur}ms)`)
  } catch (e: any) {
    error.value = e.message || '请求失败'
    const dur = Date.now() - startTime
    const status = e.status || 500
    updateState({ response: { error: error.value }, statusCode: status, duration: dur })
    responseType.value = 'json'

    message.error(`请求失败: ${error.value}`)
  } finally {
    loading.value = false
  }
}

// 复制响应
async function copyResponse() {
  if (!response.value) return

  try {
    let text: string
    if (responseType.value === 'text') {
      text = response.value as string
    } else {
      text = JSON.stringify(response.value, null, 2)
    }
    await navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

// 下载响应
async function downloadResponse() {
  if (!response.value) return

  let content: string
  let extension: string

  if (responseType.value === 'text') {
    content = response.value as string
    extension = 'txt'
  } else {
    content = JSON.stringify(response.value, null, 2)
    extension = 'json'
  }

  const defaultName = `response-${Date.now()}.${extension}`

  try {
    const saved = await saveFileWithDialog(defaultName, content)
    if (saved) {
      message.success('下载成功')
    }
  } catch (e) {
    message.error('下载失败')
  }
}

// 格式化请求体
function formatRequestBody() {
  if (!requestEditor) return

  const text = requestEditor.getValue()
  if (!text.trim()) return

  try {
    const parsed = JSON.parse(text)
    requestEditor.setValue(JSON.stringify(parsed, null, 2))
    message.success('格式化成功')
  } catch {
    message.error('JSON 格式错误')
  }
}

// 拖动调整面板宽度
const startWidth = ref(0)
const startX = ref(0)

function startResize(e: MouseEvent) {
  isResizing.value = true
  startWidth.value = leftPanelWidth.value
  startX.value = e.clientX
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
}

function handleMouseMove(e: MouseEvent) {
  if (!isResizing.value) return
  const diff = e.clientX - startX.value
  const maxWidth = Math.floor(window.innerWidth * 0.6)
  leftPanelWidth.value = Math.min(maxWidth, Math.max(300, startWidth.value + diff))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

// 切换面板折叠
function togglePanel() {
  leftPanelCollapsed.value = !leftPanelCollapsed.value
}

// 处理快捷路径选择
function handleQuickPath(val: string) {
  path.value = val
}

// 更新响应区域高度
function updateResponseHeight() {
  nextTick(() => {
    if (responseAreaRef.value) {
      const rect = responseAreaRef.value.getBoundingClientRect()
      // 减去工具栏高度
      responseHeight.value = Math.max(rect.height - 50, 300)
    }
  })
}

// 监听主题变化
function handleThemeChange() {
  const theme = getEditorTheme()
  monaco.editor.setTheme(theme)
}

// 监听连接变化
watch(() => connectionStore.currentConnectionId, (connId) => {
  if (connId) {
    // 重置响应
    updateState({ response: null, statusCode: null })
    error.value = null
  }
})

// 监听面板宽度变化，更新高度
watch([leftPanelWidth, leftPanelCollapsed], () => {
  updateResponseHeight()
})

// 处理预填充事件
function handlePrefill(e: CustomEvent) {
  const { method: m, path: p, body } = e.detail
  if (m) updateState({ method: m })
  if (p) updateState({ path: p })
  if (body && requestEditor) {
    requestEditor.setValue(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
    updateState({ body: requestEditor.getValue() })
  }
}

onMounted(() => {
  initRequestEditor()
  updateResponseHeight()

  // 监听预填充事件
  window.addEventListener('rest-prefill', handlePrefill as EventListener)

  // 监听主题变化
  const observer = new MutationObserver(handleThemeChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  // 监听窗口大小变化
  window.addEventListener('resize', updateResponseHeight)

  onUnmounted(() => {
    observer.disconnect()
    window.removeEventListener('resize', updateResponseHeight)
    window.removeEventListener('rest-prefill', handlePrefill as EventListener)
    requestEditor?.dispose()
  })
})
</script>

<template>
  <div class="rest-page">
    <div class="main-content">
      <!-- 左侧请求面板 -->
      <div
        class="request-panel"
        :class="{ collapsed: leftPanelCollapsed }"
        :style="{ width: leftPanelCollapsed ? '0px' : `${leftPanelWidth}px` }"
      >
        <div v-show="!leftPanelCollapsed" class="panel-content">
          <!-- 请求行 -->
          <div class="request-line">
            <n-select
              v-model:value="method"
              :options="methodOptions"
              size="small"
              style="width: 100px"
            />
            <n-input
              v-model:value="path"
              placeholder="/_cat/indices"
              size="small"
              style="flex: 1"
              @keyup.enter="executeRequest"
            />
            <n-button
              type="primary"
              size="small"
              :loading="loading"
              @click="executeRequest"
            >
              <template #icon>
                <n-icon :component="PlayOutline" />
              </template>
            </n-button>
          </div>

          <!-- 快捷路径 -->
          <div class="quick-paths">
            <n-select
              placeholder="快捷路径"
              size="small"
              clearable
              :options="quickPaths"
              @update:value="handleQuickPath"
            />
          </div>

          <!-- 请求体编辑器 -->
          <div class="editor-header">
            <span>请求体</span>
            <div class="editor-actions">
              <n-button size="tiny" quaternary @click="formatRequestBody">格式化</n-button>
            </div>
          </div>
          <div ref="requestEditorContainer" class="request-editor"></div>
        </div>

        <!-- 拖动调整宽度 -->
        <div
          v-show="!leftPanelCollapsed"
          class="resize-handle"
          :class="{ active: isResizing }"
          @mousedown="startResize"
        />
      </div>

      <!-- 右侧响应面板 -->
      <div ref="responseAreaRef" class="response-panel">
        <!-- 工具栏 -->
        <div class="response-toolbar">
          <div class="toolbar-left">
            <div class="panel-toggle" @click="togglePanel">
              <n-icon :size="16">
                <ChevronForwardOutline v-if="leftPanelCollapsed" />
                <ChevronBackOutline v-else />
              </n-icon>
            </div>
            <span class="toolbar-title">响应</span>
            <span v-if="statusCode" class="status-badge" :class="{ success: statusCode < 400, error: statusCode >= 400 }">
              {{ statusCode }}
            </span>
            <span v-if="duration" class="duration">{{ duration }}ms</span>
          </div>
          <div class="toolbar-right">
            <n-button quaternary size="small" :disabled="!response" @click="copyResponse">
              <template #icon>
                <n-icon :component="CopyOutline" />
              </template>
            </n-button>
            <n-button quaternary size="small" :disabled="!response" @click="downloadResponse">
              <template #icon>
                <n-icon :component="DownloadOutline" />
              </template>
            </n-button>
          </div>
        </div>

        <!-- 响应内容 -->
        <div class="response-content">
          <n-spin :show="loading">
            <JsonViewer v-if="response && responseType === 'json'" :content="response" :height="`${responseHeight}px`" />
            <pre v-else-if="response && responseType === 'text'" class="text-response" :style="{ height: `${responseHeight}px` }">{{ response }}</pre>
            <n-empty v-else description="执行请求查看响应" />
          </n-spin>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rest-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.request-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: #252525;
  border-right: 1px solid #333;
  min-width: 0;
  transition: width 0.2s ease;

  &.collapsed {
    border-right: none;
  }
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.request-line {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.quick-paths {
  margin-bottom: 8px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid #333;
  margin-top: 8px;

  span {
    font-size: 12px;
    color: #888;
  }
}

.editor-actions {
  display: flex;
  gap: 4px;
}

.request-editor {
  flex: 1;
  min-height: 0;
  border: 1px solid #333;
  border-radius: 4px;
  overflow: hidden;
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

  &:hover,
  &.active {
    background-color: #63e2b7;
  }
}

.response-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #1a1a1a;
}

.response-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #252525;
  border-bottom: 1px solid #333;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-toggle {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  color: #888;

  &:hover {
    background-color: #3d3d3d;
    color: #fff;
  }
}

.toolbar-title {
  font-size: 14px;
  color: #fff;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;

  &.success {
    background-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  &.error {
    background-color: rgba(244, 67, 54, 0.2);
    color: #f44336;
  }
}

.duration {
  font-size: 12px;
  color: #888;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.response-content {
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.text-response {
  margin: 0;
  padding: 12px;
  background-color: #2d2d2d;
  border: 1px solid #333;
  border-radius: 4px;
  overflow: auto;
  font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: #e0e0e0;
}

// 浅色主题
:root[data-theme='light'] {
  .rest-page {
    background-color: #f5f5f5;
  }

  .request-panel {
    background-color: #fff;
    border-right-color: #e0e0e0;
  }

  .editor-header {
    border-top-color: #e0e0e0;
  }

  .request-editor {
    border-color: #e0e0e0;
  }

  .resize-handle {
    &:hover,
    &.active {
      background-color: #18a058;
    }
  }

  .response-panel {
    background-color: #f5f5f5;
  }

  .response-toolbar {
    background-color: #fff;
    border-bottom-color: #e0e0e0;
  }

  .panel-toggle:hover {
    background-color: #f0f0f0;
    color: #333;
  }

  .toolbar-title {
    color: #333;
  }

  .text-response {
    background-color: #f8f8f8;
    border-color: #e0e0e0;
    color: #333;
  }
}
</style>