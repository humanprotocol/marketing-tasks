import type { ChainId } from '@human-protocol/sdk';

export type EvmAddress = `0x${string}`;

export enum CampaignRequestType {
  SOCIAL_MEDIA_PROMOTION = 'social_media_promotion',
  SOCIAL_MEDIA_ENGAGEMENT = 'social_media_engagement',
}

export enum SocialPlatform {
  X = 'x',
  LINKEDIN = 'linkedin',
}

export enum EscrowFundToken {
  HMT = 'HMT',
  USDT = 'USDT',
  USDC = 'USDC',
  USDT0 = 'USDT0',
}

export type AbuseProbability = 'low' | 'medium' | 'high';

export type XApiCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export type BaseCampaignForm = {
  chainId: ChainId;
  requestType: CampaignRequestType;
  platform: SocialPlatform;
  campaignName: string;
  campaignDescription: string;
  submissionsRequired: string;
  endDate: string;
  fundToken: EscrowFundToken;
  fundAmount: string;
  qualifications: string;
};

export type PromotionRequirementsForm = {
  requiredHashtags: string;
  requiredKeywords: string;
  requiredLink: string;
  minLength: string;
  requiresMedia: boolean;
  mustBePublic: boolean;
  minLiveDurationHours: string;
  minFollowers: string;
  minAccountAgeDays: string;
  minLikes: string;
  minReposts: string;
  allowedAbuseProbability: AbuseProbability;
};

export type EngagementRequirementsForm = {
  targetPostUrl: string;
  checkLike: boolean;
  checkRepost: boolean;
  checkQuote: boolean;
  checkComment: boolean;
  xApiCredentials: XApiCredentials;
};

export type CampaignFormState = BaseCampaignForm & {
  promotion: PromotionRequirementsForm;
  engagement: EngagementRequirementsForm;
};

export type SocialMediaPromotionRequirements = {
  requiredHashtags?: string[];
  requiredKeywords?: string[];
  requiredLink?: string;
  minLength?: number;
  requiresMedia?: boolean;
  mustBePublic?: boolean;
  minLiveDurationHours?: number;
  minFollowers?: number;
  minAccountAgeDays?: number;
  minLikes?: number;
  minReposts?: number;
};

export type SocialMediaEngagementRequirements = {
  targetPostUrl: string;
  checkLike?: boolean;
  checkRepost?: boolean;
  checkQuote?: boolean;
  checkComment?: boolean;
  xApiCredentials?: XApiCredentials | string;
};

export type ManifestCampaign = {
  name: string;
  description: string;
};

export type BaseManifest = {
  requestType: CampaignRequestType;
  submissionsRequired: number;
  endDate: number;
  platforms: SocialPlatform[];
  campaign: ManifestCampaign;
  qualifications?: string[];
};

export type SocialMediaPromotionManifest = BaseManifest & {
  requestType: CampaignRequestType.SOCIAL_MEDIA_PROMOTION;
  requirements: SocialMediaPromotionRequirements;
  aiValidation: {
    allowedAbuseProbability: AbuseProbability;
  };
};

export type SocialMediaEngagementManifest = BaseManifest & {
  requestType: CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT;
  requirements: SocialMediaEngagementRequirements;
};

export type CampaignManifest =
  | SocialMediaPromotionManifest
  | SocialMediaEngagementManifest;

export type ManifestMode = 'plain' | 'encrypted_credentials';

export type PreparedManifest = {
  manifest: CampaignManifest;
  manifestString: string;
  manifestHash: string;
  mode: ManifestMode;
  encryptionRequired: boolean;
};

export type RecordingOracleKeyState = {
  isLoading: boolean;
  error?: string;
  publicKey: string;
};

export type EscrowResult = {
  escrowAddress: string;
  transactionManifestHash: string;
};
