/* TODO:
test unstake and withdraw
test cases where nobody votes, too low stake (1-4) */

const merkle = require('@razor-network/merkle');
const { utils } = require('ethers');
const { DEFAULT_ADMIN_ROLE_HASH } = require('./helpers/constants');
const {
  assertBNEqual,
  assertBNLessThan,
  assertRevert,
  mineToNextEpoch,
  mineToNextState,
} = require('./helpers/testHelpers');
const { setupContracts } = require('./helpers/testSetup');
const {
  getEpoch,
  getIteration,
  getBiggestStakeAndId,
  toBigNumber,
  tokenAmount,
} = require('./helpers/utils');

describe('VoteManager', function () {
  describe('BlockManager', function () {
    let signers;
    let blockManager;
    let parameters;
    let random;
    let razor;
    let stakeManager;
    let rewardManager;
    let voteManager;
    let initializeContracts;

    before(async () => {
      ({
        blockManager, parameters, random, razor, stakeManager, rewardManager, voteManager, initializeContracts,
      } = await setupContracts());
      signers = await ethers.getSigners();
    });

    describe('razor', async function () {
      it('admin role should be granted', async () => {
        const isAdminRoleGranted = await stakeManager.hasRole(DEFAULT_ADMIN_ROLE_HASH, signers[0].address);
        assert(isAdminRoleGranted === true, 'Admin role was not Granted');
      });

      it('should not be able to commit without initialization', async () => {
        const epoch = await getEpoch();
        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);

        const root = tree.root();
        const commitment1 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );
        const tx = voteManager.connect(signers[5]).commit(epoch, commitment1);

        await assertRevert(tx, 'Contract should be initialized');
      });

      it('should not be able to initiliaze VoteManager contract without admin role', async () => {
        const tx = voteManager.connect(signers[1]).initialize(stakeManager.address, rewardManager.address, blockManager.address, parameters.address);
        await assertRevert(tx, 'ACL: sender not authorized');
      });

      it('should be able to initialize', async function () {
        await Promise.all(await initializeContracts());

        await mineToNextEpoch();
        await razor.transfer(signers[3].address, tokenAmount('423000'));
        await razor.transfer(signers[4].address, tokenAmount('19000'));
        await razor.transfer(signers[5].address, tokenAmount('1000'));
        await razor.transfer(signers[6].address, tokenAmount('1000'));
        await razor.connect(signers[3]).approve(stakeManager.address, tokenAmount('420000'));
        await razor.connect(signers[4]).approve(stakeManager.address, tokenAmount('19000'));
        await razor.connect(signers[5]).approve(stakeManager.address, tokenAmount('1000'));
        await razor.connect(signers[6]).approve(stakeManager.address, tokenAmount('1000'));
        const epoch = await getEpoch();
        await stakeManager.connect(signers[3]).stake(epoch, tokenAmount('420000'));
        await stakeManager.connect(signers[4]).stake(epoch, tokenAmount('19000'));
      });

      it('should be able to commit', async function () {
        const epoch = await getEpoch();
        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);
        const root = tree.root();
        const commitment1 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );

        await voteManager.connect(signers[3]).commit(epoch, commitment1);
        const stakerIdAcc3 = await stakeManager.stakerIds(signers[3].address);
        const commitment2 = await voteManager.getCommitment(epoch, stakerIdAcc3);

        assertBNEqual(commitment1, commitment2, 'commitment1, commitment2 not equal');

        const votes2 = [104, 204, 304, 404, 504, 604, 704, 804, 904];
        const tree2 = merkle('keccak256').sync(votes2);
        const root2 = tree2.root();
        const commitment3 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );

        await voteManager.connect(signers[4]).commit(epoch, commitment3);
      });

      it('should be able to reveal', async function () {
        const epoch = await getEpoch();
        const stakerIdAcc3 = await stakeManager.stakerIds(signers[3].address);

        const stakeBefore = (await stakeManager.stakers(stakerIdAcc3)).stake;

        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);

        await mineToNextState(); // reveal

        const proof = [];
        for (let i = 0; i < votes.length; i++) {
          proof.push(tree.getProofPath(i, true, true));
        }

        await voteManager.connect(signers[3]).reveal(epoch, tree.root(), votes, proof,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[3].address);
        // arguments getvVote => epoch, stakerId, assetId
        assertBNEqual((await voteManager.getVote(epoch, stakerIdAcc3, 0)).value, toBigNumber('100'), 'Vote not equal to 100');

        const votes2 = [104, 204, 304, 404, 504, 604, 704, 804, 904];
        const tree2 = merkle('keccak256').sync(votes2);
        const root2 = tree2.root();
        const proof2 = [];
        for (let i = 0; i < votes2.length; i++) {
          proof2.push(tree2.getProofPath(i, true, true));
        }

        await voteManager.connect(signers[4]).reveal(epoch, root2, votes2, proof2,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[4].address);

        const stakeAfter = (await stakeManager.stakers(stakerIdAcc3)).stake;
        assertBNEqual(stakeBefore, stakeAfter);
      });

      it('should be able to commit again with correct rewards', async function () {
        let epoch = await getEpoch();
        const stakerIdAcc3 = await stakeManager.stakerIds(signers[3].address);
        const stakerIdAcc4 = await stakeManager.stakerIds(signers[4].address);
        const staker = await stakeManager.getStaker(stakerIdAcc3);
        const { biggestStakerId } = await getBiggestStakeAndId(stakeManager);

        const iteration = await getIteration(stakeManager, random, staker);
        await mineToNextState(); // propose
        await blockManager.connect(signers[3]).propose(epoch,
          [1, 2, 3, 4, 5, 6, 7, 8, 9],
          [100, 200, 300, 400, 500, 600, 700, 800, 900],
          [100, 200, 300, 400, 500, 600, 700, 800, 900],
          [104, 204, 304, 404, 504, 604, 704, 804, 904],
          iteration,
          biggestStakerId);

        const stakeBefore = (await stakeManager.stakers(stakerIdAcc3)).stake;
        const stakeBefore2 = (await stakeManager.stakers(stakerIdAcc4)).stake;
        await mineToNextState(); // dispute
        await mineToNextState(); // commit
        epoch = await getEpoch();
        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);
        const root = tree.root();
        const commitment1 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );

        await voteManager.connect(signers[3]).commit(epoch, commitment1);

        const votes2 = [104, 204, 304, 404, 504, 604, 704, 804, 904];
        const tree2 = merkle('keccak256').sync(votes2);
        const root2 = tree2.root();
        const commitment2 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );

        await voteManager.connect(signers[4]).commit(epoch, commitment2);
        const commitment3 = await voteManager.getCommitment(epoch, stakerIdAcc3);

        assertBNEqual(commitment1, commitment3, 'commitment1, commitment2 not equal');

        const stakeAfter = (await stakeManager.stakers(stakerIdAcc3)).stake;
        const stakeAfter2 = (await stakeManager.stakers(stakerIdAcc4)).stake;
        assertBNLessThan(stakeBefore, stakeAfter, 'Not rewarded');
        assertBNEqual(stakeBefore2, stakeAfter2, 'Penalty should not be applied');
        const stakeGettingReward = await rewardManager.stakeGettingReward();
        assertBNEqual(stakeGettingReward, (stakeAfter2.add(stakeAfter)), 'Error 3');
      });

      it('should be able to reveal again but with no rewards for now', async function () {
        const epoch = await getEpoch();
        const stakerIdAcc3 = await stakeManager.stakerIds(signers[3].address);
        const stakerIdAcc4 = await stakeManager.stakerIds(signers[4].address);

        const stakeBefore = (await stakeManager.stakers(stakerIdAcc3)).stake.toString();
        const stakeBefore2 = (await stakeManager.stakers(stakerIdAcc4)).stake.toString();

        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);

        const proof = [];
        for (let i = 0; i < votes.length; i++) {
          proof.push(tree.getProofPath(i, true, true));
        }

        const votes2 = [104, 204, 304, 404, 504, 604, 704, 804, 904];
        const tree2 = merkle('keccak256').sync(votes2);

        const proof2 = [];
        for (let i = 0; i < votes2.length; i++) {
          proof2.push(tree2.getProofPath(i, true, true));
        }

        await mineToNextState(); // reveal

        await voteManager.connect(signers[3]).reveal(epoch, tree.root(), votes, proof,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[3].address);
        // arguments getvVote => epoch, stakerId, assetId
        assertBNEqual((await voteManager.getVote(epoch, stakerIdAcc3, 0)).value, toBigNumber('100'), 'Vote not equal to 100');

        await voteManager.connect(signers[4]).reveal(epoch, tree2.root(), votes2, proof2,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[4].address);

        const rewardPool = await rewardManager.rewardPool();
        const stakeAfter = (await stakeManager.stakers(stakerIdAcc3)).stake;
        const stakeAfter2 = (await stakeManager.stakers(stakerIdAcc4)).stake;
        assertBNEqual(rewardPool, toBigNumber('0'));
        assertBNEqual(stakeBefore, stakeAfter);
        assertBNEqual(stakeBefore2, stakeAfter2);
      });

      it('account 4 should be penalised for trying to make fraudulent predictions in the previous epoch', async function () {
        let epoch = await getEpoch();
        const stakerIdAcc3 = await stakeManager.stakerIds(signers[3].address);
        const stakerIdAcc4 = await stakeManager.stakerIds(signers[4].address);
        const staker = await stakeManager.getStaker(stakerIdAcc3);

        const { biggestStakerId } = await getBiggestStakeAndId(stakeManager);

        const iteration = await getIteration(stakeManager, random, staker);
        await mineToNextState(); // propose
        await blockManager.connect(signers[3]).propose(epoch,
          [10, 11, 12, 13, 14, 15, 16, 17, 18],
          [100, 200, 300, 400, 500, 600, 700, 800, 900],
          [100, 200, 300, 400, 500, 600, 700, 800, 900],
          [103, 203, 303, 403, 503, 603, 703, 803, 903],
          iteration,
          biggestStakerId);

        const stakeBefore = ((await stakeManager.stakers(stakerIdAcc3)).stake);
        const stakeBefore2 = ((await stakeManager.stakers(stakerIdAcc4)).stake);
        await mineToNextState(); // dispute
        await mineToNextState(); // commit
        epoch = await getEpoch();
        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);
        const root = tree.root();
        const commitment1 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );

        await voteManager.connect(signers[3]).commit(epoch, commitment1);
        await voteManager.connect(signers[4]).commit(epoch, commitment1);

        const commitment2 = await voteManager.getCommitment(epoch, stakerIdAcc3);

        assert(commitment1 === commitment2, 'commitment1, commitment2 not equal');

        const stakeAfter = (await stakeManager.stakers(stakerIdAcc3)).stake;
        const stakeAfter2 = (await stakeManager.stakers(stakerIdAcc4)).stake;
        let penalty = toBigNumber('0');
        const den = toBigNumber('1000');
        for (let i = 0; i < votes.length; i++) {
          penalty = penalty.add((stakeBefore2.div(den)));
        }

        assertBNLessThan(stakeBefore, stakeAfter, 'Not rewarded');
        assertBNEqual(stakeBefore2.sub(penalty), stakeAfter2, 'Penalty should be applied');
        const stakeGettingReward = await rewardManager.stakeGettingReward();
        assertBNEqual(stakeGettingReward, stakeAfter, 'Error 3');
        const rewardPool = await rewardManager.rewardPool();
        assertBNEqual(rewardPool, penalty, 'reward pool should not be zero as penalties have been applied');
      });

      it('Account 4 should have his stake slashed for leaking out his secret to another account before the reveal state', async function () {
        const epoch = await getEpoch();

        const stakerIdAcc4 = await stakeManager.stakerIds(signers[4].address);
        const stakeBeforeAcc4 = (await stakeManager.stakers(stakerIdAcc4)).stake;

        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);
        const proof = [];
        for (let i = 0; i < votes.length; i++) {
          proof.push(tree.getProofPath(i, true, true));
        }

        await voteManager.connect(signers[10]).reveal(epoch, tree.root(), votes, proof,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[4].address);

        const stakeAcc10 = await razor.connect(signers[10]).balanceOf(signers[10].address);
        const slashPenaltyAmount = (stakeBeforeAcc4.mul((await parameters.slashPenaltyNum()))).div(await parameters.slashPenaltyDenom());
        assertBNEqual((await stakeManager.stakers(stakerIdAcc4)).stake, stakeBeforeAcc4.sub(slashPenaltyAmount), 'stake should be less by slashPenalty');
        assertBNEqual(stakeAcc10, slashPenaltyAmount.div('2'), 'the bounty hunter should receive half of the slashPenaltyAmount of account 4');
      });

      it('Account 3 should be able to reveal again with correct rewards', async function () {
        const epoch = await getEpoch();
        const stakerIdAcc3 = await stakeManager.stakerIds(signers[3].address);

        const stakeBefore = (await stakeManager.stakers(stakerIdAcc3)).stake;

        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);

        const proof = [];
        for (let i = 0; i < votes.length; i++) {
          proof.push(tree.getProofPath(i, true, true));
        }
        await mineToNextState(); // reveal
        const rewardPool = await rewardManager.rewardPool();

        await voteManager.connect(signers[3]).reveal(epoch, tree.root(), votes, proof,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[3].address);
        // arguments getvVote => epoch, stakerId, assetId
        assertBNEqual((await voteManager.getVote(epoch, stakerIdAcc3, 0)).value, toBigNumber('100'), 'Vote not equal to 100');

        const stakeAfter = (await stakeManager.stakers(stakerIdAcc3)).stake;
        assertBNEqual(stakeBefore.add(rewardPool), stakeAfter);
      });

      it('Should be able to slash if stake is zero', async function () {
        await mineToNextEpoch();
        const epoch = await getEpoch();

        await parameters.setMinStake(0);
        await stakeManager.connect(signers[6]).stake(epoch, tokenAmount('0'));

        const votes2 = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree2 = merkle('keccak256').sync(votes2);
        const root2 = tree2.root();
        const commitment3 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );

        await voteManager.connect(signers[6]).commit(epoch, commitment3);

        const stakerIdAcc6 = await stakeManager.stakerIds(signers[6].address);
        const stakeBeforeAcc6 = (await stakeManager.stakers(stakerIdAcc6)).stake;
        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);
        const proof = [];
        for (let i = 0; i < votes.length; i++) {
          proof.push(tree.getProofPath(i, true, true));
        }
        const balanceBeforeAcc10 = await razor.balanceOf(signers[10].address);

        await voteManager.connect(signers[10]).reveal(epoch, tree.root(), votes, proof,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[6].address);

        const balanceAfterAcc10 = await razor.balanceOf(signers[10].address);
        const slashPenaltyAmount = stakeBeforeAcc6.mul(((await parameters.slashPenaltyNum())).div(await parameters.slashPenaltyDenom()));
        const stakeAcc6 = (await stakeManager.stakers(stakerIdAcc6)).stake;
        assertBNEqual(stakeAcc6, toBigNumber('0'), 'Stake of account 6 should be zero');
        assertBNEqual(balanceAfterAcc10, balanceBeforeAcc10.add(slashPenaltyAmount.div('2')),
          'the bounty hunter should receive half of the slashPenaltyAmount of account 4');
      });

      it('Should be able to slash if stake is one', async function () {
        const epoch = await getEpoch();
        await stakeManager.connect(signers[5]).stake(epoch, tokenAmount('1'));

        const votes2 = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree2 = merkle('keccak256').sync(votes2);
        const root2 = tree2.root();
        const commitment3 = utils.solidityKeccak256(
          ['uint256', 'uint256', 'bytes32'],
          [epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
        );

        await voteManager.connect(signers[5]).commit(epoch, commitment3);

        const stakerIdAcc5 = await stakeManager.stakerIds(signers[5].address);
        const stakeBeforeAcc5 = (await stakeManager.stakers(stakerIdAcc5)).stake;
        const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
        const tree = merkle('keccak256').sync(votes);
        const proof = [];
        for (let i = 0; i < votes.length; i++) {
          proof.push(tree.getProofPath(i, true, true));
        }
        const balanceBeforeAcc10 = await razor.balanceOf(signers[10].address);

        await voteManager.connect(signers[10]).reveal(epoch, tree.root(), votes, proof,
          '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
          signers[5].address);

        const balanceAfterAcc10 = await razor.balanceOf(signers[10].address);
        const slashPenaltyAmount = (stakeBeforeAcc5.mul((await parameters.slashPenaltyNum()))).div(await parameters.slashPenaltyDenom());
        const stakeAfterAcc5 = (await stakeManager.stakers(stakerIdAcc5)).stake;
        assertBNEqual(stakeAfterAcc5, stakeBeforeAcc5.sub(slashPenaltyAmount), 'Stake of account 5 should lessen by slashPenaltyAmount');
        assertBNEqual(balanceAfterAcc10, balanceBeforeAcc10.add(slashPenaltyAmount.div('2')),
          'the bounty hunter should receive half of the slashPenaltyAmount of account 4');
      });
    });
  });
});
