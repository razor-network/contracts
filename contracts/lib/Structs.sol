// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;


library Structs {
    struct Vote {
        uint256 value;
        uint256 weight;
    }

    struct Staker {
        uint256 id;
        address _address;
        uint256 stake;
        uint256 epochStaked;
        uint256 epochLastCommitted;
        uint256 epochLastRevealed;
        bool acceptDelegation;
        uint256 commission;
        address tokenAddress;
    }

    struct Lock {
        uint256 amount; //amount in sTokens
        uint256 withdrawAfter;
    }

    struct Block {
        uint256 proposerId;
        uint256[] ids;
        uint256[] medians;
        uint256[] lowerCutoffs;
        uint256[] higherCutoffs;
        uint256 iteration;
        uint256 biggestStake;
        bool valid;
    }

    struct Dispute {
        uint256 accWeight;
        uint256 median;
        uint256 lowerCutoff;
        uint256 higherCutoff;
        uint256 lastVisited;
        uint256 assetId;
    }

    struct Job {
        uint256 id;
        uint256 epoch;
        string url;
        string selector;
        string name;
        bool repeat;
        bool active;
        address creator;
        uint256 result;
        uint256 assetType;
    }

    struct Collection{
        uint256 id;
        string name;
        uint32 aggregationMethod;
        uint256[] jobIDs; 
        mapping(uint256=>bool) jobIDExist;
        uint256 epoch;
        bool active;
        address creator;
        uint256 result;
        uint256 assetType;
    }

    struct AssignedAsset {
        uint256 id;
        uint256 value;
    }
}