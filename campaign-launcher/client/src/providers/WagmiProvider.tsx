import type { FC, PropsWithChildren } from 'react';

import { AppKitProvider } from '@reown/appkit/react';
import type { ConnectMethod } from '@reown/appkit-controllers';
import { WagmiProvider as WWagmiProvider } from 'wagmi';

import { appKitNetworks, wagmiAdapter, wagmiConfig } from './wagmiConfig';

const projectId = import.meta.env.VITE_APP_WALLETCONNECT_PROJECT_ID || '';
const termsUrl = import.meta.env.VITE_APP_TERMS_URL;
const privacyUrl = import.meta.env.VITE_APP_PRIVACY_URL;

const appKitConfig = {
  adapters: [wagmiAdapter],
  networks: appKitNetworks,
  projectId,
  metadata: {
    name: 'Marketing',
    description: 'Marketing Campaign Launcher',
    url: window.location.origin,
    icons: [],
  },
  termsConditionsUrl: termsUrl,
  privacyPolicyUrl: privacyUrl,
  features: {
    email: false,
    socials: false as const,
    history: false,
    swaps: false,
    onramp: false,
    send: false,
    connectMethodsOrder: ['wallet'] as ConnectMethod[],
  },
};

export const WagmiProvider: FC<PropsWithChildren> = ({ children }) => {
  const initialState = {
    chainId: appKitNetworks[0].id,
    connections: new Map(),
    current: null,
    status: 'disconnected' as const,
  };

  return (
    <AppKitProvider {...appKitConfig}>
      <WWagmiProvider config={wagmiConfig} initialState={initialState}>
        {children}
      </WWagmiProvider>
    </AppKitProvider>
  );
};
