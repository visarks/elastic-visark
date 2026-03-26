<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, h } from 'vue'
import {
  NCard, NButton, NIcon, NInput, NDataTable, NPagination,
  NModal, NForm, NFormItem, NSpin, NEmpty, NTag, NInputNumber,
  useMessage, useDialog
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  Refresh, AddOutline, TrashOutline, CreateOutline, EyeOutline
} from '@vicons/ionicons5'
import * as monaco from 'monaco-editor'
import { useConnectionStore } from '@/store/modules/connection'
import { ElasticClient } from '@/api/elastic'
import JsonViewer from '@/components/JsonViewer.vue'

interface TemplateItem {
  name: string
  type: 'legacy' | 'index_template'
  index_patterns: string[]
  order: number
  priority: number
  version: number | null
}

const connectionStore = useConnectionStore()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const templates = ref<TemplateItem[]>([])
const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

// 模板详情弹窗
const showDetailModal = ref(false)
const detailTemplate = ref<any>(null)
const detailTemplateName = ref('')
const detailTemplateType = ref<'legacy' | 'index_template'>('index_template')
const detailLoading = ref(false)

// 创建/编辑模板弹窗
const showEditModal = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editTemplateType = ref<'legacy' | 'index_template'>('index_template') // 编辑时保存模板类型
const editForm = ref({
  name: '',
  index_patterns: [] as string[],
  priority: 1,
  settings: '{}',
  mappings: '{}',
  aliases: '{}'
})

// JSON 编辑器引用
const settingsEditorContainer = ref<HTMLElement | null>(null)
const mappingsEditorContainer = ref<HTMLElement | null>(null)
const aliasesEditorContainer = ref<HTMLElement | null>(null)
let settingsEditor: monaco.editor.IStandaloneCodeEditor | null = null
let mappingsEditor: monaco.editor.IStandaloneCodeEditor | null = null
let aliasesEditor: monaco.editor.IStandaloneCodeEditor | null = null

// 当前激活的编辑器 tab
const activeEditorTab = ref<'settings' | 'mappings' | 'aliases'>('settings')

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 加载模板列表
async function loadTemplates() {
  const active = currentActive.value
  if (!active) return

  loading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    // 先尝试新版索引模板 API
    let indexTemplates: any[] = []
    try {
      indexTemplates = await client.getIndexTemplates()
    } catch {
      // ES 7.x 不支持 _cat/index_templates API
    }

    // 再加载旧版模板
    const legacyTemplates = await client.getTemplates().catch(() => [])

    console.log('Legacy templates response:', legacyTemplates)
    console.log('Index templates response:', indexTemplates)

    // 收集新版模板名称
    const indexTemplateNames = new Set(indexTemplates.map((t: any) => t.name))

    const allTemplates: TemplateItem[] = []

    // 处理旧版模板（排除已经在新版模板列表中的）
    for (const t of legacyTemplates) {
      // 如果这个模板名已经在新版模板列表中，跳过
      if (indexTemplateNames.has(t.name)) {
        continue
      }

      let patterns: string[] = []
      const patternsValue = t.index_patterns || t.patterns || ''
      if (typeof patternsValue === 'string' && patternsValue) {
        patterns = patternsValue.split(',').map((p: string) => p.trim())
      } else if (Array.isArray(patternsValue)) {
        patterns = patternsValue
      }

      allTemplates.push({
        name: t.name,
        type: 'legacy',
        index_patterns: patterns,
        order: t.order || 0,
        priority: 0,
        version: t.version || null
      })
    }

    // 处理新版索引模板
    for (const t of indexTemplates) {
      let patterns: string[] = []
      const patternsValue = t.index_patterns || ''
      if (typeof patternsValue === 'string' && patternsValue) {
        patterns = patternsValue.split(',').map((p: string) => p.trim())
      } else if (Array.isArray(patternsValue)) {
        patterns = patternsValue
      }

      allTemplates.push({
        name: t.name,
        type: 'index_template',
        index_patterns: patterns,
        order: 0,
        priority: t.priority || 0,
        version: t.version || null
      })
    }

    templates.value = allTemplates.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Failed to load templates:', error)
    message.error('加载模板列表失败')
  } finally {
    loading.value = false
  }
}

