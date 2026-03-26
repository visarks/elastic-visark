<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal, NTabs, NTabPane, NButton, NIcon, NSpin, NEmpty, NStatistic,
  NGrid, NGi, NDescriptions, NDescriptionsItem, NTag, useMessage
} from 'naive-ui'
import { SyncOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { ElasticClient } from '@/api/elastic'
import MappingTab from './components/MappingTab.vue'
import SettingsTab from './components/SettingsTab.vue'
import AliasesTab from './components/AliasesTab.vue'

const props = defineProps<{
  indexName: string
}>()

const connectionStore = useConnectionStore()
const message = useMessage()

const showModal = ref(false)
const loading = ref(false)
const indexInfo = ref<any>(null)
const stats = ref<any>(null)
const mapping = ref<any>(null)
const settings = ref<any>(null)
const aliases = ref<any[]>([])
const activeTab = ref('overview')

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 加载所有数据
async function loadAllData() {
  if (!props.indexName) return
  if (indexInfo.value) return // 已有数据，不重新加载

  const active = currentActive.value
  if (!active) return

  loading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const [info, statsData, mappingData, settingsData, aliasData] = await Promise.all([
      client.getIndexInfo(props.indexName),
      client.getIndexStats(props.indexName),
      client.getIndexMapping(props.indexName),
      client.getIndexSettings(props.indexName),
      client.execute('GET', `/${props.indexName}/_alias`)
    ])

    // 索引信息
    indexInfo.value = info[props.indexName] || Object.values(info)[0]
    stats.value = statsData.indices?.[props.indexName] || Object.values(statsData.indices || {})[0]

    // Mapping
    let indexMapping = mappingData[props.indexName]?.mappings
    if (!indexMapping) {
      const firstKey = Object.keys(mappingData)[0]
      indexMapping = mappingData[firstKey]?.mappings || {}
    }
    mapping.value = indexMapping

    // Settings
    let indexSettings = settingsData[props.indexName]?.settings
    if (!indexSettings) {
      const firstKey = Object.keys(settingsData)[0]
      indexSettings = settingsData[firstKey]?.settings || {}
    }
    settings.value = indexSettings

    // Aliases
    const aliasIndexData = aliasData[props.indexName]
    if (aliasIndexData && aliasIndexData.aliases) {
      aliases.value = Object.entries(aliasIndexData.aliases).map(([name, data]) => ({
        alias: name,
        index: props.indexName,
        ...(data as object)
      }))
    } else {
      aliases.value = []
    }
  } catch (error) {
    console.error('Failed to load index data:', error)
    message.error('加载索引信息失败')
  } finally {
    loading.value = false
  }
}

// 强制刷新所有数据
async function forceRefresh() {
  indexInfo.value = null
  stats.value = null
  mapping.value = null
  settings.value = null
  aliases.value = []
  await loadAllData()
}

// 打开弹窗
function open() {
  // 先重置所有数据
  indexInfo.value = null
  stats.value = null
  mapping.value = null
  settings.value = null
  aliases.value = []
  activeTab.value = 'overview'

  showModal.value = true
  loadAllData()
}

// 格式化数字
function formatNumber(num: number): string {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString()
}

// 格式化字节
function formatBytes(bytes: number): string {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(2)} ${units[i]}`
}

// 监听索引名称变化，清除缓存
watch(() => props.indexName, () => {
  indexInfo.value = null
  stats.value = null
  mapping.value = null
  settings.value = null
  aliases.value = []
})

defineExpose({
  open
})
</script>

<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="`索引详情 - ${indexName}`"
    style="width: 900px; max-width: 95vw;"
    :bordered="false"
    size="small"
  >
    <n-spin :show="loading">
      <n-tabs v-model:value="activeTab" type="line" animated>
        <n-tab-pane name="overview" tab="概览">
          <div class="overview-content">
            <div class="tab-toolbar">
              <n-button size="small" quaternary @click="forceRefresh">
                <template #icon>
                  <n-icon :component="SyncOutline" />
                </template>
              </n-button>
            </div>
            <template v-if="indexInfo && stats">
              <n-descriptions label-placement="left" :column="2" bordered size="small">
                <n-descriptions-item label="索引名称">
                  {{ indexName }}
                </n-descriptions-item>
                <n-descriptions-item label="状态">
                  <n-tag
                    :type="indexInfo.settings?.index?.verified_before_close ? 'warning' : 'success'"
                    size="small"
                  >
                    {{ indexInfo.settings?.index?.verified_before_close ? '已关闭' : '打开' }}
                  </n-tag>
                </n-descriptions-item>
                <n-descriptions-item label="主分片数">
                  {{ indexInfo.settings?.index?.number_of_shards || '-' }}
                </n-descriptions-item>
                <n-descriptions-item label="副本数">
                  {{ indexInfo.settings?.index?.number_of_replicas || '-' }}
                </n-descriptions-item>
                <n-descriptions-item label="创建时间">
                  {{ new Date(parseInt(indexInfo.settings?.index?.creation_date)).toLocaleString() }}
                </n-descriptions-item>
              </n-descriptions>

              <n-grid :cols="4" :x-gap="16" :y-gap="16" class="stats-grid">
                <n-gi>
                  <n-statistic label="文档数">
                    {{ formatNumber(stats.primaries?.docs?.count) }}
                  </n-statistic>
                </n-gi>
                <n-gi>
                  <n-statistic label="已删除文档">
                    {{ formatNumber(stats.primaries?.docs?.deleted) }}
                  </n-statistic>
                </n-gi>
                <n-gi>
                  <n-statistic label="存储大小">
                    {{ formatBytes(stats.primaries?.store?.size_in_bytes) }}
                  </n-statistic>
                </n-gi>
                <n-gi>
                  <n-statistic label="总数据大小">
                    {{ formatBytes(stats.total?.store?.size_in_bytes) }}
                  </n-statistic>
                </n-gi>
              </n-grid>
            </template>
            <n-empty v-else-if="!loading" description="暂无数据" />
          </div>
        </n-tab-pane>

        <n-tab-pane name="mapping" tab="Mapping">
          <MappingTab :index-name="indexName" :mapping="mapping" @refresh="forceRefresh" />
        </n-tab-pane>

        <n-tab-pane name="settings" tab="Settings">
          <SettingsTab :index-name="indexName" :settings="settings" />
        </n-tab-pane>

        <n-tab-pane name="aliases" tab="Aliases">
          <AliasesTab :index-name="indexName" :aliases="aliases" @refresh="forceRefresh" />
        </n-tab-pane>
      </n-tabs>
    </n-spin>
  </n-modal>
</template>

<style scoped lang="scss">
.overview-content {
  padding: 12px 0;
}

.tab-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

.stats-grid {
  margin-top: 20px;
}

:root[data-theme='light'] {
  .tab-toolbar {
    border-bottom-color: #e0e0e0;
  }
}
</style>