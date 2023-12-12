<template>
    <div id="app">
        <router-view></router-view>
    </div>
</template>
  
<script>
import Register from './components/Register.vue';
import Login from './components/Login.vue';
import UserPage from './components/UserPage.vue';

export default {
    name: 'App',
    components: {
        Register,
        Login,
        UserPage
    }
};
</script>
  
<style>
body {
    font-family: Arial, sans-serif;
}

/* input[type="text"],
input[type="password"],
input[type="email"] {
    width: 100%;
    padding: 10px;
    margin: 10px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
} */

</style>
  