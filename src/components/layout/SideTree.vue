<script setup lang="ts">
import { ref, computed, onMounted, h, watch } from 'vue'
import {
  NTree, NButton, NIcon, NInput, NDropdown, NModal, NForm, NFormItem, NEmpty, NSpin
} from 'naive-ui'
import {
  FolderOutline, FolderOpenOutline, ServerOutline, AddOutline,
  CreateOutline, TrashOutline, LinkOutline, UnlinkOutline
} from '@vicons/ionicons5'
import type { TreeOption } from 'naive-ui'
import { useConnectionStore, type Connection } from '@/store/modules/connection'
import { ElasticClient } from '@/api/elastic'
import { useMessage } from 'naive-ui'
import { getTreeData, saveTreeData } from '@/services/database'

interface Folder {
  id: string
  name: string
  type: 'folder'
  children: (Folder | ConnectionItem)[]
  expanded?: boolean
}

interface ConnectionItem {
  id: string
  name: string
  type: 'connection'
  url: string
  username?: string
  password?: string
  version?: string
  folderId?: string
  created_at: number
  updated_at: number
}

type TreeNode = Folder | ConnectionItem

const connectionStore = useConnectionStore()
const message = useMessage()

const loading = ref(false)
const connectingId = ref<string | null>(null)
const treeData = ref<TreeNode[]>([])
const expandedKeys = ref<string[]>([])
const selectedKeys = ref<string[]>([])
const searchValue = ref('')

// 模态框状态
const showEditModal = ref(false)
const editingItem = ref<TreeNode | null>(null)
const isNewItem = ref(false)
const newItemParentId = ref<string | undefined>()
const editForm = ref({
  name: '',
  url: '',
  username: '',
  password: '',
  folderId: ''
})

// 右键菜单
const contextMenuOptions = ref<any[]>([])
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const showContextMenu = ref(false)
const contextMenuNode = ref<TreeNode | null>(null)

// 删除确认模态框
const showDeleteModal = ref(false)
const deleteTarget = ref<TreeNode | null>(null)

// 连接中模态框
const showConnectingModal = ref(false)
const connectingName = ref('')

// 活跃连接 ID 集合
const activeIds = computed(() => new Set(connectionStore.activeConnectionList.map(a => a.connection.id)))

// 从数据库加载数据
async function loadData() {
  loading.value = true
  try {
    const items = await getTreeData()
    if (items && items.length > 0) {
      // Reconstruct tree from flat data
      const nodeMap = new Map<string, TreeNode>()
      const rootNodes: TreeNode[] = []

      // First pass: create all nodes
      for (const item of items) {
        const data = JSON.parse(item.data)
        if (item.type === 'folder') {
          nodeMap.set(item.id, { ...data, id: item.id, type: 'folder', children: [] })
        } else {
          nodeMap.set(item.id, { ...data, id: item.id, type: 'connection' })
        }
      }

      // Second pass: build tree structure
      for (const item of items) {
        const node = nodeMap.get(item.id)
        if (node) {
          if (item.parent_id) {
            const parent = nodeMap.get(item.parent_id) as Folder
            if (parent && parent.type === 'folder') {
              parent.children.push(node)
            }
          } else {
            rootNodes.push(node)
          }
        }
      }

      treeData.value = rootNodes
    }

    // 从 treeData 生成 treeOptions
    treeOptions.value = treeData.value.map(toTreeOption)
  } catch (e) {
    console.error('Failed to load tree data:', e)
  } finally {
    loading.value = false
  }
}

// 保存数据到数据库
async function saveData() {
  try {
    // Flatten tree to array
    const items: Array<{ id: string; parent_id: string | null; type: string; data: string; sort_order: number }> = []

    function flatten(nodes: TreeNode[], parentId: string | null = null, order: number = 0): number {
      for (const node of nodes) {
        const itemData = { ...node }
        if (node.type === 'folder') {
          delete (itemData as any).children
        }
        items.push({
          id: node.id,
          parent_id: parentId,
          type: node.type,
          data: JSON.stringify(itemData),
          sort_order: order++
        })
        if (node.type === 'folder' && node.children) {
          order = flatten(node.children, node.id, order)
        }
      }
      return order
    }

    flatten(treeData.value)
    await saveTreeData(items)
  } catch (e) {
    console.error('Failed to save tree data:', e)
  }
}

