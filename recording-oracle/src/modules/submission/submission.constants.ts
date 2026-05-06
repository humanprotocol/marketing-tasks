import { SubmissionRejectionReason } from '../../common/constants/errors';
import { AbuseProbability } from '../../common/interfaces/job';
import { SubmissionValidationRule } from './submission.dto';

export const ABUSE_PRIORITY: Record<AbuseProbability, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const SUBMISSION_VALIDATION_RULES: SubmissionValidationRule[] = [
  {
    isValid: (validation) => validation.postExists,
    rejectionReason: SubmissionRejectionReason.PostNotFound,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.must_be_public || validation.isPublic,
    rejectionReason: SubmissionRejectionReason.PostNotPublic,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.required_hashtags?.length ||
      validation.hasRequiredHashtags,
    rejectionReason: SubmissionRejectionReason.MissingRequiredHashtag,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.required_keywords?.length ||
      validation.hasRequiredKeywords,
    rejectionReason: SubmissionRejectionReason.MissingRequiredKeyword,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.required_link || validation.hasRequiredLink,
    rejectionReason: SubmissionRejectionReason.MissingRequiredLink,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.min_length || validation.meetsMinLength,
    rejectionReason: SubmissionRejectionReason.MinLengthNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.requires_media || validation.hasRequiredMedia,
    rejectionReason: SubmissionRejectionReason.RequiredMediaMissing,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.min_followers || validation.meetsMinFollowers,
    rejectionReason: SubmissionRejectionReason.MinFollowersNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.min_account_age_days ||
      validation.meetsMinAccountAgeDays,
    rejectionReason: SubmissionRejectionReason.MinAccountAgeNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.min_live_duration_hours ||
      validation.meetsMinLiveDurationHours,
    rejectionReason: SubmissionRejectionReason.MinLiveDurationNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.min_likes || validation.meetsMinLikes,
    rejectionReason: SubmissionRejectionReason.MinLikesNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.min_reposts || validation.meetsMinReposts,
    rejectionReason: SubmissionRejectionReason.MinRepostsNotMet,
  },
];
