<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    style="width: 480px"
    :bordered="false"
    :closable="false"
  >
    <div class="about-content">
      <div class="about-logo">
        <img :src="LogoIcon" alt="elastic-visark" class="logo-image" />
      </div>
      <h2 class="app-name">{{ t('about.name') }}</h2>
      <p class="app-description">{{ t('about.description') }}</p>

      <div class="info-section">
        <a
          class="github-link"
          href="https://github.com/visarks/elastic-visark"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          github.com/visarks/elastic-visark
        </a>

        <div class="version-info">
          <span class="version-label">{{ t('about.version') }}:</span>
          <span class="version-value">{{ version }}</span>
        </div>
      </div>

      <a
        class="check-update-link"
        href="javascript:;"
        @click="handleCheckUpdate"
      >
        {{ checking ? t('about.checking') : t('about.checkUpdate') }}
      </a>

      <p v-if="updateMessage" class="update-message" :class="updateMessageType">
        {{ updateMessage }}
      </p>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NModal } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getVersion } from '@tauri-apps/api/app'
import LogoIcon from '@/assets/logo.svg'
import { checkForUpdate } from '@/services/updater'

const { t } = useI18n()

const showModal = ref(false)
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

// Open modal
function open() {
  showModal.value = true
  loadVersion()
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

defineExpose({
  open
})
</script>

<style scoped lang="scss">
.about-content {
  text-align: center;
  padding: 24px 16px;
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
  margin: 0 0 20px 0;
}

.info-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #70c0e8;
  font-size: 13px;
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: #63e2b7;
  }

  svg {
    flex-shrink: 0;
  }
}

.version-info {
  font-size: 14px;
  color: #666;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 16px;
  border-radius: 8px;
}

.version-label {
  margin-right: 8px;
}

.version-value {
  font-weight: 600;
  color: #63e2b7;
}

.check-update-link {
  display: block;
  color: #70c0e8;
  font-size: 13px;
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: #63e2b7;
  }
}

.update-message {
  margin: 12px 0 0 0;
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

  .github-link {
    color: #2080f0;

    &:hover {
      color: #18a058;
    }
  }

  .version-info {
    background: rgba(0, 0, 0, 0.05);
  }

  .version-value {
    color: #18a058;
  }

  .check-update-link {
    color: #2080f0;

    &:hover {
      color: #18a058;
    }
  }
}
</style>