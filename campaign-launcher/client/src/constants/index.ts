import type { EvmAddress } from '@/types';

export const ORACLE_ADDRESSES = {
  exchangeOracle: import.meta.env
    .VITE_APP_EXCHANGE_ORACLE_ADDRESS as EvmAddress,
  recordingOracle: import.meta.env
    .VITE_APP_RECORDING_ORACLE_ADDRESS as EvmAddress,
  reputationOracle: import.meta.env
    .VITE_APP_REPUTATION_ORACLE_ADDRESS as EvmAddress,
};

export const MAX_MANIFEST_PREVIEW_LENGTH = 2800;

export const WALLET_PAGE_SIZE = 20;

export const MOBILE_BOTTOM_NAV_HEIGHT = 90;
