const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with", deployer.address);

    // Deploy MockTWAP
    const Mock = await hre.ethers.getContractFactory("MockTWAPOracle");
    const mock = await Mock.deploy();
    await mock.deployed();
    console.log("MockTWAPOracle:", mock.address);

    const Token = await hre.ethers.getContractFactory("ERC20PresetMinterPauser");
    // For local test we will mint two tokens
    const tokenA = await Token.deploy("Token A", "TKA");
    await tokenA.deployed();
    const tokenB = await Token.deploy("Token B", "TKB");
    await tokenB.deployed();
    console.log("TokenA:", tokenA.address, "TokenB:", tokenB.address);

    // Deploy swap
    const Swap = await hre.ethers.getContractFactory("StableSwap");
    const swap = await Swap.deploy(tokenA.address, tokenB.address, mock.address);
    await swap.deployed();
    console.log("StableSwap:", swap.address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});