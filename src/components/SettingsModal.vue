<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NForm, NFormItem, NSelect, NInputNumber, NDynamicTags } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/store/modules/settings'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const showModal = ref(false)

const themeOptions = [
  { label: t('settings.light'), value: 'light' },
  { label: t('settings.dark'), value: 'dark' }
]

const retentionDays = ref(7)

function open() {
  showModal.value = true
  retentionDays.value = settingsStore.historyRetentionDays
}

async function handleRetentionChange(value: number | null) {
  if (value !== null && value > 0) {
    retentionDays.value = value
    await settingsStore.setHistoryRetentionDays(value)
  }
}

// 处理排除索引模式变化
function handlePatternsChange(value: string[]) {
  settingsStore.setExcludeIndexPatterns(value)
}

defineExpose({
  open
})
</script>

<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="t('settings.title')"
    style="width: 500px"
    :bordered="false"
  >
    <n-form label-width="100px" label-placement="left">
      <n-form-item :label="t('settings.theme')">
        <n-select
          :value="settingsStore.theme"
          :options="themeOptions"
          @update:value="settingsStore.setTheme"
        />
      </n-form-item>

      <n-form-item label="排除索引">
        <n-dynamic-tags
          :value="settingsStore.excludeIndexPatterns"
          @update:value="handlePatternsChange"
          style="width: 100%"
        />
      </n-form-item>

      <n-form-item label="日志保留">
        <n-input-number
          v-model:value="retentionDays"
          :min="1"
          :max="365"
          size="small"
          style="width: 100%"
          @update:value="handleRetentionChange"
        >
          <template #suffix>天</template>
        </n-input-number>
      </n-form-item>
    </n-form>
  </n-modal>
</template>

<style scoped>
:deep(.n-dynamic-tags) {
  width: 200px;
}
</style>