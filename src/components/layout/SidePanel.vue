<script setup lang="ts">
import { h, ref, computed, onMounted, watch, shallowRef } from 'vue'
import {
  NButton,
  NInput,
  NTree,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  NSpin,
  NDropdown,
  NTag,
  NIcon,
  useMessage
} from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import {
  ServerOutline,
  DesktopOutline,
  FolderOutline,
  DocumentTextOutline,
  FileTrayFullOutline,
  AddOutline,
  CreateOutline,
  TrashOutline
} from '@vicons/ionicons5'
import { Database } from '@vicons/fa'
import { getConnections, saveConnection, deleteConnection, ElasticClient, type Connection } from '@/api/elastic'
import { useConnectionStore } from '@/store/modules/connection'
import { useSettingsStore } from '@/store/modules/settings'

const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()
const message = useMessage()

const connections = shallowRef<Connection[]>([])
const treeSearchValue = ref('')
const clusterSearchValue = ref('')
const showAddModal = ref(false)
const showConnectingModal = ref(false)
const editingConnection = ref<Connection | null>(null)
const loading = ref(false)
const abortController = ref<AbortController | null>(null)

// 加载状态按集群ID存储
const loadingStates = ref<Map<string, { nodes: boolean; indices: boolean; templates: boolean }>>(new Map())

// 表单数据
const formData = ref({
  name: '',
  url: '',
  username: '',
  password: ''
})

// 树形数据（节点、索引、模板作为根节点，只显示当前选中集群的数据）
const treeData = computed<TreeOption[]>(() => {
  const currentActive = connectionStore.currentActiveConnection
  if (!currentActive) return []

  const pattern = treeSearchValue.value.toLowerCase()
  const connId = currentActive.connection.id
  const loadState = loadingStates.value.get(connId) || { nodes: false, indices: false, templates: false }

  // 过滤节点
  const filteredNodes = pattern
    ? currentActive.nodes.filter((n: any) => n.name.toLowerCase().includes(pattern))
    : currentActive.nodes

  // 过滤索引（排除系统索引 + 搜索过滤）
  const filteredIndices = pattern
    ? currentActive.indices.filter((i: any) =>
        i.index.toLowerCase().includes(pattern) && !settingsStore.isIndexExcluded(i.index)
      )
    : currentActive.indices.filter((i: any) => !settingsStore.isIndexExcluded(i.index))

  // 过滤模板
  const filteredTemplates = pattern
    ? currentActive.templates.filter((t: any) => t.name.toLowerCase().includes(pattern))
    : currentActive.templates

  // Elasticsearch API 返回的字段名带点，如 "docs.count"
  const getDocsCount = (idx: any) => parseInt(idx['docs.count']) || 0
  const getHealth = (idx: any) => idx.health || 'red'
  const getStatus = (idx: any) => idx.status || 'close'

  // 健康状态颜色
  const getStatusColor = (health: string) => {
    if (health === 'green') return '#4caf50'
    if (health === 'yellow') return '#ff9800'
    return '#f44336'
  }

  // 索引状态图标：结合 health 和 status
  // - close: 灰色锁图标
  // - open + green: 绿色圆点
  // - open + yellow: 黄色圆点
  // - open + red: 红色圆点
  const IndexStatusIcon = (idx: any) => {
    const status = getStatus(idx)
    if (status === 'close') {
      // 关闭状态：灰色锁图标
      return h(NIcon, { size: 14, color: '#888' }, { default: () => h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
        h('path', { d: 'M12 17a2 2 0 0 0 2-2a2 2 0 0 0-2-2a2 2 0 0 0-2 2a2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5a5 5 0 0 1 5 5v2h1m-6-5a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3Z' })
      ]) })
    }
    // 打开状态：根据健康度显示颜色圆点
    const color = getStatusColor(getHealth(idx))
    return h('span', {
      style: {
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: '4px'
      }
    })
  }

  // 图标渲染函数
  const renderIcon = (icon: any, size = 16, color?: string) => {
    return () => h(NIcon, { size, color }, { default: () => h(icon) })
  }

  return [
    {
      key: 'nodes-root',
      label: `节点 (${currentActive.nodes.length})`,
      prefix: () => loadState.nodes ? h(NSpin, { size: 14, stroke: '#4caf50' }) : renderIcon(ServerOutline)(),
      children: filteredNodes.map((node: any) => ({
        key: `node-${connId}-${node.name}`,
        label: `${node.name} ${node.roles?.join(',') || ''}`,
        prefix: renderIcon(DesktopOutline, 14)
      }))
    },
    {
      key: 'indices-root',
      label: `索引 (${filteredIndices.length})`,
      prefix: () => loadState.indices ? h(NSpin, { size: 14, stroke: '#4caf50' }) : renderIcon(FolderOutline)(),
      children: filteredIndices.map((idx: any) => ({
        key: `index-${connId}-${idx.index}`,
        label: `${idx.index} (${getDocsCount(idx).toLocaleString()})`,
        prefix: () => IndexStatusIcon(idx)
      }))
    },
    {
      key: 'templates-root',
      label: `模板 (${currentActive.templates.length})`,
      prefix: () => loadState.templates ? h(NSpin, { size: 14, stroke: '#4caf50' }) : renderIcon(DocumentTextOutline)(),
      children: filteredTemplates.map((tpl: any) => ({
        key: `template-${connId}-${tpl.name}`,
        label: tpl.name,
        prefix: renderIcon(FileTrayFullOutline, 14)
      }))
    }
  ]
})

