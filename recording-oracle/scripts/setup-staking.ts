import {
  ChainId,
  NetworkData,
  NETWORKS,
  StakingClient,
} from '@human-protocol/sdk';
import * as dotenv from 'dotenv';
import { Contract, NonceManager, Wallet, ethers } from 'ethers';

dotenv.config({ path: '.env.local' });

const RPC_URL = process.env.RPC_URL_LOCALHOST || 'http://127.0.0.1:8545';
const ERC20_ABI = [
  'function approve(address spender, uint256 value) returns (bool)',
];

async function setup(): Promise<void> {
  if (!RPC_URL) {
    throw new Error('RPC url is empty');
  }

  const { WEB3_PRIVATE_KEY } = process.env;
  if (!WEB3_PRIVATE_KEY || WEB3_PRIVATE_KEY === 'replace_me') {
    throw new Error('WEB3_PRIVATE_KEY must be configured in .env.local');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const { hmtAddress, stakingAddress } = NETWORKS[
    ChainId.LOCALHOST
  ] as NetworkData;
  const baseWallet = new Wallet(WEB3_PRIVATE_KEY, provider);
  const wallet = new NonceManager(baseWallet);

  const tokenContract = new Contract(hmtAddress, ERC20_ABI, wallet);
  const approveTx = await tokenContract.approve(stakingAddress, BigInt(1));
  await approveTx.wait();

  const stakingClient = await StakingClient.build(wallet);
  await stakingClient.stake(BigInt(1));
}

(async () => {
  try {
    await setup();
    process.exit(0);
  } catch (error) {
    console.error('Failed to setup staking.', error);
    process.exit(1);
  }
})();
