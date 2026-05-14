/**
 * 网页端入口
 * 复用渲染进程 App.vue，不加载 Electron 专属模块
 */
import { createApp } from 'vue'
import App from '../renderer/src/App.vue'
import '../renderer/src/styles/global.css'

const app = createApp(App)

// 全局注入环境标识
app.config.globalProperties.$isElectron = false

app.mount('#app')
