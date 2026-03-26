<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { NDrawer, NDrawerContent, NDataTable, NButton, NIcon, NInput, NEmpty, NTag, NPagination, NSelect, useMessage, useDialog } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { TrashOutline, CopyOutline, SearchOutline, CloseOutline } from '@vicons/ionicons5'
import { getHistory, deleteHistoryItem, clearHistory, type History } from '@/api/elastic'

const message = useMessage()
const dialog = useDialog()

const showModal = ref(false)
const loading = ref(false)
const historyData = ref<History[]>([])
const searchText = ref('')

// 分页
const currentPage = ref(1)
const pageSize = ref(10)

// 每页条数选项
const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 },
  { label: '100 条/页', value: 100 }
]

// 总页数
const pageCount = computed(() => Math.ceil(filteredHistory.value.length / pageSize.value))

// 过滤后的历史记录（按时间倒序）
const filteredHistory = computed(() => {
  let data = [...historyData.value]

  // 搜索过滤
  if (searchText.value) {
    const search = searchText.value.toLowerCase()
    data = data.filter(item =>
      item.curl.toLowerCase().includes(search) ||
      item.connection_name.toLowerCase().includes(search)
    )
  }

  // 按时间倒序排列
  data.sort((a, b) => b.start_time - a.start_time)

  return data
})

// 分页后的数据
const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredHistory.value.slice(start, end)
})

// 重置分页
function resetPage() {
  currentPage.value = 1
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化耗时
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// 复制 curl
async function copyCurl(curl: string) {
  try {
    await navigator.clipboard.writeText(curl)
    message.success('复制成功')
  } catch {
    message.error('复制失败')
  }
}

// 删除单条记录
async function handleDelete(id: string) {
  dialog.warning({
    title: '信息提示',
    content: '是否确认删除该记录？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteHistoryItem(id)
        historyData.value = historyData.value.filter(item => item.id !== id)
        message.success('删除成功')
      } catch {
        message.error('删除失败')
      }
    }
  })
}

// 清空所有记录
function handleClear() {
  dialog.warning({
    title: '信息提示',
    content: '是否确认清空所有历史记录？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await clearHistory()
        historyData.value = []
        message.success('清空成功')
      } catch {
        message.error('清空失败')
      }
    }
  })
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    historyData.value = await getHistory()
  } catch {
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

// 打开弹窗
function open() {
  showModal.value = true
  loadData()
}

// 表格列
const columns: DataTableColumns<History> = [
  {
    title: '时间',
    key: 'start_time',
    width: 160,
    render(row) {
      return formatTime(row.start_time)
    }
  },
  {
    title: '集群',
    key: 'connection_name',
    width: 120,
    ellipsis: { tooltip: true }
  },
  {
    title: '请求内容',
    key: 'curl',
    ellipsis: { tooltip: true }
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
    align: 'center',
    render(row) {
      return row.status === 'success'
        ? h(NTag, { type: 'success', size: 'small' }, { default: () => '成功' })
        : h(NTag, { type: 'error', size: 'small' }, { default: () => '失败' })
    }
  },
  {
    title: '耗时',
    key: 'duration',
    width: 80,
    align: 'right',
    render(row) {
      return formatDuration(row.duration)
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    align: 'center',
    render(row) {
      return h('div', { class: 'action-buttons' }, [
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          onClick: () => copyCurl(row.curl)
        }, {
          default: () => h(NIcon, { size: 14 }, { default: () => h(CopyOutline) })
        }),
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          type: 'error',
          onClick: () => handleDelete(row.id)
        }, {
          default: () => h(NIcon, { size: 14 }, { default: () => h(TrashOutline) })
        })
      ])
    }
  }
]

defineExpose({
  open
})
</script>

<template>
  <n-drawer
    v-model:show="showModal"
    placement="bottom"
    :height="'50%'"
    class="history-drawer"
  >
    <n-drawer-content :bordered="false">
      <template #header>
        <div class="drawer-header">
          <span>历史记录</span>
          <n-button quaternary size="small" @click="showModal = false">
            <template #icon>
              <n-icon :component="CloseOutline" />
            </template>
          </n-button>
        </div>
      </template>
      <div class="history-header">
        <n-input
          v-model:value="searchText"
          placeholder="搜索请求内容或集群名称"
          clearable
          size="small"
          style="width: 240px"
          @update:value="resetPage"
        >
          <template #prefix>
            <n-icon :component="SearchOutline" />
          </template>
        </n-input>
        <n-button size="small" type="error" :disabled="historyData.length === 0" @click="handleClear">
            <template #icon>
              <n-icon :component="TrashOutline" />
            </template>
            清空
          </n-button>
      </div>

      <n-data-table
        :columns="columns"
        :data="paginatedHistory"
        :loading="loading"
        :bordered="false"
        size="small"
        :max-height="'calc(50vh - 210px)'"
      />

      <div class="card-footer">
        <span class="total-count">共 {{ filteredHistory.length }} 条</span>
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

      <n-empty v-if="!loading && historyData.length === 0" description="暂无历史记录" />
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
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
</style>