<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  NCard, NButton, NIcon, NSpin, NEmpty, NTabs, NTabPane, NInput, useMessage, useDialog
} from 'naive-ui'
import { RefreshOutline, SaveOutline, CopyOutline } from '@vicons/ionicons5'
import { useConnectionStore } from '@/store/modules/connection'
import { ElasticClient } from '@/api/elastic'
import JsonViewer from '@/components/JsonViewer.vue'

const connectionStore = useConnectionStore()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const saving = ref(false)
const settings = ref<any>(null)
const activeTab = ref('persistent')
const editMode = ref(false)
const editedSettings = ref('')

const currentActive = computed(() => connectionStore.currentActiveConnection)

// 加载集群设置
async function loadSettings() {
  const active = currentActive.value
  if (!active) return

  loading.value = true
  const conn = active.connection
  const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

  try {
    const result = await client.execute('GET', '/_cluster/settings?include_defaults=true')
    settings.value = result
  } catch (error) {
    console.error('Failed to load cluster settings:', error)
    message.error('加载集群设置失败')
  } finally {
    loading.value = false
  }
}

// 获取持久化设置
const persistentSettings = computed(() => {
  return settings.value?.persistent || {}
})

// 获取临时设置
const transientSettings = computed(() => {
  return settings.value?.transient || {}
})

// 获取默认设置
const defaultSettings = computed(() => {
  return settings.value?.defaults || {}
})

// 复制设置
async function copySettings() {
  if (!settings.value) return

  try {
    const copyData = {
      persistent: persistentSettings.value,
      transient: transientSettings.value
    }
    await navigator.clipboard.writeText(JSON.stringify(copyData, null, 2))
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

// 打开编辑模式
function openEditMode() {
  const editData = {
    persistent: persistentSettings.value,
    transient: transientSettings.value
  }
  editedSettings.value = JSON.stringify(editData, null, 2)
  editMode.value = true
}

// 取消编辑
function cancelEdit() {
  editMode.value = false
  editedSettings.value = ''
}

// 保存设置
async function saveSettings() {
  let parsed: any = {}
  try {
    parsed = JSON.parse(editedSettings.value)
  } catch {
    message.error('JSON 格式错误')
    return
  }

  dialog.warning({
    title: '确认保存',
    content: '确定要保存集群设置吗？不正确的设置可能会影响集群运行。',
    positiveText: '保存',
    negativeText: '取消',
    onPositiveClick: async () => {
      const active = currentActive.value
      if (!active) return

      const conn = active.connection
      const client = new ElasticClient(conn.url, conn.username, conn.password, conn.id, conn.name)

      saving.value = true
      try {
        await client.execute('PUT', '/_cluster/settings', parsed)
        message.success('保存集群设置成功')
        editMode.value = false
        loadSettings()
      } catch (error: any) {
        message.error(`保存失败: ${error.message}`)
      } finally {
        saving.value = false
      }
    }
  })
}

// 监听连接变化
watch(() => connectionStore.currentConnectionId, (connId) => {
  if (connId) {
    loadSettings()
  }
}, { immediate: true })

onMounted(() => {
  if (currentActive.value) {
    loadSettings()
  }
})
</script>

<template>
  <div class="cluster-settings-page">
    <n-card class="settings-card" size="small">
      <template #header>
        <div class="card-header">
          <span>设置</span>
          <div class="header-actions">
            <n-button size="small" quaternary :loading="loading" @click="loadSettings">
              <template #icon>
                <n-icon :component="RefreshOutline" />
              </template>
            </n-button>
            <n-button size="small" quaternary :disabled="!settings" @click="copySettings">
              <template #icon>
                <n-icon :component="CopyOutline" />
              </template>
              复制
            </n-button>
            <n-button
              v-if="!editMode"
              size="small"
              type="primary"
              :disabled="!settings"
              @click="openEditMode"
            >
              编辑
            </n-button>
          </div>
        </div>
      </template>

      <n-spin :show="loading">
        <!-- 编辑模式 -->
        <template v-if="editMode">
          <div class="edit-container">
            <n-input
              v-model:value="editedSettings"
              type="textarea"
              :autosize="{ minRows: 15, maxRows: 25 }"
              placeholder="输入 JSON 格式的集群设置"
              :input-props="{ spellcheck: 'false' }"
            />
          </div>
          <div class="edit-actions">
            <n-button @click="cancelEdit">取消</n-button>
            <n-button type="primary" :loading="saving" @click="saveSettings">
              <template #icon>
                <n-icon :component="SaveOutline" />
              </template>
              保存
            </n-button>
          </div>
        </template>

        <!-- 查看模式 -->
        <template v-else>
          <n-tabs v-model:value="activeTab" type="line" animated>
            <n-tab-pane name="persistent" tab="持久化设置">
              <JsonViewer
                v-if="Object.keys(persistentSettings).length > 0"
                :content="persistentSettings"
                height="calc(100vh - 350px)"
              />
              <n-empty v-else description="无持久化设置" />
            </n-tab-pane>

            <n-tab-pane name="transient" tab="临时设置">
              <JsonViewer
                v-if="Object.keys(transientSettings).length > 0"
                :content="transientSettings"
                height="calc(100vh - 350px)"
              />
              <n-empty v-else description="无临时设置" />
            </n-tab-pane>

            <n-tab-pane name="defaults" tab="默认设置">
              <JsonViewer
                v-if="Object.keys(defaultSettings).length > 0"
                :content="defaultSettings"
                height="calc(100vh - 350px)"
              />
              <n-empty v-else description="无默认设置" />
            </n-tab-pane>
          </n-tabs>
        </template>
      </n-spin>
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.cluster-settings-page {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.settings-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  :deep(.n-card__content) {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
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

.edit-container {
  flex: 1;
  min-height: 300px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #333;
}

:root[data-theme='light'] {
  .edit-actions {
    border-top-color: #e0e0e0;
  }
}
</style>