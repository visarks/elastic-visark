<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  NButton, NIcon, NSpin, NEmpty, NRadioGroup, NRadioButton, useMessage
} from 'naive-ui'
import {
  PlayOutline, CopyOutline, DownloadOutline, ChevronUpOutline, ChevronDownOutline
} from '@vicons/ionicons5'
import * as monaco from 'monaco-editor'
import { useConnectionStore } from '@/store/modules/connection'
import { useTabInstanceStore, type SqlTabState } from '@/store/modules/tabInstance'
import { ElasticClient, saveFileWithDialog } from '@/api/elastic'
import { getSqlHistory, saveSqlHistory } from '@/services/database'
import JsonViewer from '@/components/JsonViewer.vue'

const props = defineProps<{
  tabId: string
}>()

const connectionStore = useConnectionStore()
const tabInstanceStore = useTabInstanceStore()
const message = useMessage()

// 获取当前标签状态
const tabState = computed<SqlTabState>(() => {
  const state = tabInstanceStore.getTabState(props.tabId)
  return state as SqlTabState
})

// 状态更新函数
function updateState(partial: Partial<SqlTabState>) {
  tabInstanceStore.updateTabState(props.tabId, partial)
}

// 编辑器容器引用
const sqlEditorContainer = ref<HTMLElement | null>(null)
let sqlEditor: monaco.editor.IStandaloneCodeEditor | null = null

// 结果容器引用
const resultContent = ref<HTMLElement | null>(null)
const tableHeight = ref(400)

// 面板状态
const editorHeight = ref(200)
const editorCollapsed = ref(false)
const isResizing = ref(false)

// 请求状态
const loading = ref(false)
const result = computed({
  get: () => tabState.value.result,
  set: (val) => updateState({ result: val })
})
const error = ref<string | null>(null)
const duration = ref(0)
const resultMode = computed({
  get: () => tabState.value.resultMode,
  set: (val) => updateState({ resultMode: val })
})

// 历史记录
interface HistoryItem {
  id: string
  sql: string
  timestamp: number
}
const history = ref<HistoryItem[]>([])
const historyIndex = ref(-1)

// 索引列表（用于自动补全）
const indexNames = ref<string[]>([])
const indexMappings = ref<Record<string, string[]>>({})

// 表格数据
const tableColumns = ref<any[]>([])
const tableData = ref<any[]>([])

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 加载索引列表
async function loadIndexNames() {
  const active = currentActive.value
  if (!active) return

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const indices = await client.getIndices()
    indexNames.value = indices.map((idx: any) => idx.index).filter((name: string) => !name.startsWith('.'))

    // 后台加载 mapping 信息，不阻塞 UI
    loadMappingsInBackground(client, indexNames.value)
  } catch {
    indexNames.value = []
  }
}

// 后台加载 mapping 信息
async function loadMappingsInBackground(client: ElasticClient, indices: string[]) {
  for (const indexName of indices.slice(0, 20)) { // 只加载前20个索引的 mapping
    try {
      const mapping = await client.getIndexMapping(indexName)
      const properties = mapping[indexName]?.mappings?.properties || {}
      const fields = Object.keys(properties)
      if (fields.length > 0) {
        indexMappings.value[indexName] = fields
      }
    } catch {
      // 忽略单个索引的错误
    }
  }
}

// 获取编辑器主题
function getEditorTheme(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'light' ? 'vs' : 'vs-dark'
}

