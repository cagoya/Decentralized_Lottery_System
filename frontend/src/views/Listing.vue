<template>
  <div class="listing-page">
    <div class="main-content">
      <el-card class="listings-card" shadow="always">
        <template #header>
          <div class="card-header">
            <span class="card-title">挂单市场</span>
            <el-button 
              type="primary" 
              size="default" 
              plain
              @click="loadListings"
              :loading="loading"
              :icon="Refresh"
            >
              刷新
            </el-button>
          </div>
        </template>

        <!-- 搜索筛选区 -->
        <div class="search-section">
          <el-row :gutter="20">
            <el-col :span="24" :md="12">
              <el-radio-group v-model="searchType" @change="onSearchTypeChange">
                <el-radio-button value="activity">按活动查询</el-radio-button>
                <el-radio-button value="seller">查询我的挂单</el-radio-button>
              </el-radio-group>
            </el-col>
          </el-row>

          <!-- 按活动查询 -->
          <el-row v-if="searchType === 'activity'" :gutter="20" class="search-row">
            <el-col :span="24" :md="16">
              <el-input 
                v-model="selectedActivityId" 
                placeholder="请输入活动ID" 
                type="number"
                clearable
                @keyup.enter="loadListings"
              />
            </el-col>
            <el-col :span="24" :md="8">
              <el-button 
                type="primary" 
                @click="loadListings"
                :loading="loading"
                style="width: 100%;"
              >
                查询
              </el-button>
            </el-col>
          </el-row>

          <!-- 查询我的挂单 -->
          <div v-else-if="searchType === 'seller'" class="my-listings-info">
            <el-alert 
              v-if="!account"
              title="请先连接钱包查看您的挂单" 
              type="warning" 
              :closable="false"
              show-icon
            />
            <el-alert 
              v-else
              :title="`当前查询账户: ${formatAddress(account)}`" 
              type="info" 
              :closable="false"
              show-icon
            />
          </div>
        </div>

        <el-divider />

        <!-- 未连接钱包状态（仅在查询我的挂单时） -->
        <div v-if="searchType === 'seller' && !account" class="empty-state">
          <el-empty description="请先连接钱包查看您的挂单" :image-size="120" />
          <el-button 
            type="primary" 
            size="large"
            @click="onClickConnectWallet"
            class="connect-btn"
          >
            连接钱包
          </el-button>
        </div>

        <!-- 加载中状态 -->
        <div v-else-if="loading" class="loading-state">
          <el-icon class="is-loading loading-icon"><Loading /></el-icon>
          <span>加载挂单中...</span>
        </div>

        <!-- 无挂单状态 -->
        <div v-else-if="listings.length === 0" class="empty-state">
          <el-empty description="暂无挂单" :image-size="120" />
          <router-link to="/ticket">
            <el-button type="primary" size="large">
              查看我的凭证
            </el-button>
          </router-link>
        </div>

        <!-- 挂单列表 -->
        <div v-else class="listings-grid">
          <ListingCard
            v-for="listing in listings"
            :key="listing.id"
            :listing="listing"
            :activity-name="getActivityName(listing)"
            :option-name="getOptionName(listing)"
            :current-account="account"
            :lottery-contract="lotteryContract"
            :erc20-contract="myERC20Contract"
            @cancel-success="loadListings"
            @show-buy-dialog="showBuyDialog"
            @show-cancel-dialog="showCancelDialog"
          />
        </div>
      </el-card>
    </div>

    <!-- 购买确认对话框 -->
    <el-dialog 
      v-model="buyDialogVisible" 
      title="购买凭证" 
      width="450px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedListing" class="buy-dialog-content">
        <el-alert 
          title="购买确认" 
          type="warning" 
          :closable="false"
          show-icon
        >
          您即将花费 {{ selectedListing.price }} ZJU 购买该凭证
        </el-alert>
        
        <div class="buy-info">
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">凭证ID:</el-col>
            <el-col :span="14">{{ selectedListing.ticketId }}</el-col>
          </el-row>
          
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">投注金额:</el-col>
            <el-col :span="14">{{ selectedListing.amount }} ZJU</el-col>
          </el-row>
          
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">购买价格:</el-col>
            <el-col :span="14" class="price">{{ selectedListing.price }} ZJU</el-col>
          </el-row>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="buyDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="onBuyListing"
          :loading="buyLoading"
        >
          确认购买
        </el-button>
      </template>
    </el-dialog>

    <!-- 取消出售确认对话框 -->
    <el-dialog 
      v-model="cancelDialogVisible" 
      title="取消出售确认" 
      width="450px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedCancelListing" class="cancel-dialog-content">
        <el-alert 
          title="取消出售确认" 
          type="warning" 
          :closable="false"
          show-icon
        >
          您确定要取消该凭证的出售吗？取消后将无法恢复。
        </el-alert>
        
        <div class="cancel-info">
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">挂单ID:</el-col>
            <el-col :span="14">{{ selectedCancelListing.id }}</el-col>
          </el-row>
          
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">凭证ID:</el-col>
            <el-col :span="14">{{ selectedCancelListing.ticketId }}</el-col>
          </el-row>
          
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">活动名称:</el-col>
            <el-col :span="14">{{ getActivityName(selectedCancelListing) }}</el-col>
          </el-row>
          
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">投注选项:</el-col>
            <el-col :span="14">
              <el-tag type="success" size="small">{{ getOptionName(selectedCancelListing) }}</el-tag>
            </el-col>
          </el-row>
          
          <el-row :gutter="20" class="info-row">
            <el-col :span="10" class="label">出售价格:</el-col>
            <el-col :span="14" class="price">{{ selectedCancelListing.price }} ZJU</el-col>
          </el-row>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="cancelDialogVisible = false">取消</el-button>
        <el-button 
          type="danger" 
          @click="onCancelListing"
          :loading="cancelLoading"
        >
          确认取消
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, watch, type Ref } from 'vue'
import { ElCard, ElButton, ElEmpty, ElIcon, ElMessage, ElRadioGroup, ElRadioButton, ElRow, ElCol, ElInput, ElDivider, ElAlert, ElDialog, ElTag } from 'element-plus'
import { Loading, Refresh } from '@element-plus/icons-vue'
import ListingCard from '../components/ListingCard.vue'