// 默认展开所有节点
const expandedKeys = ref<string[]>([])

// 加载连接列表
async function loadConnections() {
  loading.value = true
  try {
    connections.value = await getConnections()
    connectionStore.connections = connections.value
  } catch (error) {
    console.error('Failed to load connections:', error)
  } finally {
    loading.value = false
  }
}

// 加载节点数据
async function loadNodes(connId: string) {
  const active = connectionStore.getActiveConnection(connId)
  if (!active) return

  const loadState = loadingStates.value.get(connId) || { nodes: false, indices: false, templates: false }
  loadingStates.value.set(connId, { ...loadState, nodes: true })

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)
  try {
    const data = await client.getNodes()
    connectionStore.updateConnectionData(connId, 'nodes', data)
  } catch (error) {
    console.error('Failed to load nodes:', error)
  } finally {
    const state = loadingStates.value.get(connId)
    if (state) loadingStates.value.set(connId, { ...state, nodes: false })
  }
}

// 加载索引数据
async function loadIndices(connId: string) {
  const active = connectionStore.getActiveConnection(connId)
  if (!active) return

  const loadState = loadingStates.value.get(connId) || { nodes: false, indices: false, templates: false }
  loadingStates.value.set(connId, { ...loadState, indices: true })

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)
  try {
    const data = await client.getIndices()
    // 按索引名称排序
    const sortedData = data.sort((a: any, b: any) => a.index.localeCompare(b.index))
    connectionStore.updateConnectionData(connId, 'indices', sortedData)
  } catch (error) {
    console.error('Failed to load indices:', error)
  } finally {
    const state = loadingStates.value.get(connId)
    if (state) loadingStates.value.set(connId, { ...state, indices: false })
  }
}

// 加载模板数据
async function loadTemplates(connId: string) {
  const active = connectionStore.getActiveConnection(connId)
  if (!active) return

  const loadState = loadingStates.value.get(connId) || { nodes: false, indices: false, templates: false }
  loadingStates.value.set(connId, { ...loadState, templates: true })

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)
  try {
    const data = await client.getTemplates()
    connectionStore.updateConnectionData(connId, 'templates', data)
  } catch (error) {
    console.error('Failed to load templates:', error)
  } finally {
    const state = loadingStates.value.get(connId)
    if (state) loadingStates.value.set(connId, { ...state, templates: false })
  }
}

// 加载集群所有数据
async function loadClusterData(connId: string) {
  await Promise.all([
    loadNodes(connId),
    loadIndices(connId),
    loadTemplates(connId)
  ])
}

