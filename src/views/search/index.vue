<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted, onUnmounted, nextTick } from 'vue'
import {
  NSelect, NRadioGroup, NRadioButton, NInputNumber, NCheckbox, NCheckboxGroup,
  NButton, NIcon, NSpin, NEmpty, NInput, NTabs, NTabPane, NModal, useMessage
} from 'naive-ui'
import { Search, TrashOutline, AddOutline, RemoveOutline, DownloadOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { useSettingsStore } from '@/store/modules/settings'
import { useTabInstanceStore, type SearchTabState } from '@/store/modules/tabInstance'
import { ElasticClient } from '@/api/elastic'
import { getSearchHistory, saveSearchHistory } from '@/services/database'
import { type MappingField, type SearchHistoryItem, type AggregationConfig, createEmptyBoolQuery, buildDslFromQuery, createSearchQuery, createAggregationConfig } from './types'
import QueryBuilder from './components/QueryBuilder.vue'
import AggItem from './components/AggItem.vue'
import JsonPreviewModal from '@/components/JsonPreviewModal.vue'
import JsonViewer from '@/components/JsonViewer.vue'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

const props = defineProps<{
  tabId: string
}>()

const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()
const tabInstanceStore = useTabInstanceStore()
const message = useMessage()

// 查询配置区域高度
const configHeight = ref(280)
const isResizing = ref(false)

// JSON 视图容器高度
const jsonViewerHeight = ref(400)
const resultAreaRef = ref<HTMLElement | null>(null)

// JSON 预览弹窗
const jsonPreviewRef = ref<InstanceType<typeof JsonPreviewModal> | null>(null)

// vxe-table 引用
const xTable = ref<any>(null)

// 获取当前标签状态
const tabState = computed<SearchTabState>(() => {
  const state = tabInstanceStore.getTabState(props.tabId)
  return (state || {
    index: '',
    simple: true,
    timeout: 60,
    trackTotalHits: true,
    boolQuery: createEmptyBoolQuery(),
    sortItems: [],
    aggItems: [],
    selectedFields: [],
    fieldFilterKeyword: '',
    result: null,
    resultMode: 'table',
    activeTab: 'query',
    pageNum: 1,
    pageSize: 20,
    total: 0
  }) as SearchTabState
})

// 状态更新函数
function updateState(partial: Partial<SearchTabState>) {
  tabInstanceStore.updateTabState(props.tabId, partial)
}

// 表单配置（从 tabState 读取）
const form = computed({
  get: () => ({
    index: tabState.value.index,
    simple: tabState.value.simple,
    timeout: tabState.value.timeout,
    trackTotalHits: tabState.value.trackTotalHits
  }),
  set: (val) => updateState({
    index: val.index,
    simple: val.simple,
    timeout: val.timeout,
    trackTotalHits: val.trackTotalHits
  })
})

// 单独的 simple 切换
const isSimpleMode = computed({
  get: () => tabState.value.simple,
  set: (val) => {
    updateState({ simple: val, activeTab: val ? 'query' : 'aggregation' })
  }
})

// 深拷贝 - 使用 JSON 方式（Vue 响应式对象需用此方式）
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// 状态
const loading = ref(false)
const mappingLoading = ref(false)
const mappingLoadedForIndex = ref<string>('')  // 记录已加载 mapping 的 index

// 分页（从 tabState 读取）
const page = computed({
  get: () => ({
    pageNum: tabState.value.pageNum,
    pageSize: tabState.value.pageSize,
    total: tabState.value.total
  }),
  set: (val) => updateState({
    pageNum: val.pageNum,
    pageSize: val.pageSize,
    total: val.total
  })
})

// 当前连接
const currentActive = computed(() => connectionStore.currentActiveConnection)

// 从 connectionStore 获取索引选项
const indexOptions = computed(() => {
  const active = connectionStore.currentActiveConnection
  if (!active) return []

  // 使用侧边栏加载的索引数据
  return active.indices
    .filter((idx: any) => idx.status === 'open' && !settingsStore.isIndexExcluded(idx.index))
    .map((idx: any) => ({
      label: idx.index,
      value: idx.index,
      count: parseInt(idx['docs.count']) || 0,
      health: idx.health
    }))
})

// 当前索引的 mapping
const mapping = ref<MappingField[]>([])

// 查询树（从 tabState 读取）
const boolQuery = computed({
  get: () => tabState.value.boolQuery,
  set: (val) => updateState({ boolQuery: val })
})

// Tab 激活状态（从 tabState 读取）
const activeTab = computed({
  get: () => tabState.value.activeTab,
  set: (val) => updateState({ activeTab: val })
})

// 排序（从 tabState 读取）
const sortItems = computed({
  get: () => tabState.value.sortItems,
  set: (val) => updateState({ sortItems: val })
})

// 字段选择（从 tabState 读取）
const fieldFilterKeyword = computed({
  get: () => tabState.value.fieldFilterKeyword,
  set: (val) => updateState({ fieldFilterKeyword: val })
})

const selectedFields = computed({
  get: () => new Set(tabState.value.selectedFields),
  set: (val) => updateState({ selectedFields: Array.from(val) })
})

// 过滤后的字段列表
const filteredFields = computed(() => {
  if (!fieldFilterKeyword.value) {
    return mapping.value
  }
  const keyword = fieldFilterKeyword.value.toLowerCase()
  return mapping.value.filter(f =>
    f.name.toLowerCase().includes(keyword) ||
    f.type.toLowerCase().includes(keyword)
  )
})

// 处理复选框组变化
function handleFieldGroupChange(values: (string | number)[]) {
  selectedFields.value = new Set(values as string[])
  // 字段选择变化时更新表格列
  generateColumnsFromMapping()
}

// 全选
function selectAllFields() {
  const newSet = new Set(selectedFields.value)
  filteredFields.value.forEach(f => newSet.add(f.name))
  selectedFields.value = newSet
  generateColumnsFromMapping()
}

// 反选
function deselectAllFields() {
  const newSet = new Set<string>()
  filteredFields.value.forEach(f => {
    if (selectedFields.value.has(f.name)) {
      // skip
    } else {
      newSet.add(f.name)
    }
  })
  selectedFields.value = newSet
  generateColumnsFromMapping()
}

// 字段选项（用于排序，使用全部字段）
const fieldOptions = computed(() => {
  return mapping.value.map(f => ({ label: f.name, value: f.name }))
})

// 聚合（从 tabState 读取）
const aggItems = computed({
  get: () => tabState.value.aggItems,
  set: (val) => updateState({ aggItems: val })
})

// 结果（从 tabState 读取）
const result = computed({
  get: () => tabState.value.result,
  set: (val) => updateState({ result: val })
})

const resultMode = computed({
  get: () => tabState.value.resultMode,
  set: (val) => updateState({ resultMode: val })
})

const rows = ref<any[]>([])
const columns = ref<any[]>([])

// 更新模态框
const showUpdateModal = ref(false)
const showDeleteModal = ref(false)
const updatePreviewBody = ref<any>(null)
const deletePreviewBody = ref<any>(null)
const operationLoading = ref(false)
interface UpdateField {
  field: string
  value: string
}
const updateFields = ref<UpdateField[]>([])

// 不显示的字段
const hiddenFields = ['_id', '_index', '_score']

// 从 mapping 和选择的字段生成表格列
function generateColumnsFromMapping() {
  if (mapping.value.length === 0) {
    columns.value = []
    return
  }

  // 如果用户选择了字段，使用选择的字段；否则使用所有 mapping 字段
  let fieldsToShow: string[]
  if (selectedFields.value.size > 0) {
    fieldsToShow = Array.from(selectedFields.value)
  } else {
    fieldsToShow = mapping.value
      .filter(field => !hiddenFields.includes(field.name))
      .map(field => field.name)
  }

  columns.value = fieldsToShow.map(field => ({
    field,
    title: field,
    minWidth: 150
  }))
}

// 加载字段
async function loadFields(index: string, silent: boolean = false) {
  if (!index) {
    mapping.value = []
    columns.value = []
    mappingLoadedForIndex.value = ''
    return
  }

  // 如果已经加载过相同的 index，跳过
  if (mappingLoadedForIndex.value === index && mapping.value.length > 0) {
    return
  }

  const active = currentActive.value
  if (!active) return

  mappingLoading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const result = await client.getIndexMapping(index)
    // 处理不同版本的 ES 响应结构
    let indexMapping = result[index]?.mappings
    if (!indexMapping) {
      // 尝试获取第一个 key 的 mappings
      const firstKey = Object.keys(result)[0]
      indexMapping = result[firstKey]?.mappings || {}
    }

    const properties = indexMapping?.properties || indexMapping || {}
    mapping.value = parseMapping(properties)
    mappingLoadedForIndex.value = index
    // 生成表格列
    generateColumnsFromMapping()
  } catch (error) {
    console.error('Failed to load mapping:', error)
    if (!silent) {
      message.error('加载 Mapping 失败')
    }
    mapping.value = []
    columns.value = []
    mappingLoadedForIndex.value = ''
  } finally {
    mappingLoading.value = false
  }
}

