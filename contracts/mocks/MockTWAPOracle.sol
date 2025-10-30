// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockTWAPOracle {
    // A very simple test oracle mapping token => tokenOut per amount (1:1 by default)
    mapping(address => uint256) public pricePerUnit; // scaled so consult(amountIn) = amountIn * pricePerUnit / 1e18
    uint256 public constant SCALE = 1e18;

    function setPrice(address token, uint256 priceScaled) external {
        pricePerUnit[token] = priceScaled;
    }

    function consult(address /*tokenIn*/, uint256 amountIn) external view returns (uint256) {
        // naive 1:1 for testing if unset
        uint256 p = pricePerUnit[address(0)];
        if (p == 0) p = SCALE;
        return (amountIn * p) / SCALE;
    }
}
