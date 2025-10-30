// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/*
  Hardened simple swap pool example.
  - uses OpenZeppelin for security primitives
  - has per-tx slippage checks, max tx limits, pause, reentrancy guard
  - integrates a (very small) TWAP oracle interface placeholder for price feeds
  - DOES NOT implement an advanced AMM (this is intentionally simple and safer)
*/

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITWAPOracle {
    function consult(address tokenIn, uint256 amountIn) external view returns (uint256 amountOut);
}

contract StableSwap is ReentrancyGuard, Pausable, Ownable {
    IERC20 public tokenA;
    IERC20 public tokenB;
    ITWAPOracle public twapOracle;

    uint256 public maxTxRatioBps = 1000; // 10% of pool by default
    uint256 public constant BPS = 10000;
    uint256 public slippageBps = 50; // default acceptable slippage 0.5%

    event Swap(address indexed user, address indexed fromToken, address indexed toToken, uint256 inAmount, uint256 outAmount);
    event OracleUpdated(address indexed oracle);
    event MaxTxRatioUpdated(uint256 ratioBps);
    event SlippageUpdated(uint256 slippageBps);

    constructor(address _tokenA, address _tokenB, address _oracle)
        Ownable(msg.sender)   // ✅ OZ v5 requires passing initial owner
    {
        require(_tokenA != address(0) && _tokenB != address(0), "zero token");
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
        twapOracle = ITWAPOracle(_oracle);
    }

    // --- Admin helpers ---
    function setTWAPOracle(address _oracle) external onlyOwner {
        twapOracle = ITWAPOracle(_oracle);
        emit OracleUpdated(_oracle);
    }

    function setMaxTxRatio(uint256 _bps) external onlyOwner {
        require(_bps <= BPS, "bps overflow");
        maxTxRatioBps = _bps;
        emit MaxTxRatioUpdated(_bps);
    }

    function setSlippageBps(uint256 _bps) external onlyOwner {
        require(_bps <= BPS, "bps overflow");
        slippageBps = _bps;
        emit SlippageUpdated(_bps);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // --- Helper to compute max allowed tx ---
    function maxTxAmount(IERC20 token) public view returns (uint256) {
        uint256 bal = token.balanceOf(address(this));
        return (bal * maxTxRatioBps) / BPS;
    }

    // --- Core swap logic ---
    function swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        nonReentrant
        whenNotPaused
    {
        require(amountIn > 0, "zero amount");
        require(
            (tokenIn == tokenA && tokenOut == tokenB) || (tokenIn == tokenB && tokenOut == tokenA),
            "unsupported pair"
        );

        // prevent large single-tx manipulation
        uint256 maxAllowed = maxTxAmount(tokenIn);
        require(amountIn <= maxAllowed, "tx exceeds max ratio");

        // pull tokens
        uint256 preBalance = tokenIn.balanceOf(address(this));
        bool ok = tokenIn.transferFrom(msg.sender, address(this), amountIn);
        require(ok, "transferFrom failed");
        uint256 postBalance = tokenIn.balanceOf(address(this));
        uint256 actualReceived = postBalance - preBalance;
        require(actualReceived > 0, "zero received");

        // consult TWAP oracle
        uint256 expectedOut = twapOracle.consult(address(tokenIn), actualReceived);
        require(expectedOut > 0, "oracle invalid");

        // slippage guard
        uint256 allowedMin = (expectedOut * (BPS - slippageBps)) / BPS;
        require(minAmountOut >= allowedMin, "insufficient minAmountOut");

        // compute output amount
        uint256 toSend = expectedOut;

        // liquidity check
        uint256 outBal = tokenOut.balanceOf(address(this));
        require(outBal >= toSend, "insufficient liquidity");

        // send output token
        bool ok2 = tokenOut.transfer(msg.sender, toSend);
        require(ok2, "transfer failed");

        emit Swap(msg.sender, address(tokenIn), address(tokenOut), actualReceived, toSend);
    }
}
