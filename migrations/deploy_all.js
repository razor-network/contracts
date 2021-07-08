/* eslint-disable no-console */
const librariesMigration = require('./src/1_deploy_libraries');
const parametersMigration = require('./src/2_deploy_parameters');
const blockManagerMigration = require('./src/3_deploy_block_manager');
const assetManagerMigration = require('./src/4_deploy_asset_manager');
const stakeManagerMigration = require('./src/5_deploy_stake_manager');
const rewardManagerMigration = require('./src/6_deploy_reward_manager');
const voteManagerMigration = require('./src/7_deploy_vote_manager');
const delegatorMigration = require('./src/8_deploy_delegator');
const RAZORAndFacuetMigration = require('./src/9_deploy_razor_and_faucet');
const postDeploymentSetup = require('./src/postDeploymentSetup');

async function main() {
  // Deploy smart contracts
  await librariesMigration();
  await parametersMigration();
  await blockManagerMigration();
  await assetManagerMigration();
  await stakeManagerMigration();
  await rewardManagerMigration();
  await voteManagerMigration();
  await delegatorMigration();
  await RAZORAndFacuetMigration();
  await postDeploymentSetup();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
