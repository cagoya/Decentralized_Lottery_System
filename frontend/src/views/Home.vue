<template>
  <div class="app-container">
    <div class="main-content">
      <el-card class="info-card account-card" shadow="always">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">管理员地址:</span>
            <el-tag type="success" effect="dark" class="address-tag">{{ managerAccount || '加载中...' }}</el-tag>
          </div>
        </div>
        
        <div v-if="account === ''" class="connect-section">
          <p class="connect-hint">请先连接您的 MetaMask 钱包</p>
          <el-button 
            type="primary" 
            size="large"
            @click="onClickConnectWallet"
            class="connect-btn">
            连接钱包
          </el-button>
        </div>
        
        <div v-else class="account-info">
          <div class="info-grid account-details">
            <div class="info-item">
              <span class="info-label">当前账户地址:</span>
              <el-tag type="info" effect="dark" class="address-tag">{{ account }}</el-tag>
            </div>
            <div class="info-item">
              <span class="info-label">浙大币余额:</span>
              <el-tag type="warning" effect="dark" class="balance-tag">
                {{ accountBalance }} ZJU
              </el-tag>
            </div>
          </div>
          
          <div class="action-section">
            <el-button 
              type="success" 
              size="large"
              @click="onClaimTokenAirdrop"
              class="action-btn"
              :disabled="accountBalance > 0"
            >
              {{ accountBalance > 0 ? '已领取空投' : '领取浙大币空投' }}
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card v-if="isManager" class="info-card admin-card" shadow="always">
        <template #header>
          <div class="card-header">
            <span class="card-title">创建竞猜活动</span>
            <el-tag type="danger" effect="dark">管理员专属</el-tag>
          </div>
        </template>
        
        <el-form :model="activityForm" label-position="top" class="activity-form">
          <el-form-item label="活动名称">
            <el-input v-model="activityForm.name" placeholder="请输入活动名称" />
          </el-form-item>
          
          <el-form-item label="可选项目 (至少2个)">
            <div class="options-input">
              <el-tag
                v-for="(option, index) in activityForm.options"
                :key="index"
                closable
                @close="removeOption(index)"
                class="option-tag"
                type="info"
              >
                {{ option }}
              </el-tag>
              <el-input
                v-if="inputVisible"
                ref="inputRef"
                v-model="inputValue"
                size="small"
                style="width: 120px"
                @keyup.enter="handleInputConfirm"
                @blur="handleInputConfirm"
              />
              <el-button v-else size="small" @click="showInput" type="info" plain>
                + 添加选项
              </el-button>
            </div>
          </el-form-item>
          
          <div class="form-row">
              <el-form-item label="结束时间" class="form-item-half">
                <el-date-picker
                  v-model="activityForm.endTime"
                  type="datetime"
                  placeholder="选择结束时间"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="x"
                  style="width: 100%;"
                />
              </el-form-item>
              
              <el-form-item label="基础金额 (浙大币)" class="form-item-half">
                <el-input 
                  v-model="activityForm.baseAmount" 
                  type="number"
                  placeholder="例如: 100" 
                />
              </el-form-item>
          </div>
          
          <el-form-item class="form-action-buttons">
            <el-button 
              type="primary" 
              @click="onCreateActivity"
              :loading="createLoading"
              size="large"
            >
              创建活动
            </el-button>
            <el-button @click="resetForm" size="large">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, inject, type Ref } from 'vue'
import { ElButton, ElCard, ElTag, ElMessage, ElForm, ElFormItem, ElInput, ElDatePicker } from 'element-plus' 

// 从 App.vue 注入全局状态和方法
const lotteryContract = inject('lotteryContract') as any
const account = inject('account') as Ref<string>
const accountBalance = inject('accountBalance') as Ref<number>
const managerAccount = inject('managerAccount') as Ref<string>
const onClaimTokenAirdrop = inject('onClaimTokenAirdrop') as () => Promise<void>
const onClickConnectWallet = inject('onClickConnectWallet') as () => Promise<void>

// 创建活动表单（移除 description 字段）
const activityForm = ref({
  name: '',
  options: [] as string[],
  endTime: '',
  baseAmount: ''
})

const createLoading = ref<boolean>(false)
const inputVisible = ref<boolean>(false)
const inputValue = ref<string>('')
const inputRef = ref()

// 判断当前用户是否是管理员
const isManager = computed(() => {
  return account.value !== '' && 
         managerAccount.value !== '' && 
         account.value.toLowerCase() === managerAccount.value.toLowerCase()
})

