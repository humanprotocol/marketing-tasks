import { JobRequestType } from '../enums/job';
import { VerificationResult } from '../enums/submission';

export type AbuseProbability = 'low' | 'medium' | 'high';

export interface ISocialMediaPromotionRequirements {
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

export interface IXApiCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface ISocialMediaEngagementRequirements {
  targetPostUrl: string;
  checkLike?: boolean;
  checkRepost?: boolean;
  checkQuote?: boolean;
  checkComment?: boolean;
  xApiCredentials?: IXApiCredentials;
}

export type IManifestRequirements =
  | ISocialMediaPromotionRequirements
  | ISocialMediaEngagementRequirements;

export interface IManifestAiValidation {
  allowedAbuseProbability: AbuseProbability;
}

export interface IManifestCampaign {
  name: string;
  description: string;
}

interface IBaseManifest {
  requestType: JobRequestType;
  endDate: number;
  platforms: string[];
  submissionsRequired: number;
  campaign: IManifestCampaign;
  qualifications?: string[];
}

export interface ISocialMediaPromotionManifest extends IBaseManifest {
  requirements: ISocialMediaPromotionRequirements;
  aiValidation: IManifestAiValidation;
}

export interface ISocialMediaEngagementManifest extends IBaseManifest {
  requirements: ISocialMediaEngagementRequirements;
}

export type IManifest =
  | ISocialMediaPromotionManifest
  | ISocialMediaEngagementManifest;

export interface IRecordingResult {
  workerAddress: string;
  solution: string;
  verificationResult: VerificationResult;
  rejectionReason?: string;
}

export interface IPostValidationResult {
  postExists: boolean;
  isPublic: boolean;
  hasRequiredHashtags: boolean;
  hasRequiredKeywords: boolean;
  hasRequiredLink: boolean;
  meetsMinLength: boolean;
  hasRequiredMedia: boolean;
  meetsMinFollowers: boolean;
  meetsMinAccountAgeDays: boolean;
  meetsMinLiveDurationHours: boolean;
  meetsMinLikes: boolean;
  meetsMinReposts: boolean;
  followerAuthenticity: AbuseProbability;
  overallBotProbability: AbuseProbability;
}
