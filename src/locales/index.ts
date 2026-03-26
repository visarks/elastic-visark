import { createI18n } from 'vue-i18n'
import enUS from './en-US'
import zhCN from './zh-CN'

const i18n = createI18n({
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'en-US',
  legacy: false,
  globalInjection: true,
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN
  }
})

export default i18n