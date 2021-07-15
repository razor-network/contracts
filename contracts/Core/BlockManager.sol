// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interface/IParameters.sol";
import "./interface/IStakeManager.sol";
import "./interface/IRewardManager.sol";
import "./interface/IVoteManager.sol";
import "./interface/IAssetManager.sol";
import "./storage/BlockStorage.sol";
import "../lib/Random.sol";
import "../Initializable.sol";
import "./ACL.sol";


contract BlockManager is Initializable, ACL, BlockStorage {
    
    IParameters public parameters;
    IStakeManager public stakeManager;
    IRewardManager public rewardManager;
    IVoteManager public voteManager;
    IAssetManager public assetManager;

    event BlockConfirmed (
        uint256 epoch,
        uint256 stakerId,
        uint256[] medians,
        uint256[] lowerCutoffs,
        uint256[] higherCutoffs,
        uint256[] ids,
        uint256 timestamp
    );

    event Proposed (
        uint256 epoch,
        uint256 stakerId,
        uint256[] ids,
        uint256[] medians,
        uint256[] lowerCutoffs,
        uint256[] higherCutoffs,
        uint256 iteration,
        uint256 biggestStakerId,
        uint256 timestamp
    );    

    modifier checkEpoch (uint256 epoch) {
        require(epoch == parameters.getEpoch(), "incorrect epoch");
        _;
    }

    modifier checkState (uint256 state) {
        require(state == parameters.getState(), "incorrect state");
        _;
    }

    function initialize (
        address stakeManagerAddress,
        address rewardManagerAddress,
        address voteManagerAddress,
        address assetManagerAddress,
        address parametersAddress
    ) external initializer onlyRole(DEFAULT_ADMIN_ROLE)
    {
        stakeManager = IStakeManager(stakeManagerAddress);
        rewardManager = IRewardManager(rewardManagerAddress);
        voteManager = IVoteManager(voteManagerAddress);
        assetManager = IAssetManager(assetManagerAddress);
        parameters = IParameters(parametersAddress);
    }

    function getBlock(uint256 epoch) external view returns(Structs.Block memory _block) {
        return(blocks[epoch]);
    }

    function getBlockMedians(uint256 epoch) external view returns(uint256[] memory _blockMedians) {
        _blockMedians = blocks[epoch].medians;
        return(_blockMedians);
    }

    function getLowerCutoffs(uint256 epoch) external view returns(uint256[] memory _lowerCutoffs) {
        _lowerCutoffs = blocks[epoch].lowerCutoffs;
        return(_lowerCutoffs);
    }

    function getHigherCutoffs(
        uint256 epoch
    ) external view returns(uint256[] memory _higherCutoffs) 
    {
        _higherCutoffs = blocks[epoch].higherCutoffs;
        return(_higherCutoffs);
    }

    function getProposedBlock(
        uint256 epoch,
        uint256 proposedBlock
    )
        external
        view 
        returns(
            Structs.Block memory _block,
            uint256[] memory _blockMedians,
            uint256[] memory _lowerCutoffs,
            uint256[] memory _higherCutoffs
        ) 
    {
        _block = proposedBlocks[epoch][proposedBlock];
        return(_block, _block.medians, _block.lowerCutoffs, _block.higherCutoffs);
    }

    function getProposedBlockMedians(uint256 epoch, uint256 proposedBlock)
    external view returns(uint256[] memory _blockMedians) {
        _blockMedians = proposedBlocks[epoch][proposedBlock].medians;
        return(_blockMedians);
    }

    function getNumProposedBlocks(uint256 epoch)
    external view returns(uint256) {
        return(proposedBlocks[epoch].length);
    }

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
    ) public initialized checkEpoch(epoch) checkState(parameters.propose()) 
    {
        uint256 proposerId = stakeManager.getStakerId(msg.sender);
        require(isElectedProposer(iteration, biggestStakerId, proposerId), "not elected");
        require(
            stakeManager.getStaker(proposerId).stake >= parameters.minStake(),
            "stake below minimum stake"
        );

        _insertAppropriately(
            epoch, 
            Structs.Block(
                proposerId,
                ids,
                medians,
                lowerCutoffs,
                higherCutoffs,
                iteration,
                stakeManager.getStaker(biggestStakerId).stake,
                true
            )
        );

        emit Proposed(
            epoch,
            proposerId,
            ids,
            medians,
            lowerCutoffs,
            higherCutoffs,
            iteration,
            biggestStakerId,
            block.timestamp
        );
    }

    //anyone can give sorted votes in batches in dispute state
    function giveSorted(
        uint256 epoch,
        uint256 assetId,
        uint256[] memory sorted
    ) 
        public
        initialized
        checkEpoch(epoch)
        checkState(parameters.dispute()) 
    {
        uint256 medianWeight = voteManager.getTotalStakeRevealed(epoch, assetId)/(2);
        uint256 lowerCutoffWeight = voteManager.getTotalStakeRevealed(epoch, assetId)/(4);
        uint256 higherCutoffWeight = (voteManager.getTotalStakeRevealed(epoch, assetId)*(3))/(4);
        uint256 accWeight = disputes[epoch][msg.sender].accWeight;
        uint256 lastVisited = disputes[epoch][msg.sender].lastVisited;
        if (disputes[epoch][msg.sender].accWeight == 0) {
            disputes[epoch][msg.sender].assetId = assetId;
        } else {
            require(disputes[epoch][msg.sender].assetId == assetId, "AssetId not matching");
        }
        for (uint256 i = 0; i < sorted.length; i++) {
            require(sorted[i] > lastVisited, "sorted[i] is not greater than lastVisited");
            lastVisited = sorted[i];
            accWeight = accWeight + (voteManager.getVoteWeight(epoch, assetId, sorted[i]));

            if (disputes[epoch][msg.sender].lowerCutoff == 0 && accWeight >= lowerCutoffWeight) {
                disputes[epoch][msg.sender].lowerCutoff = sorted[i];
            }
            if (disputes[epoch][msg.sender].median == 0 && accWeight > medianWeight) {
                disputes[epoch][msg.sender].median = sorted[i];
            }
            if (disputes[epoch][msg.sender].higherCutoff == 0 && accWeight > higherCutoffWeight) {
                disputes[epoch][msg.sender].higherCutoff = sorted[i];
            }
            //TODO verify how much gas required for below operations and update this value
            if (gasleft() < 10000) break;
        }
        disputes[epoch][msg.sender].lastVisited = lastVisited;
        disputes[epoch][msg.sender].accWeight = accWeight;
    }

    // //if any mistake made during giveSorted, resetDispute and start again
    function resetDispute(
        uint256 epoch
    ) public initialized checkEpoch(epoch) checkState(parameters.dispute())
    {
        disputes[epoch][msg.sender] = Structs.Dispute(0, 0, 0, 0, 0, 0);
    }

    function finalizeDispute (uint256 epoch, uint256 blockId)
    public initialized checkEpoch(epoch) checkState(parameters.dispute()) {
        uint256 assetId = disputes[epoch][msg.sender].assetId;
        require(
            disputes[epoch][msg.sender].accWeight == voteManager.getTotalStakeRevealed(epoch, assetId),
            "Total stake revealed doesnt match"
        );
        uint256 median = disputes[epoch][msg.sender].median;
        uint256 lowerCutoff = disputes[epoch][msg.sender].lowerCutoff;
        uint256 higherCutoff = disputes[epoch][msg.sender].higherCutoff;
        uint256 proposerId = proposedBlocks[epoch][blockId].proposerId;
        //
        require(median > 0, "median can't be zero");
        if (proposedBlocks[epoch][blockId].medians[assetId] != median ||
            proposedBlocks[epoch][blockId].lowerCutoffs[assetId] != lowerCutoff ||
            proposedBlocks[epoch][blockId].higherCutoffs[assetId] != higherCutoff) {
            proposedBlocks[epoch][blockId].valid = false;
            rewardManager.slash(proposerId, msg.sender, epoch);
        } else {
            revert("Proposed Alternate block is identical to proposed block");
        }
    }

    function confirmBlock() public initialized onlyRole(parameters.getBlockConfirmerHash()) {
        uint256 epoch = parameters.getEpoch();
        
        for (uint8 i=0; i < proposedBlocks[epoch - 1].length; i++) {
            if (proposedBlocks[epoch - 1][i].valid) {
                blocks[epoch - 1] = proposedBlocks[epoch - 1][i];
                uint256 proposerId = proposedBlocks[epoch - 1][i].proposerId;
                emit BlockConfirmed(epoch - 1,
                                    proposerId,
                                    proposedBlocks[epoch - 1][i].medians,
                                    proposedBlocks[epoch - 1][i].lowerCutoffs,
                                    proposedBlocks[epoch - 1][i].higherCutoffs,
                                    proposedBlocks[epoch - 1][i].ids,
                                    block.timestamp);
                for (uint8 j = 0; j < proposedBlocks[epoch - 1][i].ids.length; j++) {
                    assetManager.fulfillAsset(proposedBlocks[epoch - 1][i].ids[j],
                                        proposedBlocks[epoch - 1][i].medians[j]);
                }
                rewardManager.giveBlockReward(proposerId, epoch);
                return;
            }
        }
        
    }

    function isElectedProposer(
        uint256 iteration,
        uint256 biggestStakerId,
        uint256 stakerId
    )
        public
        view
        initialized
        returns (bool) 
    {   
        // generating pseudo random number (range 0..(totalstake - 1)), add (+1) to the result,
        // since prng returns 0 to max-1 and staker start from 1
        if ((Random.prng(10, stakeManager.getNumStakers(), keccak256(abi.encode(iteration)), parameters.epochLength())+(1)) != stakerId) {
            return false;
        }
        bytes32 randHash = Random.prngHash(10, keccak256(abi.encode(stakerId, iteration)), parameters.epochLength());
        uint256 rand = uint256(randHash)%(2**32);
        uint256 biggestStake = stakeManager.getStaker(biggestStakerId).stake;
        if (rand*(biggestStake) > stakeManager.getStaker(stakerId).stake*(2**32)) return(false);
        return true;
    }

    function _insertAppropriately(uint256 epoch, Structs.Block memory _block) internal {
        if (proposedBlocks[epoch].length == 0) {
            proposedBlocks[epoch].push(_block);
            return;
        }

        uint256 pushAt = proposedBlocks[epoch].length;
        for (uint256 i = 0; i < proposedBlocks[epoch].length; i++) {
            if (proposedBlocks[epoch][i].biggestStake < _block.biggestStake) {
                pushAt = i;
                break;
            }
            if (proposedBlocks[epoch][i].iteration > _block.iteration) {
                pushAt = i;
                break;
            }
        }

        proposedBlocks[epoch].push(_block);
        for (uint256 j = proposedBlocks[epoch].length - 1; j > (pushAt); j--) {
            proposedBlocks[epoch][j] = proposedBlocks[epoch][j - 1];
        }

        proposedBlocks[epoch][pushAt] = _block;

        if (proposedBlocks[epoch].length > parameters.maxAltBlocks()) {
            delete (proposedBlocks[epoch][proposedBlocks[epoch].length - 1]);
        }
    }


}
