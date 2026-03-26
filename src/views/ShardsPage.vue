<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { NCard, NButton, NIcon, NInput, NSelect, NPagination, NEmpty, NTooltip } from 'naive-ui'
import { Refresh, ExpandOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { useCacheStore } from '@/store/modules/cache'
import { ElasticClient } from '@/api/elastic'
import ShardsModal from '@/components/ShardsModal.vue'

const connectionStore = useConnectionStore()
const cacheStore = useCacheStore()

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

interface IndexShards {
  index: string
  primaries: ShardInfo[]
  replicas: ShardInfo[]
  totalDocs: number
  totalStore: number
}

const loading = ref(false)
const searchText = ref('')
const stateFilter = ref<string>('')
const currentPage = ref(1)
const pageSize = ref(20)

const shardsModalRef = ref<InstanceType<typeof ShardsModal> | null>(null)

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 从缓存获取分片数据
const shardsData = computed({
  get: () => {
    const connId = connectionStore.currentConnectionId
    if (!connId) return []
    return cacheStore.getClusterCache(connId).shards as ShardInfo[]
  },
  set: (val) => {
    const connId = connectionStore.currentConnectionId
    if (connId) {
      cacheStore.updateCache(connId, { shards: val })
    }
  }
})

// 分片状态选项
const stateOptions = [
  { label: '全部状态', value: '' },
  { label: 'STARTED', value: 'STARTED' },
  { label: 'RELOCATING', value: 'RELOCATING' },
  { label: 'INITIALIZING', value: 'INITIALIZING' },
  { label: 'UNASSIGNED', value: 'UNASSIGNED' }
]

// 每页条数选项
const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 },
  { label: '100 条/页', value: 100 }
]

// 加载分片数据
async function loadShards() {
  const active = currentActive.value
  if (!active) return

  loading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const data = await client.getShards()
    shardsData.value = data
  } catch (error) {
    console.error('Failed to load shards:', error)
  } finally {
    loading.value = false
  }
}

// 监听当前连接变化
watch(() => connectionStore.currentActiveConnection, (active) => {
  if (active && shardsData.value.length === 0) {
    loadShards()
  }
}, { immediate: true })

// 组件挂载时也尝试加载数据
onMounted(() => {
  if (currentActive.value && shardsData.value.length === 0) {
    loadShards()
  }
})

// 按索引分组
const groupedShards = computed<IndexShards[]>(() => {
  const groups = new Map<string, IndexShards>()

  shardsData.value.forEach(shard => {
    // 过滤
    if (searchText.value && !shard.index.toLowerCase().includes(searchText.value.toLowerCase())) {
      return
    }
    if (stateFilter.value && shard.state !== stateFilter.value) {
      return
    }

    if (!groups.has(shard.index)) {
      groups.set(shard.index, {
        index: shard.index,
        primaries: [],
        replicas: [],
        totalDocs: 0,
        totalStore: 0
      })
    }

    const group = groups.get(shard.index)!
    if (shard.prirep === 'p') {
      group.primaries.push(shard)
    } else {
      group.replicas.push(shard)
    }
    group.totalDocs += parseInt(shard.docs) || 0
    group.totalStore += parseFloat(shard.store) || 0
  })

  // 排序主分片和副分片
  groups.forEach(group => {
    group.primaries.sort((a, b) => parseInt(a.shard) - parseInt(b.shard))
    group.replicas.sort((a, b) => parseInt(a.shard) - parseInt(b.shard))
  })

  return Array.from(groups.values())
})

// 分页后的数据
const paginatedShards = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return groupedShards.value.slice(start, end)
})

