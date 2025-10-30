require('dotenv').config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      // forking: {
      //   url: process.env.ALCHEMY_MAINNET_WS || process.env.ALCHEMY_MAINNET_HTTP || "",
      //   blockNumber: process.env.FORK_BLOCK ? parseInt(process.env.FORK_BLOCK) : undefined
      // },
      chainId: 1
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || ""
  }
};