// 转换为 TreeOption 格式
function toTreeOption(node: TreeNode): TreeOption {
  if (node.type === 'folder') {
    return {
      key: node.id,
      label: node.name,
      prefix: () => h(NIcon, null, {
        default: () => h(expandedKeys.value.includes(node.id) ? FolderOpenOutline : FolderOutline)
      }),
      children: (node.children || []).map(toTreeOption),
      data: node
    } as unknown as TreeOption
  } else {
    return {
      key: node.id,
      label: node.name,
      prefix: () => h(NIcon, {
        size: 14,
        color: activeIds.value.has(node.id) ? '#63e2b7' : undefined
      }, {
        default: () => h(ServerOutline)
      }),
      data: node
    } as unknown as TreeOption
  }
}

const treeOptions = ref<TreeOption[]>([])

// 过滤树
const filteredTreeOptions = computed(() => {
  if (!searchValue.value) return treeOptions.value
  return filterTree(treeOptions.value, searchValue.value.toLowerCase())
})

function filterTree(options: TreeOption[], keyword: string): TreeOption[] {
  return options.filter(opt => {
    // label 可能是字符串或函数，需要从 data 中获取名称
    const nodeName = (opt.data as TreeNode)?.name || ''
    const match = nodeName.toLowerCase().includes(keyword)
    if (opt.children && opt.children.length > 0) {
      const filteredChildren = filterTree(opt.children, keyword)
      if (filteredChildren.length > 0) {
        return true
      }
    }
    return match
  })
}

// 查找节点
function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.type === 'folder' && node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

// 查找父节点
function findParent(nodes: TreeNode[], id: string): { list: TreeNode[], index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return { list: nodes, index: i }
    }
    if (nodes[i].type === 'folder') {
      const folder = nodes[i] as Folder
      if (folder.children) {
        const found = findParent(folder.children, id)
        if (found) return found
      }
    }
  }
  return null
}

// 生成唯一 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 新建文件夹
function createFolder(parentId?: string) {
  // 如果没有传入 parentId，检查当前选中的节点
  if (!parentId && selectedKeys.value.length > 0) {
    const selectedNode = findNode(treeData.value, selectedKeys.value[0])
    if (selectedNode?.type === 'folder') {
      parentId = selectedNode.id
    }
  }

  // 标记为新建模式
  isNewItem.value = true
  newItemParentId.value = parentId
  editingItem.value = null

  editForm.value = { name: '新建文件夹', url: '', username: '', password: '', folderId: parentId || '' }
  showEditModal.value = true
}

// 新建连接
function createConnection(parentId?: string) {
  // 如果没有传入 parentId，检查当前选中的节点
  if (!parentId && selectedKeys.value.length > 0) {
    const selectedNode = findNode(treeData.value, selectedKeys.value[0])
    if (selectedNode?.type === 'folder') {
      parentId = selectedNode.id
    }
  }

  // 标记为新建模式
  isNewItem.value = true
  newItemParentId.value = parentId
  editingItem.value = null

  editForm.value = { name: '新连接', url: 'localhost:9200', username: '', password: '', folderId: parentId || '' }
  showEditModal.value = true
}

