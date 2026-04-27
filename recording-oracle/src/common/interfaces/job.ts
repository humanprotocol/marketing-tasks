import { JobRequestType } from '../enums/job';
import { VerificationResult } from '../enums/submission';

export type AbuseProbability = 'low' | 'medium' | 'high';

export interface IManifestRequirements {
  required_hashtags?: string[];
  required_keywords?: string[];
  required_link?: string;
  min_length?: number;
  requires_media?: boolean;
  must_be_public?: boolean;
  min_live_duration_hours?: number;
  min_followers?: number;
  min_account_age_days?: number;
}

export interface IManifestAiValidation {
  allowed_abuse_probability: AbuseProbability;
}

export interface IManifestCampaign {
  name: string;
  description: string;
}

export interface IManifest {
  job_type: JobRequestType;
  end_date: number;
  platforms: string[];
  submissions_required: number;
  campaign: IManifestCampaign;
  requirements: IManifestRequirements;
  ai_validation: IManifestAiValidation;
  qualifications?: string[];
}

export interface IExchangeSolution {
  workerAddress: string;
  postUrl: string;
  error?: boolean | string;
}

export interface IExchangeSolutionsFile {
  exchangeAddress: string;
  solutions: IExchangeSolution[];
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
  followerAuthenticity: AbuseProbability;
  overallBotProbability: AbuseProbability;
}