// 查看模板详情
async function viewTemplate(name: string, type: 'legacy' | 'index_template') {
  const active = currentActive.value
  if (!active) return

  detailLoading.value = true
  showDetailModal.value = true
  detailTemplate.value = null
  detailTemplateName.value = name
  detailTemplateType.value = type

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    let result: any
    let template: any = null

    // 先尝试新版索引模板 API
    try {
      result = await client.getIndexTemplate(name)
      template = result.index_templates?.[0]?.index_template || result[name] || result
      if (template && Object.keys(template).length > 0) {
        detailTemplate.value = template
        return
      }
    } catch {
      // 忽略错误，尝试旧版
    }

    // 再尝试旧版模板 API
    try {
      result = await client.getTemplate(name)
      template = result[name] || Object.values(result)[0]
      if (template && Object.keys(template).length > 0) {
        detailTemplate.value = template
        return
      }
    } catch {
      // 忽略错误
    }

    // 如果都获取不到，显示提示
    if (!template || Object.keys(template).length === 0) {
      detailTemplate.value = { message: '无法获取模板详情，可能是系统内置模板' }
    }
  } catch (error) {
    console.error('Failed to load template:', error)
    message.error('加载模板详情失败')
  } finally {
    detailLoading.value = false
  }
}

// 打开创建模板弹窗
function openCreateModal() {
  editMode.value = 'create'
  editForm.value = {
    name: '',
    index_patterns: [''],
    priority: 1,
    settings: '{}',
    mappings: '{}',
    aliases: '{}'
  }
  showEditModal.value = true
}

// 打开编辑模板弹窗
async function openEditModal(name: string, type: 'legacy' | 'index_template') {
  const active = currentActive.value
  if (!active) return

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    let result: any
    let template: any = null

    // 先尝试新版索引模板 API
    try {
      result = await client.getIndexTemplate(name)
      template = result.index_templates?.[0]?.index_template || result[name] || result
    } catch {
      // 忽略错误
    }

    // 如果新版 API 没有获取到，尝试旧版模板 API
    if (!template || Object.keys(template).length === 0) {
      try {
        result = await client.getTemplate(name)
        template = result[name] || Object.values(result)[0]
      } catch {
        // 忽略错误
      }
    }

    if (!template || Object.keys(template).length === 0) {
      message.error('无法获取模板详情')
      return
    }

    editMode.value = 'edit'
    editTemplateType.value = type
    editForm.value = {
      name,
      index_patterns: template.index_patterns || template.patterns || [''],
      priority: template.priority || template.order || 1,
      settings: JSON.stringify(template.settings || template.template?.settings || {}, null, 2),
      mappings: JSON.stringify(template.mappings || template.template?.mappings || {}, null, 2),
      aliases: JSON.stringify(template.aliases || template.template?.aliases || {}, null, 2)
    }
    showEditModal.value = true
  } catch (error) {
    console.error('Failed to load template for edit:', error)
    message.error('加载模板失败')
  }
}

