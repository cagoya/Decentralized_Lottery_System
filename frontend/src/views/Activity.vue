<template>
  <div class="activity-container">
    <div class="main-content">
      <!-- 活动列表卡片 -->
      <el-card class="info-card activities-card" shadow="always">
        <template #header>
          <div class="card-header">
            <span class="card-title">竞猜活动列表</span>
            <el-button 
              type="primary" 
              size="default" 
              plain
              @click="loadActivities"
              :loading="loadingActivities"
              :icon="Loading"
            >
              刷新列表
            </el-button>
          </div>
        </template>
        
        <div v-if="loadingActivities" class="loading-section">
          <el-icon class="is-loading loading-icon"><Loading /></el-icon>
          <span>活动列表加载中...</span>
        </div>
        
        <div v-else-if="activities.length === 0" class="empty-section">
          <el-empty description="暂无竞猜活动" :image-size="100" />
        </div>
        
        <div v-else class="activities-grid">
          <ActivityCard 
            v-for="activity in activities" 
            :key="activity.id"
            :activity-data="activity"
            :current-account="account"
            :erc20-contract="myERC20Contract"
            :lottery-contract="lotteryContract"
            :is-manager="isManager"
            @bet-success="handleBetSuccess"
            @draw-lottery="handleDrawLottery"
            @refund="handleRefund"
          />
        </div>
      </el-card>
    </div>

    <!-- 开奖对话框 -->
    <el-dialog 
      v-model="drawDialogVisible" 
      title="活动开奖" 
      width="450px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedActivity">
        <el-alert 
          type="warning" 
          :closable="false"
          show-icon
          style="margin-bottom: 20px;"
        >
          <template #title>
            确认为活动 "{{ selectedActivity.name }}" 开奖
          </template>
        </el-alert>

        <el-form label-position="top">
          <el-form-item label="选择中奖选项">
            <el-select 
              v-model="drawForm.winningOptionIndex" 
              placeholder="请选择中奖选项"
              style="width: 100%;"
            >
              <el-option
                v-for="(option, index) in selectedActivity.options"
                :key="index"
                :label="option"
                :value="index"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <el-button @click="drawDialogVisible = false">取消</el-button>
        <el-button 
          type="success" 
          @click="confirmDrawLottery"
          :loading="drawLoading"
        >
          确认开奖
        </el-button>
      </template>
    </el-dialog>

    <!-- 退款对话框 -->
    <el-dialog 
      v-model="refundDialogVisible" 
      title="活动退款" 
      width="450px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedActivity">
        <el-alert 
          type="warning" 
          :closable="false"
          show-icon
        >
          <template #title>
            确认退款活动 "{{ selectedActivity.name }}" 吗？
          </template>
          此操作将退还所有参与者的投注金额。
        </el-alert>
      </div>
      
      <template #footer>
        <el-button @click="refundDialogVisible = false">取消</el-button>
        <el-button 
          type="warning" 
          @click="confirmRefund"
          :loading="refundLoading"
        >
          确认退款
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, inject, type Ref } from 'vue'
import { ElButton, ElCard, ElMessage, ElEmpty, ElIcon, ElDialog, ElAlert, ElForm, ElFormItem, ElSelect, ElOption } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import ActivityCard from '../components/ActivityCard.vue' 

// 从 App.vue 注入全局状态和方法
const lotteryContract = inject('lotteryContract') as any
const myERC20Contract = inject('myERC20Contract') as any
const account = inject('account') as Ref<string>
const managerAccount = inject('managerAccount') as Ref<string>
const getAccountInfo = inject('getAccountInfo') as () => Promise<void>

// 活动相关 - 根据新的合约结构体定义
interface Activity {
  id: string
  name: string
  options: string[]
  endTime: number
  baseAmount: number
  totalAmount: number
  status: number
  winningOptionIndex: number
}

const activities = ref<Activity[]>([])
const loadingActivities = ref<boolean>(false)

// 开奖对话框相关
const drawDialogVisible = ref<boolean>(false)
const drawLoading = ref<boolean>(false)
const drawForm = ref({
  winningOptionIndex: null as number | null
})

// 退款对话框相关
const refundDialogVisible = ref<boolean>(false)
const refundLoading = ref<boolean>(false)

// 当前选中的活动
const selectedActivity = ref<Activity | null>(null)

// 判断当前用户是否是管理员
const isManager = computed(() => {
  return account.value !== '' && 
         managerAccount.value !== '' && 
         account.value.toLowerCase() === managerAccount.value.toLowerCase()
})

