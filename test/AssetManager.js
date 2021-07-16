/* TODO:
test same vote values, stakes
test penalizeEpochs */

const { assert } = require('chai');
const { setupContracts } = require('./helpers/testSetup');
const { DEFAULT_ADMIN_ROLE_HASH } = require('./helpers/constants');

const {
  assertBNEqual,
  assertRevert,
} = require('./helpers/testHelpers');

const { toBigNumber } = require('./helpers/utils');

describe('AssetManager', function () {
  let signers;
  let parameters;
  let assetManager;

  before(async () => {
    ({ parameters, assetManager } = await setupContracts());
    signers = await ethers.getSigners();
  });

  describe('Delegator', function () {
    it('Admin role should be granted', async () => {
      assert(await assetManager.hasRole(DEFAULT_ADMIN_ROLE_HASH, signers[0].address) === true, 'Role was not Granted');
    });
    it('should be able to create Job', async function () {
      await assetManager.grantRole(await parameters.getAssetModifierHash(), signers[0].address);
      const url = 'http://testurl.com';
      const selector = 'selector';
      const name = 'test';
      const repeat = true;
      await assetManager.createJob(url, selector, name, repeat);
      const job = await assetManager.jobs(1);
      assert(job.url === url);
      assert(job.selector === selector);
      assert(job.repeat === repeat);
      assertBNEqual(job.assetType, toBigNumber('1'));
      assertBNEqual((await assetManager.getNumAssets()), toBigNumber('1'));
    });

    it('should be able to create a Collection', async function () {
      const url = 'http://testurl.com/2';
      const selector = 'selector/2';
      const name = 'test2';
      const repeat = true;
      await assetManager.createJob(url, selector, name, repeat);

      const collectionName = 'Test Collection';
      await assetManager.createCollection(collectionName, [1, 2], 1);
      const collection = await assetManager.getCollection(3);
      assert(collection.name === collectionName);
      assertBNEqual(collection.aggregationMethod, toBigNumber('1'));
      assert((collection.jobIDs).length === 2);
      assertBNEqual((await assetManager.getNumAssets()), toBigNumber('3'));
    });

    it('should be able to add a job to a collection', async function () {
      const url = 'http://testurl.com/3';
      const selector = 'selector/3';
      const name = 'test3';
      const repeat = true;
      await assetManager.createJob(url, selector, name, repeat);

      await assetManager.addJobToCollection(3, 4);
      const collection = await assetManager.getCollection(3);
      assert((collection.jobIDs).length === 3);
      assertBNEqual(collection.jobIDs[2], toBigNumber('4'));
    });

    it('should return the correct asset type when getAssetType is called', async function () {
      const numAssets = await assetManager.getNumAssets();
      for (let i = 1; i <= numAssets; i++) {
        const asset = await assetManager.getAssetType(i);
        if (i !== 3) {
          assertBNEqual(asset, toBigNumber('1'));
        } else {
          assertBNEqual(asset, toBigNumber('2'));
        }
      }
    });

    it('should fulfill result to the correct asset', async function () {
      await assetManager.grantRole(await parameters.getAssetConfirmerHash(), signers[0].address);
      await assetManager.fulfillAsset(1, 111);
      await assetManager.fulfillAsset(2, 222);
      await assetManager.fulfillAsset(3, 333);
      await assetManager.fulfillAsset(4, 444);
      const j1 = await assetManager.getJob(1);
      const j2 = await assetManager.getJob(2);
      const c3 = await assetManager.getCollection(3);
      const j4 = await assetManager.getJob(4);
      assertBNEqual(j1.result, toBigNumber('111'));
      assertBNEqual(j2.result, toBigNumber('222'));
      assertBNEqual(c3.result, toBigNumber('333'));
      assertBNEqual(j4.result, toBigNumber('444'));
    });

    it('should be able to update Job', async function () {
      await assetManager.createJob('http://testurl.com/4', 'selector/4', 'test4', true);
      await assetManager.updateJob(5, 'http://testurl.com/5', 'selector/5');
      const job = await assetManager.jobs(5);
      assert(job.url === 'http://testurl.com/5');
      assert(job.selector === 'selector/5');
    });

    it('should be able to inactivate Job', async function () {
      await assetManager.setAssetStatus(5, false);
      const job = await assetManager.jobs(5);
      assert(job.active === false);
    });

    it('should be able to reactivate Job', async function () {
      await assetManager.setAssetStatus(5, true);
      const job = await assetManager.jobs(5);
      assert(job.active === true);
      await assetManager.setAssetStatus(5, 1);
    });

    it('should be able remove job from collection', async function () {
      await assetManager.removeJobFromCollection(3, 2);
      const collection = await assetManager.getCollection(3);
      assert((collection.jobIDs).length === 2);
      assertBNEqual(collection.jobIDs[1], toBigNumber('2'));
    });

    it('should be able to inactivate collection', async function () {
      const collectionName = 'Test Collection6';
      await assetManager.createCollection(collectionName, [1, 2], 2);
      await assetManager.setAssetStatus(6, false);
      const collection = await assetManager.getCollection(6);
      assert(collection.active === false);
    });

    it('should be able to reactivate collection', async function () {
      await assetManager.setAssetStatus(6, true);
      const collection = await assetManager.getCollection(6);
      assert(collection.active === true);
      await assetManager.setAssetStatus(6, false);
    });

    it('should not be able to remove or add job to collection if the collection has been inactivated', async function () {
      const tx1 = assetManager.addJobToCollection(6, 4);
      await assertRevert(tx1, 'Collection is inactive');
    });

    it('should not be able to remove job from collection if index is out of range', async function () {
      const tx = assetManager.removeJobFromCollection(3, 5);
      await assertRevert(tx, 'Index not in range');
    });

    it('should not be able to update job if job does not exist', async function () {
      const tx = assetManager.updateJob(9, 'http://testurl.com/4', 'selector/4');
      await assertRevert(tx, 'Job ID not present');
    });

    it('should not be able to update activity status of asset if assetID is 0', async function () {
      const tx = assetManager.setAssetStatus(0, 1);
      await assertRevert(tx, 'ID cannot be 0');
    });

    it('should not be able to update activity status of asset if assetID does not exist', async function () {
      const tx = assetManager.setAssetStatus(100, 1);
      await assertRevert(tx, 'ID does not exist');
    });

    it('should not create a collection if one of the jobIDs is not a job', async function () {
      const collectionName = 'Test Collection2';
      const tx = assetManager.createCollection(collectionName, [1, 2, 3], 2);
      await assertRevert(tx, 'Job ID not present');
    });

    it('should not create collection if it does not have more than 1 or any jobIDs', async function () {
      const collectionName = 'Test Collection2';
      const tx1 = assetManager.createCollection(collectionName, [], 1);
      await assertRevert(tx1, 'Number of jobIDs low to create collection');
      const tx2 = assetManager.createCollection(collectionName, [1], 1);
      await assertRevert(tx2, 'Number of jobIDs low to create collection');
    });

    it('aggregationMethod should not be equal to 0 or greater than 3', async function () {
      const collectionName = 'Test Collection2';
      const tx1 = assetManager.createCollection(collectionName, [1, 2, 5], 4);
      await assertRevert(tx1, 'Aggregation range out of bounds');
      const tx2 = assetManager.createCollection(collectionName, [1, 2, 5], 0);
      await assertRevert(tx2, 'Aggregation range out of bounds');
    });

    it('should not create collection if duplicates jobIDs are present', async function () {
      const collectionName = 'Test Collection2';
      const tx = assetManager.createCollection(collectionName, [1, 2, 2, 5], 1);
      await assertRevert(tx, 'Duplicate JobIDs sent');
    });

    it('should not add jobID to a collection if the collectionID specified is not a collection', async function () {
      const tx = assetManager.addJobToCollection(5, 4);
      await assertRevert(tx, 'Collection ID not present');
    });

    it('should not add jobID to a collection if the jobID specified is not a Job', async function () {
    // jobID does not exist
      const tx = assetManager.addJobToCollection(3, 7);
      await assertRevert(tx, 'Job ID not present');
      // jobID specified is a collection
      const tx1 = assetManager.addJobToCollection(3, 6);
      await assertRevert(tx1, 'Job ID not present');
    });

    it('should not be add job if it already exists in the collection', async function () {
      const tx = assetManager.addJobToCollection(3, 1);
      await assertRevert(tx, 'Job exists in this collection');
    });

    // it('should be able to get result using proxy', async function () {
    //  await delegator.upgradeDelegate(assetManager.address);
    //  assert(await delegator.delegate() === assetManager.address);
    //
    //  const url = 'http://testurl.com/2';
    //  const selector = 'selector/2';
    //  const name = 'test2';
    //  const repeat = true;
    //  await assetManager.createJob(url, selector, name, repeat);
    //  //await assetManager.grantRole(await parameters.getJobConfirmerHash(), signers[0].address);
    //  await assetManager.fulfillJob(2, 222);
    // });
  });
});
