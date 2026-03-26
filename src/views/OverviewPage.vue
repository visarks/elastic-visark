<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { NCard, NGrid, NGi, NStatistic, NTag, NDescriptions, NDescriptionsItem, NSkeleton, NButton, NIcon } from 'naive-ui'
import { Refresh } from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { useCacheStore } from '@/store/modules/cache'
import { ElasticClient } from '@/api/elastic'

const connectionStore = useConnectionStore()
const cacheStore = useCacheStore()

interface ClusterInfo {
  name: string
  cluster_name: string
  cluster_uuid: string
  version: {
    number: string
    build_flavor: string
    build_type: string
    build_hash: string
    build_date: string
    lucene_version: string
    minimum_wire_version: string
    minimum_index_compatibility_version: string
  }
  tagline: string
}

interface ClusterHealth {
  cluster_name: string
  status: string
  timed_out: boolean
  number_of_nodes: number
  number_of_data_nodes: number
  active_primary_shards: number
  active_shards: number
  relocating_shards: number
  initializing_shards: number
  unassigned_shards: number
  delayed_unassigned_shards: number
  number_of_pending_tasks: number
  number_of_in_flight_fetch: number
  task_max_waiting_in_queue_millis: number
  active_shards_percent_as_number: number
}

const loadingInfo = ref(false)
const loadingHealth = ref(false)

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 从缓存获取数据
const clusterInfo = computed({
  get: () => {
    const connId = connectionStore.currentConnectionId
    if (!connId) return null
    return cacheStore.getClusterCache(connId).clusterInfo as ClusterInfo | null
  },
  set: (val) => {
    const connId = connectionStore.currentConnectionId
    if (connId) {
      cacheStore.updateCache(connId, { clusterInfo: val })
    }
  }
})

const clusterHealth = computed({
  get: () => {
    const connId = connectionStore.currentConnectionId
    if (!connId) return null
    return cacheStore.getClusterCache(connId).clusterHealth as ClusterHealth | null
  },
  set: (val) => {
    const connId = connectionStore.currentConnectionId
    if (connId) {
      cacheStore.updateCache(connId, { clusterHealth: val })
    }
  }
})

// 加载集群基本信息
async function loadClusterInfo() {
  const active = currentActive.value
  if (!active) return

  loadingInfo.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const info = await client.getInfo()
    clusterInfo.value = info
  } catch (error) {
    console.error('Failed to load cluster info:', error)
  } finally {
    loadingInfo.value = false
  }
}

// 加载健康状态
async function loadClusterHealth() {
  const active = currentActive.value
  if (!active) return

  loadingHealth.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const health = await client.getHealth()
    clusterHealth.value = health
  } catch (error) {
    console.error('Failed to load cluster health:', error)
  } finally {
    loadingHealth.value = false
  }
}

// 加载全部数据
async function loadClusterData() {
  // 如果缓存中有数据，不重新加载
  if (clusterInfo.value && clusterHealth.value) return

  await Promise.all([
    loadClusterInfo(),
    loadClusterHealth()
  ])
}

// 监听当前连接变化
watch(() => connectionStore.currentActiveConnection, (active) => {
  if (active) {
    loadClusterData()
  }
}, { immediate: true })

// 组件挂载时也尝试加载数据
onMounted(() => {
  if (currentActive.value && !clusterInfo.value) {
    loadClusterData()
  }
})

// 健康状态颜色
const healthStatusConfig = computed(() => {
  const status = clusterHealth.value?.status || 'red'
  const config: Record<string, { color: string; text: string; type: 'success' | 'warning' | 'error' | 'info' }> = {
    green: { color: '#4caf50', text: '健康', type: 'success' },
    yellow: { color: '#ff9800', text: '警告', type: 'warning' },
    red: { color: '#f44336', text: '异常', type: 'error' }
  }
  return config[status] || config.red
})
</script>