// 解析 Mapping
function parseMapping(properties: any, prefix = ''): MappingField[] {
  const fields: MappingField[] = []
  for (const [name, prop] of Object.entries(properties)) {
    const p = prop as any
    const fullName = prefix ? `${prefix}.${name}` : name
    fields.push({ name: fullName, type: p.type || 'object' })
    if (p.properties) {
      fields.push(...parseMapping(p.properties, fullName))
    }
    if (p.fields) {
      for (const [fieldName, fieldProp] of Object.entries(p.fields)) {
        const fp = fieldProp as any
        fields.push({ name: `${fullName}.${fieldName}`, type: fp.type || 'text' })
      }
    }
  }
  return fields
}

// 构建查询 DSL
function buildQueryDsl(): any {
  const dsl = buildDslFromQuery(boolQuery.value)

  const query: any = {
    query: dsl.bool && Object.keys(dsl.bool).length > 0 ? dsl : { match_all: {} },
    track_total_hits: form.value.trackTotalHits
  }

  if (isSimpleMode.value) {
    // 简单查询：添加 _source、排序、分页
    if (selectedFields.value.size > 0) {
      query._source = { includes: Array.from(selectedFields.value) }
    }
    if (sortItems.value.length > 0) {
      query.sort = sortItems.value.map(s => ({ [s.field]: s.order }))
    }
    query.from = (page.value.pageNum - 1) * page.value.pageSize
    query.size = page.value.pageSize
  } else {
    // 聚合查询：from 和 size 都是 0，添加聚合
    query.from = 0
    query.size = 0

    // 构建聚合
    const enabledAggs = aggItems.value.filter(a => a.enabled && a.field)
    if (enabledAggs.length > 0) {
      query.aggs = {}
      for (const agg of enabledAggs) {
        // 使用字段名作为聚合名称
        const aggName = agg.field
        query.aggs[aggName] = buildAggregation(agg)
      }
    }
  }

  query.timeout = `${form.value.timeout}s`

  return query
}

