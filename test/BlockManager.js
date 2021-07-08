/* TODO:
test same vote values, stakes
test penalizeEpochs */

const merkle = require('@razor-network/merkle');
const {
  assertBNEqual,
  mineToNextEpoch,
  mineToNextState,
  assertRevert,
} = require('./helpers/testHelpers');
const { setupContracts } = require('./helpers/testSetup');
const { DEFAULT_ADMIN_ROLE_HASH } = require('./helpers/constants');
const {
  calculateDisputesData,
  getEpoch,
  getBiggestStakeAndId,
  getIteration,
  toBigNumber,
  tokenAmount,
} = require('./helpers/utils');

const { utils } = ethers;

describe('BlockManager', function () {
  let signers;
  let blockManager;
  let assetManager;
  let random;
  let razor;
  let stakeManager;
  let rewardManager;
  let parameters;
  let voteManager;
  let initializeContracts;

  before(async () => {
    ({
      blockManager,
      parameters,
      assetManager,
      random,
      razor,
      stakeManager,
      rewardManager,
      voteManager,
      initializeContracts,
    } = await setupContracts());
    signers = await ethers.getSigners();
  });

  describe('razor', async () => {
    it('admin role should be granted', async () => {
      const isAdminRoleGranted = await blockManager.hasRole(DEFAULT_ADMIN_ROLE_HASH, signers[0].address);
      assert(isAdminRoleGranted === true, 'Admin role was not Granted');
    });

    it('should not be able to stake, commit without initialization', async () => {
      const epoch = await getEpoch();

      const tx1 = stakeManager.connect(signers[6]).stake(epoch, tokenAmount('18000'));
      await assertRevert(tx1, 'Contract should be initialized');

      const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const tree = merkle('keccak256').sync(votes);

      const root = tree.root();
      const commitment1 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );
      const tx2 = voteManager.connect(signers[5]).commit(epoch, commitment1);

      await assertRevert(tx2, 'Contract should be initialized');
    });

    it('should not be able to initiliaze BlockManager contract without admin role', async () => {
      const tx = blockManager.connect(signers[1]).initialize(
        stakeManager.address,
        rewardManager.address,
        parameters.address,
        voteManager.address,
        assetManager.address
      );
      await assertRevert(tx, 'ACL: sender not authorized');
    });

    it('should be able to initialize', async () => {
      await Promise.all(await initializeContracts());

      await mineToNextEpoch();
      await razor.transfer(signers[5].address, tokenAmount('423000'));
      await razor.transfer(signers[6].address, tokenAmount('19000'));
      await razor.transfer(signers[8].address, tokenAmount('18000'));

      await razor.connect(signers[5]).approve(stakeManager.address, tokenAmount('420000'));
      const epoch = await getEpoch();
      await stakeManager.connect(signers[5]).stake(epoch, tokenAmount('420000'));

      await razor.connect(signers[6]).approve(stakeManager.address, tokenAmount('18000'));
      await stakeManager.connect(signers[6]).stake(epoch, tokenAmount('18000'));

      await razor.connect(signers[8]).approve(stakeManager.address, tokenAmount('18000'));
      await stakeManager.connect(signers[8]).stake(epoch, tokenAmount('18000'));

      const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const tree = merkle('keccak256').sync(votes);

      const root = tree.root();
      const commitment1 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      await voteManager.connect(signers[5]).commit(epoch, commitment1);

      const votes2 = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const tree2 = merkle('keccak256').sync(votes2);

      const root2 = tree2.root();
      const commitment2 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      await voteManager.connect(signers[6]).commit(epoch, commitment2);

      const votes3 = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const tree3 = merkle('keccak256').sync(votes3);

      const root3 = tree3.root();
      const commitment3 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root3, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      await voteManager.connect(signers[8]).commit(epoch, commitment3);

      await mineToNextState();

      const proof = [];
      for (let i = 0; i < votes.length; i++) {
        proof.push(tree.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[5]).reveal(epoch, tree.root(), votes, proof,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[5].address);

      const proof2 = [];
      for (let i = 0; i < votes2.length; i++) {
        proof2.push(tree2.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[6]).reveal(epoch, tree2.root(), votes2, proof2,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[6].address);

      const proof3 = [];
      for (let i = 0; i < votes3.length; i++) {
        proof3.push(tree3.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[8]).reveal(epoch, tree3.root(), votes3, proof3,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[8].address);
    });

    it('should be able to propose', async function () {
      const epoch = await getEpoch();

      await mineToNextState();
      const stakerIdAcc5 = await stakeManager.stakerIds(signers[5].address);
      const staker = await stakeManager.getStaker(stakerIdAcc5);

      const { biggestStakerId } = await getBiggestStakeAndId(stakeManager);
      const iteration = await getIteration(stakeManager, random, staker);

      await blockManager.connect(signers[5]).propose(epoch,
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [100, 201, 300, 400, 500, 600, 700, 800, 900],
        [99, 199, 299, 399, 499, 599, 699, 799, 899],
        [101, 201, 301, 401, 501, 601, 701, 801, 901],
        iteration,
        biggestStakerId);
      const proposedBlock = await blockManager.proposedBlocks(epoch, 0);
      assertBNEqual(proposedBlock.proposerId, toBigNumber('1'), 'incorrect proposalID');
    });

    it('Number of proposals should be 1', async function () {
      const epoch = await getEpoch();

      const nblocks = await blockManager.getNumProposedBlocks(epoch);
      assertBNEqual(nblocks, toBigNumber('1'), 'Only one block has been proposed till now. Incorrect Answer');
    });

    it('should allow another proposals', async function () {
      const epoch = await getEpoch();

      const stakerIdAcc6 = await stakeManager.stakerIds(signers[6].address);
      const staker = await stakeManager.getStaker(stakerIdAcc6);
      const { biggestStakerId } = await getBiggestStakeAndId(stakeManager);

      const firstProposedBlock = await blockManager.proposedBlocks(epoch, 0);

      const iteration = await getIteration(stakeManager, random, staker);

      await blockManager.connect(signers[6]).propose(epoch,
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [100, 200, 300, 400, 500, 600, 700, 800, 900],
        [99, 199, 299, 399, 499, 599, 699, 799, 899],
        [101, 201, 301, 401, 501, 601, 701, 801, 901],
        iteration,
        biggestStakerId);

      const secondProposedBlock = (firstProposedBlock.iteration.gt(iteration))
        ? await blockManager.proposedBlocks(epoch, 0) : await blockManager.proposedBlocks(epoch, 1);

      assertBNEqual(secondProposedBlock.proposerId, toBigNumber('2'));
    });

    it('Number of proposals should be 2', async function () {
      const epoch = await getEpoch();

      const nblocks = await blockManager.getNumProposedBlocks(epoch);

      assertBNEqual(nblocks, toBigNumber('2'), 'Only one block has been proposed till now. Incorrect Answer');
    });

    it('should be able to dispute', async function () {
      await mineToNextState();
      const epoch = await getEpoch();

      const sortedVotes = [toBigNumber('200')];
      const {
        median, totalStakeRevealed, lowerCutoff, higherCutoff,
      } = await calculateDisputesData(
        voteManager,
        epoch,
        sortedVotes,
        [tokenAmount('420000'), tokenAmount('18000')] // initial weights
      );

      await blockManager.connect(signers[19]).giveSorted(epoch, 1, sortedVotes);

      const dispute = await blockManager.disputes(epoch, signers[19].address);

      assertBNEqual(dispute.assetId, toBigNumber('1'), 'assetId should match');
      assertBNEqual(dispute.accWeight, totalStakeRevealed, 'totalStakeRevealed should match');
      assertBNEqual(dispute.median, median, 'median should match');
      assertBNEqual(dispute.lowerCutoff, lowerCutoff, 'lowerCutoff should match');
      assertBNEqual(dispute.higherCutoff, higherCutoff, 'higherCutoff should match');
      assertBNEqual(dispute.lastVisited, sortedVotes[sortedVotes.length - 1], 'lastVisited should match');
    });

    it('should be able to finalize Dispute', async function () {
      const epoch = await getEpoch();

      const firstProposedBlock = await blockManager.proposedBlocks(epoch, 0);
      const secondProposedBlock = await blockManager.proposedBlocks(epoch, 1);

      const firstProposedBlockIndex = (firstProposedBlock.proposerId.gt(secondProposedBlock.proposerId))
        ? 1 : 0;
      const stakerIdAccount = await stakeManager.stakerIds(signers[5].address);
      const stakeBeforeAcc5 = (await stakeManager.getStaker(stakerIdAccount)).stake;
      const balanceBeforeAcc19 = await razor.balanceOf(signers[19].address);

      await blockManager.connect(signers[19]).finalizeDispute(epoch, firstProposedBlockIndex);
      const proposedBlock = await blockManager.proposedBlocks(epoch, firstProposedBlockIndex);

      assert((await proposedBlock.valid) === false);

      const slashPenaltyAmount = (stakeBeforeAcc5.mul((await parameters.slashPenaltyNum()))).div(await parameters.slashPenaltyDenom());

      assertBNEqual((await stakeManager.getStaker(stakerIdAccount)).stake, stakeBeforeAcc5.sub(slashPenaltyAmount));
      assertBNEqual(await razor.balanceOf(signers[19].address), balanceBeforeAcc19.add(slashPenaltyAmount.div('2')));
    });

    it('block proposed by account 6 should be confirmed', async function () {
      await mineToNextState();
      await razor.connect(signers[0]).transfer(signers[7].address, tokenAmount('20000'));

      const epoch = await getEpoch();

      await razor.connect(signers[7]).approve(stakeManager.address, tokenAmount('19000'));
      await stakeManager.connect(signers[7]).stake(epoch, tokenAmount('19000'));

      const votes = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
      const tree = merkle('keccak256').sync(votes);

      const root = tree.root();
      const commitment1 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );
      await voteManager.connect(signers[6]).commit(epoch, commitment1);

      const votes2 = [1010, 2010, 3010, 4010, 5010, 6010, 7010, 8010, 9010];
      const tree2 = merkle('keccak256').sync(votes2);

      const root2 = tree2.root();
      const commitment2 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      await voteManager.connect(signers[7]).commit(epoch, commitment2);

      assertBNEqual(
        (await blockManager.getBlock(epoch - 1)).proposerId,
        await stakeManager.stakerIds(signers[6].address),
        `${await stakeManager.stakerIds(signers[6].address)} ID is the one who proposed the block `
      );

      await mineToNextState();

      const proof = [];
      for (let i = 0; i < votes.length; i++) {
        proof.push(tree.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[6]).reveal(epoch, tree.root(), votes, proof,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[6].address);

      const proof2 = [];
      for (let i = 0; i < votes2.length; i++) {
        proof2.push(tree2.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[7]).reveal(epoch, tree2.root(), votes2, proof2,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[7].address);
    });

    it('all blocks being disputed', async function () {
      const epoch = await getEpoch();
      const stakerIdAcc6 = await stakeManager.stakerIds(signers[6].address);
      const staker6 = await stakeManager.getStaker(stakerIdAcc6);

      const { biggestStakerId } = await getBiggestStakeAndId(stakeManager);

      const iteration6 = await getIteration(stakeManager, random, staker6);

      const stakerIdAcc7 = await stakeManager.stakerIds(signers[7].address);
      const staker7 = await stakeManager.getStaker(stakerIdAcc7);

      const iteration7 = await getIteration(stakeManager, random, staker7);

      await mineToNextState();

      await blockManager.connect(signers[6]).propose(epoch,
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1000, 2001, 3000, 4000, 5000, 6000, 7000, 8000, 9000],
        [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000],
        [1010, 2010, 3010, 4010, 5010, 6010, 7010, 8010, 9010],
        iteration6,
        biggestStakerId);

      await blockManager.connect(signers[7]).propose(epoch,
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1000, 2000, 3001, 4000, 5000, 6000, 7000, 8000, 9000],
        [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000],
        [1010, 2010, 3010, 4010, 5010, 6010, 7010, 8010, 9010],
        iteration7,
        biggestStakerId);

      await mineToNextState();

      const sortedVotes1 = [toBigNumber('2000'), toBigNumber('2010')];
      const {
        median: median1,
        totalStakeRevealed: totalStakeRevealed1,
        lowerCutoff: lowerCutoff1,
        higherCutoff: higherCutoff1,
      } = await calculateDisputesData(
        voteManager,
        epoch,
        sortedVotes1,
        [tokenAmount('18000'), tokenAmount('19000')] // initial weights
      );

      await blockManager.connect(signers[19]).giveSorted(epoch, 1, sortedVotes1);

      const firstDispute = await blockManager.disputes(epoch, signers[19].address);

      assertBNEqual(firstDispute.assetId, toBigNumber('1'), 'assetId should match');
      assertBNEqual(firstDispute.accWeight, totalStakeRevealed1, 'totalStakeRevealed should match');
      assertBNEqual(firstDispute.median, median1, 'median should match');
      assertBNEqual(firstDispute.lowerCutoff, lowerCutoff1, 'lowerCutoff should match');
      assertBNEqual(firstDispute.higherCutoff, higherCutoff1, 'higherCutoff should match');
      assertBNEqual(firstDispute.lastVisited, sortedVotes1[sortedVotes1.length - 1], 'lastVisited should match');

      await blockManager.connect(signers[19]).finalizeDispute(epoch, 0);
      let proposedBlock = await blockManager.proposedBlocks(epoch, 0);
      assert((await proposedBlock.valid) === false);

      const sortedVotes2 = [toBigNumber('3000'), toBigNumber('3010')];

      const {
        median: median2,
        totalStakeRevealed: totalStakeRevealed2,
        lowerCutoff: lowerCutoff2,
        higherCutoff: higherCutoff2,
      } = await calculateDisputesData(
        voteManager,
        epoch,
        sortedVotes2,
        [tokenAmount('18000'), tokenAmount('19000')] // initial weights
      );

      await blockManager.connect(signers[15]).giveSorted(epoch, 2, sortedVotes2);

      const secondDispute = await blockManager.disputes(epoch, signers[15].address);

      assertBNEqual(secondDispute.assetId, toBigNumber('2'), 'assetId should match');
      assertBNEqual(secondDispute.accWeight, totalStakeRevealed2, 'totalStakeRevealed should match');
      assertBNEqual(secondDispute.median, median2, 'median should match');
      assertBNEqual(secondDispute.lowerCutoff, lowerCutoff2, 'lowerCutoff should match');
      assertBNEqual(secondDispute.higherCutoff, higherCutoff2, 'higherCutoff should match');
      assertBNEqual(secondDispute.lastVisited, sortedVotes2[sortedVotes2.length - 1], 'lastVisited should match');

      await blockManager.connect(signers[15]).finalizeDispute(epoch, 1);
      proposedBlock = await blockManager.proposedBlocks(epoch, 1);
      assert((await proposedBlock.valid) === false);
    });

    it('if no block is valid in previous epoch, stakers should not be penalised', async function () {
      await mineToNextState();
      const epoch = await getEpoch();

      const stakerIdAcc8 = await stakeManager.stakerIds(signers[8].address);
      const staker = await stakeManager.getStaker(stakerIdAcc8);

      const votes = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
      const tree = merkle('keccak256').sync(votes);

      const root = tree.root();
      const commitment = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      const { stake } = staker;

      await voteManager.connect(signers[8]).commit(epoch, commitment);

      assertBNEqual((await blockManager.getBlock(epoch - 1)).proposerId, toBigNumber('0'));
      assertBNEqual(((await blockManager.getBlock(epoch - 1)).medians).length, toBigNumber('0'));
      assert((await blockManager.getBlock(epoch - 1)).valid === false);

      await mineToNextState();

      const proof = [];
      for (let i = 0; i < votes.length; i++) {
        proof.push(tree.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[8]).reveal(epoch, tree.root(), votes, proof,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[8].address);

      assertBNEqual(staker.stake, stake, 'Stake should have remained the same');
    });

    it('should be able to reset dispute incase of wrong values being entered', async function () {
      await mineToNextEpoch();
      const epoch = await getEpoch();

      await razor.connect(signers[19]).approve(stakeManager.address, tokenAmount('19000'));
      await stakeManager.connect(signers[19]).stake(epoch, tokenAmount('19000'));

      const votes = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
      const tree = merkle('keccak256').sync(votes);

      const root = tree.root();
      const commitment1 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      await voteManager.connect(signers[19]).commit(epoch, commitment1);

      await mineToNextState();

      const proof = [];
      for (let i = 0; i < votes.length; i++) {
        proof.push(tree.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[19]).reveal(epoch, tree.root(), votes, proof,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[19].address);

      await mineToNextState();
      const stakerIdAcc20 = await stakeManager.stakerIds(signers[19].address);
      const staker = await stakeManager.getStaker(stakerIdAcc20);

      const { biggestStakerId } = await getBiggestStakeAndId(stakeManager);

      const iteration = await getIteration(stakeManager, random, staker);
      await blockManager.connect(signers[19]).propose(epoch,
        [10, 12, 13, 14, 15, 16, 17, 18, 19],
        [1000, 2001, 3000, 4000, 5000, 6000, 7000, 8000, 9000],
        [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000],
        [1002, 2002, 3002, 4002, 5002, 6002, 7002, 8002, 9002],
        iteration,
        biggestStakerId);
      const proposedBlock = await blockManager.proposedBlocks(epoch, 0);
      assertBNEqual(proposedBlock.proposerId, toBigNumber('5'), 'incorrect proposalID');

      await mineToNextState();

      const sortedVotes = [toBigNumber('20000')];

      await blockManager.connect(signers[15]).giveSorted(epoch, 1, sortedVotes);

      const beforeDisputeReset = await blockManager.disputes(epoch, signers[15].address);
      assertBNEqual(beforeDisputeReset.assetId, toBigNumber('1'), 'assetId should match');

      await blockManager.connect(signers[15]).resetDispute(epoch);
      const afterDisputeReset = await blockManager.disputes(epoch, signers[15].address);

      assertBNEqual(afterDisputeReset.assetId, toBigNumber('0'));
      assertBNEqual(afterDisputeReset.median, toBigNumber('0'));
      assertBNEqual(afterDisputeReset.accWeight, toBigNumber('0'));
      assertBNEqual(afterDisputeReset.lastVisited, toBigNumber('0'));
      assertBNEqual(afterDisputeReset.lowerCutoff, toBigNumber('0'));
      assertBNEqual(afterDisputeReset.higherCutoff, toBigNumber('0'));
    });

    it('should be able to dispute in batches', async function () {
      // Commit
      await mineToNextEpoch();
      await razor.transfer(signers[2].address, tokenAmount('423000'));
      await razor.transfer(signers[3].address, tokenAmount('19000'));
      let epoch = await getEpoch();

      await razor.connect(signers[2]).approve(stakeManager.address, tokenAmount('420000'));
      await stakeManager.connect(signers[2]).stake(epoch, tokenAmount('420000'));

      await razor.connect(signers[3]).approve(stakeManager.address, tokenAmount('18000'));
      await stakeManager.connect(signers[3]).stake(epoch, tokenAmount('18000'));
      const votes = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const tree = merkle('keccak256').sync(votes);

      const root = tree.root();
      const commitment1 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      await voteManager.connect(signers[2]).commit(epoch, commitment1);

      const votes2 = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const tree2 = merkle('keccak256').sync(votes2);

      const root2 = tree2.root();
      const commitment2 = utils.solidityKeccak256(
        ['uint256', 'uint256', 'bytes32'],
        [epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd']
      );

      await voteManager.connect(signers[3]).commit(epoch, commitment2);

      // Reveal
      await mineToNextState();
      const proof = [];
      for (let i = 0; i < votes.length; i++) {
        proof.push(tree.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[2]).reveal(epoch, tree.root(), votes, proof,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[2].address);

      const proof2 = [];
      for (let i = 0; i < votes2.length; i++) {
        proof2.push(tree2.getProofPath(i, true, true));
      }
      await voteManager.connect(signers[3]).reveal(epoch, tree2.root(), votes2, proof2,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        signers[3].address);

      // Propose
      await mineToNextState();
      const stakerIdAcc2 = await stakeManager.stakerIds(signers[2].address);
      const staker = await stakeManager.getStaker(stakerIdAcc2);
      const { biggestStakerId } = await getBiggestStakeAndId(stakeManager);

      const iteration = await getIteration(stakeManager, random, staker);

      await blockManager.connect(signers[2]).propose(epoch,
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [100, 201, 300, 400, 500, 600, 700, 800, 900],
        [99, 199, 299, 399, 499, 599, 699, 799, 899],
        [101, 201, 301, 401, 501, 601, 701, 801, 901],
        iteration,
        biggestStakerId);
      const proposedBlock = await blockManager.proposedBlocks(epoch, 0);
      assertBNEqual(proposedBlock.proposerId, toBigNumber('6'), 'incorrect proposalID');

      // Calculate Dispute data
      await mineToNextState();
      epoch = await getEpoch();
      const sortedVotes = [toBigNumber('200')];
      const {
        median, totalStakeRevealed, lowerCutoff, higherCutoff,
      } = await calculateDisputesData(
        voteManager,
        epoch,
        sortedVotes,
        [tokenAmount('420000'), tokenAmount('18000')] // initial weights
      );

      // Dispute in batches
      await blockManager.connect(signers[19]).giveSorted(epoch, 1, sortedVotes.slice(0, 51));
      await blockManager.connect(signers[19]).giveSorted(epoch, 1, sortedVotes.slice(51, 101));
      await blockManager.connect(signers[19]).giveSorted(epoch, 1, sortedVotes.slice(101, 151));
      await blockManager.connect(signers[19]).giveSorted(epoch, 1, sortedVotes.slice(151, 201));

      const dispute = await blockManager.disputes(epoch, signers[19].address);

      assertBNEqual(dispute.assetId, toBigNumber('1'), 'assetId should match');
      assertBNEqual(dispute.accWeight, totalStakeRevealed, 'totalStakeRevealed should match');
      assertBNEqual(dispute.median, median, 'median should match');
      assertBNEqual(dispute.lowerCutoff, lowerCutoff, 'lowerCutoff should match');
      assertBNEqual(dispute.higherCutoff, higherCutoff, 'higherCutoff should match');
      assertBNEqual(dispute.lastVisited, sortedVotes[sortedVotes.length - 1], 'lastVisited should match');
    });
  });
});
