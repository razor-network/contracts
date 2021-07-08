const { BigNumber } = ethers;
const {
  ONE_ETHER, EPOCH_LENGTH, NUM_BLOCKS, NUM_STATES,
} = require('./constants');

const toBigNumber = (value) => BigNumber.from(value);
const tokenAmount = (value) => toBigNumber(value).mul(ONE_ETHER);

const calculateDisputesData = async (voteManager, epoch, sortedVotes, weights) => {
  // See issue https://github.com/ethers-io/ethers.js/issues/407#issuecomment-458360013
  // We should rethink about overloading functions.
  const totalStakeRevealed = await voteManager['getTotalStakeRevealed(uint256,uint256)'](epoch, 1);
  const medianWeight = totalStakeRevealed.div(2);
  const lowerCutoffWeight = totalStakeRevealed.div(4);
  const higherCutoffWeight = totalStakeRevealed.mul(3).div(4);
  let median = toBigNumber('0');
  let lowerCutoff = toBigNumber('0');
  let higherCutoff = toBigNumber('0');
  let weight = toBigNumber('0');

  for (let i = 0; i < sortedVotes.length; i++) {
    weight = weight.add(weights[i]);
    if (weight.gt(medianWeight) && median.eq('0')) median = sortedVotes[i];
    if (weight.gt(lowerCutoffWeight) && lowerCutoff.eq('0')) lowerCutoff = sortedVotes[i];
    if (weight.gt(higherCutoffWeight) && higherCutoff.eq('0')) higherCutoff = sortedVotes[i];
  }

  return {
    median, totalStakeRevealed, lowerCutoff, higherCutoff,
  };
};

// pseudo random hash generator based on block hashes.
const prngHash = async (seed, blockHashes) => {
  const sum = await web3.utils.soliditySha3(blockHashes, seed);
  return (sum);
};

const prng = async (seed, max, blockHashes) => {
  const hash = await prngHash(seed, blockHashes);
  const sum = toBigNumber(hash);
  max = toBigNumber(max);
  return (sum.mod(max));
};

const isElectedProposer = async (iteration, biggestStake, stake, stakerId, numStakers, blockHashes) => {
  // add +1 since prng returns 0 to max-1 and staker start from 1
  const seed = await web3.utils.soliditySha3(iteration);

  if (!((await prng(seed, numStakers, blockHashes)).add('1')).eq(stakerId)) return false;

  const seed2 = await web3.utils.soliditySha3(stakerId, iteration);
  const randHash = await prngHash(seed2, blockHashes);
  const rand = (toBigNumber(randHash).mod('2').pow('32'));

  if ((rand.mul(biggestStake)).gt(stake.mul(toBigNumber('2').pow('32')))) return false;

  return true;
};

const getBiggestStakeAndId = async (razor) => {
  const numStakers = await razor.numStakers();
  let biggestStake = toBigNumber('0');
  let biggestStakerId = toBigNumber('0');

  for (let i = 1; i <= numStakers; i++) {
    const { stake } = await razor.stakers(i);

    if (stake.gt(biggestStakerId)) {
      biggestStake = stake;
      biggestStakerId = i;
    }
  }
  return { biggestStake, biggestStakerId };
};

const getEpoch = async () => {
  const blockNumber = toBigNumber(await web3.eth.getBlockNumber());
  return blockNumber.div(EPOCH_LENGTH).toNumber();
};

const getIteration = async (stakeManager, random, staker) => {
  const numStakers = await stakeManager.getNumStakers();
  const { stake } = staker;
  const stakerId = staker.id;
  const { biggestStake } = await getBiggestStakeAndId(stakeManager);
  const blockHashes = await random.blockHashes(NUM_BLOCKS, EPOCH_LENGTH);

  for (let i = 0; i < 10000000000; i++) {
    const isElected = await isElectedProposer(i, biggestStake, stake, stakerId, numStakers, blockHashes);
    if (isElected) return (i);
  }
  return 0;
};

const getState = async () => {
  const blockNumber = toBigNumber(await web3.eth.getBlockNumber());
  const state = blockNumber.div(EPOCH_LENGTH.div(NUM_STATES));
  return state.mod(NUM_STATES).toNumber();
};

module.exports = {
  calculateDisputesData,
  isElectedProposer,
  getBiggestStakeAndId,
  getEpoch,
  getIteration,
  getState,
  prng,
  prngHash,
  toBigNumber,
  tokenAmount,
};
