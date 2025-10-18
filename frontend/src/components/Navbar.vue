<template>
  <nav class="navbar">
    <div class="navbar-container">
      <!-- Logo 和标题 -->
      <div class="navbar-brand">
        <router-link to="/" class="brand-link">
          <span class="brand-text">去中心化彩票系统</span>
        </router-link>
      </div>

      <!-- 导航链接 -->
      <div class="navbar-menu">
        <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
          <el-icon><House /></el-icon>
          <span>首页</span>
        </router-link>
        <router-link to="/activity" class="nav-item" :class="{ active: $route.path === '/activity' }">
          <el-icon><Trophy /></el-icon>
          <span>竞猜活动</span>
        </router-link>
        <router-link to="/ticket" class="nav-item" :class="{ active: $route.path === '/ticket' }">
          <el-icon><Ticket /></el-icon>
          <span>我的凭证</span>
        </router-link>
        <router-link to="/listing" class="nav-item" :class="{ active: $route.path === '/listing' }">
          <el-icon><ShoppingCart /></el-icon>
          <span>挂单市场</span>
        </router-link>
      </div>

      <!-- 账户信息和连接钱包 -->
      <div class="navbar-account">
        <!-- 未连接钱包 -->
        <template v-if="!account">
          <el-button 
            type="primary" 
            @click="onClickConnectWallet"
            class="connect-wallet-btn"
          >
            <el-icon class="btn-icon"><Wallet /></el-icon>
            连接钱包
          </el-button>
        </template>

        <!-- 已连接钱包 -->
        <template v-else>
          <!-- 余额显示 -->
          <div class="balance-display">
            <el-icon class="balance-icon"><Coin /></el-icon>
            <span class="balance-text">{{ accountBalance }} ZJU</span>
          </div>

          <!-- 账户地址下拉菜单 -->
          <el-dropdown trigger="click" class="account-dropdown">
            <div class="account-info">
              <el-avatar :size="32" class="account-avatar">
                {{ account.substring(2, 4).toUpperCase() }}
              </el-avatar>
              <span class="account-address">
                {{ formatAddress(account) }}
              </span>
              <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <div class="dropdown-header">
                    <strong>当前账户</strong>
                  </div>
                </el-dropdown-item>
                <el-dropdown-item>
                  <div class="full-address" @click="copyAddress">
                    <el-icon><CopyDocument /></el-icon>
                    {{ account }}
                  </div>
                </el-dropdown-item>
                <el-dropdown-item divided v-if="accountBalance === 0">
                  <div @click="onClaimTokenAirdrop">
                    <el-icon><Present /></el-icon>
                    领取空投
                  </div>
                </el-dropdown-item>
                <el-dropdown-item v-if="isManager">
                  <div class="manager-badge">
                    <el-icon><Star /></el-icon>
                    管理员身份
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </div>

      <!-- 移动端菜单按钮 -->
      <div class="mobile-menu-btn" @click="toggleMobileMenu">
        <el-icon :size="24"><Menu /></el-icon>
      </div>
    </div>

    <!-- 移动端菜单 -->
    <transition name="slide-down">
      <div v-if="mobileMenuVisible" class="mobile-menu">
        <router-link 
          to="/" 
          class="mobile-nav-item" 
          :class="{ active: $route.path === '/' }"
          @click="closeMobileMenu"
        >
          <el-icon><House /></el-icon>
          <span>首页</span>
        </router-link>
        <router-link 
          to="/activity" 
          class="mobile-nav-item" 
          :class="{ active: $route.path === '/activity' }"
          @click="closeMobileMenu"
        >
          <el-icon><Trophy /></el-icon>
          <span>竞猜活动</span>
        </router-link>
        <router-link 
          to="/ticket" 
          class="mobile-nav-item" 
          :class="{ active: $route.path === '/ticket' }"
          @click="closeMobileMenu"
        >
          <el-icon><Ticket /></el-icon>
          <span>我的凭证</span>
        </router-link>
        <router-link 
          to="/listing" 
          class="mobile-nav-item" 
          :class="{ active: $route.path === '/listing' }"
          @click="closeMobileMenu"
        >
          <el-icon><ShoppingCart /></el-icon>
          <span>挂单市场</span>
        </router-link>
        
        <div v-if="!account" class="mobile-wallet-section">
          <el-button 
            type="primary" 
            @click="handleMobileConnect"
            block
          >
            <el-icon><Wallet /></el-icon>
            连接钱包
          </el-button>
        </div>
        
        <div v-else class="mobile-account-section">
          <div class="mobile-balance">
            <el-icon><Coin /></el-icon>
            余额: {{ accountBalance }} ZJU
          </div>
          <div class="mobile-address">
            账户: {{ formatAddress(account) }}
          </div>
          <el-button 
            v-if="accountBalance === 0"
            type="success" 
            size="small"
            @click="handleMobileAirdrop"
            plain
          >
            领取空投
          </el-button>
        </div>
      </div>
    </transition>
  </nav>
