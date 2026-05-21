export type AbuseProbability = 'low' | 'medium' | 'high';

export interface ManifestCampaign {
  name: string;
  description: string;
}

export interface ManifestRequirements {
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

export interface ManifestAiValidation {
  allowedAbuseProbability: AbuseProbability;
}

export interface Manifest {
  jobType: string;
  platforms: string[];
  campaign: ManifestCampaign;
  endDate: number;
  submissionsRequired: number;
  requirements: ManifestRequirements;
  aiValidation: ManifestAiValidation;
  qualifications?: string[];
}