// 从 App.vue 注入的依赖
const lotteryContract = inject('lotteryContract') as any
const myERC20Contract = inject('myERC20Contract') as any
const account = inject('account') as Ref<string>
const onClickConnectWallet = inject('onClickConnectWallet') as () => Promise<void>

// 接口定义 - 对应合约的 ListingResponse 结构
interface Listing {
  id: string
  ticketId: string
  activityId: string
  name: string  // 活动名称
  option: string  // 选项名称
  seller: string
  price: number
  amount: number
  endTime: number
  status: number  // 0: Selling, 1: Cancelled, 2: Sold
}

// 状态
const listings = ref<Listing[]>([])
const loading = ref(false)
const searchType = ref<'activity' | 'seller'>('activity')
const selectedActivityId = ref<string>('')

// 购买对话框相关状态
const buyDialogVisible = ref(false)
const buyLoading = ref(false)
const selectedListing = ref<Listing | null>(null)

// 取消对话框相关状态
const cancelDialogVisible = ref(false)
const cancelLoading = ref(false)
const selectedCancelListing = ref<Listing | null>(null)

/**
 * 加载挂单列表
 */
const loadListings = async () => {
  if (!lotteryContract) {
    listings.value = []
    return
  }

  // 如果是查询我的挂单，需要先连接钱包
  if (searchType.value === 'seller' && !account.value) {
    listings.value = []
    return
  }

  loading.value = true
  try {
    let result

    if (searchType.value === 'activity') {
      // 按活动ID查询
      if (!selectedActivityId.value) {
        ElMessage.warning('请选择一个活动')
        listings.value = []
        loading.value = false
        return
      }
      
      result = await lotteryContract.methods
        .getListingsByActivityId(selectedActivityId.value)
        .call()
    } else {
      // 查询我的挂单
      result = await lotteryContract.methods
        .getListingsBySeller()
        .call({ from: account.value })
    }
    
    if (result && Array.isArray(result)) {
      // ListingResponse 已经包含了活动名称和选项名称，无需再从 activities 中查找
      listings.value = result.map((listing: any) => ({
        id: listing.id.toString(),
        ticketId: listing.ticketId.toString(),
        activityId: listing.activityId.toString(),
        name: listing.name,  // 活动名称
        option: listing.option,  // 选项名称
        seller: listing.seller,
        price: parseInt(listing.price.toString()),
        amount: parseInt(listing.amount.toString()),
        endTime: parseInt(listing.endTime.toString()),
        status: parseInt(listing.status.toString())
      }))
    } else {
      listings.value = []
    }
  } catch (error: any) {
    console.error('加载挂单失败:', error)
    ElMessage.error(error.message || '加载挂单失败')
    listings.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 获取活动名称 - 直接从 listing 对象获取
 */
const getActivityName = (listing: Listing): string => {
  return listing.name || `活动 #${listing.activityId}`
}

/**
 * 获取选项名称 - 直接从 listing 对象获取
 */
const getOptionName = (listing: Listing): string => {
  return listing.option || '未知选项'
}

/**
 * 格式化地址
 */
const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

/**
 * 显示购买对话框
 */
const showBuyDialog = (listing: Listing) => {
  if (!account.value) {
    ElMessage.warning('请先连接钱包')
    return
  }
  selectedListing.value = listing
  buyDialogVisible.value = true
}

/**
 * 显示取消确认对话框
 */
const showCancelDialog = (listing: Listing) => {
  selectedCancelListing.value = listing
  cancelDialogVisible.value = true
}

/**
 * 购买挂单
 */
const onBuyListing = async () => {
  if (!account.value || !lotteryContract || !myERC20Contract || !selectedListing.value) {
    ElMessage.error('合约或账户未准备就绪')
    return
  }

  buyLoading.value = true
  try {
    // 步骤1: 授权 ERC20 代币给卖家
    ElMessage.info('正在授权代币...')
    
    const lotteryAddress = lotteryContract.options.address
    await myERC20Contract.methods
      .approve(lotteryAddress, selectedListing.value.price)
      .send({ from: account.value })

    ElMessage.success('授权成功！')

    // 步骤2: 调用 buyListing
    ElMessage.info('正在购买凭证...')
    
    await lotteryContract.methods
      .buyListing(selectedListing.value.id)
      .send({ from: account.value })

    ElMessage.success('购买成功！')
    
    // 关闭对话框
    buyDialogVisible.value = false
    selectedListing.value = null
    
    // 刷新挂单列表
    loadListings()
    
  } catch (error: any) {
    console.error('购买失败:', error)
    ElMessage.error(error.message || '购买失败，请重试')
  } finally {
    buyLoading.value = false
  }
}

/**
 * 取消挂单
 */
const onCancelListing = async () => {
  if (!account.value || !lotteryContract || !selectedCancelListing.value) {
    ElMessage.error('合约或账户未准备就绪')
    return
  }

  cancelLoading.value = true
  try {
    ElMessage.info('正在取消出售...')
    
    await lotteryContract.methods
      .cancelListing(selectedCancelListing.value.id)
      .send({ from: account.value })

    ElMessage.success('取消成功！')
    
    // 关闭对话框
    cancelDialogVisible.value = false
    selectedCancelListing.value = null
    
    // 刷新挂单列表
    loadListings()
    
  } catch (error: any) {
    console.error('取消失败:', error)
    ElMessage.error(error.message || '取消失败，请重试')
  } finally {
    cancelLoading.value = false
  }
}

/**
 * 搜索类型变化时的处理
 */
const onSearchTypeChange = () => {
  // 清空当前列表
  listings.value = []
  
  // 如果切换到"查询我的挂单"且已连接钱包，则立即加载
  if (searchType.value === 'seller' && account.value) {
    loadListings()
  }
  // 如果切换到"按活动查询"，等待用户输入活动ID后再查询
}

// 监听账户变化
watch(account, () => {
  if (searchType.value === 'seller') {
    if (account.value) {
      loadListings()
    } else {
      listings.value = []
    }
  }
})

// 组件挂载时加载数据（不需要预加载，等用户输入活动ID后再查询）
onMounted(() => {
  // 初始不加载任何数据，等用户选择查询类型和输入参数
})
</script>

<style scoped>
/* 基础样式重置 */
* {
  box-sizing: border-box;
}

/* 页面容器和背景 - 蓝色系渐变 */
.listing-page {
  min-height: calc(100vh - 64px);
  background: linear-gradient(135deg, #4c87e8 0%, #20a0ff 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  padding: 0;
}

/* 主内容区 */
.main-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  max-width: 1200px;
  width: 95%;
  margin: 0 auto;
}

/* 挂单卡片容器 */
.listings-card {
  width: 100%;
  border-radius: 12px;
  background: #ffffff;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:deep(.el-card__header) {
  padding: 18px 24px;
  border-bottom: 1px solid #ebeef5;
  background: #f7f9fc;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
}

/* 搜索区域 */
.search-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 10px;
}

.search-row {
  margin-top: 15px;
}

.my-listings-info {
  margin-top: 15px;
}

/* 空状态和加载状态 */
.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
  gap: 20px;
}

