<script setup lang="ts">
import { ref, computed, h } from 'vue'
import {
  NButton, NIcon, NEmpty, NDataTable, NModal, NForm, NFormItem, NInput,
  useMessage, useDialog
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { AddOutline, TrashOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { ElasticClient } from '@/api/elastic'

const props = defineProps<{
  indexName: string
  aliases: any[]
}>()

const emit = defineEmits<{
  refresh: []
}>()

const connectionStore = useConnectionStore()
const message = useMessage()
const dialog = useDialog()

// 添加别名弹窗
const showAddAliasModal = ref(false)
const newAliasForm = ref({
  name: '',
  filter: '',
  routing: ''
})

interface AliasInfo {
  alias: string
  index: string
  filter?: any
  routing?: string
  is_write_index?: boolean
}

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 添加别名
async function addAlias() {
  if (!newAliasForm.value.name) {
    message.warning('请输入别名名称')
    return
  }

  const active = currentActive.value
  if (!active) return

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  const body: any = {}
  if (newAliasForm.value.filter) {
    try {
      body.filter = JSON.parse(newAliasForm.value.filter)
    } catch {
      message.error('过滤条件 JSON 格式错误')
      return
    }
  }
  if (newAliasForm.value.routing) {
    body.routing = newAliasForm.value.routing
  }

  try {
    await client.execute('PUT', `/${props.indexName}/_alias/${newAliasForm.value.name}`, body)
    message.success('添加别名成功')
    showAddAliasModal.value = false
    emit('refresh')
  } catch (error: any) {
    message.error(`添加别名失败: ${error.message}`)
  }
}

// 删除别名
function confirmDeleteAlias(alias: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除别名 "${alias}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const active = currentActive.value
      if (!active) return

      const conn = active.connection
      const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

      try {
        await client.execute('DELETE', `/${props.indexName}/_alias/${alias}`)
        message.success('删除别名成功')
        emit('refresh')
      } catch (error: any) {
        message.error(`删除别名失败: ${error.message}`)
      }
    }
  })
}

// 打开添加别名弹窗
function openAddAliasModal() {
  newAliasForm.value = {
    name: '',
    filter: '',
    routing: ''
  }
  showAddAliasModal.value = true
}

// 表格列
const columns: DataTableColumns<AliasInfo> = [
  {
    title: '别名',
    key: 'alias',
    width: 200
  },
  {
    title: '索引',
    key: 'index',
    width: 200
  },
  {
    title: '路由',
    key: 'routing',
    width: 150,
    render(row) {
      return row.routing || '-'
    }
  },
  {
    title: '写入索引',
    key: 'is_write_index',
    width: 100,
    align: 'center',
    render(row) {
      return row.is_write_index ? '是' : '否'
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    align: 'center',
    render(row) {
      return h(NButton, {
        size: 'tiny',
        quaternary: true,
        type: 'error',
        onClick: () => confirmDeleteAlias(row.alias)
      }, {
        default: () => h(NIcon, { size: 14 }, { default: () => h(TrashOutline) })
      })
    }
  }
]
</script>

<template>
  <div class="aliases-tab">
    <div class="tab-toolbar">
      <div class="toolbar-left"></div>
      <div class="toolbar-right">
        <n-button size="small" type="primary" @click="openAddAliasModal">
          <template #icon>
            <n-icon :component="AddOutline" />
          </template>
          添加别名
        </n-button>
      </div>
    </div>

    <div class="tab-content">
      <n-data-table
        v-if="aliases.length > 0"
        :columns="columns"
        :data="aliases"
        :bordered="false"
        size="small"
        max-height="calc(100vh - 350px)"
      />
      <n-empty v-else description="暂无别名" />
    </div>

    <!-- 添加别名弹窗 -->
    <n-modal
      v-model:show="showAddAliasModal"
      preset="dialog"
      title="添加别名"
      positive-text="添加"
      negative-text="取消"
      @positive-click="addAlias"
    >
      <n-form label-placement="left" label-width="100px">
        <n-form-item label="别名名称" required>
          <n-input v-model:value="newAliasForm.name" placeholder="alias_name" />
        </n-form-item>
        <n-form-item label="路由">
          <n-input v-model:value="newAliasForm.routing" placeholder="可选" />
        </n-form-item>
        <n-form-item label="过滤条件">
          <n-input
            v-model:value="newAliasForm.filter"
            type="textarea"
            placeholder='{"term": {"status": "active"}}'
            :rows="3"
          />
        </n-form-item>
      </n-form>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.aliases-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tab-content {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}

:root[data-theme='light'] {
  .tab-toolbar {
    border-bottom-color: #e0e0e0;
  }
}
</style>