// 构建单个聚合
function buildAggregation(agg: AggregationConfig): any {
  const result: any = {}

  switch (agg.type) {
    case 'terms':
      result.terms = {
        field: agg.field,
        size: agg.size || 10
      }
      if (agg.order) {
        result.terms.order = agg.order
      }
      break
    case 'max':
      result.max = { field: agg.field }
      break
    case 'min':
      result.min = { field: agg.field }
      break
    case 'sum':
      result.sum = { field: agg.field }
      break
    case 'count':
      result.value_count = { field: agg.field }
      break
    case 'avg':
      result.avg = { field: agg.field }
      break
    case 'cardinality':
      result.cardinality = { field: agg.field }
      break
    case 'date_histogram':
      result.date_histogram = {
        field: agg.field,
        calendar_interval: agg.interval || '1d'
      }
      if (agg.format) {
        result.date_histogram.format = agg.format
      }
      break
  }

  // 添加子聚合
  if (agg.subAggs && agg.subAggs.length > 0) {
    const enabledSubAggs = agg.subAggs.filter(a => a.enabled && a.field)
    if (enabledSubAggs.length > 0) {
      result.aggs = {}
      for (const subAgg of enabledSubAggs) {
        // 使用字段名作为聚合名称
        result.aggs[subAgg.field] = buildAggregation(subAgg)
      }
    }
  }

  return result
}

// 显示查询条件
function showQueryDsl() {
  jsonPreviewRef.value?.open('查询条件', buildQueryDsl())
}

