import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'wagmi';

import { getSupportedChains } from '@/constants/chains';

const projectId = import.meta.env.VITE_APP_WALLETCONNECT_PROJECT_ID || '';

export const supportedChains = getSupportedChains();
export const appKitNetworks = supportedChains as unknown as [
  AppKitNetwork,
  ...AppKitNetwork[],
];

export const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId,
  syncConnectedChain: false,
  transports: Object.fromEntries(
    supportedChains.map((chain) => [
      chain.id,
      http(chain.rpcUrls.default.http[0]),
    ])
  ),
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
