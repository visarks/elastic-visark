import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n from './locales'
import App from './App.vue'
import './styles/global.scss'

// vxe-table
import VxeTable from 'vxe-table'
import VxeUI from 'vxe-pc-ui'
import 'vxe-table/lib/style.css'
import 'vxe-pc-ui/lib/style.css'

// 生产环境禁止右键菜单
if (import.meta.env.PROD) {
  window.addEventListener('contextmenu', (e) => e.preventDefault(), false)
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(VxeUI)
app.use(VxeTable)

app.mount('#app')