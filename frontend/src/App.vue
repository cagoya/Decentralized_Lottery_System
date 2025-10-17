<template>
  <div class="container">
    <div class="main-content">
      <el-card class="lottery-card">
        <h1>浙大彩票DEMO</h1>

        <!-- 领取空投 -->
        <el-button type="success" @click="onClaimTokenAirdrop" class="mb-4">
          领取浙大币空投
        </el-button>

        <p class="info-item">
          <strong>管理员地址:</strong> {{ managerAccount }}
        </p>

        <div class="account-section">
          <el-button v-if="account === ''" type="primary" @click="onClickConnectWallet">
            连接钱包
          </el-button>
          <div v-else class="flex flex-col items-center">
            <p class="info-item">
              <strong>当前用户:</strong>
              <el-tag type="info" effect="dark" class="ml-2">{{ account }}</el-tag>
            </p>
            <p class="info-item">
              <strong>当前用户拥有浙大币数量:</strong>
              <el-tag type="warning" effect="plain" class="ml-2">{{ accountBalance }}</el-tag>
            </p>
          </div>
        </div>

        <el-divider />

        <p class="description">
          花费 {{ playAmount }} 浙大币，赢取更多浙大币！每个人可以参与多次，参与越多，得奖概率越高！
        </p>

        <div class="stats-item">
          <el-icon :size="20"><User /></el-icon>
          <span>已有 {{ playerNumber }} 人/次参加</span>
        </div>

        <div class="stats-item">
          <el-icon :size="20"><Money /></el-icon>
          <span>奖池有金额 {{ totalAmount }} 个ZJUToken</span>
        </div>

        <el-divider />

        <!-- 重新添加操作栏 -->
        <div class="operation">
          <h2>操作栏</h2>
          <div class="button-group">
            <el-button type="warning" @click="onPlay" :disabled="account === ''">
              投注产生希望 (花费 {{ playAmount }})
            </el-button>
            <el-button type="danger" @click="onDraw" :disabled="account === '' || account.toLowerCase() !== managerAccount.toLowerCase()">
              开奖（仅限管理员使用）
            </el-button>
            <el-button type="info" @click="onRefund" :disabled="account === '' || account.toLowerCase() !== managerAccount.toLowerCase()">
              退款（仅限管理员使用）
            </el-button>
          </div>
        </div>
        <!-- 结束操作栏 -->

      </el-card>
      <div class="mock-warning">
        <p><strong>注意:</strong> 此文件中的 web3, contract 和 Header 依赖已被模拟/占位。在实际项目中，请替换为正确的导入和配置。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElButton, ElCard, ElDivider, ElTag, ElMessage, ElNotification } from 'element-plus'
import { User, Money } from '@element-plus/icons-vue'
import { web3, lotteryContract, myERC20Contract } from './utils/contracts'

const GanacheTestChainId = '0x539' // Ganache默认的ChainId = 0x539 = Hex(1337)
const GanacheTestChainName = 'Qickstart'
const GanacheTestChainRpcUrl = 'http://127.0.0.1:8545'

const account = ref<string>('')
const accountBalance = ref<number>(0)
const playAmount = ref<number>(0)
const totalAmount = ref<number>(0)
const playerNumber = ref<number>(0)
const managerAccount = ref<string>('')

type NotificationType = 'success' | 'warning' | 'info' | 'error';
const showNotification = (title: string, message: string, type: NotificationType) => {
  ElNotification({
    title: title,
    message: message,
    type: type,
    duration: 4500,
    position: 'bottom-right'
  })
}

// 检查是否已连接钱包
const initCheckAccounts = async () => {
  // @ts-ignore
  const { ethereum } = window;
  if (Boolean(ethereum && ethereum.isMetaMask)) {
    try {
      const accounts = await web3.eth.getAccounts()
      if (accounts && accounts.length) {
        account.value = accounts[0] as string
        ElMessage.success(`已连接账户: ${accounts[0]}`)
      }
    } catch (error) {
      console.error('Failed to get initial accounts:', error);
    }
  }
}

// 获取彩票合约信息 (已修复)
const getLotteryContractInfo = async () => {
  if (lotteryContract) {
    try {
        const ma = await lotteryContract.methods.manager().call()
        managerAccount.value = ma as unknown as string
        const pnString = await lotteryContract.methods.getPlayerNumber().call()
        playerNumber.value = parseInt(pnString as unknown as string)
        const paString = await lotteryContract.methods.PLAY_AMOUNT().call()
        playAmount.value = parseInt(paString as unknown as string)
        const taString = await lotteryContract.methods.totalAmount().call()
        totalAmount.value = parseInt(taString as unknown as string)
    } catch (error) {
        console.error('获取合约信息失败:', error)
        showNotification('错误', '获取彩票合约信息失败。', 'error') // 修复: 替换 alert
    }
  } else {
    showNotification('错误', 'Lottery Contract不存在。', 'error') // 修复: 替换 alert
  }
}

// 获取账户余额信息 (已修复)
const getAccountInfo = async () => {
  if (myERC20Contract && account.value !== '') {
    try {
      const abString = await myERC20Contract.methods.balanceOf(account.value).call()
      accountBalance.value = parseInt(abString as unknown as string) 
    } catch (error) {
      console.error('获取账户余额失败:', error)
      ElMessage.error('获取账户余额失败。')
    }
  }
}

// 领取空投
const onClaimTokenAirdrop = async () => {
  if (account.value === '') {
    ElMessage.warning('您尚未连接钱包。')
    return
  }

  if (myERC20Contract) {
    try {
      await myERC20Contract.methods.airdrop().send({
        from: account.value
      })
      ElMessage.success('您已成功领取 ZJU Token 空投。')
      // 刷新余额
      await getAccountInfo()
    } catch (error: any) {
      ElMessage.error(error.message || '空投交易失败。')
    }
  } else {
    ElMessage.error('Contract not exists.')
  }
}

