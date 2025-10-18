<template>
    <el-card v-if="activityData" class="activity-card" :header="activityData.name">
      <div class="card-content">
        <el-row :gutter="20" class="info-row">
          <el-col :span="6" class="label">ID:</el-col>
          <el-col :span="18">{{ activityData.id }}</el-col>
        </el-row>
  
        <el-row :gutter="20" class="info-row">
          <el-col :span="6" class="label">结束时间:</el-col>
          <el-col :span="18">{{ formatTimestamp(activityData.endTime) }}</el-col>
        </el-row>
  
        <el-row :gutter="20" class="info-row">
          <el-col :span="6" class="label">基础金额:</el-col>
          <el-col :span="18">{{ activityData.baseAmount }} ZJU</el-col>
        </el-row>
  
        <el-row :gutter="20" class="info-row">
          <el-col :span="6" class="label">奖池总额:</el-col>
          <el-col :span="18">{{ activityData.totalAmount }} ZJU</el-col>
        </el-row>
  
        <el-row :gutter="20" class="info-row">
          <el-col :span="6" class="label">活动状态:</el-col>
          <el-col :span="18">
            <el-tag :type="getStatusType(activityData.status)">
              {{ getStatusText(activityData.status) }}
            </el-tag>
          </el-col>
        </el-row>
  
        <el-row :gutter="20" class="info-row">
          <el-col :span="6" class="label">可选项目:</el-col>
          <el-col :span="18">
            <el-tag 
              v-for="(option, index) in activityData.options" 
              :key="index" 
              class="option-tag" 
              type="info"
            >
              {{ option }}
            </el-tag>
            <span v-if="!activityData.options || activityData.options.length === 0">无可选项目</span>
          </el-col>
        </el-row>
      </div>
  
      <template #footer>
        <div class="card-footer-actions">
          <el-button 
            type="primary" 
            @click="showBetDialog"
            :disabled="activityData.status !== 0 || !currentAccount"
          >
            {{ getBetButtonText() }}
          </el-button>
          
          <!-- 管理员操作按钮 -->
          <div v-if="isManager" class="admin-actions">
            <el-button 
              type="success" 
              @click="onDrawLottery"
              :disabled="activityData.status !== 0"
            >
              开奖
            </el-button>
            <el-button 
              type="warning" 
              @click="onRefund"
              :disabled="activityData.status !== 0"
            >
              退款
            </el-button>
          </div>
        </div>
      </template>
    </el-card>
    <div v-else>
      加载中... 或 数据不存在。
    </div>

    <!-- 投注对话框 -->
    <el-dialog 
      v-model="betDialogVisible" 
      title="参与竞猜活动" 
      width="450px"
      :close-on-click-modal="false"
    >
      <el-form :model="betForm" label-position="top">
        <el-form-item label="选择投注项目">
          <el-select 
            v-model="betForm.optionIndex" 
            placeholder="请选择一个选项"
            style="width: 100%;"
          >
            <el-option
              v-for="(option, index) in activityData.options"
              :key="index"
              :label="option"
              :value="index"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="投注金额 (ZJU)">
          <el-input-number
            v-model="betForm.amount"
            :min="1"
            :step="1"
            style="width: 100%;"
            placeholder="请输入投注金额"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="betDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="onBuyTicket"
          :loading="betLoading"
        >
          确认投注
        </el-button>
      </template>
    </el-dialog>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  import { ElCard, ElRow, ElCol, ElTag, ElButton, ElDialog, ElForm, ElFormItem, ElSelect, ElOption, ElInputNumber, ElMessage } from 'element-plus';
  import { defineProps, withDefaults, defineEmits } from 'vue';
  
  // 1. 定义与 Solidity 结构体对应的 TS 接口
  interface Activity {
      id: string;
      name: string;
      options: string[];
      endTime: number;
      baseAmount: number;
      totalAmount: number;
      status: number;
      winningOptionIndex: number;
  }
  
  // 2. 使用类型声明的方式定义 props
  interface Props {
      activityData: Activity;
      currentAccount?: string;
      erc20Contract?: any;
      lotteryContract?: any;
      isManager?: boolean;
  }
  
  const props = withDefaults(defineProps<Props>(), {
      // 默认值必须严格匹配 Activity 接口的类型
      activityData: () => ({
          id: '0',
          name: '加载中...',
          options: [] as string[],
          endTime: 0,
          baseAmount: 0,
          totalAmount: 0,
          status: 0,
          winningOptionIndex: 0
      }),
      currentAccount: '',
      erc20Contract: null,
      lotteryContract: null,
      isManager: false
  });

  // 定义 emits
  const emit = defineEmits<{
    'bet-success': [],
    'draw-lottery': [activityId: string],
    'refund': [activityId: string]
  }>();

  // 投注对话框相关
  const betDialogVisible = ref(false);
  const betLoading = ref(false);
  const betForm = ref({
    optionIndex: null as number | null,
    amount: null as number | null
  });

  /**
   * 显示投注对话框
   */
  const showBetDialog = () => {
    if (!props.currentAccount) {
      ElMessage.warning('请先连接钱包');
      return;
    }
    if (props.activityData.status !== 0) {
      ElMessage.warning('该活动已结束或不可用');
      return;
    }
    betForm.value = {
      optionIndex: null,
      amount: null
    };
    betDialogVisible.value = true;
  };

  /**
   * 获取按钮文字
   */
  const getBetButtonText = (): string => {
    if (!props.currentAccount) {
      return '请先连接钱包';
    }
    if (props.activityData.status === 1) {
      return '已开奖';
    }
    if (props.activityData.status === 2) {
      return '已退款';
    }
    if (props.activityData.status !== 0) {
      return '活动不可用';
    }
    return '参与活动';
  };

  /**
   * 触发开奖事件
   */
  const onDrawLottery = () => {
    emit('draw-lottery', props.activityData.id);
  };

  /**
   * 触发退款事件
   */
  const onRefund = () => {
    emit('refund', props.activityData.id);
  };

  /**
   * 购买投注凭证
   */
  const onBuyTicket = async () => {
    // 验证表单
    if (betForm.value.optionIndex === null || betForm.value.optionIndex < 0) {
      ElMessage.warning('请选择一个投注选项');
      return;
    }
    if (!betForm.value.amount || betForm.value.amount <= 0) {
      ElMessage.warning('请输入有效的投注金额');
      return;
    }

    if (!props.currentAccount || !props.erc20Contract || !props.lotteryContract) {
      ElMessage.error('合约或账户未准备就绪');
      return;
    }

    betLoading.value = true;
    try {
      // 步骤1: 授权 ERC20 代币给 Lottery 合约
      ElMessage.info('正在授权代币...');
      
      const lotteryAddress = props.lotteryContract.options.address;
      await props.erc20Contract.methods
        .approve(lotteryAddress, betForm.value.amount)
        .send({ from: props.currentAccount });

      ElMessage.success('授权成功！');

      // 步骤2: 调用 buyTicket
      ElMessage.info('正在购买凭证...');
      
      await props.lotteryContract.methods
        .buyTicket(
          props.activityData.id,
          betForm.value.optionIndex,
          betForm.value.amount
        )
        .send({ from: props.currentAccount });

      ElMessage.success('投注成功！');
      
      // 关闭对话框
      betDialogVisible.value = false;
      
      // 触发成功事件，通知父组件刷新数据
      emit('bet-success');
      
    } catch (error: any) {
      console.error('投注失败:', error);
      ElMessage.error(error.message || '投注失败，请重试');
    } finally {
      betLoading.value = false;
    }
  };
  
  
  /**
   * 格式化时间戳（秒）为可读日期
   * @param {number} timestamp - 时间戳（秒）
   * @returns {string} 格式化后的日期字符串
   */
  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp || timestamp === 0) return '永久有效/N/A';
    
    // 转换为毫秒
    const timestampMs = timestamp * 1000;
    
    if (isNaN(timestampMs)) return '无效时间';
    
    return new Date(timestampMs).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 获取活动状态文本
   * @param {number} status - 状态码
   * @returns {string} 状态文本
   */
  const getStatusText = (status: number): string => {
    // 根据 Solidity 枚举：enum ActivityStatus {Active, Drawn, Refunded}
    const statusMap: Record<number, string> = {
      0: '进行中',
      1: '已开奖',
      2: '已退款'
    };
    return statusMap[status] || '未知';
  };

  /**
   * 获取状态标签类型
   * @param {number} status - 状态码
   * @returns Element Plus tag type
   */
  const getStatusType = (status: number): 'success' | 'warning' | 'info' | 'danger' => {
    // 0: Active - 进行中（绿色）
    // 1: Drawn - 已开奖（蓝色）
    // 2: Refunded - 已退款（橙色）
    const typeMap: Record<number, 'success' | 'warning' | 'info' | 'danger'> = {
      0: 'success',
      1: 'info',
      2: 'warning'
    };
    return typeMap[status] || 'info';
  };
  </script>
  
  <style scoped>
  .activity-card {
    width: 100%;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
  }

  .activity-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  
  .card-content {
    padding: 5px 0;
  }
  
  .info-row {
    margin-bottom: 10px;
    font-size: 14px;
  }
  
  .label {
    font-weight: bold;
    color: #606266;
  }
  
  .option-tag {
    margin-right: 5px;
    margin-bottom: 5px;
  }

  .card-footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .admin-actions {
    display: flex;
    gap: 8px;
  }
  </style>