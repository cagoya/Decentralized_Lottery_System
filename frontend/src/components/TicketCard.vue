<template>
  <el-card 
    class="ticket-card"
    shadow="hover"
  >
    <div class="card-content">
      <!-- 凭证头部 -->
      <div class="ticket-header">
        <el-tag type="primary" size="large" class="ticket-id-tag">
          凭证 #{{ ticket.id }}
        </el-tag>
        <el-tag 
          :type="getStatusType(ticket.status)" 
          size="small"
        >
          {{ getStatusText(ticket.status) }}
        </el-tag>
      </div>

      <el-divider class="divider" />

      <!-- 凭证信息 - 使用 el-row/el-col 格式 -->
      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">活动ID:</el-col>
        <el-col :span="16">{{ ticket.activityId }}</el-col>
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
        <el-col :span="16" class="amount">{{ ticket.amount }} ZJU</el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">结束时间:</el-col>
        <el-col :span="16">{{ formatTimestamp(ticket.endTime) }}</el-col>
      </el-row>

      <el-row :gutter="20" class="info-row">
        <el-col :span="8" class="label">活动状态:</el-col>
        <el-col :span="16">
          <el-tag 
            :type="activityStatusType" 
            size="small"
          >
            {{ activityStatus }}
          </el-tag>
        </el-col>
      </el-row>

      <!-- 操作按钮 -->
      <div class="ticket-actions">
        <el-button 
          v-if="ticket.status === 0 && activityStatus === '进行中'" 
          type="warning" 
          @click="emit('show-list-dialog', ticket)"
        >
          出售凭证
        </el-button>
        <el-tag v-else-if="ticket.status === 1" type="warning" size="large">
          该凭证正在出售中
        </el-tag>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ElCard, ElRow, ElCol, ElTag, ElDivider, ElButton } from 'element-plus'

// 对应合约的 TicketResponse 结构
interface Ticket {
  id: string
  activityId: string
  name: string  // 活动名称
  amount: number
  optionIndex: number
  option: string  // 选项名称
  endTime: number
  status: number  // 凭证状态: 0-持有中, 1-出售中, 2-获胜, 3-失败
  activityStatus: number  // 活动状态
}

interface Props {
  ticket: Ticket
  activityName: string
  optionName: string
  activityStatus: string
  activityStatusType: 'success' | 'warning' | 'info' | 'danger'
}

defineProps<Props>()

const emit = defineEmits<{
  'view-activity': [activityId: string]
  'show-list-dialog': [ticket: Ticket]
}>()

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

/**
 * 获取凭证状态文本
 * 0-持有中, 1-出售中, 2-获胜, 3-失败
 */
const getStatusText = (status: number): string => {
  switch (status) {
    case 0: return '持有中'
    case 1: return '出售中'
    case 2: return '获胜'
    case 3: return '失败'
    default: return '未知'
  }
}

/**
 * 获取凭证状态类型
 */
const getStatusType = (status: number): 'success' | 'warning' | 'info' | 'danger' => {
  switch (status) {
    case 0: return 'info'      // 持有中
    case 1: return 'warning'   // 出售中
    case 2: return 'success'   // 获胜
    case 3: return 'danger'    // 失败
    default: return 'info'
  }
}
</script>

<style scoped>
.ticket-card {
  border-radius: 10px;
  transition: all 0.3s ease;
  border: 1px solid #e0e0e0;
}

.ticket-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* 凭证头部 */
.ticket-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.ticket-id-tag {
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

/* 操作按钮 */
.ticket-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.ticket-actions .el-button {
  flex: 1;
  min-width: 100px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .ticket-actions {
    flex-direction: column;
  }

  .ticket-actions .el-button {
    width: 100%;
  }
}
</style>