.loading-icon {
  font-size: 32px;
  color: #409eff;
}

.connect-btn {
  min-width: 180px;
  height: 44px;
  font-size: 1rem !important;
  font-weight: 600;
  border-radius: 8px;
}

/* 挂单网格 */
.listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  padding: 10px 0;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .main-content {
    padding: 20px 10px;
    width: 100%;
  }

  .listings-grid {
    grid-template-columns: 1fr;
  }
  
  .search-section :deep(.el-radio-group) {
    display: flex;
    flex-direction: column;
  }
  
  .search-section :deep(.el-radio-button) {
    width: 100%;
  }
}

/* 购买对话框内容 */
.buy-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.buy-info {
  padding: 15px;
  background: #f7f9fc;
  border-radius: 8px;
}

.buy-info .info-row {
  margin-bottom: 10px;
  font-size: 14px;
}

.buy-info .label {
  font-weight: bold;
  color: #606266;
}

.buy-info .price {
  color: #f56c6c;
  font-weight: 700;
  font-size: 1.1rem;
}

/* 取消对话框内容 */
.cancel-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cancel-info {
  padding: 15px;
  background: #f7f9fc;
  border-radius: 8px;
}

.cancel-info .info-row {
  margin-bottom: 10px;
  font-size: 14px;
}

.cancel-info .label {
  font-weight: bold;
  color: #606266;
}

.cancel-info .price {
  color: #f56c6c;
  font-weight: 700;
  font-size: 1.1rem;
}
</style>

