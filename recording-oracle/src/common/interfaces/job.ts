import { JobRequestType } from '../enums/job';
import { VerificationResult } from '../enums/submission';

export type AbuseProbability = 'low' | 'medium' | 'high';

export interface IManifestRequirements {
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

export interface IManifestAiValidation {
  allowedAbuseProbability: AbuseProbability;
}

export interface IManifestCampaign {
  name: string;
  description: string;
}

export interface IManifest {
  requestType: JobRequestType;
  endDate: number;
  platforms: string[];
  submissionsRequired: number;
  campaign: IManifestCampaign;
  requirements: IManifestRequirements;
  aiValidation: IManifestAiValidation;
  qualifications?: string[];
}

export interface IRecordingResult {
  workerAddress: string;
  postUrl: string;
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