</template>

<script setup lang="ts">
import { ref, inject, computed, type Ref } from 'vue'
import { ElButton, ElIcon, ElDropdown, ElDropdownMenu, ElDropdownItem, ElAvatar, ElMessage } from 'element-plus'
import { House, Trophy, Ticket, Wallet, Coin, ArrowDown, CopyDocument, Present, Star, Menu, ShoppingCart } from '@element-plus/icons-vue'

// 从 App.vue 注入的依赖
const account = inject('account') as Ref<string>
const accountBalance = inject('accountBalance') as Ref<number>
const managerAccount = inject('managerAccount') as Ref<string>
const onClaimTokenAirdrop = inject('onClaimTokenAirdrop') as () => Promise<void>
const onClickConnectWallet = inject('onClickConnectWallet') as () => Promise<void>

// 移动端菜单状态
const mobileMenuVisible = ref(false)

// 判断是否是管理员
const isManager = computed(() => {
  return account.value !== '' && 
         managerAccount.value !== '' && 
         account.value.toLowerCase() === managerAccount.value.toLowerCase()
})

/**
 * 格式化地址显示
 */
const formatAddress = (address: string): string => {
  if (!address) return ''
  return `${address.substring(0, 6)}...${address.substring(38)}`
}

/**
 * 复制地址到剪贴板
 */
const copyAddress = async () => {
  try {
    await navigator.clipboard.writeText(account.value)
    ElMessage.success('地址已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

/**
 * 切换移动端菜单
 */
const toggleMobileMenu = () => {
  mobileMenuVisible.value = !mobileMenuVisible.value
}

/**
 * 关闭移动端菜单
 */
const closeMobileMenu = () => {
  mobileMenuVisible.value = false
}

/**
 * 移动端连接钱包
 */
const handleMobileConnect = async () => {
  await onClickConnectWallet()
  closeMobileMenu()
}

/**
 * 移动端领取空投
 */
const handleMobileAirdrop = async () => {
  await onClaimTokenAirdrop()
  closeMobileMenu()
}
</script>

<style scoped>
/* 导航栏容器 */
.navbar {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

/* Logo 品牌 */
.navbar-brand {
  flex-shrink: 0;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: white;
  font-size: 1.3rem;
  font-weight: 700;
  transition: opacity 0.3s;
}

.brand-link:hover {
  opacity: 0.85;
}

.brand-icon {
  font-size: 1.8rem;
}

.brand-text {
  display: inline-block;
}

/* 导航菜单 */
.navbar-menu {
  display: flex;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s;
  background: rgba(255, 255, 255, 0.1);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-weight: 600;
}

/* 账户区域 */
.navbar-account {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.connect-wallet-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  font-weight: 600;
}

.btn-icon {
  font-size: 1.1rem;
}

/* 余额显示 */
.balance-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: white;
  font-weight: 600;
}

.balance-icon {
  color: #ffd700;
  font-size: 1.1rem;
}

.balance-text {
  font-size: 0.95rem;
}

/* 账户下拉菜单 */
.account-dropdown {
  cursor: pointer;
}

.account-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  color: white;
  transition: all 0.3s;
}

.account-info:hover {
  background: rgba(255, 255, 255, 0.25);
}

.account-avatar {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
}

.account-address {
  font-size: 0.9rem;
  font-weight: 500;
}

.dropdown-icon {
  font-size: 0.9rem;
  transition: transform 0.3s;
}

:deep(.el-dropdown__popper) {
  margin-top: 8px !important;
}

/* 下拉菜单内容 */
.dropdown-header {
  padding: 4px 0;
  color: #606266;
}

.full-address {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
  font-size: 0.85rem;
  cursor: pointer;
}

.manager-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e6a23c;
  font-weight: 600;
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  display: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.3s;
}

.mobile-menu-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 移动端菜单 */
.mobile-menu {
  display: none;
  background: rgba(255, 255, 255, 0.98);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding: 12px;
}

.mobile-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  color: #333;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s;
  background: #f5f5f5;
}

.mobile-nav-item:hover,
.mobile-nav-item.active {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white;
}

.mobile-wallet-section,
.mobile-account-section {
  padding: 12px;
  margin-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.mobile-account-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-balance,
.mobile-address {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #333;
}

/* 过渡动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 500px;
  opacity: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .navbar-container {
    padding: 0 16px;
  }

  .brand-text {
    font-size: 1.1rem;
  }

  .navbar-menu,
  .navbar-account {
    display: none;
  }

  .mobile-menu-btn {
    display: block;
  }

  .mobile-menu {
    display: block;
  }
}

@media (max-width: 480px) {
  .brand-text {
    display: none;
  }

  .brand-icon {
    font-size: 1.5rem;
  }
}
</style>

