// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockTarget {
    uint256 private number;
    uint256 public lastValue;

    event Executed(address indexed from, uint256 value, bytes data);

    function setNumber(uint256 n) external {
        number = n;
        emit Executed(msg.sender, 0, "");
    }

    function setNumberPayable(uint256 n) external payable {
        number = n;
        lastValue = msg.value;
        emit Executed(msg.sender, msg.value, "");
    }

    function getNumber() external view returns (uint256) {
        return number;
    }
}
