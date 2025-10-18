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
        '0xdaa5e025599f5afffaafdd9b56b8ba2d6c68ea01e96d632039587d119e574f1a',
        '0x445a8c17bd24dc1592a2f2db6e1823e77906b884739ab2382f42346d7bbc087f',
        '0xf6113506b8cdfebaa9bdbc91cd04a198b7672c8d9167f14d06f8cebf2fdd5190'
      ]
    },
  },
};

export default config;
