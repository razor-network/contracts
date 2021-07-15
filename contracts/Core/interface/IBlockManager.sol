// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../../lib/Structs.sol";


interface IBlockManager {

    // elected proposer proposes block. 
    //we use a probabilistic method to elect stakers weighted by stake
    // protocol works like this. 
    //select a staker pseudorandomly (not weighted by anything)
    // that staker then tosses a biased coin. 
    //bias = hisStake/biggestStake. if its heads, he can propose block
    // end of iteration. try next iteration
    // note that only one staker or no stakers selected in each iteration.
    // stakers elected in higher iterations can also propose hoping that
    // stakers with lower iteration do not propose for some reason
    function propose(
        uint256 epoch,
        uint256[] memory ids,
        uint256[] memory medians,
        uint256[] memory lowerCutoffs,
        uint256[] memory higherCutoffs,
        uint256 iteration,
        uint256 biggestStakerId
    ) external;
                    
    //anyone can give sorted votes in batches in dispute state

    function giveSorted (uint256 epoch, uint256 assetId, uint256[] calldata sorted) external;
    function resetDispute (uint256 epoch) external;

    function isElectedProposer(
        uint256 iteration,
        uint256 biggestStakerId,
        uint256 stakerId
    ) external;

    function confirmBlock() external;

    function getBlock(uint256 epoch) external view returns(Structs.Block memory _block);
    function getBlockMedians(uint256 epoch) external view returns(uint256[] memory _blockMedians);

    function getLowerCutoffs(uint256 epoch) external view returns(uint256[] memory _lowerCutoffs);

    function getHigherCutoffs(
        uint256 epoch
    ) external view returns(uint256[] memory _higherCutoffs);

    function getProposedBlockMedians(
        uint256 epoch,
        uint256 proposedBlock
    ) external view returns(uint256[] memory _blockMedians);

    function getNumProposedBlocks(uint256 epoch) external view returns(uint256);
}
