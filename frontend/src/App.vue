<template>
  <div class="app-wrapper">
    <Navbar />
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, provide } from 'vue'
import { ElMessage } from 'element-plus'
import { web3, lotteryContract, myERC20Contract, myERC721Contract, lotteryAddress } from './utils/contracts'
import Navbar from './components/Navbar.vue'

const GanacheTestChainId = '0x539' 
const GanacheTestChainName = 'Qickstart'
const GanacheTestChainRpcUrl = 'http://127.0.0.1:8545'

// 全局状态
const account = ref<string>('')
const accountBalance = ref<number>(0)
const managerAccount = ref<string>('')

// 检查是否已连接钱包
const initCheckAccounts = async () => {
  // @ts-ignore
  const { ethereum } = window;
  if (Boolean(ethereum && ethereum.isMetaMask)) {
    try {
      const accounts = await web3.eth.getAccounts()
      if (accounts && accounts.length) {
        account.value = accounts[0] as string
      }
    } catch (error) {
      console.error('Failed to get initial accounts:', error);
    }
  }
}

// 获取彩票合约信息
const getLotteryContractInfo = async () => {
  if (lotteryContract) {
    try {
        const ma = await lotteryContract.methods.manager().call()
        managerAccount.value = ma as unknown as string
    } catch (error) {
        console.error('获取彩票合约信息失败:', error)
    }
  }
}

// 获取账户余额信息
const getAccountInfo = async () => {
  if (myERC20Contract && account.value !== '') {
    try {
      const abString = await myERC20Contract.methods.balanceOf(account.value).call()
      accountBalance.value = parseInt(abString as unknown as string) 
    } catch (error) {
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

  if (accountBalance.value > 0) {
    ElMessage.info('您已领取过 ZJU Token 空投。')
    return
  }

  if (myERC20Contract) {
    try {
      await myERC20Contract.methods.airdrop().send({
        from: account.value
      })
      ElMessage.success('您已成功领取 ZJU Token 空投。')
      await getAccountInfo()
    } catch (error: any) {
      ElMessage.error(error.message || '空投交易失败。请检查交易是否被拒绝或余额不足。')
    }
  } else {
    ElMessage.error('Contract not exists.')
  }
}

// 连接钱包
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
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

    if (accounts && accounts.length) {
      account.value = accounts[0];
      ElMessage.success(`已连接账户: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`)
    } else {
      account.value = '';
      ElMessage.error('无法获取账户信息。')
    }
  } catch (error: any) {
    if (error.code === 4001) {
      ElMessage.info('用户拒绝了连接请求。')
    } else {
      ElMessage.error(error.message || '连接钱包时发生错误。')
    }
  }
}

onMounted(() => {
  initCheckAccounts()
  getLotteryContractInfo()

  // 监听账户变化
  // @ts-ignore
  if (window.ethereum) {
    // @ts-ignore
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length > 0) {
        account.value = accounts[0]
        ElMessage.info(`账户已切换到: ${accounts[0].substring(0, 6)}...`)
      } else {
        account.value = ''
        ElMessage.info('钱包已断开连接。')
      }
    })
    // @ts-ignore
    window.ethereum.on('chainChanged', (chainId: string) => {
      console.log('Chain ID changed:', chainId);
      if (chainId !== GanacheTestChainId) {
          ElMessage.warning('请切换到本地 Ganache 测试链。')
      }
    })
  }
})

// 监听 account 变化，获取账户余额
watch(account, (newAccount) => {
  if (newAccount !== '') {
    getAccountInfo()
  } else {
    accountBalance.value = 0
  }
}, { immediate: true })

// 提供给子组件使用
provide('web3', web3)
provide('lotteryContract', lotteryContract)
provide('myERC20Contract', myERC20Contract)
provide('myERC721Contract', myERC721Contract)
provide('lotteryAddress', lotteryAddress)
provide('account', account)
provide('accountBalance', accountBalance)
provide('managerAccount', managerAccount)
provide('getAccountInfo', getAccountInfo)
provide('onClaimTokenAirdrop', onClaimTokenAirdrop)
provide('onClickConnectWallet', onClickConnectWallet)
</script>

<style>
.app-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>