// 格式化存储大小
function formatStore(size: number): string {
  if (size < 1024) return `${size.toFixed(1)}kb`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}mb`
  return `${(size / 1024 / 1024).toFixed(2)}gb`
}

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

// 获取分片状态提示
function getShardTooltip(shard: ShardInfo): string {
  const docs = parseInt(shard.docs)
  const lines = [
    `分片: ${shard.shard}`,
    `类型: ${shard.prirep === 'p' ? '主分片' : '副分片'}`,
    `状态: ${shard.state}`,
    `文档数: ${docs > 0 ? docs.toLocaleString() : '-'}`,
    `大小: ${shard.store || '-'}`
  ]
  if (shard.node) {
    lines.push(`节点: ${shard.node}`)
  }
  if (shard['unassigned.reason']) {
    lines.push(`原因: ${shard['unassigned.reason']}`)
  }
  return lines.join('\n')
}

// 重置分页
function resetPage() {
  currentPage.value = 1
}

// 打开模态框
function openModal(group: IndexShards) {
  const allShards = [...group.primaries, ...group.replicas]
  shardsModalRef.value?.openWithData(group.index, allShards)
}
</script>

<template>
  <div class="shards-page">
    <n-card
      class="shards-card"
      size="small"
      :content-style="{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0', minHeight: '0' }"
      :card-style="{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }"
    >
      <template #header>
        <div class="card-header">
          <span>分片信息</span>
          <div class="header-actions">
            <n-button size="small" quaternary :loading="loading" @click="loadShards">
              <template #icon>
                <n-icon :component="Refresh" />
              </template>
            </n-button>
            <n-select
              v-model:value="stateFilter"
              :options="stateOptions"
              placeholder="状态"
              clearable
              size="small"
              style="width: 120px"
              @update:value="resetPage"
            />
            <n-input
              v-model:value="searchText"
              placeholder="索引名称"
              clearable
              size="small"
              style="width: 160px"
              @update:value="resetPage"
            />
          </div>
        </div>
      </template>

      <div class="shards-content">
        <div v-if="paginatedShards.length > 0" class="shards-grid">
            <n-card
              v-for="group in paginatedShards"
              :key="group.index"
              size="small"
              class="index-card"
            >
              <template #header>
                <div class="card-header-inner">
                  <n-tooltip :disabled="group.index.length <= 20">
                    <template #trigger>
                      <span class="index-name">{{ group.index }}</span>
                    </template>
                    {{ group.index }}
                  </n-tooltip>
                  <n-button size="tiny" quaternary @click="openModal(group)">
                    <template #icon>
                      <n-icon :component="ExpandOutline" size="14" />
                    </template>
                  </n-button>
                </div>
              </template>

              <div class="card-content">
                <div class="index-stats">
                  <span>{{ group.totalDocs > 0 ? group.totalDocs.toLocaleString() : '-' }}</span>
                  <span>{{ group.totalStore > 0 ? formatStore(group.totalStore) : '-' }}</span>
                </div>

                <div class="shards-container">
                  <!-- 主分片行 -->
                  <div class="shard-row">
                    <span class="row-label">P</span>
                    <div class="shard-items">
                      <n-tooltip v-for="shard in group.primaries" :key="`${shard.shard}-${shard.prirep}`">
                        <template #trigger>
                          <div
                            class="shard-item primary"
                            :style="{ border: getShardBorderStyle(shard) }"
                          >
                            {{ shard.shard }}
                          </div>
                        </template>
                        <pre>{{ getShardTooltip(shard) }}</pre>
                      </n-tooltip>
                    </div>
                  </div>
                  <!-- 副分片行 -->
                  <div v-if="group.replicas.length > 0" class="shard-row">
                    <span class="row-label">R</span>
                    <div class="shard-items">
                      <n-tooltip v-for="shard in group.replicas" :key="`${shard.shard}-${shard.prirep}-${shard.node}`">
                        <template #trigger>
                          <div
                            class="shard-item replica"
                            :style="{ border: getShardBorderStyle(shard) }"
                          >
                            {{ shard.shard }}
                          </div>
                        </template>
                        <pre>{{ getShardTooltip(shard) }}</pre>
                      </n-tooltip>
                    </div>
                  </div>
                </div>
              </div>
            </n-card>
          </div>
          <n-empty v-else description="暂无分片数据" />
      </div>

      <template #footer>
        <div class="card-footer">
          <span class="total-count">共 {{ groupedShards.length }} 条</span>
          <n-select
            v-model:value="pageSize"
            :options="pageSizeOptions"
            size="small"
            style="width: 100px"
            @update:value="resetPage"
          />
          <n-pagination
            v-model:page="currentPage"
            :page-count="Math.ceil(groupedShards.length / pageSize)"
            size="small"
          />
        </div>
      </template>
    </n-card>

    <ShardsModal ref="shardsModalRef" />
  </div>
</template>

<style scoped lang="scss">
.shards-page {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shards-card {
  flex: 1;
  min-height: 0;

  :deep(.n-card-header) {
    flex-shrink: 0;
  }

  :deep(.n-card__footer) {
    flex-shrink: 0;
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

.shards-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  min-height: 0;
}

.shards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.index-card {
  :deep(.n-card-header) {
    padding: 8px 12px;
    border-bottom: 1px solid #3a3a3a;
  }

  :deep(.n-card__content) {
    padding: 10px 12px;
  }
}

.index-name {
  font-weight: 500;
  font-size: 13px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.index-stats {
  font-size: 12px;
  color: #888;
  display: flex;
  justify-content: space-between;
}

.shards-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shard-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-label {
  width: 14px;
  font-size: 11px;
  color: #666;
  font-weight: 600;
  flex-shrink: 0;
}

.shard-items {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 2px;
    transition: background-color 0.2s;
  }

  &:hover::-webkit-scrollbar-thumb {
    background-color: #555;
  }

  // 确保 NTooltip 的 trigger 包裹层不影响 hover
  :deep(.n-tooltip-trigger) {
    display: inline-flex;
  }
}

.shard-item {
  min-width: 40px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
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

// 浅色主题
:root[data-theme='light'] {
  .shards-card {
    :deep(.n-card__footer) {
      border-top-color: #e0e0e0;
    }
  }

  .index-card {
    :deep(.n-card-header) {
      border-bottom-color: #e0e0e0;
    }
  }

  .shard-item:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
}

// 卡片头部内部样式
.card-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

:deep(.n-data-table) {
  .n-data-table-th {
    text-align: center;
  }
}
</style>