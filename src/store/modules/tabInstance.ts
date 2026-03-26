import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type BoolQuery, createEmptyBoolQuery, type SortConfig, type AggregationConfig } from '@/views/search/types'
import { getTabs, saveTabs } from '@/services/database'

// 标签页类型
export type TabType = 'search' | 'rest' | 'sql' | 'overview' | 'nodes' | 'indices' | 'templates' | 'shards' | 'cluster-settings'

// 搜索标签状态
export interface SearchTabState {
  index: string
  simple: boolean
  timeout: number
  trackTotalHits: boolean
  boolQuery: BoolQuery
  sortItems: SortConfig[]
  aggItems: AggregationConfig[]
  selectedFields: string[]
  fieldFilterKeyword: string
  result: any
  resultMode: 'table' | 'json'
  activeTab: string
  // 分页
  pageNum: number
  pageSize: number
  total: number
}

// REST 标签状态
export interface RestTabState {
  method: string
  path: string
  body: string
  response: any
  statusCode: number | null
  duration: number | null
}

// SQL 标签状态
export interface SqlTabState {
  query: string
  result: any
  resultMode: 'table' | 'json'
}

// 标签页实例
export interface TabInstance {
  id: string
  type: TabType
  title: string
  connectionId: string
  closable: boolean
  state: SearchTabState | RestTabState | SqlTabState | Record<string, never>
}

// 生成唯一ID
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// 创建默认的搜索标签状态
function createDefaultSearchState(): SearchTabState {
  return {
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
  }
}

// 创建默认的 REST 标签状态
function createDefaultRestState(): RestTabState {
  return {
    method: 'GET',
    path: '',
    body: '',
    response: null,
    statusCode: null,
    duration: null
  }
}

// 创建默认的 SQL 标签状态
function createDefaultSqlState(): SqlTabState {
  return {
    query: '',
    result: null,
    resultMode: 'table'
  }
}

// 标签类型对应的中文名称
const TAB_TYPE_LABELS: Record<TabType, string> = {
  'search': '搜索',
  'rest': 'REST',
  'sql': 'SQL',
  'overview': '概览',
  'nodes': '节点',
  'indices': '索引',
  'templates': '模板',
  'shards': '分片',
  'cluster-settings': '设置'
}

