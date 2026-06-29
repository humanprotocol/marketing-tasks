import {
  CampaignRequestType,
  SocialPlatform,
  type CampaignFormState,
} from '@/types';
import { getFundingTokenConfig } from '@/constants/fundingTokens';
import { requiresEncryption } from './manifest';

const isPositiveNumber = (value: string): boolean => Number(value) > 0;

const isFutureDate = (value: string): boolean => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

export const validateForm = (form: CampaignFormState): string[] => {
  const errors: string[] = [];

  if (!form.campaignName.trim()) errors.push('Campaign name is required');
  if (!form.campaignDescription.trim()) {
    errors.push('Campaign description is required');
  }
  if (!isPositiveNumber(form.submissionsRequired)) {
    errors.push('Submissions required must be greater than zero');
  }
  if (!isFutureDate(form.endDate)) errors.push('End date must be in the future');
  if (!getFundingTokenConfig(form.chainId, form.fundToken)) {
    errors.push('Selected currency is not configured for this network');
  }
  if (!isPositiveNumber(form.fundAmount)) {
    errors.push('Fund amount must be greater than zero');
  }

  if (form.requestType === CampaignRequestType.SOCIAL_MEDIA_PROMOTION) {
    const hasRequirement =
      form.promotion.requiredHashtags.trim() ||
      form.promotion.requiredKeywords.trim() ||
      form.promotion.requiredLink.trim() ||
      form.promotion.minLength.trim() ||
      form.promotion.requiresMedia ||
      form.promotion.mustBePublic;

    if (!hasRequirement) {
      errors.push('At least one promotion requirement is required');
    }
  }

  if (form.requestType === CampaignRequestType.SOCIAL_MEDIA_ENGAGEMENT) {
    if (!form.engagement.targetPostUrl.trim()) {
      errors.push('Target post URL is required');
    }

    const hasEngagementCheck =
      form.engagement.checkLike ||
      form.engagement.checkRepost ||
      form.engagement.checkQuote ||
      form.engagement.checkComment;

    if (!hasEngagementCheck) {
      errors.push('At least one engagement check is required');
    }

    if (form.platform === SocialPlatform.LINKEDIN) {
      if (form.engagement.checkRepost || form.engagement.checkQuote) {
        errors.push('LinkedIn supports only like and comment checks');
      }
    }

    if (
      form.platform === SocialPlatform.X &&
      form.engagement.checkComment &&
      !form.engagement.checkLike &&
      !form.engagement.checkRepost &&
      !form.engagement.checkQuote
    ) {
      errors.push('X comments must be requested with like, repost, or quote');
    }

    if (requiresEncryption(form)) {
      const credentials = form.engagement.xApiCredentials;
      if (
        !credentials.consumerKey.trim() ||
        !credentials.consumerSecret.trim() ||
        !credentials.accessToken.trim() ||
        !credentials.accessTokenSecret.trim()
      ) {
        errors.push('X API credentials are required when checking likes');
      }
    }
  }

  return errors;
};
