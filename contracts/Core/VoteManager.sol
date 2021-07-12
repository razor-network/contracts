// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interface/IParameters.sol";
import "./interface/IStakeManager.sol";
import "./interface/IRewardManager.sol";
import "./interface/IBlockManager.sol";
import "./interface/IAssetManager.sol";
import "./storage/VoteStorage.sol";
import "../Initializable.sol";
import "./ACL.sol";
import "../lib/Random.sol";

contract VoteManager is Initializable, ACL, VoteStorage {

    IParameters public parameters;
    IStakeManager public stakeManager;
    IRewardManager public rewardManager;
    IBlockManager public blockManager;
    IAssetManager public assetManager;

    event Committed(uint256 epoch, uint256 stakerId, bytes32 commitment, uint256 timestamp);
    event Revealed(uint256 epoch, uint256 stakerId, uint256 stake, Structs.AssignedAsset[] values, uint256 timestamp);

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
        address blockManagerAddress,
        address parametersAddress,
        address assetManagerAddress
    ) external initializer onlyRole(DEFAULT_ADMIN_ROLE)
    {
        stakeManager = IStakeManager(stakeManagerAddress);
        rewardManager = IRewardManager(rewardManagerAddress);
        blockManager = IBlockManager(blockManagerAddress);
        parameters = IParameters(parametersAddress);
        assetManager = IAssetManager(assetManagerAddress);
    }
    

    function commit(uint256 epoch, bytes32 commitment) public initialized checkEpoch(epoch) checkState(parameters.commit()) {
        uint256 stakerId = stakeManager.getStakerId(msg.sender);
        require(commitments[epoch][stakerId] == 0x0, "already commited");
        Structs.Staker memory thisStaker = stakeManager.getStaker(stakerId);

        // Switch to call confirm block only when block in previous epoch has not been confirmed 
        // and if previous epoch do have proposed blocks

        if (blockManager.getBlock(epoch-1).proposerId == 0 && blockManager.getNumProposedBlocks(epoch-1) > 0) {
            blockManager.confirmBlock();
        }
        rewardManager.givePenalties(stakerId, epoch);

        if (thisStaker.stake >= parameters.minStake()) {
            commitments[epoch][stakerId] = commitment;
            stakeManager.updateCommitmentEpoch(stakerId);
            emit Committed(epoch, stakerId, commitment, block.timestamp);
        }
    }

    function reveal (
        uint256 epoch,
        bytes32 root,
        Structs.AssignedAsset [] memory values,
        bytes32[][] memory proofs, bytes32 secret,
        address stakerAddress
    )
        public
        initialized
        checkEpoch(epoch) 
    {
        uint256 thisStakerId = stakeManager.getStakerId(stakerAddress);
        require(thisStakerId > 0, "Structs.Staker does not exist");
        Structs.Staker memory thisStaker = stakeManager.getStaker(thisStakerId);
        require(commitments[epoch][thisStakerId] != 0x0, "not commited or already revealed");
        require(keccak256(abi.encodePacked(epoch, root, secret)) == commitments[epoch][thisStakerId],
                "incorrect secret/value");
        require(values.length == parameters.maxAssetsPerStaker(), "Revealed assets not equal to required assets per staker");

        //if revealing self
        if (msg.sender == stakerAddress) {
            require(parameters.getState() == parameters.reveal(), "Not reveal state");
            require(thisStaker.stake > 0, "nonpositive stake");
            for (uint256 i = 0; i < values.length; i++) {
                if (votes[epoch][thisStakerId][values[i].id - 1].weight == 0) { // If Job Not Revealed before 
                    require(isAssetAllotedToStaker(thisStakerId, i, values[i].id), "Revealed asset not alloted");
                    require(MerkleProof.verify(proofs[i], root, keccak256(abi.encodePacked(values[i].value))),
                    "invalid merkle proof");
                    votes[epoch][thisStakerId][values[i].id-1] = Structs.Vote(values[i].value, thisStaker.stake);
                    voteWeights[epoch][values[i].id-1][values[i].value] = voteWeights[epoch][values[i].id-1][values[i].value]+(thisStaker.stake);
                    totalStakeRevealed[epoch][values[i].id-1] = totalStakeRevealed[epoch][values[i].id-1]+(thisStaker.stake);
                }
            }

            rewardManager.giveRewards(thisStakerId, epoch);

            commitments[epoch][thisStakerId] = 0x0;
            stakeManager.setStakerEpochLastRevealed(thisStakerId, epoch);

            emit Revealed(epoch, thisStakerId, thisStaker.stake, values, block.timestamp);
        } else {
            //bounty hunter revealing someone else's secret in commit state
            require(parameters.getState() == parameters.commit(), "Not commit state");
            commitments[epoch][thisStakerId] = 0x0;
            rewardManager.slash(thisStakerId, msg.sender, epoch);
        }
    }

    function isAssetAllotedToStaker(uint256 stakerId, uint256 iteration, uint256 assetId) public view initialized returns (bool)
    {   
        // numBlocks = 10, max= numAssets, seed = iteration+stakerId, epochLength
        if ((Random.prng(10, assetManager.getNumAssets(), keccak256(abi.encode( iteration + stakerId)), parameters.epochLength())+(1)) == assetId) return true;
        return false;
    }
    function getCommitment(uint256 epoch, uint256 stakerId) public view returns(bytes32) {
        //epoch -> stakerid -> commitment
        return(commitments[epoch][stakerId]);
    }

    function getVote(uint256 epoch, uint256 stakerId, uint256 assetId) public view returns(Structs.Vote memory vote) {
        //epoch -> stakerid -> assetid -> vote
        return(votes[epoch][stakerId][assetId]);
    }

    function getVoteWeight(uint256 epoch, uint256 assetId, uint256 voteValue)
    public view returns(uint256) {
        //epoch -> assetid -> voteValue -> weight
        return(voteWeights[epoch][assetId][voteValue]);
    }

    function getTotalStakeRevealed(uint256 epoch, uint256 assetId) public view returns(uint256) {
        // epoch -> asset -> stakeWeight
        return(totalStakeRevealed[epoch][assetId]);
    }

    function getTotalStakeRevealed(uint256 epoch, uint256 assetId, uint256 voteValue) public view returns(uint256) {
        //epoch -> assetid -> voteValue -> weight
        return(voteWeights[epoch][assetId][voteValue]);
    }
}
