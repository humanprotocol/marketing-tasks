import { EncryptionUtils, KVStoreUtils } from '@human-protocol/sdk';
import type { ChainId } from '@human-protocol/sdk';

import { ORACLE_ADDRESSES } from '@/constants';
import {
  CampaignRequestType,
  SocialPlatform,
  type CampaignFormState,
  type CampaignManifest,
  type PreparedManifest,
  type RecordingOracleKeyState,
  type SocialMediaEngagementRequirements,
  type SocialMediaPromotionRequirements,
} from '@/types';

const splitList = (value: string): string[] | undefined => {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : undefined;
};

const optionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeDateToTimestamp = (value: string): number => {
  return new Date(value).getTime();
};

export const requiresEncryption = (form: CampaignFormState): boolean => {
  return (
    form.requestType === CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT &&
    form.platform === SocialPlatform.X &&
    form.engagement.checkLike
  );
};

const getXApiCredentials = (form: CampaignFormState) => ({
  consumerKey: form.engagement.xApiCredentials.consumerKey.trim(),
  consumerSecret: form.engagement.xApiCredentials.consumerSecret.trim(),
  accessToken: form.engagement.xApiCredentials.accessToken.trim(),
  accessTokenSecret: form.engagement.xApiCredentials.accessTokenSecret.trim(),
});

export const buildManifest = (
  form: CampaignFormState,
  encryptedXApiCredentials?: string,
): CampaignManifest => {
  const qualifications = splitList(form.qualifications);
  const baseManifest = {
    requestType: form.requestType,
    submissionsRequired: Number(form.submissionsRequired),
    endDate: normalizeDateToTimestamp(form.endDate),
    platforms: [form.platform],
    campaign: {
      name: form.campaignName.trim(),
      description: form.campaignDescription.trim(),
    },
    ...(qualifications && { qualifications }),
  };

  if (form.requestType === CampaignRequestType.SOCIAL_MEDIA_PROMOTION) {
    const requirements: SocialMediaPromotionRequirements = {
      ...(splitList(form.promotion.requiredHashtags) && {
        requiredHashtags: splitList(form.promotion.requiredHashtags),
      }),
      ...(splitList(form.promotion.requiredKeywords) && {
        requiredKeywords: splitList(form.promotion.requiredKeywords),
      }),
      ...(form.promotion.requiredLink.trim() && {
        requiredLink: form.promotion.requiredLink.trim(),
      }),
      ...(optionalNumber(form.promotion.minLength) !== undefined && {
        minLength: optionalNumber(form.promotion.minLength),
      }),
      requiresMedia: form.promotion.requiresMedia,
      mustBePublic: form.promotion.mustBePublic,
      ...(optionalNumber(form.promotion.minLiveDurationHours) !== undefined && {
        minLiveDurationHours: optionalNumber(
          form.promotion.minLiveDurationHours,
        ),
      }),
      ...(optionalNumber(form.promotion.minFollowers) !== undefined && {
        minFollowers: optionalNumber(form.promotion.minFollowers),
      }),
      ...(optionalNumber(form.promotion.minAccountAgeDays) !== undefined && {
        minAccountAgeDays: optionalNumber(form.promotion.minAccountAgeDays),
      }),
      ...(optionalNumber(form.promotion.minLikes) !== undefined && {
        minLikes: optionalNumber(form.promotion.minLikes),
      }),
      ...(optionalNumber(form.promotion.minReposts) !== undefined && {
        minReposts: optionalNumber(form.promotion.minReposts),
      }),
    };

    return {
      ...baseManifest,
      requestType: CampaignRequestType.SOCIAL_MEDIA_PROMOTION,
      requirements,
      aiValidation: {
        allowedAbuseProbability: form.promotion.allowedAbuseProbability,
      },
    };
  }

  const requirements: SocialMediaEngagementRequirements = {
    targetPostUrl: form.engagement.targetPostUrl.trim(),
    checkLike: form.engagement.checkLike,
    checkRepost:
      form.platform === SocialPlatform.X && form.engagement.checkRepost,
    checkQuote:
      form.platform === SocialPlatform.X && form.engagement.checkQuote,
    checkComment: form.engagement.checkComment,
    ...(requiresEncryption(form) && {
      xApiCredentials: encryptedXApiCredentials ?? getXApiCredentials(form),
    }),
  };

  return {
    ...baseManifest,
    requestType: CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT,
    requirements,
  };
};

export const calculateHash = async (content: string): Promise<string> => {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const getRecordingOraclePublicKey = async (
  chainId: ChainId,
  encryptionRequired: boolean,
): Promise<RecordingOracleKeyState> => {
  if (!encryptionRequired) {
    return {
      isLoading: false,
      publicKey: '',
    };
  }

  try {
    const publicKey = await KVStoreUtils.getPublicKey(
      chainId,
      ORACLE_ADDRESSES.recordingOracle,
    );

    return {
      isLoading: false,
      publicKey,
    };
  } catch (error) {
    return {
      isLoading: false,
      publicKey: '',
      error: getPublicKeyErrorMessage(error),
    };
  }
};

const getPublicKeyErrorMessage = (error: unknown): string => {
  const message =
    error instanceof Error
      ? error.message
      : 'Failed to fetch public keys from KVStore';

  if (message.includes('No URL found for the given address and key')) {
    return 'Recording oracle public key not found in KVStore.';
  }

  return message;
};

export const prepareManifest = async (
  form: CampaignFormState,
  recordingOracleKey: RecordingOracleKeyState,
): Promise<PreparedManifest> => {
  const encryptionRequired = requiresEncryption(form);
  const manifest = buildManifest(form);
  const plainManifestString = JSON.stringify(manifest);

  if (!encryptionRequired) {
    return {
      manifest,
      manifestString: plainManifestString,
      manifestHash: await calculateHash(plainManifestString),
      mode: 'plain',
      encryptionRequired,
    };
  }

  if (!recordingOracleKey.publicKey) {
    throw new Error('Recording oracle public key is missing in KVStore.');
  }

  const encryptedCredentials = await EncryptionUtils.encrypt(
    JSON.stringify(getXApiCredentials(form)),
    [recordingOracleKey.publicKey],
  );
  const manifestWithEncryptedCredentials = buildManifest(
    form,
    encryptedCredentials,
  );
  const manifestString = JSON.stringify(manifestWithEncryptedCredentials);

  return {
    manifest: manifestWithEncryptedCredentials,
    manifestString,
    manifestHash: await calculateHash(manifestString),
    mode: 'encrypted_credentials',
    encryptionRequired,
  };
};

export const shortKeyPreview = (publicKey: string): string => {
  if (!publicKey) return 'Missing';
  const compact = publicKey.replace(/\s+/g, ' ').trim();
  return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact;
};
