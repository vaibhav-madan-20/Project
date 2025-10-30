const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StableSwap", function () {
    let owner, user;
    let Token, tokenA, tokenB;
    let Mock, mock;
    let Swap, swap;

    beforeEach(async () => {
        [owner, user] = await ethers.getSigners();

        Token = await ethers.getContractFactory("TestToken");
        tokenA = await Token.deploy("A", "A");
        await tokenA.deployed();
        tokenB = await Token.deploy("B", "B");
        await tokenB.deployed();

        Mock = await ethers.getContractFactory("MockTWAPOracle");
        mock = await Mock.deploy();
        await mock.deployed();
        // set default price 1:1
        await mock.setPrice(ethers.constants.AddressZero, ethers.constants.WeiPerEther);

        // deploy swap
        Swap = await ethers.getContractFactory("StableSwap");
        swap = await Swap.deploy(tokenA.address, tokenB.address, mock.address);
        await swap.deployed();

        // mint and fund pool
        await tokenA.mint(swap.address, ethers.utils.parseEther("1000"));
        await tokenB.mint(swap.address, ethers.utils.parseEther("1000"));

        // mint to user
        await tokenA.mint(user.address, ethers.utils.parseEther("10"));
        await tokenB.mint(user.address, ethers.utils.parseEther("10"));
    });

    it("swap respects maxTxRatio", async () => {
        // set low maxTx
        await swap.setMaxTxRatio(1); // 0.01%
        await tokenA.connect(user).approve(swap.address, ethers.utils.parseEther("1"));
        await expect(swap.connect(user).swap(tokenA.address, tokenB.address, ethers.utils.parseEther("1"), 0))
            .to.be.revertedWith("tx exceeds max ratio");
    });

    it("swap succeeds with acceptable slippage", async () => {
        await swap.setMaxTxRatio(10000);
        await tokenA.connect(user).approve(swap.address, ethers.utils.parseEther("1"));
        // minAmountOut should match allowedMin per oracle
        const expected = ethers.utils.parseEther("1");
        const allowedMin = expected.mul(10000 - 50).div(10000); // slippageBps default 50
        await expect(swap.connect(user).swap(tokenA.address, tokenB.address, ethers.utils.parseEther("1"), allowedMin))
            .to.emit(swap, "Swap");
    });
});
