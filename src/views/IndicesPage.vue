<script setup lang="ts">
import { computed, ref, h } from 'vue'
import {
  NCard, NButton, NIcon, NInput, NDataTable, NSelect, NPagination,
  NDropdown, useMessage, useDialog
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import {
  Refresh, InformationCircleOutline, StatsChartOutline,
  GridOutline, SyncOutline, ColorFillOutline,
  TrashOutline, LockClosedOutline, LockOpenOutline, SettingsOutline
} from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { useSettingsStore } from '@/store/modules/settings'
import { ElasticClient } from '@/api/elastic'
import ShardsModal from '@/components/ShardsModal.vue'
import JsonPreviewModal from '@/components/JsonPreviewModal.vue'
import IndexDetailModal from './index/IndexDetailModal.vue'

const connectionStore = useConnectionStore()
const settingsStore = useSettingsStore()
const message = useMessage()
const dialog = useDialog()

interface IndexInfo {
  index: string
  health: string
  status: string
  pri: string
  rep: string
  'docs.count': string
  tm: string
  'store.size': string
  'memory.total': string
  'creation.date': string
}

const loading = ref(false)
const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const selectedIndex = ref<string | null>(null)

const shardsModalRef = ref<InstanceType<typeof ShardsModal> | null>(null)
const jsonPreviewRef = ref<InstanceType<typeof JsonPreviewModal> | null>(null)
const indexDetailRef = ref<InstanceType<typeof IndexDetailModal> | null>(null)

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 从 connectionStore 获取索引数据（已在 SidePanel 中排序）
const indicesData = computed(() => {
  const active = currentActive.value
  if (!active) return []
  return active.indices as IndexInfo[]
})

// 每页条数选项
const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 },
  { label: '100 条/页', value: 100 }
]

// 刷新索引数据
async function refreshIndices() {
  const active = currentActive.value
  if (!active) return

  loading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const data = await client.getIndices()
    // 按索引名称排序
    const sortedData = data.sort((a, b) => a.index.localeCompare(b.index))
    connectionStore.updateConnectionData(conn.id, 'indices', sortedData)
  } catch (error) {
    console.error('Failed to load indices:', error)
    message.error('加载索引失败')
  } finally {
    loading.value = false
  }
}

// 过滤后的数据（排除系统索引 + 搜索过滤）
const filteredIndices = computed(() => {
  let data = indicesData.value

  // 排除指定模式的索引
  data = data.filter(item => !settingsStore.isIndexExcluded(item.index))

  // 搜索过滤
  if (searchText.value) {
    data = data.filter(item =>
      item.index.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }

  return data
})

// 分页后的数据
const paginatedIndices = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredIndices.value.slice(start, end)
})

// 总页数
const pageCount = computed(() => Math.ceil(filteredIndices.value.length / pageSize.value))

// 格式化日期 yyyy-MM-dd HH:mm:ss (支持时间戳毫秒)
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const timestamp = parseInt(dateStr)
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  } catch {
    return dateStr
  }
}

// 格式化数字
function formatNumber(value: string): string {
  const num = parseInt(value)
  return num > 0 ? num.toLocaleString() : '-'
}

// 健康状态颜色
function getHealthColor(health: string): string {
  switch (health) {
    case 'green': return '#22c55e'
    case 'yellow': return '#ff9800'
    case 'red': return '#f44336'
    default: return '#888'
  }
}

// 重置分页
function resetPage() {
  currentPage.value = 1
}

// 渲染图标
function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

// 获取操作选项
function getActionOptions(status: string) {
  const openOptions = [
    { label: '查看信息', key: 'info', icon: renderIcon(InformationCircleOutline) },
    { label: '查看状态', key: 'stats', icon: renderIcon(StatsChartOutline) },
    { label: '查看分片', key: 'shards', icon: renderIcon(GridOutline) },
    { type: 'divider', key: 'd1' },
    { label: '刷新索引', key: 'refresh', icon: renderIcon(SyncOutline) },
    { label: 'Flush索引', key: 'flush', icon: renderIcon(ColorFillOutline) },
    { label: '清理缓存', key: 'clearCache', icon: renderIcon(TrashOutline) },
    { type: 'divider', key: 'd2' },
    { label: '关闭索引', key: 'close', icon: renderIcon(LockClosedOutline) },
    { label: '删除索引', key: 'delete', icon: renderIcon(TrashOutline) }
  ]

  const closedOptions = [
    { label: '查看信息', key: 'info', icon: renderIcon(InformationCircleOutline) },
    { label: '查看状态', key: 'stats', icon: renderIcon(StatsChartOutline) },
    { type: 'divider', key: 'd1' },
    { label: '打开索引', key: 'open', icon: renderIcon(LockOpenOutline) },
    { label: '删除索引', key: 'delete', icon: renderIcon(TrashOutline) }
  ]

  return status === 'close' ? closedOptions : openOptions
}

// 获取客户端
function getClient() {
  const active = currentActive.value
  if (!active) return null
  const conn = active.connection
  return new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)
}

// 查看分片
function viewShards(index: string) {
  shardsModalRef.value?.openWithApi(index)
}

// 确认操作
function confirmAction(content: string, onConfirm: () => void) {
  dialog.info({
    title: '信息提示',
    content,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: onConfirm
  })
}

