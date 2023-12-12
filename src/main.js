import { createApp } from 'vue';
import App from './App.vue'; // 引入根组件
import router from '/router'; // 导入路由配置
const app=createApp(App);
app.use(router); // 使用路由
app.mount('#app'); // 挂载到#app上

