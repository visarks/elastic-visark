<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NDataTable, NTabs, NTabPane } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useConnectionStore } from '@/store/modules/connection'
import { ElasticClient } from '@/api/elastic'

interface ShardInfo {
  index: string
  shard: string
  prirep: 'p' | 'r'
  state: string
  docs: string
  store: string
  ip: string
  id: string
  node: string
  'unassigned.reason'?: string
}

const props = defineProps<{
  data?: ShardInfo[]
}>()

const connectionStore = useConnectionStore()

const showModal = ref(false)
const loading = ref(false)
const internalData = ref<ShardInfo[]>([])
const indexName = ref('')
const selectedTab = ref<'p' | 'r'>('p')
const selectedShardKey = ref<string | null>(null)

// 使用传入的数据或内部加载的数据
const shardsData = computed(() => props.data || internalData.value)

// 按主分片/副分片分组
const groupedShards = computed(() => {
  const primaries: ShardInfo[] = []
  const replicas: ShardInfo[] = []

  shardsData.value.forEach(shard => {
    if (shard.prirep === 'p') {
      primaries.push(shard)
    } else {
      replicas.push(shard)
    }
  })

  primaries.sort((a, b) => parseInt(a.shard) - parseInt(b.shard))
  replicas.sort((a, b) => parseInt(a.shard) - parseInt(b.shard))

  return { primaries, replicas }
})

// 分片状态是否正常
function isShardHealthy(state: string): boolean {
  return state === 'STARTED'
}

// 获取分片边框样式
function getShardBorderStyle(shard: ShardInfo): string {
  const healthy = isShardHealthy(shard.state)
  const color = healthy ? '#22c55e' : '#f44336'
  const style = shard.prirep === 'p' ? 'solid' : 'dashed'
  return `${style} 2px ${color}`
}

// 选择分片
function selectShard(shard: ShardInfo) {
  selectedTab.value = shard.prirep
  if (shard.prirep === 'p') {
    selectedShardKey.value = `${shard.shard}-p`
  } else {
    selectedShardKey.value = `${shard.shard}-r-${shard.node}`
  }
}

// 打开弹窗（传入数据）
function openWithData(index: string, data: ShardInfo[]) {
  indexName.value = index
  internalData.value = data
  selectedTab.value = 'p'
  selectedShardKey.value = null
  showModal.value = true
}

// 打开弹窗（通过API加载）
async function openWithApi(index: string) {
  const active = connectionStore.currentActiveConnection
  if (!active) return

  loading.value = true
  indexName.value = index
  selectedTab.value = 'p'
  selectedShardKey.value = null
  showModal.value = true

  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const data = await client.getIndexShards(index)
    internalData.value = data
  } catch (error) {
    console.error('Failed to load shards:', error)
  } finally {
    loading.value = false
  }
}

// 表格列定义
const shardTableColumns: DataTableColumns<ShardInfo> = [
  {
    title: '节点',
    key: 'node',
    width: 150,
    ellipsis: { tooltip: true },
    render(row) {
      return row.node || '-'
    }
  },
  {
    title: 'IP',
    key: 'ip',
    width: 130,
    render(row) {
      return row.ip || '-'
    }
  },
  {
    title: '数量',
    key: 'docs',
    width: 100,
    render(row) {
      const docs = parseInt(row.docs)
      return docs > 0 ? docs.toLocaleString() : '-'
    }
  },
  {
    title: '分片',
    key: 'shard',
    width: 80
  },
  {
    title: '存储',
    key: 'store',
    width: 100,
    render(row) {
      return row.store || '-'
    }
  },
  {
    title: '状态',
    key: 'state',
    width: 120
  }
]

// 暴露方法
defineExpose({
  openWithData,
  openWithApi
})
</script>

<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="`分片 (${indexName})`"
    style="width: 800px; max-height: 80vh"
    :bordered="false"
  >
    <div v-if="!loading" class="modal-content">
      <div class="modal-shards">
        <!-- 主分片 -->
        <div class="modal-shard-row">
          <span class="modal-row-label">P</span>
          <div class="modal-shard-items">
            <div
              v-for="shard in groupedShards.primaries"
              :key="`${shard.shard}-${shard.prirep}`"
              :class="['modal-shard-item', { active: selectedShardKey === `${shard.shard}-p` }]"
              :style="{ border: getShardBorderStyle(shard) }"
              @click="selectShard(shard)"
            >
              {{ shard.shard }}
            </div>
          </div>
        </div>
        <!-- 副分片 -->
        <div v-if="groupedShards.replicas.length > 0" class="modal-shard-row">
          <span class="modal-row-label">R</span>
          <div class="modal-shard-items">
            <div
              v-for="shard in groupedShards.replicas"
              :key="`${shard.shard}-${shard.prirep}-${shard.node}`"
              :class="['modal-shard-item', { active: selectedShardKey === `${shard.shard}-r-${shard.node}` }]"
              :style="{ border: getShardBorderStyle(shard) }"
              @click="selectShard(shard)"
            >
              {{ shard.shard }}
            </div>
          </div>
        </div>
      </div>

      <n-tabs v-model:value="selectedTab" type="line" size="small">
        <n-tab-pane name="p" tab="主分片">
          <n-data-table
            :columns="shardTableColumns"
            :data="groupedShards.primaries"
            :row-key="(row: ShardInfo) => `${row.shard}-p`"
            :row-class-name="(row: ShardInfo) => selectedShardKey === `${row.shard}-p` ? 'selected-row' : ''"
            bordered
            size="small"
            max-height="300px"
          />
        </n-tab-pane>
        <n-tab-pane name="r" tab="副分片">
          <n-data-table
            :columns="shardTableColumns"
            :data="groupedShards.replicas"
            :row-key="(row: ShardInfo) => `${row.shard}-r-${row.node}`"
            :row-class-name="(row: ShardInfo) => selectedShardKey === `${row.shard}-r-${row.node}` ? 'selected-row' : ''"
            bordered
            size="small"
            max-height="300px"
          />
        </n-tab-pane>
      </n-tabs>
    </div>
  </n-modal>
</template>

<style scoped lang="scss">
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-shards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background-color: transparent;
  border-radius: 6px;
}

.modal-shard-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-row-label {
  width: 20px;
  font-size: 12px;
  color: #888;
  font-weight: 600;
  flex-shrink: 0;
}

.modal-shard-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.modal-shard-item {
  min-width: 36px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }

  &.active::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 4px;
    background-color: rgba(34, 197, 94, 0.1);
    pointer-events: none;
  }
}

:root[data-theme='light'] {
  .modal-shard-item:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
}

:deep(.selected-row) {
  background-color: rgba(34, 197, 94, 0.1) !important;
}
</style>