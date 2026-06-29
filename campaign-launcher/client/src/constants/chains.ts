import { ChainId } from '@human-protocol/sdk';
import * as wagmiChains from 'wagmi/chains';
import type { Chain } from 'wagmi/chains';

export const LOCALHOST: Chain = {
  id: ChainId.LOCALHOST,
  name: 'Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
  },
};

export const ALL_CHAINS: Chain[] = [
  wagmiChains.mainnet,
  wagmiChains.sepolia,
  wagmiChains.bsc,
  wagmiChains.bscTestnet,
  wagmiChains.polygon,
  wagmiChains.polygonAmoy,
  wagmiChains.moonbeam,
  wagmiChains.moonbaseAlpha,
  wagmiChains.avalancheFuji,
  wagmiChains.avalanche,
  wagmiChains.xLayer,
  wagmiChains.xLayerTestnet,
  LOCALHOST,
];

const defaultChainIdsByEnvironment: Record<string, ChainId[]> = {
  mainnet: [ChainId.POLYGON],
  testnet: [ChainId.POLYGON_AMOY],
  localhost: [ChainId.LOCALHOST],
};

export const getSupportedChains = (): [Chain, ...Chain[]] => {
  const environment = (
    import.meta.env.VITE_APP_ENVIRONMENT || 'testnet'
  ).toLowerCase();
  const defaultChainIds =
    defaultChainIdsByEnvironment[environment] || defaultChainIdsByEnvironment.testnet;
  const envChainIds = import.meta.env.VITE_APP_SUPPORTED_CHAINS?.split(',')
    .map((chainId) => Number(chainId.trim()))
    .filter(Boolean);
  const supportedChainIds = envChainIds?.length ? envChainIds : defaultChainIds;
  const supportedChains = ALL_CHAINS.filter((chain) =>
    supportedChainIds.includes(chain.id)
  );

  if (!supportedChains.length) {
    throw new Error('No supported chains configured');
  }

  return supportedChains as [Chain, ...Chain[]];
};