// 执行操作
async function handleAction(key: string, row: IndexInfo) {
  const client = getClient()
  if (!client) return

  const index = row.index

  try {
    switch (key) {
      case 'info':
        selectedIndex.value = index
        indexDetailRef.value?.open()
        break
      case 'stats':
        const stats = await client.getIndexStats(index)
        jsonPreviewRef.value?.open(`索引状态 - ${index}`, stats)
        break
      case 'shards':
        viewShards(index)
        break
      case 'refresh':
        confirmAction(`是否确认刷新索引 "${index}"？`, async () => {
          await client.refreshIndex(index)
          message.success('刷新索引成功')
          refreshIndices()
        })
        break
      case 'flush':
        confirmAction(`是否确认Flush索引 "${index}"？`, async () => {
          await client.flushIndex(index)
          message.success('Flush索引成功')
        })
        break
      case 'clearCache':
        confirmAction(`是否确认清理索引 "${index}" 的缓存？`, async () => {
          await client.clearIndexCache(index)
          message.success('清理缓存成功')
        })
        break
      case 'close':
        confirmAction(`是否确认关闭索引 "${index}"？`, async () => {
          await client.closeIndex(index)
          message.success('关闭索引成功')
          refreshIndices()
        })
        break
      case 'open':
        confirmAction(`是否确认打开索引 "${index}"？`, async () => {
          await client.openIndex(index)
          message.success('打开索引成功')
          refreshIndices()
        })
        break
      case 'delete':
        dialog.error({
          title: '信息提示',
          content: `是否确认删除索引 "${index}"？此操作不可恢复！`,
          positiveText: '删除',
          negativeText: '取消',
          onPositiveClick: async () => {
            await client.deleteIndex(index)
            message.success('删除索引成功')
            refreshIndices()
          }
        })
        break
    }
  } catch (error: any) {
    console.error(`Action ${key} failed:`, error)
    message.error(`操作失败: ${error.message || '未知错误'}`)
  }
}

// 表格列定义
const columns: DataTableColumns<IndexInfo> = [
  {
    title: '名称',
    key: 'index',
    width: 300,
    ellipsis: { tooltip: true }
  },
  {
    title: '状态',
    key: 'status',
    width: 50,
    align: 'center',
    render(row) {
      if (row.status === 'close') {
        return h('div', { style: { display: 'flex', justifyContent: 'center' } }, [
          h(NIcon, { size: 16, color: '#888' }, { default: () => h(LockClosedOutline) })
        ])
      }
      const color = getHealthColor(row.health)
      return h('div', {
        style: {
          display: 'flex',
          justifyContent: 'center',
          width: '100%'
        }
      }, [
        h('div', {
          style: {
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: color
          }
        })
      ])
    }
  },
  {
    title: '分片',
    key: 'shards',
    width: 60,
    align: 'center',
    render(row) {
      return `${row.pri}/${row.rep}`
    }
  },
  {
    title: '文档数',
    key: 'docs.count',
    width: 80,
    align: 'center',
    render(row) {
      return formatNumber(row['docs.count'])
    }
  },
  {
    title: '存储空间',
    key: 'store.size',
    width: 70,
    align: 'center',
    render(row) {
      return row['store.size'] || '-'
    }
  },
  {
    title: '占用内存',
    key: 'memory.total',
    width: 70,
    align: 'center',
    render(row) {
      return row['memory.total'] || '-'
    }
  },
  {
    title: '创建时间',
    key: 'creation.date',
    width: 140,
    align: 'center',
    render(row) {
      return formatDate(row['creation.date'])
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 50,
    align: 'center',
    fixed: 'right',
    render(row) {
      return h(NDropdown, {
        trigger: 'click',
        options: getActionOptions(row.status),
        onSelect: (key: string) => handleAction(key, row)
      }, {
        default: () => h(NButton, { size: 'small', quaternary: true }, {
          default: () => h(NIcon, { size: 16 }, { default: () => h(SettingsOutline) })
        })
      })
    }
  }
]
</script>

<template>
  <div class="indices-page">
    <n-card class="indices-card" size="small">
      <template #header>
        <div class="card-header">
          <span>索引</span>
          <div class="header-actions">
            <n-button size="small" quaternary :loading="loading" @click="refreshIndices">
              <template #icon>
                <n-icon :component="Refresh" />
              </template>
            </n-button>
            <n-input
              v-model:value="searchText"
              placeholder="索引名称"
              clearable
              size="small"
              style="width: 200px"
              @update:value="resetPage"
            />
          </div>
        </div>
      </template>

      <n-data-table
        :columns="columns"
        :data="paginatedIndices"
        max-height="calc(100vh - 295px)"
        :scroll-x="1500"
        striped
        bordered
        size="small"
      />

      <template #footer>
        <div class="card-footer">
          <span class="total-count">共 {{ filteredIndices.length }} 条</span>
          <n-select
            v-model:value="pageSize"
            :options="pageSizeOptions"
            size="small"
            style="width: 100px"
            @update:value="resetPage"
          />
          <n-pagination
            v-model:page="currentPage"
            :page-count="pageCount"
            size="small"
          />
        </div>
      </template>
    </n-card>

    <ShardsModal ref="shardsModalRef" />
    <JsonPreviewModal ref="jsonPreviewRef" />
    <IndexDetailModal ref="indexDetailRef" :index-name="selectedIndex || ''" @refresh="refreshIndices" />
  </div>
</template>

<style scoped lang="scss">
.indices-page {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.indices-card {
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

:deep(.n-data-table-wrapper) {
  flex: 1;
  overflow: hidden;
}

:deep(.n-data-table) {
  height: 100% !important;

  .n-data-table-th {
    font-weight: 500;
    text-align: center;
  }

  .n-data-table-td {
    padding: 8px 12px;
    vertical-align: middle;
  }
}

// 浅色主题
:root[data-theme='light'] {
  .indices-card {
    :deep(.n-card__footer) {
      border-top-color: #e0e0e0;
    }
  }
}
</style>