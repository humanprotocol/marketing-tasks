import { EncryptionUtils, KVStoreUtils } from '@human-protocol/sdk';
import type { ChainId } from '@human-protocol/sdk';

import {
  ORACLE_ADDRESSES,
  PUBLIC_KEY_SETUP_URL,
} from '@/constants';
import {
  CampaignRequestType,
  SocialPlatform,
  type CampaignFormState,
  type CampaignManifest,
  type EvmAddress,
  type PreparedManifest,
  type PublicKeysState,
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

export const buildManifest = (form: CampaignFormState): CampaignManifest => {
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
          form.promotion.minLiveDurationHours
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
    checkRepost: form.platform === SocialPlatform.X && form.engagement.checkRepost,
    checkQuote: form.platform === SocialPlatform.X && form.engagement.checkQuote,
    checkComment: form.engagement.checkComment,
    ...(requiresEncryption(form) && {
      xApiCredentials: {
        consumerKey: form.engagement.xApiCredentials.consumerKey.trim(),
        consumerSecret: form.engagement.xApiCredentials.consumerSecret.trim(),
        accessToken: form.engagement.xApiCredentials.accessToken.trim(),
        accessTokenSecret:
          form.engagement.xApiCredentials.accessTokenSecret.trim(),
      },
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

export const getPublicKeys = async (
  chainId: ChainId,
  userAddress: EvmAddress,
  encryptionRequired: boolean
): Promise<PublicKeysState> => {
  if (!encryptionRequired) {
    return {
      isLoading: false,
      userPublicKey: '',
      oraclePublicKeys: [],
    };
  }

  try {
    const userPublicKey = await KVStoreUtils.getPublicKey(
      chainId,
      userAddress
    );

    const oracleAddresses = Object.values(ORACLE_ADDRESSES).filter(Boolean);
    const oraclePublicKeys = await Promise.all(
      oracleAddresses.map((address) => KVStoreUtils.getPublicKey(chainId, address))
    );

    return {
      isLoading: false,
      userPublicKey,
      oraclePublicKeys: oraclePublicKeys.filter(Boolean),
    };
  } catch (error) {
    return {
      isLoading: false,
      userPublicKey: '',
      oraclePublicKeys: [],
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
    return PUBLIC_KEY_SETUP_URL
      ? `Public key not found for this wallet. Set it before launching this campaign: ${PUBLIC_KEY_SETUP_URL}`
      : 'Public key not found for this wallet. Set it before launching this campaign.';
  }

  return message;
};

export const prepareManifest = async (
  form: CampaignFormState,
  publicKeys: PublicKeysState
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

  if (!publicKeys.userPublicKey) {
    throw new Error(
      PUBLIC_KEY_SETUP_URL
        ? `Your wallet public key is missing in KVStore. Set it before launching this campaign: ${PUBLIC_KEY_SETUP_URL}`
        : 'Your wallet public key is missing in KVStore.'
    );
  }

  const recipientPublicKeys = [
    ...publicKeys.oraclePublicKeys,
    publicKeys.userPublicKey,
  ];

  if (recipientPublicKeys.length < 4) {
    throw new Error('Missing one or more recipient public keys for encryption');
  }

  const encryptedManifest = await EncryptionUtils.encrypt(plainManifestString, [
    ...new Set(recipientPublicKeys),
  ]);
  const encryptedManifestString = JSON.stringify({
    encrypted: true,
    encryption: 'pgp',
    manifest: encryptedManifest,
  });

  return {
    manifest,
    manifestString: encryptedManifestString,
    manifestHash: await calculateHash(encryptedManifestString),
    mode: 'encrypted',
    encryptionRequired,
  };
};

export const shortKeyPreview = (publicKey: string): string => {
  if (!publicKey) return 'Missing';
  const compact = publicKey.replace(/\s+/g, ' ').trim();
  return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact;
};
