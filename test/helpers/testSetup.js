const { BLOCK_REWARD } = require('./constants');

const { BigNumber } = ethers;
const mintableSupply = (BigNumber.from(10).pow(BigNumber.from(27)));

const setupContracts = async () => {
  const Structs = await ethers.getContractFactory('Structs');
  const structs = await Structs.deploy();
  await structs.deployed();

  const Random = await ethers.getContractFactory('Random');
  const random = await Random.deploy();
  await random.deployed();

  const BlockManager = await ethers.getContractFactory('BlockManager', {
    libraries: {
      Random: random.address,
    },
  });

  const Parameters = await ethers.getContractFactory('Parameters');
  const Delegator = await ethers.getContractFactory('Delegator');
  const Faucet = await ethers.getContractFactory('Faucet');
  const AssetManager = await ethers.getContractFactory('AssetManager');
  const RAZOR = await ethers.getContractFactory('RAZOR');
  const StakeManager = await ethers.getContractFactory('StakeManager');
  const VoteManager = await ethers.getContractFactory('VoteManager');

  const parameters = await Parameters.deploy();
  const blockManager = await BlockManager.deploy();
  const delegator = await Delegator.deploy();
  const assetManager = await AssetManager.deploy(parameters.address);
  const stakeManager = await StakeManager.deploy(BLOCK_REWARD.toHexString());
  const voteManager = await VoteManager.deploy();
  const Razor = await RAZOR.deploy(mintableSupply);
  const faucet = await Faucet.deploy(Razor.address);

  await parameters.deployed();
  await blockManager.deployed();
  await delegator.deployed();
  await faucet.deployed();
  await assetManager.deployed();
  await Razor.deployed();
  await stakeManager.deployed();
  await voteManager.deployed();

  const initializeContracts = async () => [
    blockManager.initialize(stakeManager.address, voteManager.address, assetManager.address, parameters.address),
    voteManager.initialize(stakeManager.address, blockManager.address, parameters.address),
    stakeManager.initialize(Razor.address, voteManager.address, blockManager.address, parameters.address),

    assetManager.grantRole(await parameters.getAssetConfirmerHash(), blockManager.address),
    blockManager.grantRole(await parameters.getBlockConfirmerHash(), voteManager.address),
    stakeManager.grantRole(await parameters.getStakeModifierHash(), blockManager.address),
    stakeManager.grantRole(await parameters.getStakeModifierHash(), voteManager.address),
    stakeManager.grantRole(await parameters.getStakerActivityUpdaterHash(), voteManager.address),

    delegator.upgradeDelegate(assetManager.address),
  ];

  return {
    blockManager,
    parameters,
    delegator,
    faucet,
    assetManager,
    random,
    Razor,
    stakeManager,
    structs,
    voteManager,
    initializeContracts,
  };
};

module.exports = {
  setupContracts,
};
