<template>
  <n-modal v-model:show="showModal" preset="card" :title="t('about.title')" style="width: 400px" :mask-closable="true">
    <div class="about-content">
      <div class="about-logo">
        <img :src="LogoIcon" alt="elastic-search" class="logo-image" />
      </div>
      <h2 class="app-name">{{ t('about.name') }}</h2>
      <p class="app-description">{{ t('about.description') }}</p>
      <div class="version-info">
        <span class="version-label">{{ t('about.version') }}:</span>
        <span class="version-value">{{ version }}</span>
      </div>
    </div>

    <template #footer>
      <n-space vertical>
        <n-button
          type="primary"
          block
          :loading="checking"
          :disabled="checking"
          @click="handleCheckUpdate"
        >
          {{ checking ? t('about.checking') : t('about.checkUpdate') }}
        </n-button>
        <p v-if="updateMessage" class="update-message" :class="updateMessageType">
          {{ updateMessage }}
        </p>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getVersion } from '@tauri-apps/api/app'
import LogoIcon from '@/assets/logo.svg'
import { checkForUpdate } from '@/services/updater'

const { t } = useI18n()

const showModal = defineModel<boolean>('show', { default: false })
const version = ref<string>('')
const checking = ref(false)
const updateMessage = ref('')
const updateMessageType = ref<'success' | 'error' | 'info'>('info')

// Get app version
async function loadVersion() {
  try {
    version.value = await getVersion()
  } catch {
    version.value = '0.1.0'
  }
}

// Initialize version when modal opens
async function handleOpen() {
  await loadVersion()
  updateMessage.value = ''
}

async function handleCheckUpdate() {
  checking.value = true
  updateMessage.value = ''

  try {
    const info = await checkForUpdate()
    if (info && info.available) {
      // Update notification modal will show automatically via UpdateNotification.vue
      showModal.value = false
    } else if (info === null) {
      // Error occurred
      updateMessage.value = t('about.updateError')
      updateMessageType.value = 'error'
    } else {
      // No update available
      updateMessage.value = t('about.noUpdate')
      updateMessageType.value = 'success'
    }
  } catch (error) {
    updateMessage.value = t('about.updateError')
    updateMessageType.value = 'error'
  } finally {
    checking.value = false
  }
}

// Watch for modal open
import { watch } from 'vue'
watch(showModal, (val) => {
  if (val) {
    handleOpen()
  }
})
</script>

<style scoped lang="scss">
.about-content {
  text-align: center;
  padding: 16px 0;
}

.about-logo {
  margin-bottom: 16px;
}

.logo-image {
  width: 64px;
  height: 64px;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #63e2b7 0%, #4caf50 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-description {
  color: #888;
  font-size: 14px;
  margin: 0 0 16px 0;
}

.version-info {
  font-size: 14px;
  color: #666;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 16px;
  border-radius: 8px;
  display: inline-block;
}

.version-label {
  margin-right: 8px;
}

.version-value {
  font-weight: 600;
  color: #63e2b7;
}

.update-message {
  margin: 8px 0 0 0;
  font-size: 13px;
  text-align: center;

  &.success {
    color: #63e2b7;
  }

  &.error {
    color: #e88080;
  }

  &.info {
    color: #70c0e8;
  }
}

// Light theme
:root[data-theme='light'] {
  .app-name {
    background: linear-gradient(135deg, #18a058 0%, #4caf50 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .app-description {
    color: #666;
  }

  .version-info {
    background: rgba(0, 0, 0, 0.05);
  }

  .version-value {
    color: #18a058;
  }
}
</style>