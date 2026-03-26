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

      <div class="version-text">{{ version }}</div>

      <a
        class="github-link"
        href="https://github.com/visarks/elastic-visark"
        target="_blank"
        rel="noopener noreferrer"
      >
        源码地址
      </a>

      <p class="copyright">Copyright © podigua 2025</p>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NModal } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getVersion } from '@tauri-apps/api/app'
import LogoIcon from '@/assets/logo.svg'

const { t } = useI18n()

const showModal = ref(false)
const version = ref<string>('')

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
  margin-bottom: 5px;
}

.logo-image {
  width: 64px;
  height: 64px;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 5px 0;
  background: linear-gradient(135deg, #63e2b7 0%, #4caf50 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.version-text {
  font-size: 14px;
  color: #888;
  margin-bottom: 5px;
}

.github-link {
  display: block;
  color: #70c0e8;
  font-size: 13px;
  text-decoration: none;
  margin-bottom: 5px;
  transition: color 0.2s;

  &:hover {
    color: #63e2b7;
  }
}

.copyright {
  font-size: 12px;
  color: #888;
  margin: 0;
}

// Light theme
:root[data-theme='light'] {
  .app-name {
    background: linear-gradient(135deg, #18a058 0%, #4caf50 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .github-link {
    color: #2080f0;

    &:hover {
      color: #18a058;
    }
  }

  .copyright {
    color: #888;
  }
}
</style>