export const useTabInstanceStore = defineStore('tabInstance', () => {
  const tabs = ref<TabInstance[]>([])
  const activeTabId = ref<string | null>(null)
  const currentConnectionId = ref<string | null>(null)
  const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.find(t => t.id === activeTabId.value) || null
  })

  // 防抖保存到数据库
  function scheduleSave() {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value)
    }
    saveTimeout.value = setTimeout(() => {
      saveToDatabase()
    }, 500)
  }

  // 保存到数据库
  async function saveToDatabase() {
    if (!currentConnectionId.value) return

    try {
      const tabRecords = tabs.value.map((tab, index) => ({
        id: tab.id,
        connection_id: tab.connectionId,
        tab_type: tab.type,
        title: tab.title,
        state: JSON.stringify(tab.state),
        closable: tab.closable ? 1 : 0,
        sort_order: index
      }))
      await saveTabs(currentConnectionId.value, tabRecords)
    } catch (e) {
      console.error('Failed to save tabs to database:', e)
    }
  }

  // 创建新标签
  function createTab(type: TabType, connectionId: string, options?: { title?: string; index?: string }): TabInstance {
    const id = generateTabId()
    let title = options?.title || TAB_TYPE_LABELS[type]
    let state: SearchTabState | RestTabState | SqlTabState | Record<string, never> = {}
    let closable = true

    switch (type) {
      case 'search':
        state = createDefaultSearchState()
        if (options?.index) {
          (state as SearchTabState).index = options.index
          title = `搜索: ${options.index}`
        }
        break
      case 'rest':
        state = createDefaultRestState()
        break
      case 'sql':
        state = createDefaultSqlState()
        break
      case 'overview':
      case 'nodes':
      case 'indices':
      case 'shards':
      case 'templates':
      case 'cluster-settings':
        closable = false
        state = {}
        break
    }

    const tab: TabInstance = {
      id,
      type,
      title,
      connectionId,
      closable,
      state
    }

    tabs.value.push(tab)
    activeTabId.value = id
    scheduleSave()

    return tab
  }

  // 关闭标签
  function closeTab(tabId: string) {
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1) return

    const tab = tabs.value[index]
    if (!tab.closable) return

    tabs.value.splice(index, 1)

    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIndex].id
      } else {
        activeTabId.value = null
      }
    }

    scheduleSave()
  }

  // 激活标签
  function activateTab(tabId: string) {
    if (tabs.value.find(t => t.id === tabId)) {
      activeTabId.value = tabId
      scheduleSave()
    }
  }

  // 更新标签状态
  function updateTabState(tabId: string, partialState: Partial<SearchTabState | RestTabState | SqlTabState>) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.state = { ...tab.state, ...partialState } as SearchTabState | RestTabState | SqlTabState
      scheduleSave()
    }
  }

  // 获取标签状态
  function getTabState(tabId: string): SearchTabState | RestTabState | SqlTabState | Record<string, never> | null {
    const tab = tabs.value.find(t => t.id === tabId)
    return tab ? tab.state : null
  }

  // 更新标签标题
  function updateTabTitle(tabId: string, title: string) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.title = title
      scheduleSave()
    }
  }

  // 初始化固定标签
  function initFixedTabs(connectionId: string) {
    tabs.value = []
    activeTabId.value = null
    currentConnectionId.value = connectionId

    const fixedTabs: TabType[] = ['overview', 'nodes', 'indices', 'shards', 'templates', 'cluster-settings']
    const defaultTabs: TabType[] = ['search', 'rest', 'sql']

    const newTabs: TabInstance[] = []

    fixedTabs.forEach(type => {
      const id = generateTabId()
      const tab: TabInstance = {
        id,
        type,
        title: TAB_TYPE_LABELS[type],
        connectionId,
        closable: false,
        state: {}
      }
      newTabs.push(tab)
    })

    defaultTabs.forEach(type => {
      const id = generateTabId()
      let state: SearchTabState | RestTabState | SqlTabState | Record<string, never> = {}

      if (type === 'search') {
        state = createDefaultSearchState()
      } else if (type === 'rest') {
        state = createDefaultRestState()
      } else if (type === 'sql') {
        state = createDefaultSqlState()
      }

      const tab: TabInstance = {
        id,
        type,
        title: TAB_TYPE_LABELS[type],
        connectionId,
        closable: true,
        state
      }
      newTabs.push(tab)
    })

    tabs.value = newTabs

    if (tabs.value.length > 0) {
      activeTabId.value = tabs.value[0].id
    }

    scheduleSave()
  }

  // 清除所有可关闭的标签
  function clearClosableTabs() {
    tabs.value = tabs.value.filter(t => !t.closable)
    if (activeTabId.value && !tabs.value.find(t => t.id === activeTabId.value)) {
      activeTabId.value = tabs.value.length > 0 ? tabs.value[0].id : null
    }
    scheduleSave()
  }

  // 重置所有标签
  function resetTabs() {
    tabs.value = []
    activeTabId.value = null
    currentConnectionId.value = null
  }

  // 从数据库恢复
  async function loadFromStorage(connectionId: string): Promise<boolean> {
    try {
      currentConnectionId.value = connectionId
      const records = await getTabs(connectionId)

      if (records && records.length > 0) {
        tabs.value = records.map(record => ({
          id: record.id,
          type: record.tab_type as TabType,
          title: record.title,
          connectionId: record.connection_id,
          closable: record.closable === 1,
          state: JSON.parse(record.state)
        }))
        activeTabId.value = tabs.value.length > 0 ? tabs.value[0].id : null
        return true
      }
    } catch (e) {
      console.error('Failed to load tabs from database:', e)
    }
    return false
  }

  // 获取当前连接的所有标签
  function getConnectionTabs(connectionId: string): TabInstance[] {
    return tabs.value.filter(t => t.connectionId === connectionId)
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    createTab,
    closeTab,
    activateTab,
    updateTabState,
    getTabState,
    updateTabTitle,
    initFixedTabs,
    clearClosableTabs,
    resetTabs,
    loadFromStorage,
    getConnectionTabs
  }
})