// 连接集群
async function connectCluster(conn: Connection) {
  // 已连接则断开
  if (connectionStore.isActive(conn.id)) {
    connectionStore.removeActiveConnection(conn.id)
    message.success(`已断开: ${conn.name}`)
    return
  }

  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  abortController.value = new AbortController()
  showConnectingModal.value = true

  try {
    const info = await client.getInfo()
    const clusterName = info.name || info.cluster_name

    // 添加到活跃连接
    connectionStore.addActiveConnection(conn)
    connectionStore.connections = connections.value
    connectionStore.closeClusterList()
    showConnectingModal.value = false

    message.success(`连接成功: ${clusterName}`)

    // 加载集群数据
    loadingStates.value.set(conn.id, { nodes: false, indices: false, templates: false })
    await loadClusterData(conn.id)

    // 更新展开的节点
    updateExpandedKeys()
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      message.error(`连接失败: ${error.message || error}`)
    }
    showConnectingModal.value = false
  }
}

// 更新展开的节点
function updateExpandedKeys() {
  expandedKeys.value = ['nodes-root', 'indices-root', 'templates-root']
}

// 取消连接
function cancelConnect() {
  if (abortController.value) {
    abortController.value.abort()
  }
  showConnectingModal.value = false
}

// 打开添加/编辑弹窗
function openAddModal(conn?: Connection) {
  if (conn) {
    editingConnection.value = conn
    formData.value = {
      name: conn.name,
      url: conn.url,
      username: conn.username || '',
      password: conn.password || ''
    }
  } else {
    editingConnection.value = null
    formData.value = { name: '', url: '', username: '', password: '' }
  }
  showAddModal.value = true
}

// 保存连接
async function handleSaveConnection() {
  if (!formData.value.name || !formData.value.url) {
    message.warning('请填写名称和地址')
    return
  }
  try {
    await saveConnection({
      id: editingConnection.value?.id,
      name: formData.value.name,
      url: formData.value.url,
      username: formData.value.username || undefined,
      password: formData.value.password || undefined,
      created_at: editingConnection.value?.created_at
    })
    showAddModal.value = false
    loadConnections()
    message.success('保存成功')
  } catch (error) {
    message.error('保存失败')
  }
}

// 删除连接
async function handleDeleteConnection(conn: Connection) {
  // 如果已连接，先断开
  if (connectionStore.isActive(conn.id)) {
    connectionStore.removeActiveConnection(conn.id)
  }

  try {
    await deleteConnection(conn.id)
    loadConnections()
    message.success('删除成功')
  } catch (error) {
    message.error('删除失败')
  }
}

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuOptions = ref<{ label: string; key: string }[]>([])
const currentRightClickKey = ref('')

// 右键菜单选项
function getContextMenuOptions(key: string): { label: string; key: string }[] {
  // 根节点
  if (key === 'nodes-root') {
    return [{ label: '刷新', key: 'refresh-all-nodes' }]
  }
  if (key === 'indices-root') {
    return [{ label: '刷新', key: 'refresh-all-indices' }]
  }
  if (key === 'templates-root') {
    return [{ label: '刷新', key: 'refresh-all-templates' }]
  }

  if (key.startsWith('index-')) {
    return [
      { label: '复制名称', key: 'copy-name' },
      { label: '查看详情', key: 'view-index' }
    ]
  } else if (key.startsWith('node-')) {
    return [
      { label: '复制名称', key: 'copy-name' },
      { label: '查看详情', key: 'view-node' }
    ]
  } else if (key.startsWith('template-')) {
    return [
      { label: '复制名称', key: 'copy-name' },
      { label: '查看详情', key: 'view-template' }
    ]
  }
  return []
}

// 节点属性，用于处理右键菜单和点击
function nodeProps({ option }: { option: TreeOption }) {
  return {
    onContextmenu: (e: MouseEvent) => {
      e.preventDefault()
      const key = option.key as string
      const options = getContextMenuOptions(key)
      if (options.length > 0) {
        currentRightClickKey.value = key
        contextMenuOptions.value = options
        contextMenuX.value = e.clientX
        contextMenuY.value = e.clientY
        showContextMenu.value = true
      }
    }
  }
}