// 加载活动列表
const loadActivities = async () => {
  if (!lotteryContract) {
    ElMessage.error('竞猜合约未加载')
    return
  }

  loadingActivities.value = true
  try {
    const result = await lotteryContract.methods.getActivities().call()
    if (result && Array.isArray(result)) {
      activities.value = result.map((activity: any) => ({
        id: activity.id.toString(),
        name: activity.name,
        options: activity.options,
        endTime: parseInt(activity.endTime.toString()),
        baseAmount: parseInt(activity.baseAmount.toString()),
        totalAmount: parseInt(activity.totalAmount.toString()),
        status: parseInt(activity.status.toString()),
        winningOptionIndex: parseInt(activity.winningOptionIndex.toString())
      }))
    } else {
      activities.value = []
    }
  } catch (error: any) {
    console.error('加载活动列表失败:', error)
    ElMessage.error(error.message || '加载活动列表失败')
  } finally {
    loadingActivities.value = false
  }
}

// 处理投注成功事件
const handleBetSuccess = async () => {
  // 同时刷新账户信息和活动列表
  await Promise.all([
    getAccountInfo(),
    loadActivities()
  ])
}

// 处理开奖事件
const handleDrawLottery = (activityId: string) => {
  // 找到对应的活动
  const activity = activities.value.find(a => a.id === activityId)
  if (!activity) {
    ElMessage.error('活动不存在')
    return
  }

  if (!isManager.value) {
    ElMessage.warning('只有管理员才能开奖')
    return
  }

  if (activity.status !== 0) {
    ElMessage.warning('该活动不是进行中状态，无法开奖')
    return
  }

  // 检查是否已经到了结束时间，现阶段是手动开奖，所以不检查
  /*
  const currentTime = Math.floor(Date.now() / 1000)
  if (currentTime < activity.endTime) {
    ElMessage.warning('活动尚未结束，无法开奖')
    return
  }*/

  selectedActivity.value = activity
  drawForm.value.winningOptionIndex = null
  drawDialogVisible.value = true
}

// 确认开奖
const confirmDrawLottery = async () => {
  if (!selectedActivity.value) return

  if (drawForm.value.winningOptionIndex === null || drawForm.value.winningOptionIndex < 0) {
    ElMessage.warning('请选择中奖选项')
    return
  }

  drawLoading.value = true
  try {
    ElMessage.info('正在开奖...')
    
    await lotteryContract.methods
      .drawLottery(
        selectedActivity.value.id,
        drawForm.value.winningOptionIndex
      )
      .send({ from: account.value })

    ElMessage.success('开奖成功！')
    drawDialogVisible.value = false
    
    // 刷新活动列表
    await loadActivities()
  } catch (error: any) {
    console.error('开奖失败:', error)
    ElMessage.error(error.message || '开奖失败，请重试')
  } finally {
    drawLoading.value = false
  }
}

// 处理退款事件
const handleRefund = (activityId: string) => {
  // 找到对应的活动
  const activity = activities.value.find(a => a.id === activityId)
  if (!activity) {
    ElMessage.error('活动不存在')
    return
  }

  if (!isManager.value) {
    ElMessage.warning('只有管理员才能退款')
    return
  }

  if (activity.status !== 0) {
    ElMessage.warning('该活动不是进行中状态，无法退款')
    return
  }

  selectedActivity.value = activity
  refundDialogVisible.value = true
}

// 确认退款
const confirmRefund = async () => {
  if (!selectedActivity.value) return

  refundLoading.value = true
  try {
    ElMessage.info('正在退款...')
    
    await lotteryContract.methods
      .refund(selectedActivity.value.id)
      .send({ from: account.value })

    ElMessage.success('退款成功！')
    refundDialogVisible.value = false
    
    // 刷新活动列表
    await loadActivities()
  } catch (error: any) {
    console.error('退款失败:', error)
    ElMessage.error(error.message || '退款失败，请重试')
  } finally {
    refundLoading.value = false
  }
}

onMounted(() => {
  loadActivities()
})

</script>

<style scoped>
/* 基础样式重置 */
* {
  box-sizing: border-box;
}

/* 容器和背景 - 蓝色系渐变 */
.activity-container {
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
  gap: 24px;
  padding: 40px 20px;
  max-width: 1200px;
  width: 95%;
  margin: 0 auto;
}

/* 卡片基础样式 */
.info-card {
  width: 100%;
  border-radius: 12px;
  background: #ffffff;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.info-card:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* 卡片头部 */
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
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
}

/* 活动列表区域 */
.loading-section,
.empty-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  color: #909399;
  gap: 12px;
}

.loading-icon {
  font-size: 32px;
  color: #409eff;
}

.activities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  padding-top: 10px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .main-content {
    padding: 20px 10px;
    width: 100%;
  }
  
  .activities-grid {
    grid-template-columns: 1fr;
  }
}
</style>

