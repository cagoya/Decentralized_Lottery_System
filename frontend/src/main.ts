import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// 导入 Element Plus 样式
import 'element-plus/dist/index.css'

const app = createApp(App)
app.use(router)
app.mount('#app')