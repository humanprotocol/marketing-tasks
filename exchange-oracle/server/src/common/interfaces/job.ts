export interface ISolution {
  workerAddress: string;
  postUrl: string;
  error?: boolean;
}

export type AbuseProbability = 'low' | 'medium' | 'high';

export interface ManifestCampaign {
  name: string;
  description: string;
}

export interface ManifestRequirements {
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

export interface ManifestAiValidation {
  allowed_abuse_probability: AbuseProbability;
}

export interface Manifest {
  job_type: string;
  platforms: string[];
  campaign: ManifestCampaign;
  end_date: number;
  submissions_required: number;
  requirements: ManifestRequirements;
  ai_validation: ManifestAiValidation;
  qualifications?: string[];
}
