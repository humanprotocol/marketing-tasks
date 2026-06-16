import { useCallback, useState } from 'react';

import HMTokenABI from '@human-protocol/core/abis/HMToken.json';
import { EscrowClient, NETWORKS } from '@human-protocol/sdk';
import type { ChainId } from '@human-protocol/sdk';
import { Contract, ethers } from 'ethers';
import { useAccount, useWalletClient } from 'wagmi';

import { ORACLE_ADDRESSES } from '@/constants';
import { getFundingTokenConfig } from '@/constants/fundingTokens';
import type { EscrowFundToken, EscrowResult, PreparedManifest } from '@/types';
import { walletClientToSigner } from '@/utils/wallet';

type LaunchEscrowInput = {
  chainId: ChainId;
  fundToken: EscrowFundToken;
  fundAmount: string;
  preparedManifest: PreparedManifest;
};

type LaunchState = {
  isApproving: boolean;
  isCreating: boolean;
  error?: Error;
  result?: EscrowResult;
};

export const useMarketingEscrow = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<LaunchState>({
    isApproving: false,
    isCreating: false,
  });

  const reset = useCallback(() => {
    setState({ isApproving: false, isCreating: false });
  }, []);

  const launchEscrow = useCallback(
    async ({
      chainId,
      fundToken,
      fundAmount,
      preparedManifest,
    }: LaunchEscrowInput): Promise<void> => {
      if (!walletClient || !address) {
        setState((prev) => ({
          ...prev,
          error: new Error('Wallet is not connected'),
        }));
        return;
      }

      const network = NETWORKS[chainId];
      const token = getFundingTokenConfig(chainId, fundToken);
      if (!token || !network?.factoryAddress) {
        setState((prev) => ({
          ...prev,
          error: new Error('Funding token or escrow factory is not configured'),
        }));
        return;
      }

      try {
        setState({ isApproving: true, isCreating: false });

        const signer = await walletClientToSigner(walletClient);
        const tokenContract = new Contract(token.address, HMTokenABI, signer);
        const parsedFundAmount = ethers.parseUnits(fundAmount, token.decimals);

        const currentAllowance = (await tokenContract.allowance(
          address,
          network.factoryAddress
        )) as bigint;

        if (currentAllowance < parsedFundAmount) {
          const approveTx = await tokenContract.approve(
            network.factoryAddress,
            parsedFundAmount
          );
          await approveTx.wait();
        }

        setState({ isApproving: false, isCreating: true });

        const escrowClient = await EscrowClient.build(signer);
        const escrowAddress = await escrowClient.createFundAndSetupEscrow(
          token.address,
          parsedFundAmount,
          address,
          {
            exchangeOracle: ORACLE_ADDRESSES.exchangeOracle,
            recordingOracle: ORACLE_ADDRESSES.recordingOracle,
            reputationOracle: ORACLE_ADDRESSES.reputationOracle,
            manifest: preparedManifest.manifestString,
            manifestHash: preparedManifest.manifestHash,
          }
        );

        setState({
          isApproving: false,
          isCreating: false,
          result: {
            escrowAddress,
            transactionManifestHash: preparedManifest.manifestHash,
          },
        });
      } catch (error) {
        setState({
          isApproving: false,
          isCreating: false,
          error:
            error instanceof Error
              ? error
              : new Error('Failed to create escrow'),
        });
      }
    },
    [address, walletClient]
  );

  return {
    ...state,
    isLoading: state.isApproving || state.isCreating,
    launchEscrow,
    reset,
  };
};