// 保存模板
async function saveTemplate() {
  if (!editForm.value.name) {
    message.warning('请输入模板名称')
    return
  }

  if (!editForm.value.index_patterns.length || !editForm.value.index_patterns[0]) {
    message.warning('请输入索引模式')
    return
  }

  const active = currentActive.value
  if (!active) return

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  // 解析 JSON
  let settings: any = {}
  let mappings: any = {}
  let aliases: any = {}

  try {
    if (editForm.value.settings.trim()) {
      settings = JSON.parse(editForm.value.settings)
    }
    if (editForm.value.mappings.trim()) {
      mappings = JSON.parse(editForm.value.mappings)
    }
    if (editForm.value.aliases.trim()) {
      aliases = JSON.parse(editForm.value.aliases)
    }
  } catch (e) {
    message.error('JSON 格式错误')
    return
  }

  // 判断模板类型：新增时始终为 index_template，编辑时使用原类型
  const templateType = editMode.value === 'create' ? 'index_template' : editTemplateType.value

  // 构建请求体
  const body: any = {
    index_patterns: editForm.value.index_patterns
  }

  if (templateType === 'index_template') {
    body.priority = editForm.value.priority
    if (Object.keys(settings).length > 0 || Object.keys(mappings).length > 0 || Object.keys(aliases).length > 0) {
      body.template = {}
      if (Object.keys(settings).length > 0) body.template.settings = settings
      if (Object.keys(mappings).length > 0) body.template.mappings = mappings
      if (Object.keys(aliases).length > 0) body.template.aliases = aliases
    }
  } else {
    body.order = editForm.value.priority
    if (Object.keys(settings).length > 0) body.settings = settings
    if (Object.keys(mappings).length > 0) body.mappings = mappings
    if (Object.keys(aliases).length > 0) body.aliases = aliases
  }

  try {
    const endpoint = templateType === 'index_template'
      ? `/_index_template/${editForm.value.name}`
      : `/_template/${editForm.value.name}`
    await client.execute('PUT', endpoint, body)
    message.success(editMode.value === 'create' ? '创建模板成功' : '更新模板成功')
    showEditModal.value = false
    loadTemplates()
  } catch (error: any) {
    message.error(`操作失败: ${error.message}`)
  }
}