// 保存编辑
function saveEdit() {
  if (!editForm.value.name) {
    message.warning('请输入名称')
    return
  }

  if (isNewItem.value) {
    // 新建模式
    if (editingItem.value === null && !editForm.value.url) {
      // 新建文件夹
      const folder: Folder = {
        id: generateId(),
        name: editForm.value.name,
        type: 'folder',
        children: [],
        expanded: true
      }

      const parentId = newItemParentId.value
      if (parentId) {
        const parent = findNode(treeData.value, parentId) as Folder
        if (parent && parent.type === 'folder') {
          parent.children.push(folder)
          expandedKeys.value.push(parentId)
        }
      } else {
        treeData.value.push(folder)
      }
      expandedKeys.value.push(folder.id)
    } else {
      // 新建连接
      const conn: ConnectionItem = {
        id: generateId(),
        name: editForm.value.name,
        type: 'connection',
        url: editForm.value.url.startsWith('http') ? editForm.value.url : `http://${editForm.value.url}`,
        username: editForm.value.username || undefined,
        password: editForm.value.password || undefined,
        folderId: newItemParentId.value,
        created_at: Date.now(),
        updated_at: Date.now()
      }

      const parentId = newItemParentId.value
      if (parentId) {
        const parent = findNode(treeData.value, parentId) as Folder
        if (parent && parent.type === 'folder') {
          parent.children.push(conn)
          expandedKeys.value.push(parentId)
        }
      } else {
        treeData.value.push(conn)
      }
    }
  } else if (editingItem.value) {
    // 编辑模式
    if (editingItem.value.type === 'folder') {
      (editingItem.value as Folder).name = editForm.value.name
    } else {
      const conn = editingItem.value as ConnectionItem
      conn.name = editForm.value.name
      conn.url = editForm.value.url.startsWith('http') ? editForm.value.url : `http://${editForm.value.url}`
      conn.username = editForm.value.username || undefined
      conn.password = editForm.value.password || undefined
      conn.updated_at = Date.now()
    }
  }

  saveData()
  updateTreeOptions()
  showEditModal.value = false
  editingItem.value = null
  isNewItem.value = false
  newItemParentId.value = undefined
}

// 取消编辑
function cancelEdit() {
  showEditModal.value = false
  editingItem.value = null
  isNewItem.value = false
  newItemParentId.value = undefined
}

// 删除节点
function deleteNode(node: TreeNode) {
  deleteTarget.value = node
  showDeleteModal.value = true
}

// 确认删除
function confirmDelete() {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id
  const found = findParent(treeData.value, id)
  if (found) {
    found.list.splice(found.index, 1)
    saveData()
    updateTreeOptions()
    // 如果是连接且已连接，断开
    if (connectionStore.isActive(id)) {
      connectionStore.removeActiveConnection(id)
    }
  }
  showDeleteModal.value = false
  deleteTarget.value = null
}

// 取消删除
function cancelDelete() {
  showDeleteModal.value = false
  deleteTarget.value = null
}

// 连接到集群
async function connect(conn: ConnectionItem) {
  connectingId.value = conn.id
  connectingName.value = conn.name
  showConnectingModal.value = true

  const connection: Connection = {
    id: conn.id,
    name: conn.name,
    url: conn.url,
    username: conn.username,
    password: conn.password,
    created_at: conn.created_at,
    updated_at: conn.updated_at
  }

  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const info = await client.getInfo()
    conn.version = info.version?.number
    connection.version = conn.version

    const active = connectionStore.addActiveConnection(connection)

    const [nodes, indices] = await Promise.all([
      client.getNodes().catch(() => []),
      client.getIndices().catch(() => [])
    ])
    active.nodes = nodes
    active.indices = indices.sort((a: any, b: any) => a.index.localeCompare(b.index))

    message.success(`已连接到 ${conn.name}`)
    // 连接成功后隐藏左侧树
    connectionStore.toggleSideTree()
  } catch (e: any) {
    if (connectingId.value === conn.id) {
      message.error(`连接失败: ${e.message}`)
    }
  } finally {
    connectingId.value = null
    showConnectingModal.value = false
  }
}

// 取消连接
function cancelConnect() {
  connectingId.value = null
  showConnectingModal.value = false
  message.warning('已取消连接')
}

// 断开连接
function disconnect(id: string) {
  connectionStore.removeActiveConnection(id)
  message.success('已断开连接')
}

