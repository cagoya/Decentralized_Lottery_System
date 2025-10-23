import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/Home.vue')
    },
    {
      path: '/activity',
      name: 'Activity',
      component: () => import('../views/Activity.vue')
    },
    {
      path: '/ticket',
      name: 'Ticket',
      component: () => import('../views/Ticket.vue')
    },
    {
      path: '/listing',
      name: 'Listing',
      component: () => import('../views/Listing.vue')
    },
    {
      // 将其余URL重定向到主页
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router;