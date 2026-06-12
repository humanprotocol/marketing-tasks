import { SubmissionRejectionReason } from '../../common/constants/errors';
import { AbuseProbability } from '../../common/interfaces/job';
import { SubmissionValidationRule } from './submission.dto';

export type SocialProfileNormalizer = {
  normalize: (profile: string) => string | null;
  isValid: (profile: string) => boolean;
};

export const ABUSE_PRIORITY: Record<AbuseProbability, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const SOCIAL_PROFILE_NORMALIZERS: SocialProfileNormalizer[] = [
  {
    normalize: (profile: string): string | null =>
      profile.trim().replace(/^@/, '').toLowerCase(),
    isValid: (profile: string): boolean => /^[a-z0-9_]{1,15}$/.test(profile),
  },
  {
    normalize: (profile: string): string | null => {
      const trimmedProfile = profile.trim().replace(/^@/, '');

      try {
        const parsedUrl = new URL(trimmedProfile);
        const path = parsedUrl.pathname.replace(/\/+$/, '');
        const match = path.match(/^\/in\/([^/]+)$/i);

        if (
          parsedUrl.protocol === 'https:' &&
          parsedUrl.hostname.endsWith('linkedin.com') &&
          match
        ) {
          return match[1].toLowerCase();
        }
      } catch {
        return trimmedProfile.toLowerCase();
      }

      return null;
    },
    isValid: (profile: string): boolean =>
      /^[a-z0-9][a-z0-9_-]{0,99}$/.test(profile),
  },
];

export const SUBMISSION_VALIDATION_RULES: SubmissionValidationRule[] = [
  {
    isValid: (validation) => validation.postExists,
    rejectionReason: SubmissionRejectionReason.PostNotFound,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.mustBePublic || validation.isPublic,
    rejectionReason: SubmissionRejectionReason.PostNotPublic,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.requiredHashtags?.length ||
      validation.hasRequiredHashtags,
    rejectionReason: SubmissionRejectionReason.MissingRequiredHashtag,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.requiredKeywords?.length ||
      validation.hasRequiredKeywords,
    rejectionReason: SubmissionRejectionReason.MissingRequiredKeyword,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.requiredLink || validation.hasRequiredLink,
    rejectionReason: SubmissionRejectionReason.MissingRequiredLink,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.minLength || validation.meetsMinLength,
    rejectionReason: SubmissionRejectionReason.MinLengthNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.requiresMedia || validation.hasRequiredMedia,
    rejectionReason: SubmissionRejectionReason.RequiredMediaMissing,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.minFollowers || validation.meetsMinFollowers,
    rejectionReason: SubmissionRejectionReason.MinFollowersNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.minAccountAgeDays ||
      validation.meetsMinAccountAgeDays,
    rejectionReason: SubmissionRejectionReason.MinAccountAgeNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.minLiveDurationHours ||
      validation.meetsMinLiveDurationHours,
    rejectionReason: SubmissionRejectionReason.MinLiveDurationNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.minLikes || validation.meetsMinLikes,
    rejectionReason: SubmissionRejectionReason.MinLikesNotMet,
  },
  {
    isValid: (validation, manifest) =>
      !manifest.requirements.minReposts || validation.meetsMinReposts,
    rejectionReason: SubmissionRejectionReason.MinRepostsNotMet,
  },
];
