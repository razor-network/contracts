// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../../lib/Structs.sol";


interface IVoteManager {

    function commit(uint256 epoch, bytes32 commitment) external;

    function reveal(
        uint256 epoch,
        bytes32 root,
        uint256[] calldata assetIds,
        uint256[] calldata values,
        bytes32[][] calldata proofs,
        bytes32 secret,
        address stakerAddress
    ) external;

    function getCommitment(uint256 epoch, uint256 stakerId) external view returns(bytes32);

    function getVote(
        uint256 epoch,
        uint256 stakerId,
        uint256 assetId
    ) external view returns(Structs.Vote memory vote);

    function getVoteWeight(uint256 epoch, uint256 assetId, uint256 voteValue)
    external view returns(uint256);

    function getTotalStakeRevealed(uint256 epoch, uint256 assetId) external view returns(uint256);

    function getTotalStakeRevealed(
        uint256 epoch,
        uint256 assetId,
        uint256 voteValue
    ) external view returns(uint256);

    function TEST_getAssetIds(uint256 stakerId) external;
}
