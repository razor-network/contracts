// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../../lib/Structs.sol";


contract VoteStorage {
    //epoch -> stakerid -> commitment
    mapping (uint256 => mapping (uint256 => bytes32)) public commitments;
    //epoch -> stakerid -> assetid -> vote
    mapping (uint256 => mapping (uint256 =>  mapping (uint256 => Structs.Vote))) public votes;
    // epoch -> asset -> stakeWeight
    mapping (uint256 =>  mapping (uint256 => uint256)) public totalStakeRevealed;
    //epoch - >assetid -> voteValue -> weight
    mapping (uint256 => mapping (uint256 =>  mapping (uint256 => uint256))) public voteWeights;
}
