import { WalletClient } from 'viem';

import { HUMAN_SIGNATURE_KEY } from '../constants';
import api from '../utils/api';

export type JobType = 'social_media_promotion' | 'social_media_engagement';

export type AssignmentDetails = {
  assignmentId: string;
  escrowAddress: string;
  chainId: number;
  jobType: JobType;
  status: string;
  rewardAmount: number;
  rewardToken: string;
  createdAt: string;
  expiresAt: string;
  endDate: string;
  updatedAt?: string;
  jobDescription: string;
  manifestUrl: string;
  platforms: string[];
  requirements: Record<string, unknown>;
};

export const solveJob = async (signer: WalletClient, body: any) => {
  if (!signer.account) {
    throw new Error('Account not found');
  }

  const signature = await signer.signMessage({
    account: signer.account,
    message: JSON.stringify(body),
  });
  await api.post('/job/solve', body, {
    headers: { [HUMAN_SIGNATURE_KEY]: signature },
  });
};

export const getAssignmentDetails = async (
  assignmentId: string,
): Promise<AssignmentDetails> => {
  const response = await api.get<AssignmentDetails>(
    `/assignment/${assignmentId}/details`,
  );

  return response.data;
};
