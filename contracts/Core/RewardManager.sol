// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interface/IParameters.sol";
import "./interface/IBlockManager.sol";
import "./interface/IStakeManager.sol";
import "./interface/IVoteManager.sol";
import "./storage/RewardStorage.sol";
import "../Initializable.sol";
import "./ACL.sol";

/// @title StakeManager
/// @notice StakeManager handles stake, unstake, withdraw, reward, functions
/// for stakers

contract RewardManager is Initializable, ACL, RewardStorage {
    IParameters public parameters;
    IStakeManager public stakeManager;
    IVoteManager public voteManager;
    IBlockManager public blockManager;

    event RewardPoolChange(
        uint256 epoch,
        uint256 prevRewardPool,
        uint256 rewardPool,
        uint256 timestamp
    );
    event StakeGettingRewardChange(
        uint256 epoch,
        uint256 prevStakeGettingReward,
        uint256 stakeGettingReward,
        uint256 timestamp
    );

    modifier checkEpoch(uint256 epoch) {
        require(epoch == parameters.getEpoch(), "incorrect epoch");
        _;
    }

    modifier checkState(uint256 state) {
        require(state == parameters.getState(), "incorrect state");
        _;
    }

    constructor(uint256 _blockReward) {
        blockReward = _blockReward;
    }

    /// @param stakeManagerAddress The address of the VoteManager contract
    /// @param voteManagersAddress The address of the VoteManager contract
    /// @param blockManagerAddress The address of the BlockManager contract
    /// @param parametersAddress The address of the StateManager contract
    function initialize(
        address stakeManagerAddress,
        address voteManagersAddress,
        address blockManagerAddress,
        address parametersAddress
    ) external initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        stakeManager = IStakeManager(stakeManagerAddress);
        voteManager = IVoteManager(voteManagersAddress);
        blockManager = IBlockManager(blockManagerAddress);
        parameters = IParameters(parametersAddress);
    }

    function updateBlockReward(uint256 _blockReward)
        external
        onlyRole(parameters.getDefaultAdminHash())
    {
        blockReward = _blockReward;
    }

    /// @notice gives penalty to stakers for failing to reveal or
    /// reveal value deviations
    /// @param stakerId The id of staker currently in consideration
    /// @param epoch the epoch value
    /// todo reduce complexity
    function givePenalties(uint256 stakerId, uint256 epoch)
        external
        initialized
        onlyRole(parameters.getRewardModifierHash())
    {
        _givePenalties(stakerId, epoch);
    }

    /// @notice The function gives block reward for one valid proposer in the
    /// previous epoch by increasing stake of staker
    /// called from confirmBlock function of BlockManager contract
    /// @param stakerId The ID of the staker
    function giveBlockReward(uint256 stakerId, uint256 epoch)
        external
        onlyRole(parameters.getRewardModifierHash())
    {
        if (blockReward > 0) {
            uint256 newStake =
                stakeManager.getStaker(stakerId).stake + (blockReward);
            stakeManager.setStakerStake(
                stakerId,
                newStake,
                "Block Reward",
                epoch
            );
        }
        uint256 prevStakeGettingReward = stakeGettingReward;
        stakeGettingReward = 0;

        emit StakeGettingRewardChange(
            epoch,
            prevStakeGettingReward,
            stakeGettingReward,
            block.timestamp
        );
    }

    /// @notice This function is called in VoteManager reveal function to give
    /// rewards to all the stakers who have correctly staked, committed, revealed
    /// the Values of assets according to the razor protocol rules.
    /// @param stakerId The staker id
    /// @param epoch The epoch number for which reveal has been called
    function giveRewards(uint256 stakerId, uint256 epoch)
        external
        initialized
        onlyRole(parameters.getRewardModifierHash())
    {
        if (stakeGettingReward == 0) return;
        Structs.Staker memory thisStaker = stakeManager.getStaker(stakerId);
        uint256 epochLastRevealed = thisStaker.epochLastRevealed;

        // no rewards if last epoch didn't got revealed
        if ((epoch - epochLastRevealed) != 1) return;

        Structs.Block memory blockLastEpoch = blockManager.getBlock(
            epochLastRevealed
        );

        if (blockLastEpoch.lowerCutoffs.length > 0) {
            uint256 rewardable = 0;
            for (uint256 i = 0; i < blockLastEpoch.lowerCutoffs.length; i++) {
                Structs.Vote memory voteLastEpoch = voteManager.getVote(
                    epochLastRevealed,
                    thisStaker.id,
                    blockLastEpoch.ids[i] - 1
                );

                //give rewards only if given asset was revealed by given staker
                if (voteLastEpoch.weight > 0) {
                    //give rewards if voted in zone
                    if (
                        (voteLastEpoch.value == blockLastEpoch.medians[i]) ||
                        ((voteLastEpoch.value >
                            blockLastEpoch.lowerCutoffs[i]) ||
                            (voteLastEpoch.value <
                                blockLastEpoch.higherCutoffs[i]))
                    ) {
                        rewardable = rewardable + 1;
                    }
                }
            }

            uint256 reward = (thisStaker.stake * rewardPool * rewardable) /
                (stakeGettingReward * blockLastEpoch.lowerCutoffs.length);
            if (reward > 0) {
                uint256 prevStakeGettingReward = stakeGettingReward;
                stakeGettingReward = stakeGettingReward >= thisStaker.stake
                    ? stakeGettingReward - (thisStaker.stake)
                    : 0;
                emit StakeGettingRewardChange(
                    epoch,
                    prevStakeGettingReward,
                    stakeGettingReward,
                    block.timestamp
                );
                uint256 prevRewardPool = rewardPool;
                rewardPool = rewardPool - (reward);
                emit RewardPoolChange(
                    epoch,
                    prevRewardPool,
                    rewardPool,
                    block.timestamp
                );
                stakeManager.setStakerStake(
                    thisStaker.id,
                    (thisStaker.stake + reward),
                    "Voting Rewards",
                    epoch
                );
            }
        }
    }

    /// @notice The function is used by the Votemanager reveal function
    /// to penalise the staker who lost his secret and make his stake less by "slashPenaltyAmount" and
    /// transfer to bounty hunter half the "slashPenaltyAmount" of the staker
    /// @param id The ID of the staker who is penalised
    /// @param bountyHunter The address of the bounty hunter
    function slash(
        uint256 id,
        address bountyHunter,
        uint256 epoch
    ) external onlyRole(parameters.getRewardModifierHash()) {
       uint256 slashPenaltyAmount = (stakeManager.getStaker(id).stake*parameters.slashPenaltyNum())/parameters.slashPenaltyDenom();
       uint256 Stake =  stakeManager.getStaker(id).stake - slashPenaltyAmount;
       uint256 bountyReward = slashPenaltyAmount/2;
       stakeManager.setStakerStake(id, Stake, "Slashed", epoch);
       stakeManager.transferBounty(bountyHunter, bountyReward);
    }

    /// @notice This function is used by StakeManager to increment reward pool,
    // in case of resetLock() penalty
    function incrementRewardPool(uint256 penalty)
        external
        onlyRole(parameters.getRewardModifierHash())
    {
        uint256 prevRewardPool = rewardPool;
        rewardPool = rewardPool + (penalty);
        emit RewardPoolChange(
            parameters.getEpoch(),
            prevRewardPool,
            rewardPool,
            block.timestamp
        );
    }

    /// @return The rewardpool
    function getRewardPool() external view returns (uint256) {
        return (rewardPool);
    }

    /// @return The stakeGettingReward value
    function getStakeGettingReward() external view returns (uint256) {
        return (stakeGettingReward);
    }

    /// @notice Calculates the inactivity penalties of the staker
    /// @param epochs The difference of epochs where the staker was inactive
    /// @param stakeValue The Stake that staker had in last epoch
    function calculateInactivityPenalties(uint256 epochs, uint256 stakeValue)
        public
        view
        returns (uint256)
    {
        //If no of inactive epochs falls under grace period, do not penalise.
        if (epochs <= parameters.gracePeriod()) {
            return (stakeValue);
        }

        uint256 penalty =
            ((epochs) * (stakeValue * (parameters.penaltyNotRevealNum()))) /
                parameters.penaltyNotRevealDenom();
        if (penalty < stakeValue) {
            return (stakeValue - (penalty));
        } else {
            return (0);
        }
    }

    /// @notice The function gives out penalties to stakers during commit.
    /// The penalties are given for inactivity, failing to reveal
    /// , deviation from the median value of particular asset
    /// @param stakerId The staker id
    /// @param epoch The Epoch value in consideration
    function _giveInactivityPenalties(uint256 stakerId, uint256 epoch)
        internal
    {
        Structs.Staker memory thisStaker = stakeManager.getStaker(stakerId);

        uint256 epochLastActive =
            thisStaker.epochStaked < thisStaker.epochLastRevealed
                ? thisStaker.epochLastRevealed
                : thisStaker.epochStaked;
        // penalize or reward if last active more than epoch - 1
        uint256 inactiveEpochs =
            (epoch - epochLastActive == 0) ? 0 : epoch - epochLastActive - 1;
        uint256 previousStake = thisStaker.stake;
        // uint256 currentStake = previousStake;
        uint256 currentStake =
            calculateInactivityPenalties(inactiveEpochs, previousStake);
        if (currentStake < previousStake) {
            stakeManager.setStakerStake(
                thisStaker.id,
                currentStake,
                "Inactivity Penalty",
                epoch
            );
            uint256 prevRewardPool = rewardPool;
            rewardPool = rewardPool + (previousStake - (currentStake));
            emit RewardPoolChange(
                epoch,
                prevRewardPool,
                rewardPool,
                block.timestamp
            );
        }
    }

    function _givePenalties(uint256 stakerId, uint256 epoch) internal {
        _giveInactivityPenalties(stakerId, epoch);
        Structs.Staker memory thisStaker = stakeManager.getStaker(stakerId);
        uint256 previousStake = thisStaker.stake;
        uint256 epochLastRevealed = thisStaker.epochLastRevealed;

        Structs.Block memory _block = blockManager.getBlock(epochLastRevealed);

        uint256[] memory lowerCutoffsLastEpoch = _block.lowerCutoffs;
        uint256[] memory higherCutoffsLastEpoch = _block.higherCutoffs;
        uint256[] memory ids = _block.ids;

        if (lowerCutoffsLastEpoch.length > 0) {
            uint256 penalty = 0;
            for (uint256 i = 0; i < lowerCutoffsLastEpoch.length; i++) {
                Structs.Vote memory voteLastEpoch = voteManager.getVote(
                    epochLastRevealed,
                    thisStaker.id,
                    ids[i] - 1
                );

                if (voteLastEpoch.weight > 0) {
                    if (
                        (voteLastEpoch.value < lowerCutoffsLastEpoch[i]) ||
                        (voteLastEpoch.value > higherCutoffsLastEpoch[i])
                    ) {
                        // WARNING: Potential security vulnerability. Could increase stake maliciously, need analysis
                        // For more info, See issue -: https://github.com/razor-network/contracts/issues/112
                        penalty =
                            penalty +
                            (previousStake / parameters.exposureDenominator());
                    }
                }
            }

            if (penalty > 0) {
                penalty = (penalty > previousStake) ? previousStake : penalty;
                stakeManager.setStakerStake(
                    thisStaker.id,
                    (previousStake - (penalty)),
                    "Voting Penalty",
                    epoch
                );
                uint256 prevRewardPool = rewardPool;
                rewardPool = rewardPool + (penalty);
                emit RewardPoolChange(
                    epoch,
                    prevRewardPool,
                    rewardPool,
                    block.timestamp
                );
            } else {
                //no penalty. only reward
                uint256 prevStakeGettingReward = stakeGettingReward;
                stakeGettingReward = stakeGettingReward + (previousStake); //*(1 - y);
                emit StakeGettingRewardChange(
                    epoch,
                    prevStakeGettingReward,
                    stakeGettingReward,
                    block.timestamp
                );
            }
        }
    }
}