// 节点属性
function nodeProps({ option }: { option: TreeOption }) {
  return {
    onClick() {
      const node = option.data as TreeNode
      if (node?.type === 'folder') {
        selectedKeys.value = [option.key as string]
      } else if (node) {
        if (activeIds.value.has(node.id)) {
          connectionStore.setCurrentConnection(node.id)
        }
      }
    },
    onDblclick() {
      const node = option.data as TreeNode
      if (node?.type === 'connection') {
        const conn = node as ConnectionItem
        if (activeIds.value.has(node.id)) {
          connectionStore.setCurrentConnection(node.id)
        } else {
          connect(conn)
        }
      }
    },
    onContextmenu(e: MouseEvent) {
      e.preventDefault()
      const node = option.data as TreeNode
      if (!node) return

      contextMenuNode.value = node
      contextMenuX.value = e.clientX
      contextMenuY.value = e.clientY

      if (node.type === 'folder') {
        contextMenuOptions.value = [
          { label: '新建文件夹', key: 'new-folder', icon: () => h(NIcon, null, { default: () => h(FolderOutline) }) },
          { label: '新建连接', key: 'new-connection', icon: () => h(NIcon, null, { default: () => h(ServerOutline) }) },
          { type: 'divider', key: 'd1' },
          { label: '重命名', key: 'rename', icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
          { label: '删除', key: 'delete', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) }
        ]
      } else {
        const isActive = activeIds.value.has(node.id)
        contextMenuOptions.value = [
          isActive
            ? { label: '断开连接', key: 'disconnect', icon: () => h(NIcon, null, { default: () => h(UnlinkOutline) }) }
            : { label: '连接', key: 'connect', icon: () => h(NIcon, null, { default: () => h(LinkOutline) }) },
          { type: 'divider', key: 'd1' },
          { label: '编辑', key: 'edit', icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
          { label: '删除', key: 'delete', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) }
        ]
      }
      showContextMenu.value = true
    }
  }
}

// 处理右键菜单选择
function handleContextMenuSelect(key: string) {
  showContextMenu.value = false
  if (!contextMenuNode.value) return

  const node = contextMenuNode.value

  switch (key) {
    case 'new-folder':
      createFolder(node.id)
      break
    case 'new-connection':
      createConnection(node.id)
      break
    case 'rename':
    case 'edit':
      // 编辑模式
      isNewItem.value = false
      editingItem.value = node
      if (node.type === 'folder') {
        editForm.value = { name: node.name, url: '', username: '', password: '', folderId: '' }
      } else {
        const conn = node as ConnectionItem
        editForm.value = {
          name: conn.name,
          url: conn.url,
          username: conn.username || '',
          password: conn.password || '',
          folderId: conn.folderId || ''
        }
      }
      showEditModal.value = true
      break
    case 'delete':
      deleteNode(node)
      break
    case 'connect':
      connect(node as ConnectionItem)
      break
    case 'disconnect':
      disconnect(node.id)
      break
  }

  contextMenuNode.value = null
}

// 处理展开
function handleExpand(keys: string[]) {
  expandedKeys.value = keys
  saveData()
}

// 处理搜索
function handleSearch(value: string) {
  searchValue.value = value
}

// 更新树选项（当连接状态变化时调用）
function updateTreeOptions() {
  treeOptions.value = treeData.value.map(toTreeOption)
}

// 监听连接状态变化，更新树图标
watch(connectingId, () => {
  updateTreeOptions()
})

// 监听活跃连接变化，更新树图标
watch(activeIds, () => {
  updateTreeOptions()
}, { deep: true })

