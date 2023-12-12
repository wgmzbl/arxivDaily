<template>
  <div>
    <form @submit.prevent="login">
    <h2>Login</h2>
      <div class="login-container">
        <div class="input-group margin-bottom-sm">
          <span class="input-group-addon"><i class="fa fa-user fa-fw"></i></span>
          <input id="username" class="form-control" type="text" placeholder="Username" v-model="username">
        </div>
        <div class="input-group">
          <span class="input-group-addon"><i class="fa fa-key fa-fw"></i></span>
          <input id="password"  v-model="password" class="form-control" type="password" placeholder="Password" required>
        </div>
        <button type="submit">Login</button>
        <button type="button" onclick="window.location.href='/register'">Register</button>
      </div>
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
    </form>
  </div>
</template>
  
<script>
import axios from 'axios';

export default {
  data() {
    return {
      username: '',
      password: '',
      errorMessage: '' // 用于显示错误消息
    };
  },
  methods: {
    async login() {
      try {
        const response = await axios.post('/login', {
          username: this.username,
          password: this.password
        });

        if (response.data.success) {
          window.location.href = '/user';; // 登录成功，跳转到主页
        } else {
          this.errorMessage = 'Incorrect username or password.'; // 显示错误消息
        }

        // 清空表单
        this.username = '';
        this.password = '';
      } catch (error) {
        this.errorMessage = error.response.data.message || 'An error occurred.';
      }
    }
  }
};
</script>

<style>
.error-message {
  color: red;
  margin-top: 10px;
}
</style>
