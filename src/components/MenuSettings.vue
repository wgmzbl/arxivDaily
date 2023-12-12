<template>
    <div class="user-page center-containar">
        <div class="menu-settings">
            <h2>Menu Settings</h2>
            <div>
                <h2>You can adjust menus of main page by dragging them</h2>
                <div class="fav-categories">
                    <h3>Favoriate Categories</h3>
                    <draggable v-model="userCategories" group="categories" class="menu">
                        <template #item="{ element }">
                            <li class="draggable-item">{{ element}}</li>
                        </template>
                    </draggable>
                </div>
                <div class="user-categories">
                    <h3>Hidden Categories</h3>
                    <draggable v-model="hiddenCategories" group="categories" class="menu">
                        <template #item="{ element }">
                            <li class="draggable-item">{{ element}}</li>
                        </template>
                    </draggable>
                </div>
            </div>
            <button @click="saveCategories">Save</button>
        </div>
    </div>
</template>

  
<script>

import draggable from 'vuedraggable';
import axios from 'axios';
export default {
    components: {
        draggable
    },
    data() {
        return {
            categories: [],
            hiddenCategories: [], // 所有类别
            userCategories: [] // 用户选择的类别
        };
    },
    mounted() {
        this.fetchCategories()
        .then(() => {
            this.fetchUserCategories()
            .then(() => {

                this.hiddenCategories = this.categories.filter(category => !this.userCategories.includes(category));
            });
        });
    },
    methods: {
        async fetchCategories() {
            try {
                const response = await axios.get('/categories');
                this.categories = response.data.categories;
            } catch (error) {
                alert('Error fetching categories');
            }
        },
        async fetchUserCategories() {
            try {
                const response = await axios.get('/getUserCategories');
                this.userCategories = response.data.categories;
                if(this.userCategories.lenth == 0){
                    this.userCategories = this.categories;
                }
            } catch (error) {
                alert('Error fetching user categories');
            }
        },
        async saveCategories() {
            try {
                await axios.post('/saveCategories', { categories: this.userCategories });
                alert('Menus saved successfully');
            } catch (error) {
                alert('Error saving categories');
            }
        }
    }
};

</script>
  
<style>
.menu{
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    position: relative;
    width: auto;
    height: auto;
    top:auto;
}
.menu li{
    margin: 5px;
}
</style>
  
