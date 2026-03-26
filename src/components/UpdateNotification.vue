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
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  updateAvailable,
  updateInfo,
  downloading,
  downloadProgress,
  downloadAndInstall,
  installAndRestart
} from '@/services/updater'

const { t } = useI18n()
const showModal = ref(false)
const readyToInstall = ref(false)

watch(updateAvailable, (available) => {
  if (available) {
    showModal.value = true
    readyToInstall.value = false
  }
})

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
}

async function restartApp() {
  await installAndRestart()
}

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