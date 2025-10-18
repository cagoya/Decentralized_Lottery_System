<template>
  <div class="ticket-page">
    <div class="main-content">
      <el-card class="tickets-card" shadow="always">
        <template #header>
          <div class="card-header">
            <span class="card-title">凭证列表</span>
            <el-button 
              type="primary" 
              size="default" 
              plain
              @click="loadTickets"
              :loading="loading"
              :icon="Refresh"
            >
              刷新
            </el-button>
          </div>
        </template>

        <!-- 未连接钱包状态 -->
        <div v-if="!account" class="empty-state">
          <el-empty description="请先连接钱包查看您的凭证" :image-size="120" />
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
          <span>加载凭证中...</span>
        </div>

        <!-- 无凭证状态 -->
        <div v-else-if="tickets.length === 0" class="empty-state">
          <el-empty description="您还没有任何投注凭证" :image-size="120" />
          <router-link to="/">
            <el-button type="primary" size="large">
              去参与活动
            </el-button>
          </router-link>
        </div>

        <!-- 凭证列表 -->
        <div v-else class="tickets-grid">
          <TicketInfoCard
            v-for="ticket in tickets"
            :key="ticket.id"
            :ticket="ticket"
            :activity-name="getActivityName(ticket)"
            :option-name="getOptionName(ticket)"
            :activity-status="getActivityStatus(ticket)"
            :activity-status-type="getActivityStatusType(ticket)"
            @view-activity="viewActivity"
            @show-list-dialog="showListDialog"
          />
        </div>
      </el-card>
    </div>

    <!-- 出售对话框 -->
    <el-dialog 
      v-model="listDialogVisible" 
      title="出售凭证" 
      width="450px"
      :close-on-click-modal="false"
    >
      <el-form :model="listForm" label-position="top">
        <el-form-item label="凭证 ID">
          <el-input :value="currentTicket?.id" disabled />
        </el-form-item>
        
        <el-form-item label="出售价格 (ZJU)">
          <el-input-number
            v-model="listForm.price"
            :min="1"
            :step="1"
            style="width: 100%;"
            placeholder="请输入出售价格"
          />
        </el-form-item>
        
        <el-alert 
          title="提示" 
          type="info" 
          :closable="false"
          show-icon
        >
          出售凭证后，NFT 将转移到合约托管，其他用户可以购买。
        </el-alert>
      </el-form>
      
      <template #footer>
        <el-button @click="listDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="onListTicket"
          :loading="listLoading"
        >
          确认出售
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, watch, type Ref } from 'vue'
import { ElCard, ElButton, ElEmpty, ElIcon, ElMessage, ElDialog, ElForm, ElFormItem, ElInputNumber, ElInput, ElAlert } from 'element-plus'
import { Loading, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import TicketInfoCard from '../components/TicketCard.vue'

const router = useRouter()

// 从 App.vue 注入的依赖
const lotteryContract = inject('lotteryContract') as any
const myERC721Contract = inject('myERC721Contract') as any
const lotteryAddress = inject('lotteryAddress') as string
const account = inject('account') as Ref<string>
const onClickConnectWallet = inject('onClickConnectWallet') as () => Promise<void>

// 接口定义 - 直接对应合约的 TicketResponse 结构
interface Ticket {
  id: string
  activityId: string
  name: string  // 活动名称
  amount: number
  optionIndex: number
  option: string  // 选项名称
  endTime: number
  status: number  // 凭证状态: 0-持有中, 1-出售中, 2-获胜, 3-失败
  activityStatus: number  // 活动状态: 0-进行中, 1-已开奖, 2-已退款
}

// 状态
const tickets = ref<Ticket[]>([])
const loading = ref(false)

// 出售对话框相关
const listDialogVisible = ref(false)
const listLoading = ref(false)
const currentTicket = ref<Ticket | null>(null)
const listForm = ref({
  price: null as number | null
})

/**
 * 加载用户的所有凭证 - 直接从 TicketResponse 获取所有需要的数据
 */
const loadTickets = async () => {
  if (!account.value || !lotteryContract) {
    tickets.value = []
    return
  }

  loading.value = true
  try {
    const result = await lotteryContract.methods
      .getTicketsByOwner(account.value)
      .call()
    
    if (result && Array.isArray(result)) {
      // TicketResponse 已经包含了所有需要的信息，无需再次查询 activities
      tickets.value = result.map((ticket: any) => ({
        id: ticket.id.toString(),
        activityId: ticket.activityId.toString(),
        name: ticket.name,  // 活动名称
        amount: parseInt(ticket.amount.toString()),
        optionIndex: parseInt(ticket.optionIndex.toString()),
        option: ticket.option,  // 选项名称
        endTime: parseInt(ticket.endTime.toString()),
        status: parseInt(ticket.status.toString()),
        activityStatus: parseInt(ticket.activityStatus.toString())
      }))
    } else {
      tickets.value = []
    }
  } catch (error: any) {
    console.error('加载凭证失败:', error)
    ElMessage.error(error.message || '加载凭证失败')
    tickets.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 获取活动名称 - 直接从 ticket 对象获取
 */
const getActivityName = (ticket: Ticket): string => {
  return ticket.name || `活动 #${ticket.activityId}`
}

/**
 * 获取选项名称 - 直接从 ticket 对象获取
 */
const getOptionName = (ticket: Ticket): string => {
  return ticket.option || `选项 ${ticket.optionIndex}`
}

/**
 * 获取活动状态 - 直接从 ticket 对象获取
 */
const getActivityStatus = (ticket: Ticket): string => {
  const statusMap: Record<number, string> = {
    0: '进行中',
    1: '已开奖',
    2: '已退款'
  }
  return statusMap[ticket.activityStatus] || '未知'
}

/**
 * 获取活动状态类型 - 直接从 ticket 对象获取
 */
const getActivityStatusType = (ticket: Ticket): 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<number, 'success' | 'warning' | 'info' | 'danger'> = {
    0: 'success',
    1: 'info',
    2: 'warning'
  }
  return typeMap[ticket.activityStatus] || 'info'
}

/**
 * 查看活动详情
 */
const viewActivity = (activityId: string) => {
  router.push({ name: 'Home', query: { activityId } })
}

/**
 * 显示出售对话框
 */
const showListDialog = (ticket: Ticket) => {
  currentTicket.value = ticket
  listForm.value = {
    price: null
  }
  listDialogVisible.value = true
}

/**
 * 出售凭证
 */
const onListTicket = async () => {
  // 验证表单
  if (!listForm.value.price || listForm.value.price <= 0) {
    ElMessage.warning('请输入有效的出售价格')
    return
  }

  if (!account.value || !lotteryContract || !myERC721Contract) {
    ElMessage.error('合约或账户未准备就绪')
    return
  }

  if (!currentTicket.value) {
    ElMessage.error('未选择凭证')
    return
  }

  listLoading.value = true
  try {
    // 步骤1: 授权合约转移 NFT
    ElMessage.info('正在授权合约转移 NFT...')
    await myERC721Contract.methods
      .approve(lotteryAddress, currentTicket.value.id)
      .send({ from: account.value })
    
    // 步骤2: 出售凭证
    ElMessage.info('正在出售凭证...')
    await lotteryContract.methods
      .listTicket(currentTicket.value.id, listForm.value.price)
      .send({ from: account.value })

    ElMessage.success('凭证出售成功！')
    
    // 关闭对话框
    listDialogVisible.value = false
    
    // 刷新凭证列表
    await loadTickets()
    
  } catch (error: any) {
    console.error('出售凭证失败:', error)
    ElMessage.error(error.message || '出售凭证失败，请重试')
  } finally {
    listLoading.value = false
  }
}

/**
 * 初始化加载
 */
const initLoad = async () => {
  await loadTickets()
}

// 监听账户变化
watch(account, () => {
  if (account.value) {
    loadTickets()
  } else {
    tickets.value = []
  }
})

// 组件挂载时加载数据
onMounted(() => {
  initLoad()
})
</script>

<style scoped>
/* 基础样式重置 */
* {
  box-sizing: border-box;
}

/* 页面容器和背景 - 蓝色系渐变 */
.ticket-page {
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

/* 凭证卡片容器 */
.tickets-card {
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

/* 凭证网格 */
.tickets-grid {
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

  .tickets-grid {
    grid-template-columns: 1fr;
  }
}
</style>

