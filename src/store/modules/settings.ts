import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSettings, saveSettings, getSetting, saveSetting } from '@/services/database'
import { VxeUI } from 'vxe-pc-ui'

export type ThemeType = 'light' | 'dark'

// 通配符匹配函数
function matchWildcard(pattern: string, text: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return regex.test(text)
}

// 默认排除索引模式 - 以点开头的系统索引
const DEFAULT_EXCLUDE_PATTERNS = ['[.]*']

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeType>('dark')
  const historyRetentionDays = ref<number>(7)
  const excludeIndexPatterns = ref<string[]>([...DEFAULT_EXCLUDE_PATTERNS])
  const initialized = ref(false)

  // 判断索引是否被排除
  const isIndexExcluded = computed(() => {
    return (indexName: string) => {
      return excludeIndexPatterns.value.some(pattern => {
        if (pattern.includes('*') || pattern.includes('?')) {
          return matchWildcard(pattern, indexName)
        }
        if (pattern.startsWith('.')) {
          return indexName.startsWith(pattern)
        }
        return indexName === pattern
      })
    }
  })

  async function setTheme(newTheme: ThemeType) {
    theme.value = newTheme
    document.documentElement.setAttribute('data-theme', newTheme)
    VxeUI.setTheme(newTheme)
    // 保存主题到数据库
    await saveSetting('theme', newTheme)
  }

  async function setHistoryRetentionDays(days: number) {
    historyRetentionDays.value = days
    await saveSettings({ history_retention_days: days })
  }

  async function setExcludeIndexPatterns(patterns: string[]) {
    excludeIndexPatterns.value = patterns.filter(p => p.trim())
    await saveSetting('exclude_index_patterns', JSON.stringify(excludeIndexPatterns.value))
  }

  async function loadSettings() {
    if (initialized.value) return

    try {
      // 加载主题
      const savedTheme = await getSetting('theme')
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        theme.value = savedTheme
        document.documentElement.setAttribute('data-theme', savedTheme)
        VxeUI.setTheme(savedTheme)
      }

      // 加载历史保留天数
      const settings = await getSettings()
      if (settings) {
        historyRetentionDays.value = settings.history_retention_days || 7
      }

      // 加载排除索引模式
      const savedPatterns = await getSetting('exclude_index_patterns')
      if (savedPatterns) {
        try {
          excludeIndexPatterns.value = JSON.parse(savedPatterns)
        } catch {
          excludeIndexPatterns.value = [...DEFAULT_EXCLUDE_PATTERNS]
        }
      }

      initialized.value = true
    } catch (error) {
      console.error('Failed to load settings:', error)
      // 初始化主题
      document.documentElement.setAttribute('data-theme', theme.value)
      VxeUI.setTheme(theme.value)
    }
  }

  // Initialize theme
  document.documentElement.setAttribute('data-theme', theme.value)
  VxeUI.setTheme(theme.value)

  return {
    theme,
    historyRetentionDays,
    excludeIndexPatterns,
    isIndexExcluded,
    setTheme,
    setHistoryRetentionDays,
    setExcludeIndexPatterns,
    loadSettings
  }
})