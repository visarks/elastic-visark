<script setup lang="ts">
import { h, ref, computed } from 'vue'
import {
  NDataTable, NButton, NIcon, NPagination, NSpace, NModal, NCode
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { CopyOutline, ExpandOutline } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'

const props = defineProps<{
  hits: any[]
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'update:page-size', size: number): void
}>()

const message = useMessage()

// 详情弹窗
const showDetailModal = ref(false)
const detailData = ref<any>(null)

// 表格列 - 动态从结果中提取
const columns = computed<DataTableColumns<any>>(() => {
  if (props.hits.length === 0) return []

  // 提取所有字段
  const allFields = new Set<string>()
  props.hits.forEach(hit => {
    if (hit._source) {
      Object.keys(hit._source).forEach(key => allFields.add(key))
    }
  })

  const cols: DataTableColumns<any> = [
    {
      title: '#',
      key: '_index',
      width: 50,
      render: (_, index) => (props.page - 1) * props.pageSize + index + 1
    },
    {
      title: '_id',
      key: '_id',
      width: 150,
      ellipsis: { tooltip: true },
      render: row => row._id
    }
  ]

  // 添加字段列
  Array.from(allFields).forEach(field => {
    cols.push({
      title: field,
      key: field,
      ellipsis: { tooltip: true },
      render: row => {
        const value = row._source?.[field]
        if (value === null || value === undefined) return '-'
        if (typeof value === 'object') {
          return JSON.stringify(value)
        }
        return String(value)
      }
    })
  })

  // 操作列
  cols.push({
    title: '',
    key: '_actions',
    width: 80,
    render: row => {
      return h(NSpace, { size: 'small' }, {
        default: () => [
          h(NButton, {
            size: 'tiny',
            quaternary: true,
            onClick: () => {
              detailData.value = row
              showDetailModal.value = true
            }
          }, {
            icon: () => h(NIcon, null, { default: () => h(ExpandOutline) })
          }),
          h(NButton, {
            size: 'tiny',
            quaternary: true,
            onClick: () => copyId(row._id)
          }, {
            icon: () => h(NIcon, null, { default: () => h(CopyOutline) })
          })
        ]
      })
    }
  })

  return cols
})

// 表格数据
const tableData = computed(() => props.hits)

function copyId(id: string) {
  navigator.clipboard.writeText(id)
  message.success('已复制 _id')
}

// 分页
function handlePageChange(page: number) {
  emit('update:page', page)
}

function handlePageSizeChange(size: number) {
  emit('update:page-size', size)
}
</script>

<template>
  <div class="result-table">
    <n-data-table
      :columns="columns"
      :data="tableData"
      :pagination="false"
      :bordered="false"
      size="small"
      max-height="calc(100% - 50px)"
    />

    <div class="pagination-wrapper">
      <n-pagination
        :page="page"
        :page-size="pageSize"
        :item-count="total"
        :page-sizes="[10, 20, 50, 100]"
        show-size-picker
        @update:page="handlePageChange"
        @update:page-size="handlePageSizeChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <n-modal v-model:show="showDetailModal" preset="card" title="文档详情" style="width: 800px">
      <n-code v-if="detailData" :code="JSON.stringify(detailData, null, 2)" language="json" />
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.result-table {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pagination-wrapper {
  padding: 12px 0;
  display: flex;
  justify-content: center;
  border-top: 1px solid #333;
}

// 浅色主题
:root[data-theme='light'] {
  .pagination-wrapper {
    border-top-color: #e0e0e0;
  }
}
</style>