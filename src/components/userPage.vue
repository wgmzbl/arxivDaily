<template>
    <div>
        <button @click="backToMain"><i class="fa fa-arrow-left"></i></button>
        <button @click="activeComponent='viewFavor'">View Favor</button>
        <button @click="activeComponent = 'passwordChange'">Change Password</button>
        <button @click="activeComponent = 'menuSettings'">Menu Settings</button>
        <button @click="logout">Logout</button>

        <view-favor v-if="activeComponent === 'viewFavor'"></view-favor>
        <password-change v-if="activeComponent === 'passwordChange'"></password-change>
        <menu-settings v-if="activeComponent === 'menuSettings'"></menu-settings>
    </div>
</template>
  
<script>
import PasswordChange from './PasswordChange.vue';
import MenuSettings from './MenuSettings.vue';
import ViewFavor from './ViewFavor.vue';

export default {
    components: {
        PasswordChange,
        MenuSettings,
        ViewFavor
    },
    data() {
        return {
            activeComponent: 'viewFavor'
        };
    },
    methods: {
        backToMain() {
            window.location.href = '/';
        },
        logout() {
            window.location.href = '/logout';
        }
    }
};
</script>
  