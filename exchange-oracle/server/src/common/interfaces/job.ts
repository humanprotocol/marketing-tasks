import { JobType } from '../enums/job';

export type AbuseProbability = 'low' | 'medium' | 'high';

export interface ManifestCampaign {
  name: string;
  description: string;
}

export interface SocialMediaPromotionRequirements {
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
}

export interface SocialMediaEngagementRequirements {
  targetPostUrl: string;
  checkLike?: boolean;
  checkRepost?: boolean;
  checkQuote?: boolean;
  checkComment?: boolean;
}

export type ManifestRequirements =
  | SocialMediaPromotionRequirements
  | SocialMediaEngagementRequirements;

export interface ManifestAiValidation {
  allowedAbuseProbability: AbuseProbability;
}

interface BaseManifest {
  requestType: JobType;
  platforms: string[];
  campaign: ManifestCampaign;
  endDate: number;
  submissionsRequired: number;
  qualifications?: string[];
}

export interface SocialMediaPromotionManifest extends BaseManifest {
  requirements: SocialMediaPromotionRequirements;
  aiValidation?: ManifestAiValidation;
}

export interface SocialMediaEngagementManifest extends BaseManifest {
  requirements: SocialMediaEngagementRequirements;
}

export type Manifest =
  | SocialMediaPromotionManifest
  | SocialMediaEngagementManifest;