// 处理右键菜单选择
async function handleDropdownSelect(key: string) {
  showContextMenu.value = false

  const currentConnId = connectionStore.currentConnectionId
  if (!currentConnId) return

  if (key === 'refresh-all-nodes') {
    await loadNodes(currentConnId)
    message.success('已刷新节点')
    return
  }

  if (key === 'refresh-all-indices') {
    await loadIndices(currentConnId)
    message.success('已刷新索引')
    return
  }

  if (key === 'refresh-all-templates') {
    await loadTemplates(currentConnId)
    message.success('已刷新模板')
    return
  }

  switch (key) {
    case 'copy-name':
      {
        // 提取名称，格式: node-{connId}-{name} 或 index-{connId}-{name}
        const parts = currentRightClickKey.value.split('-')
        const name = parts.slice(2).join('-')
        await navigator.clipboard.writeText(name)
        message.success('已复制到剪贴板')
      }
      break
    case 'view-index':
      message.info(`查看索引`)
      break
    case 'view-node':
      message.info(`查看节点`)
      break
    case 'view-template':
      message.info(`查看模板`)
      break
  }
}

// 过滤后的连接列表
const filteredConnections = computed(() => {
  if (!clusterSearchValue.value) return connections.value
  return connections.value.filter(c =>
    c.name.toLowerCase().includes(clusterSearchValue.value.toLowerCase()) ||
    c.url.toLowerCase().includes(clusterSearchValue.value.toLowerCase())
  )
})

// 监听活跃连接变化，更新展开节点
watch(
  () => connectionStore.activeConnectionList.length,
  () => {
    updateExpandedKeys()
  }
)

// 面板宽度调节
const panelWidth = ref(260)
const isResizing = ref(false)

function startResize(_e: MouseEvent) {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value) return
  // 减去左侧 ActivityBar 的宽度 (48px)
  const newWidth = e.clientX - 48
  if (newWidth >= 200 && newWidth <= 500) {
    panelWidth.value = newWidth
  }
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

onMounted(() => {
  loadConnections()
})
</script>

