/* global contract, it, artifacts, assert, web3 */
/* jshint esversion: 8 */

// // TODO:
// // test same vote values, stakes
// test penalizeEpochs
const { assertRevert } = require('./helpers/assertRevert')
let functions = require('./helpers/functions')
let BlockManager = artifacts.require('./BlockManager.sol')
let StakeManager = artifacts.require('./StakeManager.sol')
let StateManager = artifacts.require('./StateManager.sol')
let VoteManager = artifacts.require('./VoteManager.sol')
let SimpleToken = artifacts.require('./SimpleToken.sol')
let Random = artifacts.require('./lib/Random.sol')
let Web3 = require('web3')
let merkle = require('@razor-network/merkle')

let web3i = new Web3(Web3.givenProvider || 'ws://localhost:8545', null, {})
let numBlocks = 10

// / TODO:
// test unstake and withdraw
// test cases where nobody votes, too low stake (1-4)

contract('VoteManager', function (accounts) {
  contract('SimpleToken', async function () {
    // let blockManager = await BlockManager.deployed()
    // let voteManager = await VoteManager.deployed()
    // let stakeManager = await StakeManager.deployed()

    it('shuld be able to initialize', async function () {
      let stakeManager = await StakeManager.deployed()
      let stateManager = await StateManager.deployed()
      let sch = await SimpleToken.deployed()
      // await stateManager.setEpoch(1)
      // await stateManager.setState(0)
      await functions.mineToNextEpoch()
      await sch.transfer(accounts[3], 423000, { 'from': accounts[0] })
      await sch.transfer(accounts[4], 19000, { 'from': accounts[0] })
      await sch.approve(stakeManager.address, 420000, { 'from': accounts[3] })
      await sch.approve(stakeManager.address, 19000, { 'from': accounts[4] })
      let epoch = await functions.getEpoch()
      await stakeManager.stake(epoch, 420000, { 'from': accounts[3] })
      await stakeManager.stake(epoch, 19000, { 'from': accounts[4] })
      // await sch.transfer(accounts[3], 800000, { 'from': accounts[0]})
      // await sch.transfer(accounts[4], 600000, { 'from': accounts[0]})
      // await sch.transfer(accounts[5], 2000, { 'from': accounts[0]})
      // await sch.transfer(accounts[6], 700000, { 'from': accounts[0]})
      // await sch.transfer(accounts[7], 3000, { 'from': accounts[0]})
      // await sch.transfer(accounts[8], 4000, { 'from': accounts[0]})
      // await sch.transfer(accounts[9], 5000, { 'from': accounts[0]})
      // await sch.transfer(accounts[10], 6000, { 'from': accounts[0]})
    })

    it('should be able to commit', async function () {
      let stakeManager = await StakeManager.deployed()
      let voteManager = await VoteManager.deployed()
      let epoch = await functions.getEpoch()
      // await stateManager.setEpoch(3)
      let votes = [100, 200, 300, 400, 500, 600, 700, 800, 900]
      let tree = merkle('keccak256').sync(votes)
      let root = tree.root()
      let commitment1 = web3i.utils.soliditySha3(epoch, root, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd')

      await voteManager.commit(epoch, commitment1, { 'from': accounts[3] })
      // arguments getCommitment => epoch number and stakerId
      let stakerId_acc3 = await stakeManager.stakerIds(accounts[3])
      let commitment2 = await voteManager.getCommitment(epoch, stakerId_acc3)

      assert(commitment1 === commitment2, "commitment1, commitment2 not equal")

      let votes2 = [104, 204, 304, 404, 504, 604, 704, 804, 904]
      let tree2 = merkle('keccak256').sync(votes2)
      let root2 = tree2.root()
      let commitment3 = web3i.utils.soliditySha3(epoch, root2, '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd')
      await voteManager.commit(epoch, commitment3, { 'from': accounts[4] })
    })

    it('should be able to reveal', async function () {
      let stakeManager = await StakeManager.deployed()
      let voteManager = await VoteManager.deployed()
      let epoch = await functions.getEpoch()

      // await stateManager.setEpoch(3)
      let votes = [100, 200, 300, 400, 500, 600, 700, 800, 900]
      let tree = merkle('keccak256').sync(votes)
      // console.log(tree.root())
      // await stateManager.setState(1)
      await functions.mineToNextState()

      // let root = tree.root()
      // console.log('proofs', [tree.level(1)[1]], [tree.level(1)[0]])
      let proof = []
      for (let i = 0; i < votes.length; i++) {
        proof.push(tree.getProofPath(i, true, true))
      }

      await voteManager.reveal(epoch, tree.root(), votes, proof,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        accounts[3], { 'from': accounts[3] })
      // arguments getvVote => epoch, stakerId, assetId
      let stakerId_acc3 = await stakeManager.stakerIds(accounts[3])
      assert(Number((await voteManager.getVote(epoch, stakerId_acc3, 0)).value) === 100, "Vote not equal to 100")

      let votes2 = [104, 204, 304, 404, 504, 604, 704, 804, 904]
      let tree2 = merkle('keccak256').sync(votes2)
      let root2 = tree2.root()
      let proof2 = []
      for (let i = 0; i < votes2.length; i++) {
        proof2.push(tree2.getProofPath(i, true, true))
      }
      await voteManager.reveal(epoch, root2, votes2, proof2,
        '0x727d5c9e6d18ed15ce7ac8d3cce6ec8a0e9c02481415c0823ea49d847ccb9ddd',
        accounts[4], { 'from': accounts[4] })
    })
  })
})