<script setup lang="ts">
import { computed, ref, watch, onMounted, h } from 'vue'
import { NCard, NDataTable, NButton, NIcon, NProgress } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { Refresh, StarOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { useCacheStore } from '@/store/modules/cache'
import { ElasticClient } from '@/api/elastic'

const connectionStore = useConnectionStore()
const cacheStore = useCacheStore()

interface NodeInfo {
  name: string
  ip: string
  port: string
  version: string
  master: string
  'node.role': string
  load_1m: string
  load_5m: string
  load_15m: string
  cpu: string
  'ram.current': string
  'ram.percent': string
  'ram.max': string
  'heap.current': string
  'heap.percent': string
  'heap.max': string
  'disk.used': string
  'disk.total': string
  'disk.used_percent': string
}

const loading = ref(false)

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 从缓存获取节点数据
const nodeData = computed({
  get: () => {
    const connId = connectionStore.currentConnectionId
    if (!connId) return []
    return cacheStore.getClusterCache(connId).nodes as NodeInfo[]
  },
  set: (val) => {
    const connId = connectionStore.currentConnectionId
    if (connId) {
      cacheStore.updateCache(connId, { nodes: val })
    }
  }
})

// 加载节点数据
async function loadNodes() {
  const active = currentActive.value
  if (!active) return

  loading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const data = await client.getNodesDetailed()
    // Master 排在第一行
    nodeData.value = data.sort((a, b) => {
      if (a.master === '*') return -1
      if (b.master === '*') return 1
      return 0
    })
  } catch (error) {
    console.error('Failed to load nodes:', error)
  } finally {
    loading.value = false
  }
}

// 监听当前连接变化
watch(() => connectionStore.currentActiveConnection, (active) => {
  if (active) {
    // 如果缓存中有数据，不重新加载
    if (nodeData.value.length > 0) return
    loadNodes()
  }
}, { immediate: true })

// 组件挂载时也尝试加载数据
onMounted(() => {
  if (currentActive.value && nodeData.value.length === 0) {
    loadNodes()
  }
})

// 表格列定义
const columns: DataTableColumns<NodeInfo> = [
  {
    title: '名称',
    key: 'name',
    width: 160,
    fixed: 'left',
    align: 'center',
    render(row) {
      const isMaster = row.master === '*'
      return h('div', { class: 'node-name' }, [
        h('span', row.name),
        isMaster ? h(NIcon, { size: 12, color: '#4caf50', class: 'master-icon' }, { default: () => h(StarOutline) }) : null
      ])
    }
  },
  {
    title: '地址',
    key: 'address',
    width: 140,
    align: 'center',
    render(row) {
      return `${row.ip}:${row.port}`
    }
  },
  {
    title: '版本',
    key: 'version',
    width: 80,
    align: 'center'
  },
  {
    title: '节点角色',
    key: 'node.role',
    width: 100,
    align: 'center',
    render(row) {
      return row['node.role'] || '-'
    }
  },
  {
    title: '负载 (1m/5m/15m)',
    key: 'load',
    width: 150,
    align: 'center',
    render(row) {
      return `${row.load_1m || '0.00'}/${row.load_5m || '0.00'}/${row.load_15m || '0.00'}`
    }
  },
  {
    title: 'CPU',
    key: 'cpu',
    width: 120,
    sorter: (row1, row2) => {
      const cpu1 = parseFloat(row1.cpu) || 0
      const cpu2 = parseFloat(row2.cpu) || 0
      return cpu1 - cpu2
    },
    render(row) {
      const cpu = parseFloat(row.cpu) || 0
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' } }, [
        h('div', { style: { flex: '1', minWidth: '0' } }, [
          h(NProgress, {
            type: 'line',
            percentage: cpu,
            showIndicator: false,
            status: cpu > 85 ? 'error' : cpu > 70 ? 'warning' : 'success',
            height: 9
          })
        ]),
        h('span', { style: { fontSize: '12px', color: '#888', whiteSpace: 'nowrap', flexShrink: '0' } }, `${cpu.toFixed(0)}%`)
      ])
    }
  },
  {
    title: '内存',
    key: 'ram',
    width: 160,
    sorter: (row1, row2) => {
      const percent1 = parseFloat(row1['ram.percent']) || 0
      const percent2 = parseFloat(row2['ram.percent']) || 0
      return percent1 - percent2
    },
    render(row) {
      const percent = parseFloat(row['ram.percent']) || 0
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' } }, [
        h('div', { style: { fontSize: '12px', color: '#888' } }, `${row['ram.current'] || '-'}/${row['ram.max'] || '-'}`),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' } }, [
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            h(NProgress, {
              type: 'line',
              percentage: percent,
              showIndicator: false,
              status: percent > 85 ? 'error' : percent > 70 ? 'warning' : 'success',
              height: 9
            })
          ]),
          h('span', { style: { fontSize: '12px', color: '#888', whiteSpace: 'nowrap', flexShrink: '0' } }, `${percent.toFixed(0)}%`)
        ])
      ])
    }
  },
  {
    title: '堆内存',
    key: 'heap',
    width: 160,
    sorter: (row1, row2) => {
      const percent1 = parseFloat(row1['heap.percent']) || 0
      const percent2 = parseFloat(row2['heap.percent']) || 0
      return percent1 - percent2
    },
    render(row) {
      const percent = parseFloat(row['heap.percent']) || 0
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' } }, [
        h('div', { style: { fontSize: '12px', color: '#888' } }, `${row['heap.current'] || '-'}/${row['heap.max'] || '-'}`),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' } }, [
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            h(NProgress, {
              type: 'line',
              percentage: percent,
              showIndicator: false,
              status: percent > 85 ? 'error' : percent > 70 ? 'warning' : 'success',
              height: 9
            })
          ]),
          h('span', { style: { fontSize: '12px', color: '#888', whiteSpace: 'nowrap', flexShrink: '0' } }, `${percent.toFixed(0)}%`)
        ])
      ])
    }
  },
  {
    title: '磁盘',
    key: 'disk',
    width: 180,
    sorter: (row1, row2) => {
      const percent1 = parseFloat(row1['disk.used_percent']) || 0
      const percent2 = parseFloat(row2['disk.used_percent']) || 0
      return percent1 - percent2
    },
    render(row) {
      const percent = parseFloat(row['disk.used_percent']) || 0
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' } }, [
        h('div', { style: { fontSize: '12px', color: '#888' } }, `${row['disk.used'] || '-'}/${row['disk.total'] || '-'}`),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' } }, [
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            h(NProgress, {
              type: 'line',
              percentage: percent,
              showIndicator: false,
              status: percent > 85 ? 'error' : percent > 70 ? 'warning' : 'success',
              height: 9
            })
          ]),
          h('span', { style: { fontSize: '12px', color: '#888', whiteSpace: 'nowrap', flexShrink: '0' } }, `${percent.toFixed(1)}%`)
        ])
      ])
    }
  }
]
</script>

<template>
  <div class="nodes-page">
    <n-card class="nodes-card" size="small">
      <template #header>
        <div class="card-header">
          <span>节点列表</span>
          <n-button size="small" quaternary @click="loadNodes">
            <template #icon>
              <n-icon :component="Refresh" />
            </template>
          </n-button>
        </div>
      </template>

      <n-data-table
        :columns="columns"
        :data="nodeData"
        flex-height
        :scroll-x="1300"
        striped
        bordered
        size="small"
      />
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.nodes-page {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.nodes-card {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.n-card__content) {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.node-name {
  display: flex;
  align-items: center;
  gap: 4px;
}

.master-icon {
  flex-shrink: 0;
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
</style>