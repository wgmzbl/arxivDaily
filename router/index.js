import { createRouter, createWebHistory } from 'vue-router';
// import Home from '../src/components/Home.vue';
import Login from '../src/components/Login.vue';
import Register from '../src/components/Register.vue';
import UserPage from '../src/components/UserPage.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'Register',
    component: Register
  },
  {
    path: '/user',
    name: 'UserPage',
    component: UserPage
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