// 初始化 SQL 编辑器
function initSqlEditor() {
  if (!sqlEditorContainer.value) return

  if (sqlEditor) {
    sqlEditor.dispose()
  }

  // 从 tabState 读取 query
  const initialQuery = tabState.value.query || 'SELECT * FROM "index_name" LIMIT 100'

  sqlEditor = monaco.editor.create(sqlEditorContainer.value, {
    value: initialQuery,
    language: 'sql',
    theme: getEditorTheme(),
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    folding: true,
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8
    },
    tabSize: 2
  })

  // 监听编辑器内容变化，保存到 tabState
  sqlEditor.onDidChangeModelContent(() => {
    updateState({ query: sqlEditor?.getValue() || '' })
  })

  // 注册 SQL 语言支持
  monaco.languages.registerCompletionItemProvider('sql', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      // 获取当前行内容，判断是否在 FROM 或 JOIN 后面
      const lineContent = model.getLineContent(position.lineNumber)
      const textBeforeCursor = lineContent.substring(0, position.column - 1).toUpperCase()
      const isAfterFrom = /\bFROM\s*$/.test(textBeforeCursor) || /\bFROM\s+\S*\s*$/.test(textBeforeCursor)
      const isAfterJoin = /\bJOIN\s*$/.test(textBeforeCursor)

      const suggestions: any[] = []

      // SQL 关键字
      const keywords = [
        { label: 'SELECT', insertText: 'SELECT ' },
        { label: 'FROM', insertText: 'FROM ' },
        { label: 'WHERE', insertText: 'WHERE ' },
        { label: 'AND', insertText: 'AND ' },
        { label: 'OR', insertText: 'OR ' },
        { label: 'NOT', insertText: 'NOT ' },
        { label: 'IN', insertText: 'IN ' },
        { label: 'LIKE', insertText: 'LIKE ' },
        { label: 'BETWEEN', insertText: 'BETWEEN ' },
        { label: 'IS NULL', insertText: 'IS NULL' },
        { label: 'IS NOT NULL', insertText: 'IS NOT NULL' },
        { label: 'GROUP BY', insertText: 'GROUP BY ' },
        { label: 'ORDER BY', insertText: 'ORDER BY ' },
        { label: 'ASC', insertText: 'ASC' },
        { label: 'DESC', insertText: 'DESC' },
        { label: 'LIMIT', insertText: 'LIMIT ' },
        { label: 'OFFSET', insertText: 'OFFSET ' },
        { label: 'HAVING', insertText: 'HAVING ' },
        { label: 'JOIN', insertText: 'JOIN ' },
        { label: 'LEFT JOIN', insertText: 'LEFT JOIN ' },
        { label: 'RIGHT JOIN', insertText: 'RIGHT JOIN ' },
        { label: 'INNER JOIN', insertText: 'INNER JOIN ' },
        { label: 'ON', insertText: 'ON ' },
        { label: 'AS', insertText: 'AS ' },
        { label: 'DISTINCT', insertText: 'DISTINCT ' },
        { label: 'ALL', insertText: 'ALL ' }
      ]

      // SQL 函数
      const functions = [
        { label: 'COUNT(*)', insertText: 'COUNT(*)' },
        { label: 'COUNT', insertText: 'COUNT($0)' },
        { label: 'SUM', insertText: 'SUM($0)' },
        { label: 'AVG', insertText: 'AVG($0)' },
        { label: 'MIN', insertText: 'MIN($0)' },
        { label: 'MAX', insertText: 'MAX($0)' },
        { label: 'CAST', insertText: 'CAST($0 AS )' },
        { label: 'YEAR', insertText: 'YEAR($0)' },
        { label: 'MONTH', insertText: 'MONTH($0)' },
        { label: 'DAY', insertText: 'DAY($0)' },
        { label: 'HOUR', insertText: 'HOUR($0)' },
        { label: 'MINUTE', insertText: 'MINUTE($0)' },
        { label: 'SECOND', insertText: 'SECOND($0)' },
        { label: 'DATE_FORMAT', insertText: 'DATE_FORMAT($0, \'\')' },
        { label: 'SUBSTRING', insertText: 'SUBSTRING($0, 1, 1)' },
        { label: 'CONCAT', insertText: 'CONCAT($0, \'\')' },
        { label: 'LENGTH', insertText: 'LENGTH($0)' },
        { label: 'LOWER', insertText: 'LOWER($0)' },
        { label: 'UPPER', insertText: 'UPPER($0)' },
        { label: 'TRIM', insertText: 'TRIM($0)' },
        { label: 'COALESCE', insertText: 'COALESCE($0, \'\')' }
      ]

      // 如果在 FROM 或 JOIN 后面，优先显示索引名
      if (isAfterFrom || isAfterJoin) {
        indexNames.value.forEach(name => {
          suggestions.push({
            label: name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: `"${name}"`,
            range,
            detail: '索引'
          })
        })
      }

      // 添加关键字
      keywords.forEach(kw => {
        suggestions.push({
          label: kw.label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw.insertText,
          range
        })
      })

      // 添加函数
      functions.forEach(fn => {
        suggestions.push({
          label: fn.label,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: fn.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range
        })
      })

      // 添加索引名作为表名
      indexNames.value.forEach(name => {
        suggestions.push({
          label: name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: `"${name}"`,
          range,
          detail: '索引'
        })

        // 添加该索引的字段名
        const fields = indexMappings.value[name]
        if (fields) {
          fields.forEach(field => {
            suggestions.push({
              label: `${name}.${field}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: field,
              range,
              detail: `字段 (${name})`
            })
          })
        }
      })

      return { suggestions }
    }
  })
}

// 执行 SQL 查询
async function executeSql() {
  const active = currentActive.value
  if (!active) {
    message.warning('请先连接集群')
    return
  }

  const sql = sqlEditor?.getValue() || ''
  if (!sql.trim()) {
    message.warning('请输入 SQL 语句')
    return
  }

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  loading.value = true
  error.value = null
  updateState({ result: null })
  tableColumns.value = []
  tableData.value = []

  const startTime = Date.now()

  try {
    const res = await client.execute('POST', '/_sql', { query: sql, field_multi_value_leniency: true })
    updateState({ result: res })
    duration.value = Date.now() - startTime

    // 解析表格数据
    if (res.columns && res.rows) {
      tableColumns.value = res.columns.map((col: any) => ({
        title: col.name,
        key: col.name,
        width: 150
      }))

      tableData.value = res.rows.map((row: any[]) => {
        const obj: Record<string, any> = {}
        res.columns.forEach((col: any, index: number) => {
          obj[col.name] = row[index]
        })
        return obj
      })
    }

    message.success(`查询成功 (${duration.value}ms)`)

    // 保存到历史记录
    const historyItem = {
      id: Date.now().toString(),
      connection_id: currentActive.value?.connection?.id || null,
      query: sql,
      created_at: startTime
    }
    try {
      await saveSqlHistory(historyItem)
      // 刷新历史列表
      await loadHistory()
    } catch {
      // ignore
    }
    historyIndex.value = -1
  } catch (e: any) {
    duration.value = Date.now() - startTime
    // 提取 HTTP 状态码
    const statusMatch = e.message?.match(/HTTP (\d+)/)
    const statusCode = statusMatch ? parseInt(statusMatch[1]) : 500

    // 将错误信息显示在结果中
    updateState({
      result: {
        status: statusCode,
        error: {
          type: 'sql_exception',
          reason: e.message || '查询失败',
          status: statusCode
        }
      },
      resultMode: 'json'
    })
    message.error(`查询失败 (HTTP ${statusCode})`)
  } finally {
    loading.value = false
  }
}

// 复制结果
async function copyResult() {
  if (!result.value) return

  try {
    let text: string
    if (resultMode.value === 'table' && tableData.value.length > 0) {
      // 表格模式复制为 CSV
      const headers = tableColumns.value.map(c => c.title).join('\t')
      const rows = tableData.value.map(row =>
        tableColumns.value.map(c => row[c.key] ?? '').join('\t')
      ).join('\n')
      text = headers + '\n' + rows
    } else {
      text = JSON.stringify(result.value, null, 2)
    }
    await navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

// 下载结果
async function downloadResult() {
  if (!result.value) return

  let content: string
  let extension: string

  if (resultMode.value === 'table' && tableData.value.length > 0) {
    // 表格模式下载为 CSV
    const headers = tableColumns.value.map(c => c.title).join(',')
    const rows = tableData.value.map(row =>
      tableColumns.value.map(c => {
        const val = row[c.key] ?? ''
        // 处理包含逗号或引号的值
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`
        }
        return val
      }).join(',')
    ).join('\n')
    content = headers + '\n' + rows
    extension = 'csv'
  } else {
    content = JSON.stringify(result.value, null, 2)
    extension = 'json'
  }

  const defaultName = `sql-result-${Date.now()}.${extension}`

  try {
    const saved = await saveFileWithDialog(defaultName, content)
    if (saved) {
      message.success('下载成功')
    }
  } catch {
    message.error('下载失败')
  }
}

// 加载历史
async function loadHistory() {
  try {
    const records = await getSqlHistory(currentActive.value?.connection?.id)
    history.value = records.map(r => ({
      id: r.id,
      sql: r.query,
      timestamp: r.created_at
    }))
  } catch {
    history.value = []
  }
}

// 拖动调整面板高度
const startHeight = ref(0)
const startY = ref(0)

function startResize(e: MouseEvent) {
  isResizing.value = true
  startHeight.value = editorHeight.value
  startY.value = e.clientY
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
}

function handleMouseMove(e: MouseEvent) {
  if (!isResizing.value) return
  const diff = e.clientY - startY.value
  const maxHeight = Math.floor(window.innerHeight * 0.6)
  editorHeight.value = Math.min(maxHeight, Math.max(100, startHeight.value + diff))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

// 切换面板折叠
function togglePanel() {
  editorCollapsed.value = !editorCollapsed.value
  nextTick(updateTableHeight)
}

// 更新表格高度
function updateTableHeight() {
  if (resultContent.value) {
    tableHeight.value = resultContent.value.clientHeight - 24 // 减去 padding
  }
}

// 监听主题变化
function handleThemeChange() {
  const theme = getEditorTheme()
  monaco.editor.setTheme(theme)
}

// 监听连接变化
watch(() => connectionStore.currentConnectionId, (connId) => {
  if (connId) {
    updateState({ result: null })
    error.value = null
    tableColumns.value = []
    tableData.value = []
    loadIndexNames()
  }
})

onMounted(() => {
  nextTick(() => {
    initSqlEditor()
    updateTableHeight()
  })
  loadHistory()
  loadIndexNames()

  // 监听主题变化
  const observer = new MutationObserver(() => {
    handleThemeChange()
    updateTableHeight()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  // 监听窗口大小变化
  window.addEventListener('resize', updateTableHeight)

  onUnmounted(() => {
    observer.disconnect()
    window.removeEventListener('resize', updateTableHeight)
    sqlEditor?.dispose()
  })
})
</script>

<template>
  <div class="sql-page">
    <div class="main-content">
      <!-- 上方 SQL 编辑面板 -->
      <div
        class="sql-panel"
        :class="{ collapsed: editorCollapsed }"
        :style="{ height: editorCollapsed ? '0px' : `${editorHeight}px` }"
      >
        <div v-show="!editorCollapsed" class="panel-content">
          <!-- 工具栏 -->
          <div class="panel-toolbar">
            <n-button
              type="primary"
              size="small"
              :loading="loading"
              @click="executeSql"
            >
              <template #icon>
                <n-icon :component="PlayOutline" />
              </template>
              执行
            </n-button>
          </div>

          <!-- SQL 编辑器 -->
          <div ref="sqlEditorContainer" class="sql-editor"></div>
        </div>

        <!-- 拖动调整高度 -->
        <div
          v-show="!editorCollapsed"
          class="resize-handle"
          :class="{ active: isResizing }"
          @mousedown="startResize"
        />
      </div>

      <!-- 下方结果面板 -->
      <div class="result-panel">
        <!-- 工具栏 -->
        <div class="result-toolbar">
          <div class="toolbar-left">
            <div class="panel-toggle" @click="togglePanel">
              <n-icon :size="16">
                <ChevronUpOutline v-if="editorCollapsed" />
                <ChevronDownOutline v-else />
              </n-icon>
            </div>
            <span class="toolbar-title">结果</span>
            <span v-if="duration" class="duration">{{ duration }}ms</span>
          </div>
          <div class="toolbar-right">
            <n-radio-group v-model:value="resultMode" size="small">
              <n-radio-button value="table">表格</n-radio-button>
              <n-radio-button value="json">JSON</n-radio-button>
            </n-radio-group>
            <n-button quaternary size="small" :disabled="!result" @click="copyResult">
              <template #icon>
                <n-icon :component="CopyOutline" />
              </template>
            </n-button>
            <n-button quaternary size="small" :disabled="!result" @click="downloadResult">
              <template #icon>
                <n-icon :component="DownloadOutline" />
              </template>
            </n-button>
          </div>
        </div>

        <!-- 结果内容 -->
        <div ref="resultContent" class="result-content">
          <n-spin :show="loading" class="result-spin">
            <!-- 表格视图 -->
            <template v-if="resultMode === 'table'">
              <div v-if="tableData.length > 0" class="table-container" :style="{ height: `${tableHeight}px` }">
                <table class="result-table">
                  <thead>
                    <tr>
                      <th v-for="col in tableColumns" :key="col.key">{{ col.title }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, index) in tableData" :key="index">
                      <td v-for="col in tableColumns" :key="col.key" :title="row[col.key]">
                        {{ row[col.key] }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <n-empty v-else-if="!loading && !result" description="执行 SQL 查询查看结果" />
              <n-empty v-else-if="!loading && result" description="查询无结果" />
            </template>

            <!-- JSON 视图 -->
            <template v-else>
              <JsonViewer v-if="result" :content="result" height="calc(100vh - 300px)" />
              <n-empty v-else-if="!loading" description="执行 SQL 查询查看结果" />
            </template>
          </n-spin>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sql-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sql-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: #252525;
  border-bottom: 1px solid #333;
  min-height: 0;
  transition: height 0.2s ease;

  &.collapsed {
    border-bottom: none;
  }
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.panel-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.sql-editor {
  flex: 1;
  min-height: 0;
  border: 1px solid #333;
  border-radius: 4px;
  overflow: hidden;
}

.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  cursor: row-resize;
  background-color: transparent;
  transition: background-color 0.2s;

  &:hover,
  &.active {
    background-color: #63e2b7;
  }
}

.result-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #1a1a1a;
}

.result-toolbar {
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

.duration {
  font-size: 12px;
  color: #888;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.result-content {
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.table-container {
  overflow: auto;
  background-color: #252525;
  border-radius: 4px;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  th {
    background-color: #252525;
    font-weight: 500;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  tr:hover td {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

// 浅色主题
:root[data-theme='light'] {
  .sql-page {
    background-color: #f5f5f5;
  }

  .sql-panel {
    background-color: #fff;
    border-bottom-color: #e0e0e0;
  }

  .sql-editor {
    border-color: #e0e0e0;
  }

  .resize-handle {
    &:hover,
    &.active {
      background-color: #18a058;
    }
  }

  .result-panel {
    background-color: #f5f5f5;
  }

  .result-toolbar {
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

  .result-table {
    th, td {
      border-bottom-color: #e0e0e0;
    }

    th {
      background-color: #fafafa;
    }

    tr:hover td {
      background-color: rgba(0, 0, 0, 0.02);
    }
  }

  .table-container {
    background-color: #fff;
  }
}
</style>