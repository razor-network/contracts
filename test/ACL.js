const { assert } = require('chai');
const { DEFAULT_ADMIN_ROLE_HASH } = require('./helpers/constants');
const { takeSnapshot, restoreSnapshot } = require('./helpers/testHelpers');
const { setupContracts } = require('./helpers/testSetup');
const { assertRevert } = require('./helpers/utils');

describe('Access Control Test', async () => {
  let signers;
  let snapShotId;
  let blockManager;
  let constants;
  let jobManager;
  let stakeManager;
  const expectedRevertMessage = 'AccessControl: sender doesnt have appropriate role';

  before(async () => {
    ({
      blockManager, constants, jobManager, stakeManager,
    } = await setupContracts());
    signers = await ethers.getSigners();
  });

  beforeEach(async () => {
    snapShotId = await takeSnapshot();
  });

  afterEach(async () => {
    await restoreSnapshot(snapShotId);
  });

  it('fulFillJob() should not be accessable by anyone besides JobConfirmer', async () => {
    // Checking if Anyone can access it
    await assertRevert(jobManager.fulfillJob(2, 222), expectedRevertMessage);

    // Checking if BlockConfirmer can access it
    await jobManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await assertRevert(jobManager.fulfillJob(2, 222), expectedRevertMessage);

    // Checking if StakeModifier can access it
    await jobManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await assertRevert(jobManager.fulfillJob(2, 222), expectedRevertMessage);

    // Checking if StakerActivityUpdater can access it
    await jobManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await assertRevert(jobManager.fulfillJob(2, 222), expectedRevertMessage);

    // revoking is important to not impact other test cases
    await jobManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await jobManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
    await jobManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('fulFillJob() should be accessable by only JobConfirmer', async () => {
    await constants.getJobConfirmerHash();
    await jobManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await jobManager.fulfillJob(2, 222);
    await jobManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
  });

  it('confirmBlock() should not be accessable by anyone besides BlockConfirmer', async () => {
    // Checking if Anyone can access it
    await assertRevert(blockManager.confirmBlock(), expectedRevertMessage);

    // Checking if JobConfirmer can access it
    await blockManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await assertRevert(blockManager.confirmBlock(), expectedRevertMessage);

    // Checking if StakeModifier can access it
    await blockManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await assertRevert(blockManager.confirmBlock(), expectedRevertMessage);

    // Checking if StakerActivityUpdater can access it
    await blockManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await assertRevert(blockManager.confirmBlock(), expectedRevertMessage);

    await blockManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
    await blockManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
    await blockManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('confirmBlock() should be accessable by BlockConfirmer', async () => {
    await blockManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await blockManager.confirmBlock();
    await blockManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
  });

  it('slash() should not be accessable by anyone besides StakeModifier', async () => {
    // Checking if Anyone can access it
    await assertRevert(stakeManager.slash(1, signers[2].address, 1), expectedRevertMessage);

    // Checking if JobConfirmer can access it
    await stakeManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.slash(1, signers[2].address, 1), expectedRevertMessage);

    // Checking if BlockConfirmer can access it
    await stakeManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.slash(1, signers[2].address, 1), expectedRevertMessage);

    // Checking if StakerActivityUpdater can access it
    await stakeManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await assertRevert(stakeManager.slash(1, signers[2].address, 1), expectedRevertMessage);

    await stakeManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('slash() should be accessable by StakeModifier', async () => {
    await stakeManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await stakeManager.slash(1, signers[2].address, 1);
    await stakeManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
  });

  it('giveBlockReward() should not be accessable by anyone besides StakeModifier', async () => {
    // Checking if Anyone can access it
    await assertRevert(stakeManager.giveBlockReward(1, 1), expectedRevertMessage);

    // Checking if JobConfirmer can access it
    await stakeManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.giveBlockReward(1, 1), expectedRevertMessage);

    // Checking if BlockConfirmer can access it
    await stakeManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.giveBlockReward(1, 1), expectedRevertMessage);

    // Checking if StakerActivityUpdater can access it
    await stakeManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await assertRevert(stakeManager.giveBlockReward(1, 1), expectedRevertMessage);

    await stakeManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('giveBlockReward() should be accessable by StakeModifier', async () => {
    await stakeManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await stakeManager.giveBlockReward(1, 1);
    await stakeManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
  });

  it('giveRewards() should not be accessable by anyone besides StakeModifier', async () => {
    // Checking if Anyone can access it
    await assertRevert(stakeManager.giveRewards(1, 1), expectedRevertMessage);

    // Checking if JobConfirmer can access it
    await stakeManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.giveRewards(1, 1), expectedRevertMessage);

    // Checking if BlockConfirmer can access it
    await stakeManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.giveRewards(1, 1), expectedRevertMessage);

    // Checking if StakerActivityUpdater can access it
    await stakeManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await assertRevert(stakeManager.giveRewards(1, 1), expectedRevertMessage);

    await stakeManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('giveRewards() should be accessable by StakeModifier', async () => {
    await stakeManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await stakeManager.giveRewards(1, 1);
    await stakeManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
  });

  it('givePenalties() should not be accessable by anyone besides StakeModifier', async () => {
    // Checking if Anyone can access it
    await assertRevert(stakeManager.givePenalties(1, 1), expectedRevertMessage);

    // Checking if JobConfirmer can access it
    await stakeManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.givePenalties(1, 1), expectedRevertMessage);

    // Checking if BlockConfirmer can access it
    await stakeManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.givePenalties(1, 1), expectedRevertMessage);

    // Checking if StakerActivityUpdater can access it
    await stakeManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await assertRevert(stakeManager.givePenalties(1, 1), expectedRevertMessage);

    await stakeManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('givePenalties() should be accessable by StakeModifier', async () => {
    await stakeManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await stakeManager.givePenalties(1, 1);
    await stakeManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
  });

  it('setStakerEpochLastRevealed() should not be accessable by anyone besides StakerActivityUpdater', async () => {
    // Checking if Anyone can access it
    await assertRevert(stakeManager.setStakerEpochLastRevealed(1, 1), expectedRevertMessage);

    // Checking if JobConfirmer can access it
    await stakeManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.setStakerEpochLastRevealed(1, 1), expectedRevertMessage);

    // Checking if BlockConfirmer can access it
    await stakeManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.setStakerEpochLastRevealed(1, 1), expectedRevertMessage);

    // Checking if StakeModifier can access it
    await stakeManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await assertRevert(stakeManager.setStakerEpochLastRevealed(1, 1), expectedRevertMessage);

    await stakeManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
  });

  it('setStakerEpochLastRevealed() should be accessable by StakerActivityUpdater', async () => {
    await stakeManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await stakeManager.setStakerEpochLastRevealed(1, 1);
    await stakeManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('updateCommitmentEpoch() should not be accessable by anyone besides StakerActivityUpdater', async () => {
    // Checking if Anyone can access it
    await assertRevert(stakeManager.updateCommitmentEpoch(1), expectedRevertMessage);

    // Checking if JobConfirmer can access it
    await stakeManager.grantRole(await constants.getJobConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.updateCommitmentEpoch(1), expectedRevertMessage);

    // Checking if BlockConfirmer can access it
    await stakeManager.grantRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await assertRevert(stakeManager.updateCommitmentEpoch(1), expectedRevertMessage);

    // Checking if StakeModifier can access it
    await stakeManager.grantRole(await constants.getStakeModifierHash(), signers[0].address);
    await assertRevert(stakeManager.updateCommitmentEpoch(1), expectedRevertMessage);

    await stakeManager.revokeRole(await constants.getJobConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getBlockConfirmerHash(), signers[0].address);
    await stakeManager.revokeRole(await constants.getStakeModifierHash(), signers[0].address);
  });

  it('updateCommitmentEpoch() should be accessable by StakerActivityUpdater', async () => {
    await stakeManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
    await stakeManager.updateCommitmentEpoch(1);
    await stakeManager.revokeRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });

  it('Only Default Admin should able to update Block Reward', async () => {
    await assertRevert(stakeManager.connect(signers[1]).updateBlockReward(100), expectedRevertMessage);
    assert(await stakeManager.updateBlockReward(100), "Admin not able to update BlockReward");
  });

  it('Default Admin should able to change, New admin should able to grant/revoke', async () => {
    const expectedRevertMessage = 'AccessControl: sender must be an admin to grant';
    // Old admin should be able to grant admin role to another account
    await stakeManager.grantRole(DEFAULT_ADMIN_ROLE_HASH, signers[1].address);

    // New admin should be able to revoke admin access from old admin
    await stakeManager.connect(signers[1]).revokeRole(DEFAULT_ADMIN_ROLE_HASH, signers[0].address);

    // Old admin should not able to assign roles anymore
    await assertRevert(stakeManager.grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address), expectedRevertMessage);

    // New admin should be able to assign roles
    await stakeManager.connect(signers[1]).grantRole(await constants.getStakerActivityUpdaterHash(), signers[0].address);
  });
});
