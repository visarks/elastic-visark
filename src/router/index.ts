import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/home/index.vue')
  },
  {
    path: '/cluster/:id?',
    name: 'Cluster',
    component: () => import('@/views/cluster/index.vue')
  },
  {
    path: '/index/:name?',
    name: 'Index',
    component: () => import('@/views/index/index.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/settings/index.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router