// 暴露方法
defineExpose({
  loadData
})

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="side-tree">
    <!-- 工具栏 -->
    <div class="tree-toolbar">
      <n-input
        :value="searchValue"
        placeholder="搜索..."
        size="small"
        clearable
        @update:value="handleSearch"
      />
      <div class="toolbar-buttons">
        <n-button size="small" quaternary @click="createConnection()" title="新增集群">
          <n-icon :component="AddOutline" :size="16" />
        </n-button>
        <n-button size="small" quaternary @click="createFolder()" title="新增文件夹">
          <n-icon :component="FolderOutline" :size="16" />
        </n-button>
      </div>
    </div>

    <!-- 树 -->
    <div class="tree-content">
      <n-spin :show="loading">
        <n-tree
          :data="filteredTreeOptions"
          :expanded-keys="expandedKeys"
          block-line
          :node-props="nodeProps"
          @update:expanded-keys="handleExpand"
          class="ellipsis-tree"
        >
          <template #empty>
            <n-empty description="暂无连接" size="small" />
          </template>
        </n-tree>
      </n-spin>
    </div>

    <!-- 右键菜单 -->
    <n-dropdown
      trigger="manual"
      placement="bottom-start"
      :show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :options="contextMenuOptions"
      @select="handleContextMenuSelect"
      @clickoutside="showContextMenu = false"
    />

    <!-- 编辑模态框 -->
    <n-modal
      v-model:show="showEditModal"
      preset="card"
      :title="isNewItem ? (editingItem === null && !editForm.url ? '新建文件夹' : '新建连接') : (editingItem?.type === 'folder' ? '编辑文件夹' : '编辑连接')"
      style="width: 450px"
      :bordered="false"
      size="small"
    >
      <n-form label-placement="left" label-width="auto" :show-feedback="false">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="editForm.name" placeholder="名称" size="small" />
        </n-form-item>
        <!-- 只有新建连接或编辑连接时才显示 URL 等字段 -->
        <template v-if="(!isNewItem && editingItem?.type === 'connection') || (isNewItem && editForm.url)">
          <n-form-item label="URL" path="url">
            <n-input v-model:value="editForm.url" placeholder="localhost:9200" size="small" />
          </n-form-item>
          <n-form-item label="用户名" path="username">
            <n-input v-model:value="editForm.username" placeholder="可选" size="small" />
          </n-form-item>
          <n-form-item label="密码" path="password">
            <n-input
              v-model:value="editForm.password"
              type="password"
              show-password-on="click"
              placeholder="可选"
              size="small"
            />
          </n-form-item>
        </template>
      </n-form>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button size="small" @click="cancelEdit">取消</n-button>
          <n-button type="primary" size="small" @click="saveEdit">保存</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 删除确认模态框 -->
    <n-modal
      v-model:show="showDeleteModal"
      preset="card"
      title="信息提示"
      style="width: 400px"
      :bordered="false"
      size="small"
    >
      <p>是否确认删除 <strong>{{ deleteTarget?.name }}</strong> ?</p>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button size="small" @click="cancelDelete">取消</n-button>
          <n-button type="error" size="small" @click="confirmDelete">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 连接中模态框 -->
    <n-modal
      v-model:show="showConnectingModal"
      preset="card"
      :mask-closable="false"
      :close-on-esc="false"
      :closable="false"
      :bordered="false"
      style="width: 400px"
      size="small"
    >
      <div style="display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 16px;">
        <n-spin size="medium" />
        <span>正在连接 {{ connectingName }}...</span>
        <n-button size="small" @click="cancelConnect">取消</n-button>
      </div>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.side-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #252525;
  -webkit-user-select: none;
  user-select: none;
}

.tree-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid #333;
}

.toolbar-buttons {
  display: flex;
  gap: 4px;
}

.tree-content {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

// 树节点文字溢出样式
.ellipsis-tree {
  :deep(.n-tree-node-content__text) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.tree-label {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 160px;
  overflow: hidden;

  &.active {
    .label-name {
      color: #63e2b7;
    }
  }

  &.current {
    .label-name {
      font-weight: 500;
    }
  }
}

.label-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: block;
}

// 浅色主题
:root[data-theme='light'] {
  .side-tree {
    background-color: #fff;
  }

  .tree-toolbar {
    border-bottom-color: #e0e0e0;
  }

  .tree-label.active .label-name {
    color: #18a058;
  }
}
</style>