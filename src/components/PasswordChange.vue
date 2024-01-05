<template>
  <div class="user-page center-container">
    <div class="password-change">
      <h2>Change Password</h2>
      <form @submit.prevent="changePassword">
        <div class="center-container">
          <div class="login-container">
            <div class="input-group margin-bottom-sm">
              <span class="input-group-addon"><i class="fa fa-key fa-fw"></i></span>
              <input type="password" placeholder="Old Password" v-model="passwords.old">
            </div>
            <div class="input-group">
              <span class="input-group-addon"><i class="fa fa-key fa-fw"></i></span>
              <input v-model="passwords.new" type="password" placeholder="New Password" required>
            </div>
            <button type="submit">Change Password</button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
<script>
import axios from 'axios';

export default {
  data() {
    return {
      passwords: {
        old: '',
        new: ''
      }
    };
  },
  methods: {
    async changePassword() {
      try {
        const response = await axios.post('/changePassword', this.passwords);
        if (response.data.success) {
          alert('Password changed successfully');
        } else {
          alert('Error changing password');
        }
      } catch (error) {
        alert('Error changing password');
      }
    },
  }
}

</script>