const fs = require('fs');

const path = 'd:\\Luan_Van\\book_store\\frontend\\src\\components\\customer\\AppHeader.vue';
let content = fs.readFileSync(path, 'utf8');

const scriptTag = `<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
const authStore = useAuthStore()
const showAccountMenu = ref(false)
</script>

<template>`;

content = content.replace('<template>', scriptTag);

const regex = /<!-- TA.*kho.* -->[\s\S]*?<div style="font-size: 13px;">TA.*kho.*<\/div>\s*<\/div>/g;

const newBlock = `<!-- Tài khoản (Dropdown) -->
          <div class="position-relative" @mouseenter="showAccountMenu = true" @mouseleave="showAccountMenu = false">
            <div class="text-center text-secondary custom-icon-btn d-flex flex-column align-items-center" @click="showAccountMenu = !showAccountMenu">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" class="mb-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div style="font-size: 13px;">Tài khoản</div>
            </div>
            
            <!-- Popup Tài khoản -->
            <div v-show="showAccountMenu" class="position-absolute bg-white shadow rounded p-3" style="top: 100%; right: -20px; min-width: 260px; z-index: 1000; border: 1px solid #eee;">
              <template v-if="!authStore.isLoggedIn">
                <router-link to="/login" class="btn btn-danger w-100 mb-2 fw-bold" style="border-radius: 8px;">Đăng nhập</router-link>
                <router-link to="/register" class="btn btn-outline-danger w-100 fw-bold" style="border-radius: 8px;">Đăng ký</router-link>
              </template>
              <template v-else>
                <div class="text-center mb-3">
                  <p class="mb-0 text-muted" style="font-size: 13px;">Xin chào,</p>
                  <h6 class="fw-bold mb-0 text-truncate" :title="authStore.user?.full_name">{{ authStore.user?.full_name }}</h6>
                </div>
                <hr class="mb-3">
                <button @click="authStore.logout" class="btn btn-danger w-100 fw-bold" style="border-radius: 8px;">Đăng xuất</button>
              </template>
            </div>
          </div>`;

content = content.replace(regex, newBlock);
fs.writeFileSync(path, content, 'utf8');

const homePath = 'd:\\Luan_Van\\book_store\\frontend\\src\\views\\customer\\HomeView.vue';
let homeContent = fs.readFileSync(homePath, 'utf8');
const testHeaderRegex = /<!-- Test Đăng nhập Header -->[\s\S]*?<\/div>\s*<\/div>/;
homeContent = homeContent.replace(testHeaderRegex, '');
fs.writeFileSync(homePath, homeContent, 'utf8');

console.log('Done!');
