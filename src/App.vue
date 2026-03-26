<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme } from 'naive-ui'
import MainLayout from '@/components/layout/MainLayout.vue'
import UpdateNotification from '@/components/UpdateNotification.vue'
import { useSettingsStore } from '@/store/modules/settings'
import { checkForUpdate } from '@/services/updater'

const settingsStore = useSettingsStore()

const theme = computed(() => (settingsStore.theme === 'dark' ? darkTheme : null))

onMounted(async () => {
  await settingsStore.loadSettings()
  // Check for updates after a short delay
  setTimeout(() => {
    checkForUpdate()
  }, 3000)
})
</script>

<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <n-dialog-provider>
        <main-layout />
        <update-notification />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>