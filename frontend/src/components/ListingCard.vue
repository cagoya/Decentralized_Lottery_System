<template>
  <el-card 
    class="listing-card"
    shadow="hover"
  >
    <div class="card-content">
      <!-- 挂单头部 -->
      <div class="listing-header">
        <el-tag type="danger" size="large" class="listing-id-tag">
          挂单 #{{ listing.id }}
        </el-tag>
        <el-tag 
          :type="listingStatusType" 
          size="small"
        >
          {{ listingStatusText }}
        </el-tag>
      </div>

      <el-divider class="divider" />

      <!-- 挂单信息 - 使用 el-row/el-col 格式 -->
      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">凭证ID:</el-col>
        <el-col :span="16">{{ listing.ticketId }}</el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">活动ID:</el-col>
        <el-col :span="16">{{ listing.activityId }}</el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">活动名称:</el-col>
        <el-col :span="16">{{ activityName }}</el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">投注选项:</el-col>
        <el-col :span="16">
          <el-tag type="success" size="small">
            {{ optionName }}
          </el-tag>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">投注金额:</el-col>
        <el-col :span="16" class="amount">{{ listing.amount }} ZJU</el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">出售价格:</el-col>
        <el-col :span="16" class="price">{{ listing.price }} ZJU</el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">卖家:</el-col>
        <el-col :span="16" class="address">
          {{ formatAddress(listing.seller) }}
        </el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">结束时间:</el-col>
        <el-col :span="16">{{ formatTimestamp(listing.endTime) }}</el-col>
      </el-row>

      <!-- 操作按钮 -->
      <div v-if="listing.status === 0" class="listing-actions">
        <!-- 如果是卖家，显示取消按钮 -->
        <el-button 
          v-if="isSeller" 
          type="danger" 
          @click="onClickCancel"
          :loading="cancelLoading"
        >
          取消出售
        </el-button>
        <!-- 如果不是卖家，显示购买按钮 -->
        <el-button 
          v-else 
          type="primary" 
          @click="onClickBuy"
          :disabled="!currentAccount"
        >
          购买凭证
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElCard, ElRow, ElCol, ElTag, ElDivider, ElButton, ElMessage } from 'element-plus'

// 对应合约的 ListingResponse 结构
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

interface Props {
  listing: Listing
  activityName: string
  optionName: string
  currentAccount?: string
  lotteryContract?: any
  erc20Contract?: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'cancel-success': []
  'show-buy-dialog': [listing: Listing]
  'show-cancel-dialog': [listing: Listing]
}>()

const cancelLoading = ref(false)

/**
 * 计算属性：是否是卖家
 */
const isSeller = computed(() => {
  return props.currentAccount && 
         props.listing.seller.toLowerCase() === props.currentAccount.toLowerCase()
})

/**
 * 计算属性：挂单状态文本
 */
const listingStatusText = computed(() => {
  const statusMap: Record<number, string> = {
    0: '出售中',
    1: '已取消',
    2: '已售出'
  }
  return statusMap[props.listing.status] || '未知'
})

/**
 * 计算属性：挂单状态类型
 */
const listingStatusType = computed(() => {
  const typeMap: Record<number, 'success' | 'warning' | 'info' | 'danger'> = {
    0: 'success',
    1: 'info',
    2: 'warning'
  }
  return typeMap[props.listing.status] || 'info'
})

/**
 * 点击购买按钮
 */
const onClickBuy = () => {
  if (!props.currentAccount) {
    ElMessage.warning('请先连接钱包')
    return
  }
  emit('show-buy-dialog', props.listing)
}

/**
 * 点击取消按钮
 */
const onClickCancel = () => {
  emit('show-cancel-dialog', props.listing)
}

/**
 * 格式化地址
 */
const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

/**
 * 格式化时间戳
 */
const formatTimestamp = (timestamp: number): string => {
  if (!timestamp || timestamp === 0) return 'N/A'
  
  const timestampMs = timestamp * 1000
  if (isNaN(timestampMs)) return '无效时间'
  
  return new Date(timestampMs).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.listing-card {
  border-radius: 10px;
  transition: all 0.3s ease;
  border: 1px solid #e0e0e0;
}

.listing-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* 挂单头部 */
.listing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.listing-id-tag {
  font-size: 1rem;
  font-weight: 600;
  padding: 8px 16px;
}

.divider {
  margin: 10px 0;
}

/* 信息行 */
.info-row {
  margin-bottom: 10px;
  font-size: 14px;
}

.label {
  font-weight: bold;
  color: #606266;
}

.amount {
  color: #e6a23c;
  font-weight: 600;
  font-size: 1rem;
}

.price {
  color: #f56c6c;
  font-weight: 700;
  font-size: 1.1rem;
}

.address {
  font-family: monospace;
  color: #909399;
  font-size: 0.9rem;
}

/* 操作按钮 */
.listing-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.listing-actions .el-button {
  flex: 1;
  min-width: 100px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .listing-actions {
    flex-direction: column;
  }

  .listing-actions .el-button {
    width: 100%;
  }
}
</style>