// 创建活动
const onCreateActivity = async () => {
  if (account.value === '') {
    ElMessage.warning('请先连接钱包。')
    return
  }

  if (!isManager.value) {
    ElMessage.warning('只有管理员可以创建活动。')
    return
  }

  // 验证表单
  if (!activityForm.value.name.trim() || activityForm.value.name.length < 2) {
    ElMessage.warning('活动名称至少2个字符')
    return
  }
  if (activityForm.value.options.length < 2) {
    ElMessage.warning('请至少添加两个可选项目')
    return
  }
  if (!activityForm.value.endTime || parseInt(activityForm.value.endTime) < Date.now()) {
    ElMessage.warning('请选择一个有效的未来结束时间')
    return
  }
  const baseAmount = parseInt(activityForm.value.baseAmount)
  if (!baseAmount || baseAmount <= 0) {
    ElMessage.warning('请输入大于零的基础金额')
    return
  }

  createLoading.value = true
  try {
    // 结束时间已经是秒级时间戳（在表单中处理为'x'，即毫秒时间戳），这里转换为秒
    const endTimeInSeconds = Math.floor(parseInt(activityForm.value.endTime) / 1000)
    
    // 移除 description 参数
    await lotteryContract.methods.createActivity(
      activityForm.value.name,
      activityForm.value.options,
      endTimeInSeconds,
      activityForm.value.baseAmount
    ).send({
      from: account.value
    })

    ElMessage.success('活动创建成功！')
    resetForm()
  } catch (error: any) {
    console.error('创建活动失败:', error)
    ElMessage.error(error.message || '创建活动失败。请检查合约是否正确部署。')
  } finally {
    createLoading.value = false
  }
}

// 重置表单
const resetForm = () => {
  activityForm.value = {
    name: '',
    options: [],
    endTime: '',
    baseAmount: ''
  }
  inputVisible.value = false
  inputValue.value = ''
}

// 删除选项
const removeOption = (index: number) => {
  activityForm.value.options.splice(index, 1)
}

// 显示输入框
const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 确认输入
const handleInputConfirm = () => {
  const trimmedValue = inputValue.value.trim()
  if (trimmedValue && !activityForm.value.options.includes(trimmedValue)) {
    activityForm.value.options.push(trimmedValue)
  }
  inputVisible.value = false
  inputValue.value = ''
}

</script>

<style scoped>
/* 基础样式重置 */
* {
  box-sizing: border-box;
}

/* 容器和背景 - 蓝色系渐变 */
.app-container {
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
  max-width: 1000px;
  width: 95%;
  margin: 0 auto;
}

/* 卡片基础样式 */
.info-card {
  width: 100%;
  border-radius: 12px;
  background: #ffffff; /* 统一白色背景 */
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* 统一阴影 */
}

.info-card:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* 卡片头部 */
:deep(.el-card__header) {
  padding: 18px 24px;
  border-bottom: 1px solid #ebeef5;
  background: #f7f9fc; /* 浅灰色背景，提升层次感 */
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

/* 账户/信息网格 */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f4f8ff; /* 浅蓝色背景 */
  border-radius: 8px;
  border: 1px solid #e0ecff;
}

.info-label {
  font-size: 0.95rem;
  font-weight: 500;
  color: #5a5e66;
  margin-right: 15px;
}

/* Tag 样式优化 */
:deep(.el-tag) {
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  word-break: break-all;
}

.address-tag {
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.balance-tag {
  font-size: 1rem;
  padding: 6px 12px;
}

/* 连接钱包区域 */
.connect-section {
  text-align: center;
  padding: 30px 20px 10px;
}

.connect-hint {
  font-size: 1rem;
  color: #606266;
  margin-bottom: 20px;
  font-weight: 500;
}

.connect-btn {
  min-width: 180px;
  height: 44px;
  font-size: 1rem !important;
  font-weight: 600;
  border-radius: 8px;
}

/* 账户信息及操作 */
.account-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 5px;
}

.action-section {
  display: flex;
  justify-content: center;
  padding: 10px 0 0;
}

.action-btn {
  min-width: 220px;
  height: 44px;
  font-weight: 600;
  border-radius: 8px;
}

/* 管理员表单样式 */
.activity-form {
  padding: 5px 0;
}

.form-row {
    display: flex;
    gap: 20px;
}

.form-item-half {
    flex: 1;
    min-width: 45%;
}

.form-action-buttons {
    margin-top: 20px;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.options-input {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .main-content {
    padding: 20px 10px;
    width: 100%;
  }
  
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    padding: 10px;
  }

  .address-tag {
      max-width: 100%;
  }

  .form-row {
      flex-direction: column;
      gap: 0;
  }

  .form-action-buttons {
      justify-content: center;
  }
  
  .connect-btn,
  .action-btn {
    width: 100%;
  }
}
</style>