// 删除模板
function confirmDeleteTemplate(name: string, type: 'legacy' | 'index_template') {
  dialog.error({
    title: '确认删除',
    content: `确定要删除模板 "${name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const active = currentActive.value
      if (!active) return

      const conn = active.connection
      const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

      try {
        const endpoint = type === 'index_template'
          ? `/_index_template/${name}`
          : `/_template/${name}`
        await client.execute('DELETE', endpoint)
        message.success('删除模板成功')
        loadTemplates()
      } catch (error: any) {
        message.error(`删除失败: ${error.message}`)
      }
    }
  })
}

// 添加索引模式
function addIndexPattern() {
  editForm.value.index_patterns.push('')
}

// 删除索引模式
function removeIndexPattern(index: number) {
  editForm.value.index_patterns.splice(index, 1)
}

// 获取编辑器主题
function getEditorTheme(): string {
  const theme = document.documentElement.getAttribute('data-theme')
  return theme === 'light' ? 'vs' : 'vs-dark'
}

// 初始化 JSON 编辑器
function initEditors() {
  nextTick(() => {
    // Settings 编辑器
    if (settingsEditorContainer.value && !settingsEditor) {
      settingsEditor = monaco.editor.create(settingsEditorContainer.value, {
        value: editForm.value.settings,
        language: 'json',
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

      // 添加 Settings 自动补全
      monaco.languages.registerCompletionItemProvider('json', {
        triggerCharacters: ['"', '{'],
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          })

          // 只在 settings 编辑器中提供提示
          if (!textUntilPosition.includes('number_of')) return { suggestions: [] }

          const word = model.getWordUntilPosition(position)
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          }

          const suggestions = [
            { label: 'number_of_shards', kind: monaco.languages.CompletionItemKind.Property, insertText: '"number_of_shards": 1', range, detail: '主分片数' },
            { label: 'number_of_replicas', kind: monaco.languages.CompletionItemKind.Property, insertText: '"number_of_replicas": 1', range, detail: '副本数' },
            { label: 'index.refresh_interval', kind: monaco.languages.CompletionItemKind.Property, insertText: '"index.refresh_interval": "1s"', range, detail: '刷新间隔' },
            { label: 'index.max_result_window', kind: monaco.languages.CompletionItemKind.Property, insertText: '"index.max_result_window": 10000', range, detail: '最大结果窗口' },
            { label: 'index.analysis', kind: monaco.languages.CompletionItemKind.Property, insertText: '"analysis": {\n  "analyzer": {\n    "default": {\n      "type": "standard"\n    }\n  }\n}', range, detail: '分析器配置' },
          ]

          return { suggestions }
        }
      })

      settingsEditor.onDidChangeModelContent(() => {
        editForm.value.settings = settingsEditor?.getValue() || '{}'
      })
    }

    // Mappings 编辑器
    if (mappingsEditorContainer.value && !mappingsEditor) {
      mappingsEditor = monaco.editor.create(mappingsEditorContainer.value, {
        value: editForm.value.mappings,
        language: 'json',
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

      // 添加 Mappings 自动补全
      monaco.languages.registerCompletionItemProvider('json', {
        triggerCharacters: ['"', '{'],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position)
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          }

          const suggestions = [
            { label: 'properties', kind: monaco.languages.CompletionItemKind.Property, insertText: '"properties": {\n  "field_name": {\n    "type": "text"\n  }\n}', range, detail: '字段属性' },
            { label: 'type', kind: monaco.languages.CompletionItemKind.Property, insertText: '"type": "text"', range, detail: '字段类型' },
            { label: 'dynamic', kind: monaco.languages.CompletionItemKind.Property, insertText: '"dynamic": "true"', range, detail: '动态映射 (true/false/strict)' },
            { label: '_source', kind: monaco.languages.CompletionItemKind.Property, insertText: '"_source": {\n  "enabled": true\n}', range, detail: '是否存储原始文档' },
            { label: '_routing', kind: monaco.languages.CompletionItemKind.Property, insertText: '"_routing": {\n  "required": false\n}', range, detail: '路由配置' },
            // 字段类型
            { label: 'text', kind: monaco.languages.CompletionItemKind.Value, insertText: '"text"', range, detail: '全文检索' },
            { label: 'keyword', kind: monaco.languages.CompletionItemKind.Value, insertText: '"keyword"', range, detail: '精确匹配' },
            { label: 'long', kind: monaco.languages.CompletionItemKind.Value, insertText: '"long"', range, detail: '长整型' },
            { label: 'integer', kind: monaco.languages.CompletionItemKind.Value, insertText: '"integer"', range, detail: '整型' },
            { label: 'short', kind: monaco.languages.CompletionItemKind.Value, insertText: '"short"', range, detail: '短整型' },
            { label: 'byte', kind: monaco.languages.CompletionItemKind.Value, insertText: '"byte"', range, detail: '字节' },
            { label: 'double', kind: monaco.languages.CompletionItemKind.Value, insertText: '"double"', range, detail: '双精度浮点' },
            { label: 'float', kind: monaco.languages.CompletionItemKind.Value, insertText: '"float"', range, detail: '单精度浮点' },
            { label: 'boolean', kind: monaco.languages.CompletionItemKind.Value, insertText: '"boolean"', range, detail: '布尔' },
            { label: 'date', kind: monaco.languages.CompletionItemKind.Value, insertText: '"date"', range, detail: '日期' },
            { label: 'ip', kind: monaco.languages.CompletionItemKind.Value, insertText: '"ip"', range, detail: 'IP 地址' },
            { label: 'nested', kind: monaco.languages.CompletionItemKind.Value, insertText: '"nested"', range, detail: '嵌套对象' },
            { label: 'object', kind: monaco.languages.CompletionItemKind.Value, insertText: '"object"', range, detail: '对象' },
            { label: 'geo_point', kind: monaco.languages.CompletionItemKind.Value, insertText: '"geo_point"', range, detail: '地理坐标' },
            { label: 'completion', kind: monaco.languages.CompletionItemKind.Value, insertText: '"completion"', range, detail: '自动补全' },
            // 字段属性
            { label: 'analyzer', kind: monaco.languages.CompletionItemKind.Property, insertText: '"analyzer": "standard"', range, detail: '分析器' },
            { label: 'search_analyzer', kind: monaco.languages.CompletionItemKind.Property, insertText: '"search_analyzer": "standard"', range, detail: '搜索分析器' },
            { label: 'index', kind: monaco.languages.CompletionItemKind.Property, insertText: '"index": true', range, detail: '是否索引' },
            { label: 'doc_values', kind: monaco.languages.CompletionItemKind.Property, insertText: '"doc_values": true', range, detail: '是否存储 doc_values' },
            { label: 'store', kind: monaco.languages.CompletionItemKind.Property, insertText: '"store": false', range, detail: '是否存储' },
            { label: 'format', kind: monaco.languages.CompletionItemKind.Property, insertText: '"format": "strict_date_optional_time||epoch_millis"', range, detail: '日期格式' },
          ]

          return { suggestions }
        }
      })

      mappingsEditor.onDidChangeModelContent(() => {
        editForm.value.mappings = mappingsEditor?.getValue() || '{}'
      })
    }

    // Aliases 编辑器
    if (aliasesEditorContainer.value && !aliasesEditor) {
      aliasesEditor = monaco.editor.create(aliasesEditorContainer.value, {
        value: editForm.value.aliases,
        language: 'json',
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

      // 添加 Aliases 自动补全
      monaco.languages.registerCompletionItemProvider('json', {
        triggerCharacters: ['"', '{'],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position)
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          }

          const suggestions = [
            { label: 'alias_name', kind: monaco.languages.CompletionItemKind.Property, insertText: '"alias_name": {}', range, detail: '别名名称' },
            { label: 'filter', kind: monaco.languages.CompletionItemKind.Property, insertText: '"filter": {\n  "term": {\n    "field": "value"\n  }\n}', range, detail: '别名过滤器' },
            { label: 'routing', kind: monaco.languages.CompletionItemKind.Property, insertText: '"routing": "routing_value"', range, detail: '路由值' },
            { label: 'is_write_index', kind: monaco.languages.CompletionItemKind.Property, insertText: '"is_write_index": true', range, detail: '是否为写入索引' },
          ]

          return { suggestions }
        }
      })

      aliasesEditor.onDidChangeModelContent(() => {
        editForm.value.aliases = aliasesEditor?.getValue() || '{}'
      })
    }
  })
}

// 销毁编辑器
function destroyEditors() {
  settingsEditor?.dispose()
  settingsEditor = null
  mappingsEditor?.dispose()
  mappingsEditor = null
  aliasesEditor?.dispose()
  aliasesEditor = null
}

// 格式化编辑器内容
function formatEditorContent(editor: monaco.editor.IStandaloneCodeEditor | null) {
  if (!editor) return
  const content = editor.getValue()
  if (!content.trim()) return

  try {
    const parsed = JSON.parse(content)
    editor.setValue(JSON.stringify(parsed, null, 2))
    message.success('格式化成功')
  } catch {
    message.error('JSON 格式错误')
  }
}

// 过滤后的模板列表
const filteredTemplates = computed(() => {
  if (!searchText.value) return templates.value
  const keyword = searchText.value.toLowerCase()
  return templates.value.filter((t) =>
    t.name.toLowerCase().includes(keyword) ||
    t.index_patterns?.some((p: string) => p.toLowerCase().includes(keyword))
  )
})

// 分页
const pageCount = computed(() => Math.ceil(filteredTemplates.value.length / pageSize.value))
const paginatedTemplates = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredTemplates.value.slice(start, start + pageSize.value)
})

// 表格列
const columns: DataTableColumns<TemplateItem> = [
  {
    title: '名称',
    key: 'name',
    width: 250,
    ellipsis: { tooltip: true }
  },
  {
    title: '类型',
    key: 'type',
    width: 120,
    render(row) {
      return h(NTag, {
        size: 'small',
        type: row.type === 'index_template' ? 'info' : 'warning'
      }, { default: () => row.type === 'index_template' ? '索引模板' : '旧版模板' })
    }
  },
  {
    title: '索引模式',
    key: 'index_patterns',
    render(row) {
      if (!row.index_patterns || row.index_patterns.length === 0) return '-'
      return row.index_patterns.join(', ')
    }
  },
  {
    title: '优先级',
    key: 'priority',
    width: 80,
    align: 'center',
    render(row) {
      return row.type === 'index_template' ? row.priority : row.order
    }
  },
  {
    title: '版本',
    key: 'version',
    width: 80,
    align: 'center',
    render(row) {
      return row.version || '-'
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    align: 'center',
    render(row) {
      return h('div', { class: 'action-buttons' }, [
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          onClick: () => viewTemplate(row.name, row.type)
        }, {
          default: () => h(NIcon, { size: 14 }, { default: () => h(EyeOutline) })
        }),
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          onClick: () => openEditModal(row.name, row.type)
        }, {
          default: () => h(NIcon, { size: 14 }, { default: () => h(CreateOutline) })
        }),
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          type: 'error',
          onClick: () => confirmDeleteTemplate(row.name, row.type)
        }, {
          default: () => h(NIcon, { size: 14 }, { default: () => h(TrashOutline) })
        })
      ])
    }
  }
]

// 监听连接变化
watch(() => connectionStore.currentConnectionId, (connId) => {
  if (connId) {
    loadTemplates()
  }
}, { immediate: true })

// 监听编辑弹窗显示
watch(showEditModal, (show) => {
  if (show) {
    initEditors()
  } else {
    destroyEditors()
  }
})

// 监听主题变化
watch(() => document.documentElement.getAttribute('data-theme'), () => {
  const theme = getEditorTheme()
  monaco.editor.setTheme(theme)
})

onMounted(() => {
  if (currentActive.value) {
    loadTemplates()
  }
})
</script>

<template>
  <div class="template-page">
    <n-card class="template-card" size="small">
      <template #header>
        <div class="card-header">
          <span>模板管理</span>
          <div class="header-actions">
            <n-button size="small" quaternary :loading="loading" @click="loadTemplates">
              <template #icon>
                <n-icon :component="Refresh" />
              </template>
            </n-button>
            <n-button size="small" type="primary" @click="openCreateModal">
              <template #icon>
                <n-icon :component="AddOutline" />
              </template>
              新建模板
            </n-button>
            <n-input
              v-model:value="searchText"
              placeholder="搜索模板..."
              clearable
              size="small"
              style="width: 200px"
              @update:value="currentPage = 1"
            />
          </div>
        </div>
      </template>

      <n-data-table
        :columns="columns"
        :data="paginatedTemplates"
        max-height="calc(100vh - 295px)"
        :scroll-x="900"
        striped
        bordered
        size="small"
      />

      <template #footer>
        <div class="card-footer">
          <span class="total-count">共 {{ filteredTemplates.length }} 条</span>
          <n-pagination
            v-model:page="currentPage"
            :page-count="pageCount"
            size="small"
          />
        </div>
      </template>
    </n-card>

    <!-- 模板详情弹窗 -->
    <n-modal
      v-model:show="showDetailModal"
      preset="card"
      :title="`模板详情 - ${detailTemplateName}`"
      style="width: 800px; max-width: 95vw;"
      :bordered="false"
      size="small"
    >
      <n-spin :show="detailLoading">
        <JsonViewer v-if="detailTemplate" :content="detailTemplate" height="400px" />
        <n-empty v-else-if="!detailLoading" description="暂无数据" />
      </n-spin>
    </n-modal>

    <!-- 创建/编辑模板弹窗 -->
    <n-modal
      v-model:show="showEditModal"
      preset="card"
      :title="editMode === 'create' ? '新建模板' : '编辑模板'"
      style="width: 900px; max-width: 95vw;"
      :bordered="false"
      size="small"
    >
      <n-form label-placement="left" label-width="70px">
        <!-- 基本信息行 -->
        <div class="form-row">
          <n-form-item label="名称" required class="flex-1">
            <n-input
              v-model:value="editForm.name"
              :disabled="editMode === 'edit'"
              placeholder="template_name"
            />
          </n-form-item>
          <n-form-item label="优先级" class="priority-item">
            <n-input-number v-model:value="editForm.priority" :min="0" />
          </n-form-item>
        </div>

        <!-- 索引模式 -->
        <n-form-item label="索引模式" required>
          <div class="index-patterns">
            <div v-for="(_, index) in editForm.index_patterns" :key="index" class="pattern-item">
              <n-input
                v-model:value="editForm.index_patterns[index]"
                placeholder="log-*"
                size="small"
              />
              <n-button
                v-if="editForm.index_patterns.length > 1"
                size="small"
                quaternary
                type="error"
                @click="removeIndexPattern(index)"
              >
                <template #icon>
                  <n-icon :component="TrashOutline" />
                </template>
              </n-button>
            </div>
            <n-button size="small" dashed block @click="addIndexPattern">
              <template #icon>
                <n-icon :component="AddOutline" />
              </template>
              添加模式
            </n-button>
          </div>
        </n-form-item>

        <!-- JSON 编辑器 Tabs -->
        <div class="json-editor-section">
          <div class="editor-tabs">
            <div
              class="editor-tab"
              :class="{ active: activeEditorTab === 'settings' }"
              @click="activeEditorTab = 'settings'"
            >
              Settings
            </div>
            <div
              class="editor-tab"
              :class="{ active: activeEditorTab === 'mappings' }"
              @click="activeEditorTab = 'mappings'"
            >
              Mappings
            </div>
            <div
              class="editor-tab"
              :class="{ active: activeEditorTab === 'aliases' }"
              @click="activeEditorTab = 'aliases'"
            >
              Aliases
            </div>
            <div class="editor-tab-actions">
              <n-button size="tiny" quaternary @click="formatEditorContent(
                activeEditorTab === 'settings' ? settingsEditor :
                activeEditorTab === 'mappings' ? mappingsEditor : aliasesEditor
              )">
                格式化
              </n-button>
            </div>
          </div>

          <div class="editor-container">
            <div v-show="activeEditorTab === 'settings'" ref="settingsEditorContainer" class="json-editor"></div>
            <div v-show="activeEditorTab === 'mappings'" ref="mappingsEditorContainer" class="json-editor"></div>
            <div v-show="activeEditorTab === 'aliases'" ref="aliasesEditorContainer" class="json-editor"></div>
          </div>
        </div>
      </n-form>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" @click="saveTemplate">保存</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.template-page {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.template-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  :deep(.n-card__content) {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    min-height: 0;
  }

  :deep(.n-card__footer) {
    padding: 12px 16px;
    border-top: 1px solid #333;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.total-count {
  font-size: 12px;
  color: #888;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.index-patterns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.pattern-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.form-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  .flex-1 {
    flex: 1;
    min-width: 200px;
  }

  .priority-item {
    flex-shrink: 0;
    min-width: 120px;
  }

  :deep(.n-form-item) {
    margin-bottom: 12px;
  }

  :deep(.n-form-item-blank) {
    min-width: 0;
  }
}

.json-editor-section {
  border: 1px solid #333;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}

.editor-tabs {
  display: flex;
  background-color: #2d2d2d;
  border-bottom: 1px solid #333;
}

.editor-tab {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #888;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;

  &:hover {
    color: #fff;
  }

  &.active {
    color: #63e2b7;
    border-bottom-color: #63e2b7;
  }
}

.editor-tab-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  padding-right: 8px;
}

.editor-container {
  height: 280px;
}

.json-editor {
  height: 100%;
}

:root[data-theme='light'] {
  .template-card {
    :deep(.n-card__footer) {
      border-top-color: #e0e0e0;
    }
  }

  .json-editor-section {
    border-color: #e0e0e0;
  }

  .editor-tabs {
    background-color: #f5f5f5;
    border-bottom-color: #e0e0e0;
  }

  .editor-tab {
    color: #666;

    &:hover {
      color: #333;
    }

    &.active {
      color: #18a058;
      border-bottom-color: #18a058;
    }
  }
}
</style>