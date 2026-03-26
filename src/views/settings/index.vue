<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NForm, NFormItem, NSelect, NInput, NButton, NIcon } from 'naive-ui'
import { AddOutline, RemoveOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/store/modules/settings'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const themeOptions = [
  { label: t('settings.light'),
 value: 'light' },
  { label: t('settings.dark'), value: 'dark' }
]

// 新模式输入
const newPattern = ref('')

// 添加排除模式
function addPattern() {
  if (newPattern.value.trim()) {
    settingsStore.setExcludeIndexPatterns([...settingsStore.excludeIndexPatterns, newPattern.value.trim()])
    newPattern.value = ''
  }
}

// 删除排除模式
function removePattern(index: number) {
  const patterns = [...settingsStore.excludeIndexPatterns]
  patterns.splice(index, 1)
  settingsStore.setExcludeIndexPatterns(patterns)
}
</script>

<template>
  <n-card :title="t('settings.title')" class="settings-card">
    <n-form label-width="100px" label-placement="left">
      <n-form-item :label="t('settings.theme')">
        <n-select
          :value="settingsStore.theme"
          :options="themeOptions"
          @update:value="settingsStore.setTheme"
          style="width: 200px"
        />
      </n-form-item>

      <n-form-item label="排除索引">
        <div class="exclude-patterns">
          <div class="pattern-list">
            <div v-for="(pattern, index) in settingsStore.excludeIndexPatterns" :key="index" class="pattern-item">
              <code class="pattern-text">{{ pattern }}</code>
              <n-button size="tiny" quaternary type="error" @click="removePattern(index)">
                <template #icon>
                  <n-icon :component="RemoveOutline" />
                </template>
              </n-button>
            </div>
          </div>
          <div class="add-pattern">
            <n-input
              v-model:value="newPattern"
              placeholder="输入通配符模式，如 .* 或 test*"
              size="small"
              style="width: 200px"
              @keyup.enter="addPattern"
            />
            <n-button size="small" type="primary" @click="addPattern">
              <template #icon>
                <n-icon :component="AddOutline" />
              </template>
            </n-button>
          </div>
          <div class="pattern-hint">
            支持通配符：* 匹配任意字符，? 匹配单个字符。以 . 开头的模式会匹配所有以此开头的索引。
          </div>
        </div>
      </n-form-item>
    </n-form>
  </n-card>
</template>

<style scoped lang="scss">
.settings-card {
  margin: 16px;
}

.exclude-patterns {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pattern-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pattern-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #2d2d2d;
  border-radius: 4px;
}

.pattern-text {
  font-size: 12px;
  color: #63e2b7;
}

.add-pattern {
  display: flex;
  gap: 8px;
}

.pattern-hint {
  font-size: 12px;
  color: #888;
}

// 浅色主题
:root[data-theme='light'] {
  .pattern-item {
    background-color: #f0f0f0;
  }

  .pattern-text {
    color: #18a058;
  }
}
</style>