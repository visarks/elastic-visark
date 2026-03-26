import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Connection {
  id: string
  name: string
  url: string
  username?: string
  password?: string
  version?: string
  created_at: number
  updated_at: number
}

// 活跃连接信息，包含集群数据
export interface ActiveConnection {
  connection: Connection
  nodes: any[]
  indices: any[]
  templates: any[]
}

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<Connection[]>([])
  // 支持多个活跃连接
  const activeConnectionsMap = ref<Map<string, ActiveConnection>>(new Map())
  // 当前选中的连接ID
  const currentConnectionId = ref<string | null>(null)
  const showClusterList = ref(false)
  // 左侧树面板显示状态
  const showSideTree = ref(true)

  // 获取所有活跃连接
  const activeConnectionList = computed(() =>
    Array.from(activeConnectionsMap.value.values())
  )

  // 兼容属性：返回当前选中的连接
  const activeConnection = computed(() => {
    if (currentConnectionId.value) {
      return activeConnectionsMap.value.get(currentConnectionId.value)?.connection || null
    }
    const list = activeConnectionList.value
    return list.length > 0 ? list[0].connection : null
  })

  // 获取当前活跃连接
  const currentActiveConnection = computed(() => {
    if (currentConnectionId.value) {
      return activeConnectionsMap.value.get(currentConnectionId.value)
    }
    const list = activeConnectionList.value
    return list.length > 0 ? list[0] : undefined
  })

  // 检查是否有活跃连接
  const hasActiveConnection = computed(() => activeConnectionsMap.value.size > 0)

  // 检查连接是否已激活
  function isActive(id: string): boolean {
    return activeConnectionsMap.value.has(id)
  }

  // 添加活跃连接
  function addActiveConnection(conn: Connection): ActiveConnection {
    const active: ActiveConnection = {
      connection: conn,
      nodes: [],
      indices: [],
      templates: []
    }
    // 创建新的 Map 以触发响应式更新
    const newMap = new Map(activeConnectionsMap.value)
    newMap.set(conn.id, active)
    activeConnectionsMap.value = newMap
    // 设置为当前连接
    currentConnectionId.value = conn.id
    return active
  }

  // 移除活跃连接
  function removeActiveConnection(id: string) {
    // 创建新的 Map 以触发响应式更新
    const newMap = new Map(activeConnectionsMap.value)
    newMap.delete(id)
    activeConnectionsMap.value = newMap
    // 如果移除的是当前连接，切换到第一个
    if (currentConnectionId.value === id) {
      const list = Array.from(newMap.keys())
      currentConnectionId.value = list.length > 0 ? list[0] : null
    }
  }

  // 切换当前连接
  function setCurrentConnection(id: string) {
    if (activeConnectionsMap.value.has(id)) {
      currentConnectionId.value = id
    }
  }

  // 更新活跃连接的数据
  function updateConnectionData(
    id: string,
    type: 'nodes' | 'indices' | 'templates',
    data: any[]
  ) {
    const active = activeConnectionsMap.value.get(id)
    if (active) {
      // 创建新对象和新 Map 以触发响应式更新
      const updated = { ...active, [type]: data }
      const newMap = new Map(activeConnectionsMap.value)
      newMap.set(id, updated)
      activeConnectionsMap.value = newMap
    }
  }

  // 获取活跃连接数据
  function getActiveConnection(id: string): ActiveConnection | undefined {
    return activeConnectionsMap.value.get(id)
  }

  function toggleClusterList() {
    showClusterList.value = !showClusterList.value
  }

  function closeClusterList() {
    showClusterList.value = false
  }

  // 切换左侧树面板
  function toggleSideTree() {
    showSideTree.value = !showSideTree.value
  }

  return {
    connections,
    activeConnections: activeConnectionsMap,
    activeConnectionList,
    activeConnection,
    currentConnectionId,
    currentActiveConnection,
    hasActiveConnection,
    showClusterList,
    showSideTree,
    isActive,
    addActiveConnection,
    removeActiveConnection,
    setCurrentConnection,
    updateConnectionData,
    getActiveConnection,
    toggleClusterList,
    closeClusterList,
    toggleSideTree
  }
})