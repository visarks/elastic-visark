<template>
  <n-modal v-model:show="showModal" preset="card" :title="t('update.title')" style="width: 400px" :mask-closable="false">
    <div v-if="!downloading && !readyToInstall">
      <p>{{ t('update.available') }}</p>
      <p v-if="updateInfo?.version">
        {{ t('update.version') }}: <strong>{{ updateInfo.version }}</strong>
      </p>
      <p v-if="updateInfo?.date">
        {{ t('update.date') }}: {{ formatDate(updateInfo.date) }}
      </p>
      <n-collapse v-if="updateInfo?.body">
        <n-collapse-item :title="t('update.changelog')" name="changelog">
          <div class="changelog" v-html="formatChangelog(updateInfo.body)"></div>
        </n-collapse-item>
      </n-collapse>
      <!-- 显示错误信息 -->
      <n-alert v-if="errorMessage" type="error" style="margin-top: 12px">
        {{ errorMessage }}
      </n-alert>
    </div>

    <div v-else-if="downloading">
      <p>{{ t('update.downloading') }}</p>
      <n-progress type="line" :percentage="downloadProgress" :indicator-placement="'inside'" />
    </div>

    <div v-else-if="readyToInstall">
      <p>{{ t('update.ready') }}</p>
      <n-alert type="success" :title="t('update.readyTitle')">
        {{ t('update.readyDesc') }}
      </n-alert>
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button v-if="!downloading && !readyToInstall" @click="closeModal">
          {{ t('update.later') }}
        </n-button>
        <n-button v-if="!downloading && !readyToInstall" type="primary" @click="startDownload">
          {{ t('update.download') }}
        </n-button>
        <n-button v-if="readyToInstall" type="primary" @click="restartApp">
          {{ t('update.restart') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NCollapse,
  NCollapseItem,
  NProgress,
  NAlert,
  NButton,
  NSpace
} from 'naive-ui'
import {
  updateAvailable,
  updateInfo,
  downloading,
  downloadProgress,
  downloadAndInstall,
  installAndRestart,
  updateError
} from '@/services/updater'

const { t } = useI18n()
const showModal = ref(false)
const readyToInstall = ref(false)
const hasShownModal = ref(false)

console.log('UpdateNotification mounted, updateAvailable:', updateAvailable.value)

watch(updateAvailable, (available) => {
  console.log('updateAvailable changed:', available)
  // 只在首次检测到更新时显示模态框，避免下载失败后重复弹出
  if (available && !hasShownModal.value) {
    showModal.value = true
    hasShownModal.value = true
    console.log('showModal set to true')
  }
}, { immediate: true })

function closeModal() {
  showModal.value = false
}

async function startDownload() {
  const success = await downloadAndInstall((progress) => {
    console.log('Download progress:', progress)
  })

  if (success) {
    readyToInstall.value = true
  }
  // 下载失败时不关闭模态框，让用户可以看到错误信息
}

async function restartApp() {
  await installAndRestart()
}

// 计算错误信息
const errorMessage = computed(() => updateError.value)

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}

function formatChangelog(body: string): string {
  return body.replace(/\n/g, '<br>')
}
</script>

<style scoped lang="scss">
.changelog {
  font-size: 13px;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
}
</style>