<template>
  <div class="side-panel" :style="{ width: panelWidth + 'px' }">
    <!-- 有活跃连接时显示树形结构 -->
    <template v-if="connectionStore.activeConnectionList.length > 0 && !connectionStore.showClusterList">
      <div class="panel-search">
        <n-input
          v-model:value="treeSearchValue"
          placeholder="搜索..."
          size="small"
          clearable
          :input-props="{ spellcheck: false }"
        />
      </div>

      <div class="tree-container">
        <n-tree
          :data="treeData"
          :expanded-keys="expandedKeys"
          block-line
          virtual-scroll
          :node-props="nodeProps"
          @update:expanded-keys="expandedKeys = $event as string[]"
        />
        <n-dropdown
          trigger="manual"
          placement="bottom-start"
          :show="showContextMenu"
          :options="contextMenuOptions"
          :x="contextMenuX"
          :y="contextMenuY"
          @select="handleDropdownSelect"
          @clickoutside="showContextMenu = false"
        />
      </div>
    </template>

    <!-- 集群列表 -->
    <template v-else>
      <div class="panel-header">
        <span>集群列表</span>
        <n-button size="small" quaternary @click="openAddModal()">
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
        </n-button>
      </div>

      <div class="panel-search">
        <n-input
          v-model:value="clusterSearchValue"
          placeholder="搜索集群..."
          size="small"
        />
      </div>

      <div class="connection-list">
        <n-spin :show="loading">
          <div
            v-for="conn in filteredConnections"
            :key="conn.id"
            class="connection-item"
            :class="{ 'is-connected': connectionStore.isActive(conn.id) }"
            @dblclick="connectCluster(conn)"
          >
            <div class="conn-info">
              <n-icon :component="Database" size="20" class="conn-icon" />
              <div class="conn-details">
                <div class="conn-name">
                  {{ conn.name }}
                  <n-tag v-if="connectionStore.isActive(conn.id)" size="small" type="success">已连接</n-tag>
                </div>
                <div class="conn-url">{{ conn.url }}</div>
              </div>
            </div>
            <div class="conn-actions">
              <n-button size="tiny" quaternary @click.stop="openAddModal(conn)">
                <template #icon>
                  <n-icon :component="CreateOutline" />
                </template>
              </n-button>
              <n-button size="tiny" quaternary @click.stop="handleDeleteConnection(conn)">
                <template #icon>
                  <n-icon :component="TrashOutline" />
                </template>
              </n-button>
            </div>
          </div>

          <n-empty v-if="connections.length === 0" description="暂无集群，点击 + 添加" />
        </n-spin>
      </div>
    </template>

    <!-- 添加/编辑连接弹窗 -->
    <n-modal
      v-model:show="showAddModal"
      preset="dialog"
      :title="editingConnection ? '编辑连接' : '添加连接'"
      positive-text="保存"
      negative-text="取消"
      @positive-click="handleSaveConnection"
    >
      <n-form>
        <n-form-item label="名称">
          <n-input v-model:value="formData.name" placeholder="集群名称" />
        </n-form-item>
        <n-form-item label="地址">
          <n-input v-model:value="formData.url" placeholder="http://localhost:9200" />
        </n-form-item>
        <n-form-item label="用户名">
          <n-input v-model:value="formData.username" placeholder="可选" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="formData.password" type="password" show-password-on="click" placeholder="可选" />
        </n-form-item>
      </n-form>
    </n-modal>

    <!-- 连接中弹窗 -->
    <n-modal
      v-model:show="showConnectingModal"
      :mask-closable="false"
      :closable="false"
      preset="card"
      style="width: 300px"
      :bordered="false"
      size="small"
    >
      <div class="connecting-content">
        <n-spin size="medium" />
        <p>正在连接集群...</p>
      </div>
      <template #footer>
        <div style="text-align: center;">
          <n-button @click="cancelConnect">取消</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 拖拽调整宽度条 -->
    <div
      class="resize-handle"
      @mousedown="startResize"
    ></div>
  </div>
</template>

<style scoped lang="scss">
.side-panel {
  min-width: 200px;
  max-width: 500px;
  height: calc(100vh - 64px);
  background-color: #252525;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
  position: relative;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  transition: background-color 0.2s;
  z-index: 10;

  &:hover {
    background-color: #4caf50;
  }
}

.panel-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
  color: #fff;
  font-weight: 500;
}

.panel-search {
  padding: 8px;
}

.connection-list {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.connection-item {
  padding: 12px;
  margin-bottom: 4px;
  background-color: #2d2d2d;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #3d3d3d;
  }

  &.is-connected {
    border-left: 3px solid #4caf50;
  }
}

.conn-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.conn-icon {
  color: #888;
}

.conn-details {
  flex: 1;
  min-width: 0;
}

.conn-name {
  color: #fff;
  font-size: 14px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.conn-url {
  color: #888;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conn-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  justify-content: flex-end;
}

.tree-container {
  flex: 1;
  overflow: hidden;
  padding: 4px 8px;
  user-select: none;

  :deep(.n-tree) {
    height: 100%;

    .n-tree-node {
      padding: 2px 0;
    }

    .n-tree-node-content {
      padding: 2px 4px;
    }

    .n-tree-node-wrapper {
      padding: 0;
    }

    .n-tree-node-switcher {
      width: 18px;
      min-width: 18px;
    }

    .n-tree-node-content__prefix {
      margin-right: 4px;
    }

    .n-tree-node-content__text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

// 连接中弹窗
.connecting-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;

  p {
    color: #888;
    margin: 0;
    font-size: 13px;
  }
}

// 浅色主题
:root[data-theme='light'] {
  .side-panel {
    background-color: #f5f7f9;
    border-right-color: #e0e0e6;
  }

  .panel-header {
    border-bottom-color: #e0e0e6;
    color: #333;
  }

  .connection-item {
    background-color: #fff;

    &:hover {
      background-color: #f0f0f0;
    }
  }

  .conn-name {
    color: #333;
  }
}
</style>