// 投注 (重新添加逻辑)
const onPlay = async () => {
  if (account.value === '') {
    showNotification('警告', '您尚未连接钱包。', 'warning')
    return
  }

  if (lotteryContract && myERC20Contract) {
    try {
      // 1. Approve (授权)
      showNotification('提示', '正在请求授权 ZJU Token 给彩票合约...', 'info')
      await myERC20Contract.methods.approve(lotteryContract.options.address, playAmount.value).send({
        from: account.value
      })

      // 2. Play (投注)
      showNotification('提示', '授权成功，正在进行投注...', 'info')
      await lotteryContract.methods.play().send({
        from: account.value
      })

      showNotification('成功', '恭喜！您已成功参与投注。', 'success')
      // 刷新数据
      await getLotteryContractInfo()
      await getAccountInfo()
    } catch (error: any) {
      showNotification('交易失败', error.message || '投注或授权失败。', 'error')
    }
  } else {
    showNotification('错误', 'Contract not exists.', 'error')
  }
}

// 开奖 (重新添加逻辑)
const onDraw = async () => {
  if (account.value === '') {
    showNotification('警告', '您尚未连接钱包。', 'warning')
    return
  } else if (account.value.toLowerCase() !== managerAccount.value.toLowerCase()) {
    showNotification('警告', '只有管理员才能执行此操作。', 'warning')
    return
  }

  if (lotteryContract) {
    try {
      await lotteryContract.methods.draw().send({
        from: account.value
      })
      showNotification('成功', '开奖操作已执行。', 'success')
      // 刷新数据
      await getLotteryContractInfo()
      await getAccountInfo()
    } catch (error: any) {
      showNotification('交易失败', error.message || '开奖失败。', 'error')
    }
  } else {
    showNotification('错误', 'Contract not exists.', 'error')
  }
}

// 退款 (重新添加逻辑)
const onRefund = async () => {
  if (account.value === '') {
    showNotification('警告', '您尚未连接钱包。', 'warning')
    return
  } else if (account.value.toLowerCase() !== managerAccount.value.toLowerCase()) {
    showNotification('警告', '只有管理员才能执行此操作。', 'warning')
    return
  }

  if (lotteryContract) {
    try {
      await lotteryContract.methods.refund().send({
        from: account.value
      })
      showNotification('成功', '退款操作已执行。', 'success')
      // 刷新数据
      await getLotteryContractInfo()
      await getAccountInfo()
    } catch (error: any) {
      showNotification('交易失败', error.message || '退款失败。', 'error')
    }
  } else {
    showNotification('错误', 'Contract not exists.', 'error')
  }
}

// 连接钱包 (已修复，补充了缺失的 })
const onClickConnectWallet = async () => {
  // @ts-ignore
  const { ethereum } = window;
  if (!Boolean(ethereum && ethereum.isMetaMask)) {
    ElMessage.warning('MetaMask 未安装！')
    return
  }

  try {
    // 尝试切换到本地测试链
    if (ethereum.chainId !== GanacheTestChainId) {
      const chain = {
        chainId: GanacheTestChainId,
        chainName: GanacheTestChainName,
        rpcUrls: [GanacheTestChainRpcUrl],
      };

      try {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainId }] })
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await ethereum.request({ method: 'wallet_addEthereumChain', params: [chain] });
        }
      }
    }

    // 请求用户授权
    await ethereum.request({ method: 'eth_requestAccounts' });
    const accounts = await ethereum.request({ method: 'eth_accounts' });

    if (accounts && accounts.length) {
      account.value = accounts[0];
      ElMessage.success(`已连接账户: ${accounts[0]}`)
    } else {
      account.value = '';
      ElMessage.error('无法获取账户信息。')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '连接钱包时发生错误。')
  }
} // 修复: 补充缺失的关闭大括号

onMounted(() => {
  // 1. 初始化检查钱包连接
  initCheckAccounts()
  // 2. 获取合约信息
  getLotteryContractInfo()
})

// 监听 account 变化，获取账户余额
watch(account, (newAccount) => {
  if (newAccount !== '') {
    getAccountInfo()
  } else {
    accountBalance.value = 0
  }
}, { immediate: true })

</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f4f7f9;
  font-family: 'Inter', sans-serif;
  padding-bottom: 40px;
}

.main-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.lottery-card {
  width: 90%;
  max-width: 600px;
  border-radius: 12px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
  text-align: center;
}

h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 20px;
  color: #303133;
}

.info-item {
  margin: 8px 0;
  font-size: 0.9rem;
  color: #606266;
  word-break: break-all;
}

.account-section {
  margin: 20px 0;
  padding: 15px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.description {
  margin: 15px 0;
  font-size: 1rem;
  font-weight: 500;
  color: #303133;
}

.stats-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 10px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #409EFF; /* El-Primary */
}

.operation h2 {
  font-size: 1.2rem;
  margin-bottom: 15px;
  color: #909399;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
  width: 100%; /* 确保在 card 内占据空间 */
}

.el-button {
  width: 100%;
  padding: 12px 0;
  font-size: 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.mb-4 {
    margin-bottom: 1.5rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.mock-warning {
    margin-top: 20px;
    width: 90%;
    max-width: 600px;
    padding: 15px;
    border-radius: 8px;
    background-color: #fef0f0;
    border: 1px solid #f56c6c;
    color: #f56c6c;
    font-size: 0.85rem;
    text-align: left;
}

@media (min-width: 640px) {
  .button-group {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
  }
  .el-button {
    width: 200px; /* 调整宽度，使其在桌面端更紧凑 */
  }
}
</style>