// 执行搜索
async function search() {
  if (!form.value.index) {
    message.warning('请选择索引')
    return
  }

  const active = currentActive.value
  if (!active) {
    message.warning('请先连接集群')
    return
  }

  loading.value = true
  updateState({ result: null })
  rows.value = []

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const query = buildQueryDsl()
    const res = await client.search(form.value.index, query)
    updateState({ result: res })

    if (isSimpleMode.value) {
      // 正确处理 total 值（ES 返回格式可能是 { value: 0, relation: "eq" } 或直接数字）
      const totalValue = res.hits?.total
      const total = typeof totalValue === 'object' ? (totalValue?.value || 0) : (totalValue || 0)
      updateState({ total })
      const hits = res.hits?.hits || []
      rows.value = hits.map((hit: any) => ({
        _id: hit._id,
        _index: hit._index,
        _score: hit._score,
        ...hit._source,
        __source: hit
      }))
      message.success(`查询成功，共 ${total} 条`)
    } else {
      // 聚合模式：显示聚合结果信息
      const totalValue = res.hits?.total
      const totalHits = typeof totalValue === 'object' ? (totalValue?.value || 0) : (totalValue || 0)
      const aggCount = res.aggregations ? Object.keys(res.aggregations).length : 0
      message.success(`聚合查询成功，共 ${totalHits} 条文档，${aggCount} 个聚合结果`)
      // 聚合模式自动切换到 JSON 视图
      updateState({ resultMode: 'json' })
    }

    saveSearchHistoryItem()
  } catch (error: any) {
    console.error('Search failed:', error)
    message.error(`查询失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

// 删除文档
async function deleteRow(row: any) {
  const active = currentActive.value
  if (!active || !row.__source) return

  try {
    const conn = active.connection
    const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)
    await client.execute('DELETE', `/${row.__source._index}/_doc/${row.__source._id}`)
    message.success('删除成功')
    search()
  } catch (error: any) {
    message.error(`删除失败: ${error.message}`)
  }
}

// 查看行原文
function viewRowSource(row: any) {
  if (row.__source) {
    jsonPreviewRef.value?.open(`文档原文 - ${row.__source._id}`, row.__source)
  }
}

// vxe-table 双击事件
function handleCellDblclick({ row }: { row: any }) {
  viewRowSource(row)
}

// 索引变化处理
function handleIndexChange(val: string | null) {
  // 清除搜索结果
  updateState({
    index: val || '',
    pageNum: 1,
    total: 0,
    result: null,
    boolQuery: createEmptyBoolQuery(),
    sortItems: [],
    aggItems: [],
    selectedFields: [],
    fieldFilterKeyword: ''
  })
  rows.value = []
  // 如果选择了索引，加载字段生成表头
  if (val) {
    mappingLoadedForIndex.value = ''  // 重置，允许重新加载
    loadFields(val)
  } else {
    mapping.value = []
    columns.value = []
    mappingLoadedForIndex.value = ''
  }
}

// 添加排序
function addSortItem() {
  updateState({
    sortItems: [...sortItems.value, { field: '', order: 'asc' }]
  })
}

// 添加查询项
function addQueryItem() {
  const newQuery = deepClone(boolQuery.value)
  newQuery.query.push(createSearchQuery())
  updateState({ boolQuery: newQuery })
}

// 删除排序
function removeSortItem(index: number) {
  const newItems = [...sortItems.value]
  newItems.splice(index, 1)
  updateState({ sortItems: newItems })
}

// 添加聚合
function addAggItem() {
  updateState({
    aggItems: [...aggItems.value, createAggregationConfig()]
  })
}

// 删除聚合
function removeAggItem(index: number) {
  const newItems = [...aggItems.value]
  newItems.splice(index, 1)
  updateState({ aggItems: newItems })
}

// 查询历史
const searchHistory = ref<SearchHistoryItem[]>([])

async function loadSearchHistory() {
  try {
    const records = await getSearchHistory(currentActive.value?.connection?.id)
    searchHistory.value = records.map(r => ({
      id: r.id,
      index: r.index_name,
      query: JSON.parse(r.query),
      timestamp: r.created_at
    }))
  } catch {
    searchHistory.value = []
  }
}

async function saveSearchHistoryItem() {
  const item = {
    id: Date.now().toString(),
    connection_id: currentActive.value?.connection?.id || null,
    index_name: form.value.index,
    query: JSON.stringify(buildQueryDsl()),
    created_at: Date.now()
  }
  try {
    await saveSearchHistory(item)
    // 刷新历史列表
    await loadSearchHistory()
  } catch {
    // ignore
  }
}

// 按条件删除
function deleteByQuery() {
  if (!form.value.index) {
    message.warning('请选择索引')
    return
  }

  // 构建删除请求体
  const query = buildQueryDsl()
  deletePreviewBody.value = {
    query: query.query
  }
  showDeleteModal.value = true
}

// 确认删除
async function confirmDeleteByQuery() {
  const active = currentActive.value
  if (!active) return

  operationLoading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const result = await client.execute('POST', `/${form.value.index}/_delete_by_query`, deletePreviewBody.value)
    const deleted = result.deleted || result.total || 0
    message.success(`删除成功，共删除 ${deleted} 条文档`)
    showDeleteModal.value = false
    // 刷新搜索结果
    search()
  } catch (e: any) {
    message.error(`删除失败: ${e.message}`)
  } finally {
    operationLoading.value = false
  }
}

// 按条件更新
function updateByQuery() {
  if (!form.value.index) {
    message.warning('请选择索引')
    return
  }

  // 打开模态框
  updateFields.value = [{ field: '', value: '' }]
  updatePreviewBody.value = null
  showUpdateModal.value = true
}

// 添加更新字段
function addUpdateField() {
  updateFields.value.push({ field: '', value: '' })
}

// 删除更新字段
function removeUpdateField(index: number) {
  updateFields.value.splice(index, 1)
  previewUpdateJson()
}

// 预览更新JSON
function previewUpdateJson() {
  // 过滤有效的更新字段
  const validFields = updateFields.value.filter(f => f.field)
  if (validFields.length === 0) {
    updatePreviewBody.value = null
    return
  }

  // 构建 script source，用户输入原样拼接，不做任何转换
  const scriptLines = validFields.map(f => {
    return `ctx._source['${f.field}'] = ${f.value};`
  })

  // 构建更新请求体
  const query = buildQueryDsl()
  updatePreviewBody.value = {
    query: query.query,
    script: {
      source: scriptLines.join('\n'),
      lang: 'painless'
    }
  }
}

// 确认更新
async function confirmUpdateByQuery() {
  // 过滤有效的更新字段
  const validFields = updateFields.value.filter(f => f.field)
  if (validFields.length === 0) {
    message.warning('请至少选择一个更新字段')
    return
  }

  // 确保有预览数据
  if (!updatePreviewBody.value) {
    previewUpdateJson()
  }

  const active = currentActive.value
  if (!active) return

  operationLoading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const result = await client.execute('POST', `/${form.value.index}/_update_by_query`, updatePreviewBody.value)
    const updated = result.updated || result.total || 0
    message.success(`更新成功，共更新 ${updated} 条文档`)
    showUpdateModal.value = false
    // 刷新搜索结果
    search()
  } catch (e: any) {
    message.error(`更新失败: ${e.message}`)
  } finally {
    operationLoading.value = false
  }
}

// 分页
function handlePageChange(pageNum: number) {
  updateState({ pageNum })
  search()
}

function handlePageSizeChange(newPageSize: number) {
  updateState({ pageSize: newPageSize, pageNum: 1 })
  search()
}

// 监听连接变化，清空状态
watch(() => connectionStore.currentConnectionId, (_connId, oldConnId) => {
  if (oldConnId) {
    // 切换集群时，清空之前的状态
    updateState({
      result: null,
      total: 0
    })
    rows.value = []
    mapping.value = []
    columns.value = []
    mappingLoadedForIndex.value = ''
  }
})

// 监听索引列表变化，自动加载 mapping（用于恢复 tab 状态）
// 使用带条件的 watchEffect 更高效，避免不必要的依赖追踪
watchEffect(() => {
  const options = indexOptions.value
  const selectedIndex = tabState.value.index
  if (options.length > 0 && selectedIndex && mappingLoadedForIndex.value !== selectedIndex) {
    const indexExists = options.some(opt => opt.value === selectedIndex)
    if (indexExists) {
      loadFields(selectedIndex, true)
    }
  }
}, { flush: 'post' })

// 分页组件高度
const paginationHeight = 52

// 计算 JSON 视图高度
function updateJsonViewerHeight() {
  nextTick(() => {
    if (resultAreaRef.value) {
      const rect = resultAreaRef.value.getBoundingClientRect()
      // 减去工具栏高度约 44px、padding 24px
      jsonViewerHeight.value = Math.max(rect.height - 70, 300)
    }
  })
}

// 表格最大高度（预留分页空间）
const tableMaxHeight = computed(() => {
  return Math.max(jsonViewerHeight.value - paginationHeight, 200)
})

// 监听结果变化，更新高度
watch(result, () => {
  updateJsonViewerHeight()
})

// 监听窗口大小变化
function handleResize() {
  updateJsonViewerHeight()
}

// 拖动调整面板高度
const startHeight = ref(0)
const startY = ref(0)

function startResize(e: MouseEvent) {
  isResizing.value = true
  startHeight.value = configHeight.value
  startY.value = e.clientY
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
}

function handleMouseMove(e: MouseEvent) {
  if (!isResizing.value) return
  const diff = e.clientY - startY.value
  const maxHeight = Math.floor(window.innerHeight * 0.6)
  configHeight.value = Math.min(maxHeight, Math.max(150, startHeight.value + diff))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

// 下载 CSV
async function downloadCsv() {
  if (rows.value.length === 0) {
    message.warning('没有数据可下载')
    return
  }

  // 弹出保存对话框
  const filePath = await save({
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    defaultPath: `${form.value.index || 'search'}_${Date.now()}.csv`
  })

  if (!filePath) {
    return // 用户取消
  }

  // 获取所有列名（排除内部字段）
  const headers = columns.value.map(c => c.field)
  const csvRows: string[] = []

  // 添加表头
  csvRows.push(headers.join(','))

  // 添加数据行
  for (const row of rows.value) {
    const values = headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      // 处理包含逗号或引号的值
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    csvRows.push(values.join(','))
  }

  // 创建 CSV 内容（带 UTF-8 BOM）
  const csvContent = '\ufeff' + csvRows.join('\n')
  const encoder = new TextEncoder()
  const data = encoder.encode(csvContent)

  try {
    await writeFile(filePath, data)
    message.success('CSV 下载成功')
  } catch (error: any) {
    message.error(`下载失败: ${error.message}`)
  }
}

// 下载 JSON
async function downloadJson() {
  if (!result.value) {
    message.warning('没有数据可下载')
    return
  }

  // 弹出保存对话框
  const filePath = await save({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    defaultPath: `${form.value.index || 'search'}_${Date.now()}.json`
  })

  if (!filePath) {
    return // 用户取消
  }

  const jsonContent = JSON.stringify(result.value, null, 2)
  const encoder = new TextEncoder()
  const data = encoder.encode(jsonContent)

  try {
    await writeFile(filePath, data)
    message.success('JSON 下载成功')
  } catch (error: any) {
    message.error(`下载失败: ${error.message}`)
  }
}

onMounted(() => {
  loadSearchHistory()
  window.addEventListener('resize', handleResize)
  // 延迟初始化高度
  setTimeout(updateJsonViewerHeight, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="search-page">
    <!-- 上方查询配置区域 -->
    <div class="config-panel" :style="{ height: `${configHeight}px` }">
      <!-- 工具栏 -->
      <div class="config-toolbar">
        <div class="toolbar-left">
          <n-select
            v-model:value="form.index"
            :options="indexOptions"
            filterable
            clearable
            tag
            placeholder="选择索引"
            size="small"
            style="width: 220px"
            @update:value="handleIndexChange"
          />
          <n-radio-group v-model:value="isSimpleMode" size="small">
            <n-radio-button :value="true">简单</n-radio-button>
            <n-radio-button :value="false">聚合</n-radio-button>
          </n-radio-group>
          <span class="option-label">超时</span>
          <n-input-number v-model:value="form.timeout" :min="5" :max="180" size="small" style="width: 85px" />
          <n-checkbox v-model:checked="form.trackTotalHits">总数</n-checkbox>
          <n-button
            type="primary"
            size="small"
            :disabled="!form.index || (!isSimpleMode && aggItems.length === 0)"
            :loading="loading"
            @click="search"
          >
            <template #icon>
              <n-icon :component="Search" />
            </template>
            搜索
          </n-button>
        </div>
        <div class="toolbar-right">
          <n-button quaternary size="small" :disabled="!form.index" @click="showQueryDsl">
            查询条件
          </n-button>
          <n-button quaternary size="small" :disabled="!form.index" @click="updateByQuery">
            按条件更新
          </n-button>
          <n-button quaternary size="small" :disabled="!form.index" @click="deleteByQuery">
            按条件删除
          </n-button>
        </div>
      </div>

      <!-- Tab 区域 -->
      <n-tabs v-model:value="activeTab" type="line" size="small" class="config-tabs" :key="isSimpleMode ? 'simple' : 'agg'">
        <!-- 查询条件 -->
        <n-tab-pane name="query" tab="查询条件">
          <div class="tab-header">
            <n-button size="tiny" type="primary" @click="addQueryItem">
              <template #icon>
                <n-icon :component="AddOutline" />
              </template>
            </n-button>
          </div>
          <div class="query-builder-wrapper">
            <QueryBuilder
              v-model:bool-query="boolQuery"
              :mapping="mapping"
            />
          </div>
        </n-tab-pane>

        <!-- 排序 -->
        <n-tab-pane v-if="isSimpleMode" name="sort" tab="排序">
          <div class="tab-header">
            <n-button size="tiny" type="primary" @click="addSortItem">
              <template #icon>
                <n-icon :component="AddOutline" />
              </template>
            </n-button>
          </div>
          <div class="sort-list">
            <div v-for="(item, index) in sortItems" :key="index" class="sort-item">
              <n-select
                v-model:value="item.field"
                :options="fieldOptions"
                size="small"
                filterable
                clearable
                placeholder="字段"
              />
              <n-radio-group v-model:value="item.order" size="small">
                <n-radio-button value="asc">升</n-radio-button>
                <n-radio-button value="desc">降</n-radio-button>
              </n-radio-group>
              <n-button size="tiny" type="error" @click="removeSortItem(index)">
                <template #icon>
                  <n-icon :component="RemoveOutline" />
                </template>
              </n-button>
            </div>
            <div v-if="sortItems.length === 0" class="empty-hint">点击上方按钮添加排序</div>
          </div>
        </n-tab-pane>

        <!-- 字段选择 -->
        <n-tab-pane v-if="isSimpleMode" name="fields" tab="字段选择">
          <template #tab>
            字段选择
            <span v-if="selectedFields.size > 0" class="selected-count">({{ selectedFields.size }}/{{ mapping.length }})</span>
          </template>
          <div class="field-selector">
            <div class="field-toolbar">
              <n-input
                v-model:value="fieldFilterKeyword"
                size="tiny"
                placeholder="过滤字段..."
                clearable
                style="flex: 1"
              >
                <template #prefix>
                  <n-icon :component="Search" />
                </template>
              </n-input>
              <n-button size="tiny" type="primary" @click="selectAllFields">全选</n-button>
              <n-button size="tiny" @click="deselectAllFields">反选</n-button>
            </div>
            <n-checkbox-group :value="Array.from(selectedFields)" @update:value="handleFieldGroupChange">
              <div class="field-list">
                <n-checkbox
                  v-for="field in filteredFields"
                  :key="field.name"
                  :value="field.name"
                  :label="field.name"
                  class="field-checkbox"
                />
                <div v-if="filteredFields.length === 0" class="empty-hint">无匹配字段</div>
              </div>
            </n-checkbox-group>
          </div>
        </n-tab-pane>

        <!-- 聚合 -->
        <n-tab-pane v-if="!isSimpleMode" name="aggregation" tab="聚合">
          <div class="tab-header">
            <n-button size="tiny" type="primary" @click="addAggItem">
              <template #icon>
                <n-icon :component="AddOutline" />
              </template>
            </n-button>
          </div>
          <div class="agg-list">
            <AggItem
              v-for="(item, index) in aggItems"
              :key="item.id"
              :agg="item"
              :field-options="fieldOptions"
              @update="(updated) => {
                const newItems = [...aggItems]
                newItems[index] = updated
                updateState({ aggItems: newItems })
              }"
              @remove="() => removeAggItem(index)"
            />
            <div v-if="aggItems.length === 0" class="empty-hint">点击上方按钮添加聚合</div>
          </div>
        </n-tab-pane>
      </n-tabs>

      <!-- 拖动调整高度 -->
      <div
        class="resize-handle"
        :class="{ active: isResizing }"
        @mousedown="startResize"
      />
    </div>

    <!-- 下方结果区域 -->
    <div ref="resultAreaRef" class="result-area">
      <!-- 工具栏 -->
      <div class="result-toolbar">
        <div class="result-tabs">
          <div v-if="isSimpleMode" class="tab-item" :class="{ active: resultMode === 'table' }" @click="resultMode = 'table'">表格</div>
          <div class="tab-item" :class="{ active: resultMode === 'json' }" @click="resultMode = 'json'">JSON</div>
        </div>
        <div class="result-actions">
          <n-icon
            v-if="isSimpleMode && resultMode === 'table' && rows.length > 0"
            :component="DownloadOutline"
            class="download-icon"
            title="下载 CSV"
            @click="downloadCsv"
          />
          <n-icon
            v-if="resultMode === 'json' && result"
            :component="DownloadOutline"
            class="download-icon"
            title="下载 JSON"
            @click="downloadJson"
          />
        </div>
      </div>

      <div class="result-content">
        <!-- 表格视图 -->
        <div v-if="isSimpleMode" v-show="resultMode === 'table'" class="table-container">
          <n-spin :show="mappingLoading || loading">
            <div v-show="columns.length > 0" class="table-wrapper">
              <vxe-table
                ref="xTable"
                border
                stripe
                resizable
                show-overflow="title"
                :data="rows"
                :max-height="tableMaxHeight"
                :scroll-x="{ enabled: true }"
                :scroll-y="{ enabled: true, gt: 20 }"
                :row-config="{ height: 32 }"
                @cell-dblclick="handleCellDblclick"
              >
                <vxe-column
                  v-for="col in columns"
                  :key="col.field"
                  :field="col.field"
                  :title="col.title"
                  :min-width="col.minWidth"
                />
                <vxe-column field="__actions" title="操作" width="80" fixed="right">
                  <template #default="{ row }">
                    <n-button size="tiny" quaternary @click="deleteRow(row)">
                      <template #icon>
                        <n-icon :component="TrashOutline" />
                      </template>
                    </n-button>
                  </template>
                </vxe-column>
              </vxe-table>
            </div>
            <n-empty v-show="columns.length === 0 && !mappingLoading" :description="form.index ? '该索引无字段信息' : '选择索引查看字段'" />
            <div class="pagination">
              <span>共 {{ page.total }} 条</span>
              <n-select
                :value="page.pageSize"
                :options="[10, 15, 20, 50, 100].map((v: number) => ({ label: `${v}条/页`, value: v }))"
                size="small"
                style="width: 100px"
                @update:value="handlePageSizeChange"
              />
              <n-button size="small" :disabled="page.pageNum <= 1" @click="handlePageChange(page.pageNum - 1)">上一页</n-button>
              <span>{{ page.pageNum }}</span>
              <n-button size="small" :disabled="page.pageNum * page.pageSize >= page.total" @click="handlePageChange(page.pageNum + 1)">下一页</n-button>
            </div>
          </n-spin>
        </div>
        <!-- JSON 视图 -->
        <div v-show="resultMode === 'json'" class="json-container">
          <n-spin :show="loading" class="json-spin">
            <JsonViewer v-if="result" :content="result" :height="`${jsonViewerHeight}px`" />
            <n-empty v-else description="执行查询查看结果" />
          </n-spin>
        </div>
      </div>
    </div>

    <JsonPreviewModal ref="jsonPreviewRef" />

    <!-- 按条件删除模态框 -->
    <n-modal
      v-model:show="showDeleteModal"
      preset="card"
      title="按条件删除"
      style="width: 600px;"
      :bordered="false"
      size="small"
    >
      <div class="operation-modal-content">
        <div class="operation-hint">
          将删除匹配当前查询条件的所有文档，请确认操作。
        </div>
        <div class="json-preview">
          <div class="preview-label">请求体预览：</div>
          <pre class="preview-json">{{ JSON.stringify(deletePreviewBody, null, 2) }}</pre>
        </div>
      </div>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="showDeleteModal = false">取消</n-button>
          <n-button type="error" :loading="operationLoading" @click="confirmDeleteByQuery">确认删除</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 按条件更新模态框 -->
    <n-modal
      v-model:show="showUpdateModal"
      preset="card"
      title="按条件更新"
      style="width: 600px;"
      :bordered="false"
      size="small"
    >
      <div class="operation-modal-content">
        <div class="update-fields">
          <div v-for="(item, index) in updateFields" :key="index" class="update-field-item">
            <n-select
              v-model:value="item.field"
              :options="fieldOptions"
              size="small"
              filterable
              clearable
              placeholder="选择字段"
              style="width: 150px"
              @update:value="previewUpdateJson"
            />
            <n-input
              v-model:value="item.value"
              size="small"
              placeholder="更新值 (支持 JSON)"
              style="flex: 1"
              @update:value="previewUpdateJson"
            />
            <n-button
              v-if="updateFields.length > 1"
              size="small"
              quaternary
              type="error"
              @click="removeUpdateField(index)"
            >
              <template #icon>
                <n-icon :component="RemoveOutline" />
              </template>
            </n-button>
          </div>
        </div>

        <n-button size="small" dashed block @click="addUpdateField">
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
          添加字段
        </n-button>

        <div v-if="updatePreviewBody" class="json-preview">
          <div class="preview-label">请求体预览：</div>
          <pre class="preview-json">{{ JSON.stringify(updatePreviewBody, null, 2) }}</pre>
        </div>
      </div>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="showUpdateModal = false">取消</n-button>
          <n-button type="primary" :loading="operationLoading" :disabled="!updatePreviewBody" @click="confirmUpdateByQuery">确认更新</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.search-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
}

.config-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: #252525;
  border-bottom: 1px solid #333;
  min-height: 150px;
}

.config-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-label {
  font-size: 12px;
  color: #888;
  font-weight: 500;
  white-space: nowrap;
}

.option-label {
  font-size: 12px;
  color: #ccc;
}

.config-tabs {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  :deep(.n-tabs-nav) {
    padding: 0 12px;
  }

  :deep(.n-tabs-pane-wrapper) {
    flex: 1;
    overflow: hidden;
  }

  :deep(.n-tab-pane) {
    height: 100%;
    overflow: auto;
    padding: 8px 12px;
  }
}

.tab-header {
  margin-bottom: 8px;
}

.query-builder-wrapper {
  flex: 1;
  overflow: auto;
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 8px;
  min-height: 100px;
}

.sort-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sort-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.field-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.field-checkbox {
  padding: 4px 8px;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  background-color: #1e1e1e;
  transition: all 0.2s;

  &:hover {
    border-color: #63e2b7;
  }
}

.selected-count {
  margin-left: 4px;
  font-size: 11px;
  color: #888;
}

.empty-hint {
  padding: 12px;
  text-align: center;
  color: #666;
  font-size: 12px;
}

.agg-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}

.agg-item-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-agg-list {
  margin-left: 24px;
  padding-left: 12px;
  border-left: 2px solid #3d3d3d;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-agg-item {
  background-color: rgba(99, 226, 183, 0.05);
}

.sub-agg-item > .sub-agg-list {
  margin-left: 24px;
  padding-left: 12px;
  border-left: 2px solid #3d3d3d;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.operation-modal-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.operation-hint {
  font-size: 13px;
  color: #888;
  padding: 8px 12px;
  background-color: #2d2d2d;
  border-radius: 4px;
}

.update-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.update-field-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.json-preview {
  margin-top: 8px;
}

.preview-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.preview-json {
  margin: 0;
  padding: 12px;
  background-color: #1e1e1e;
  border: 1px solid #333;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-all;
  color: #e0e0e0;
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

.result-area {
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

.result-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.result-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-item {
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #888;
  border-radius: 4px 4px 0 0;
  transition: all 0.2s;

  &:hover {
    color: #fff;
  }

  &.active {
    color: #63e2b7;
    background-color: #1a1a1a;
  }
}

.download-icon {
  font-size: 16px;
  color: #888;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: #63e2b7;
  }
}

.result-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.table-container,
.json-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .n-spin {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
}

.json-container {
  min-height: 0;

  .json-spin {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
}

.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid #333;
}

// 浅色主题
:root[data-theme='light'] {
  .search-page {
    background-color: #f5f5f5;
  }

  .config-panel {
    background-color: #fff;
    border-bottom-color: #e0e0e0;
  }

  .config-toolbar {
    border-bottom-color: #e0e0e0;
  }

  .query-builder-wrapper {
    background-color: #fafafa;
  }

  .resize-handle {
    &:hover,
    &.active {
      background-color: #18a058;
    }
  }

  .result-area {
    background-color: #f5f5f5;
  }

  .result-toolbar {
    background-color: #fff;
    border-bottom-color: #e0e0e0;
  }

  .tab-item {
    color: #666;

    &:hover {
      color: #333;
    }

    &.active {
      color: #18a058;
      background-color: #f5f5f5;
    }
  }

  .pagination {
    border-top-color: #e0e0e0;
  }

  .field-checkbox {
    background-color: #fff;
    border-color: #ddd;

    &:hover {
      border-color: #18a058;
    }
  }

  .agg-item {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .sub-agg-list {
    border-left-color: #ddd;
  }

  .sub-agg-item {
    background-color: rgba(24, 160, 88, 0.05);
  }

  .operation-hint {
    background-color: #f5f5f5;
  }

  .preview-json {
    background-color: #fafafa;
    border-color: #e0e0e0;
    color: #333;
  }
}
</style>