<template>
  <div class="overview-page">
    <template v-if="clusterInfo && clusterHealth">
      <!-- 基本信息 -->
      <n-card class="info-card" size="small">
        <template #header>
          <div class="card-header">
            <span>基本信息</span>
            <n-button size="small" quaternary :loading="loadingInfo" @click="loadClusterInfo">
              <template #icon>
                <n-icon :component="Refresh" />
              </template>
            </n-button>
          </div>
        </template>
        <n-descriptions label-placement="left" :column="2" bordered size="small">
          <n-descriptions-item label="集群名称">
            {{ clusterInfo.cluster_name }}
          </n-descriptions-item>
          <n-descriptions-item label="集群UUID">
            {{ clusterInfo.cluster_uuid }}
          </n-descriptions-item>
          <n-descriptions-item label="版本">
            {{ clusterInfo.version.number }}
          </n-descriptions-item>
          <n-descriptions-item label="构建类型">
            {{ clusterInfo.version.build_type }}
          </n-descriptions-item>
          <n-descriptions-item label="Lucene版本">
            {{ clusterInfo.version.lucene_version }}
          </n-descriptions-item>
          <n-descriptions-item label="构建哈希">
            <span class="hash-text">{{ clusterInfo.version.build_hash }}</span>
          </n-descriptions-item>
        </n-descriptions>
      </n-card>

      <!-- 健康状态 -->
      <n-card class="health-card" size="small">
        <template #header>
          <div class="card-header">
            <span>健康状态</span>
            <n-button size="small" quaternary :loading="loadingHealth" @click="loadClusterHealth">
              <template #icon>
                <n-icon :component="Refresh" />
              </template>
            </n-button>
          </div>
        </template>
        <div class="health-header">
          <n-tag :type="healthStatusConfig.type" size="large" round>
            {{ healthStatusConfig.text }}
          </n-tag>
          <span class="health-status" :style="{ color: healthStatusConfig.color }">
            {{ clusterHealth.status.toUpperCase() }}
          </span>
        </div>

        <n-grid :cols="4" :x-gap="16" :y-gap="16" class="stats-grid">
          <n-gi>
            <n-statistic label="节点数" :value="clusterHealth.number_of_nodes" />
          </n-gi>
          <n-gi>
            <n-statistic label="数据节点数" :value="clusterHealth.number_of_data_nodes" />
          </n-gi>
          <n-gi>
            <n-statistic label="激活分片数" :value="clusterHealth.active_shards" />
          </n-gi>
          <n-gi>
            <n-statistic label="激活主分片数" :value="clusterHealth.active_primary_shards" />
          </n-gi>
          <n-gi>
            <n-statistic label="重分配分片数" :value="clusterHealth.relocating_shards" />
          </n-gi>
          <n-gi>
            <n-statistic label="初始化分片数" :value="clusterHealth.initializing_shards" />
          </n-gi>
          <n-gi>
            <n-statistic label="未分配分片数">
              <template #default>
                <span :class="{ 'unassigned-warning': clusterHealth.unassigned_shards > 0 }">
                  {{ clusterHealth.unassigned_shards }}
                </span>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="分片健康度">
              <template #default>
                {{ clusterHealth.active_shards_percent_as_number.toFixed(1) }}%
              </template>
            </n-statistic>
          </n-gi>
        </n-grid>
      </n-card>
    </template>

    <!-- 加载中骨架屏 -->
    <template v-else-if="loadingInfo || loadingHealth">
      <n-card title="基本信息" class="info-card" size="small">
        <n-skeleton text :repeat="4" />
      </n-card>
      <n-card title="健康状态" class="health-card" size="small">
        <n-skeleton text :repeat="6" />
      </n-card>
    </template>

    <!-- 未连接 -->
    <template v-else>
      <n-card class="empty-card">
        <div class="empty-text">请先连接集群</div>
      </n-card>
    </template>
  </div>
</template>

<style scoped lang="scss">
.overview-page {
  padding: 16px;
  height: 100%;
  overflow: auto;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.info-card {
  margin-bottom: 16px;
}

.health-card {
  margin-bottom: 16px;
}

.hash-text {
  font-family: monospace;
  font-size: 12px;
  color: #888;
}

.health-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #333;
}

.health-status {
  font-size: 20px;
  font-weight: bold;
}

.stats-grid {
  padding: 8px 0;
}

.unassigned-warning {
  color: #f44336;
  font-weight: bold;
}

.empty-card {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  text-align: center;
  color: #666;
}

// 浅色主题
:root[data-theme='light'] {
  .health-header {
    border-bottom-color: #e0e0e0;
  }
}
</style>