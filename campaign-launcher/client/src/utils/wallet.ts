import { BrowserProvider, type JsonRpcSigner } from 'ethers';
import type { WalletClient } from 'viem';

export const walletClientToSigner = async (
  walletClient: WalletClient
): Promise<JsonRpcSigner> => {
  const { account, chain, transport } = walletClient;
  const provider = new BrowserProvider(transport, {
    chainId: chain.id,
    name: chain.name,
  });

  return provider.getSigner(account.address);
};
