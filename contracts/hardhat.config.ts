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
        '0x35c5726e38d1c3bf0b7c18922fdae2d410e27a4282b70a9cf2344f893b8b3628',
        '0xc8205c83530cc93b9a22d84f6f5822367cc447805e25c9c8e03860696f6a421b',
        '0x7cd60493a91ef64bfc834deecd40f68dbdf2d8bfb64f8c2cf0589fbbc495c511',
        '0x4a7369258cd5fa408281c39c826d2ddb0bfb3ed30682946aea59b063a095e0ad'
      ]
    },
  },
};

export default config;
