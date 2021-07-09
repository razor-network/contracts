/* eslint-disable no-undef */
const dotenv = require('dotenv');

const dotenvResult = dotenv.config();

if (dotenvResult.error) {
  throw dotenvResult.error;
}

require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-truffle5');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('hardhat-abi-exporter');

const {
  PROVIDER_HOST,
  PROVIDER_PORT,
  PROVIDER_URL,
  NETWORK,
  MNEMONIC,
} = process.env;
const GWEI = 1000000000;

// Ref - https://chainid.network/chains.json
const ENV_CHAIN_IDS = {
  mainnet: 1,
  goerli: 5,
  matic_mumbai_testnet: 80001,
};

module.exports = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.8.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1500,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    coverage: {
      url: 'http://localhost:8555',
      gas: 0xfffffffffff,
    },
    ganache: {
      url: `http://${PROVIDER_HOST}:${PROVIDER_PORT}`,
      network_id: 31337,
      logger: console,
    },
    // More about networks config:
    // https://hardhat.org/config/#json-rpc-based-networks
    goerli: {
      url: PROVIDER_URL || '',
      accounts: { mnemonic: MNEMONIC },
      chainId: ENV_CHAIN_IDS[NETWORK],
      gas: 7700000,
      gasPrice: 1 * GWEI,
    },
    matic_mumbai_testnet: {
      url: PROVIDER_URL || '',
      accounts: { mnemonic: MNEMONIC },
      chainId: ENV_CHAIN_IDS[NETWORK],
      gas: 7700000,
      gasPrice: 1 * GWEI,
    },
  },
  gasReporter: {
    noColors: true, // Colors on terminal corrupts the output.
  },
  abiExporter: {
    path: './abi',
    clear: true,
    flat: true,
    spacing: 2,
  },
};
