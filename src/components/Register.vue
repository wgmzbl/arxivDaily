<template>
  <div>
    <h2>Register</h2>
    <form action="/register" method="post">
      <div class="login-container">
        <div class="input-group margin-bottom-sm">
          <span class="input-group-addon"><i class="fa fa-user fa-fw"></i></span>
          <input id="username" name="username" class="form-control" type="text" placeholder="Username" v-model="username">
        </div>
        <div class="input-group margin-bottom-sm">
          <span class="input-group-addon"><i class="fa fa-envelope fa-fw"></i></span>
          <input id="email" name="email" class="form-control" type="text" placeholder="Email" v-model="email">
        </div>
        <div class="input-group">
          <span class="input-group-addon"><i class="fa fa-key fa-fw"></i></span>
          <input id="password" name="password" v-model="password" class="form-control" type="password" placeholder="Password" required>
        </div>
        <div class="cf-turnstile" data-sitekey="0x4AAAAAAAOHhySkSfZRe9OY" ref="turnstile"></div>
        <div v-if="message" class="message">{{ message }}</div>
        <button type="submit">Register</button>
      </div>
    </form>
  </div>
</template>

<script>

export default {
};
</script>

<style>
.message {
  margin-top: 10px;
  color: red;
}
</style>
