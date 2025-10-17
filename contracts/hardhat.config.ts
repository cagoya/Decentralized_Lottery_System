import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      // rpc url, change it according to your ganache configuration
      url: 'http://localhost:8545',
      // the private key of signers, change it according to your ganache user
      accounts: [
        '0xca437444c60c7999f3f2c515964a4a8cbd8a0a17b71a45efe772ac86ca9c3c2d',
        '0x4db6b753086f5328248f02dc52a6bf513e84e05b265ccbd181424a2829669a5f',
        '0xd37378abdb99203dd25f82c272a47cbff37c1dd7fdfdf7e3d5fae5ed3732c89c'
      ]
    },
  },
};

export default config;
