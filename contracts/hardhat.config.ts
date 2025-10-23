import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    ganache: {
      // rpc url, change it according to your ganache configuration
      url: 'http://localhost:8545',
      // the private key of signers, change it according to your ganache user
      accounts: [
        '0xc2d6dd5e0dd6cc102c7b9ba088ed7db463d79510cd61ba4de8b1fce7500a0e80',
        '0xd0f75630c4d42c903011d25cf10f00c625821f05021aaac6019194c490ba9b30',
        '0xe28a52c396ac5fbb58f37ec753fe1b213c178610e7f969d3f5d664609ecce06e',
        '0xde599ff6c85bd9b9eaed81716d9579c5e7b5f21b89edb3d2835f4de15527614e'
      ]
    },
  },
};

export default config;
