// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title RAZOR
 * @dev Very simple ERC20 Token example, where all tokens are pre-assigned to the creator.
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `ERC20` functions.
 */

contract RAZOR is ERC20{
    
    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor (uint initialSupply) ERC20("RAZOR", "RAZOR") {
        _mint(msg.sender, initialSupply);
    }

}
