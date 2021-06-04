// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IParameters {

    function commit() external view returns(uint32);
    function reveal() external view returns(uint32);
    function propose() external view returns(uint32);
    function dispute() external view returns(uint32);

    // penalty not reveal = 0.01% per epch
    function penaltyNotRevealNum() external view returns(uint256);
    function penaltyNotRevealDenom() external view returns(uint256);
    function minStake() external view returns(uint256);
    function unstakeLockPeriod() external view returns(uint256);
    function withdrawLockPeriod() external view returns(uint256);
    function maxAltBlocks() external view returns(uint256);
    function epochLength() external view returns(uint256);
    function numStates() external view returns(uint256);
    function exposureDenominator() external view returns(uint256);
    function getEpoch() external view returns(uint256);
    function getState() external view returns(uint256);

    function getJobConfirmerHash() external view returns(bytes32);
    function getBlockConfirmerHash() external view returns(bytes32);
    function getStakeModifierHash() external view returns(bytes32);
    function getStakerActivityUpdaterHash() external view returns(bytes32);
    function getDefaultAdminHash() external view returns(bytes32);
}
