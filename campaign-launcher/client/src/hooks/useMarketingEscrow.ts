import { useCallback, useState } from 'react';

import HMTokenABI from '@human-protocol/core/abis/HMToken.json';
import {
  EscrowClient,
  KVStoreKeys,
  KVStoreUtils,
  NETWORKS,
} from '@human-protocol/sdk';
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
  isNotifyingExchange: boolean;
  error?: Error;
  result?: EscrowResult;
};

type ExchangeWebhookBody = {
  chain_id: ChainId;
  escrow_address: string;
  event_type: 'escrow_created';
};

const HEADER_SIGNATURE_KEY = 'human-signature';

const notifyExchangeOracle = async (
  chainId: ChainId,
  signer: ethers.Signer,
  webhookBody: ExchangeWebhookBody,
): Promise<void> => {
  const exchangeWebhookUrl = await KVStoreUtils.get(
    chainId,
    ORACLE_ADDRESSES.exchangeOracle,
    KVStoreKeys.webhookUrl,
  );

  if (!exchangeWebhookUrl) {
    throw new Error('Exchange oracle webhook URL not found in KVStore');
  }

  const signature = await signer.signMessage(JSON.stringify(webhookBody));
  const response = await fetch(exchangeWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [HEADER_SIGNATURE_KEY]: signature,
    },
    body: JSON.stringify(webhookBody),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Exchange webhook failed with status ${response.status}: ${responseBody}`,
    );
  }
};

export const useMarketingEscrow = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<LaunchState>({
    isApproving: false,
    isCreating: false,
    isNotifyingExchange: false,
  });

  const reset = useCallback(() => {
    setState({
      isApproving: false,
      isCreating: false,
      isNotifyingExchange: false,
    });
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

      let createdEscrowAddress = '';

      try {
        setState({
          isApproving: true,
          isCreating: false,
          isNotifyingExchange: false,
        });

        const signer = await walletClientToSigner(walletClient);
        const tokenContract = new Contract(token.address, HMTokenABI, signer);
        const parsedFundAmount = ethers.parseUnits(fundAmount, token.decimals);

        const currentAllowance = (await tokenContract.allowance(
          address,
          network.factoryAddress,
        )) as bigint;

        if (currentAllowance < parsedFundAmount) {
          const approveTx = await tokenContract.approve(
            network.factoryAddress,
            parsedFundAmount,
          );
          await approveTx.wait();
        }

        setState({
          isApproving: false,
          isCreating: true,
          isNotifyingExchange: false,
        });

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
          },
        );
        createdEscrowAddress = escrowAddress;

        setState({
          isApproving: false,
          isCreating: false,
          isNotifyingExchange: true,
        });

        await notifyExchangeOracle(chainId, signer, {
          chain_id: chainId,
          escrow_address: escrowAddress,
          event_type: 'escrow_created',
        });

        setState({
          isApproving: false,
          isCreating: false,
          isNotifyingExchange: false,
          result: {
            escrowAddress,
            transactionManifestHash: preparedManifest.manifestHash,
          },
        });
      } catch (error) {
        setState({
          isApproving: false,
          isCreating: false,
          isNotifyingExchange: false,
          ...(createdEscrowAddress && {
            result: {
              escrowAddress: createdEscrowAddress,
              transactionManifestHash: preparedManifest.manifestHash,
            },
          }),
          error:
            error instanceof Error
              ? new Error(
                  createdEscrowAddress
                    ? `Escrow created (${createdEscrowAddress}), but exchange webhook notification failed: ${error.message}`
                    : error.message,
                )
              : new Error(
                  createdEscrowAddress
                    ? `Escrow created (${createdEscrowAddress}), but exchange webhook notification failed`
                    : 'Failed to create escrow',
                ),
        });
      }
    },
    [address, walletClient],
  );

  return {
    ...state,
    isLoading:
      state.isApproving || state.isCreating || state.isNotifyingExchange,
    launchEscrow,
    reset,
  };
};
