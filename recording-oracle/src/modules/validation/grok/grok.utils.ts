import {
  IManifest,
  IPostValidationResult,
} from '../../../common/interfaces/job';

import { GrokResponsesApiResponse } from './grok.interface';

export const GROK_VALIDATION_SYSTEM_PROMPT =
  'Validate X posts using only public observable evidence. Be conservative and concise.';

export const GROK_VALIDATION_RESPONSE_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'grok_validation_result',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        postExists: { type: 'boolean' },
        isPublic: { type: 'boolean' },
        hasRequiredHashtags: { type: 'boolean' },
        hasRequiredKeywords: { type: 'boolean' },
        hasRequiredLink: { type: 'boolean' },
        meetsMinLength: { type: 'boolean' },
        hasRequiredMedia: { type: 'boolean' },
        meetsMinFollowers: { type: 'boolean' },
        meetsMinAccountAgeDays: { type: 'boolean' },
        meetsMinLiveDurationHours: { type: 'boolean' },
        followerAuthenticity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
        overallBotProbability: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
      },
      required: [
        'postExists',
        'isPublic',
        'hasRequiredHashtags',
        'hasRequiredKeywords',
        'hasRequiredLink',
        'meetsMinLength',
        'hasRequiredMedia',
        'meetsMinFollowers',
        'meetsMinAccountAgeDays',
        'meetsMinLiveDurationHours',
        'followerAuthenticity',
        'overallBotProbability',
      ],
    },
  },
} as const;

export function extractResponsesText(payload: GrokResponsesApiResponse): string {
  const message = payload.output?.find((item) => item.type === 'message');
  const text = message?.content?.find((item) => item.type === 'output_text');

  return text?.text ?? '';
}

export function normalizeValidationResult(
  validation: IPostValidationResult,
  manifest: IManifest,
): IPostValidationResult {
  const requirements = manifest.requirements;

  return {
    ...validation,
    hasRequiredHashtags:
      !requirements.required_hashtags?.length || validation.hasRequiredHashtags,
    hasRequiredKeywords:
      !requirements.required_keywords?.length || validation.hasRequiredKeywords,
    hasRequiredLink: !requirements.required_link || validation.hasRequiredLink,
    meetsMinLength: !requirements.min_length || validation.meetsMinLength,
    hasRequiredMedia:
      !requirements.requires_media || validation.hasRequiredMedia,
    meetsMinFollowers:
      !requirements.min_followers || validation.meetsMinFollowers,
    meetsMinAccountAgeDays:
      !requirements.min_account_age_days || validation.meetsMinAccountAgeDays,
    meetsMinLiveDurationHours:
      !requirements.min_live_duration_hours ||
      validation.meetsMinLiveDurationHours,
  };
}

export function buildGrokValidationPrompt(
  postUrl: string,
  manifest: IManifest,
): string {
  const requirements = manifest.requirements;
  const requiredHashtags = requirements.required_hashtags ?? [];
  const requiredKeywords = requirements.required_keywords ?? [];
  const rules = ['- post exists'];

  if (requirements.must_be_public ?? true) {
    rules.push('- post is public');
  }

  if (requiredHashtags.length > 0) {
    rules.push(`- contains hashtags: ${requiredHashtags.join(', ')}`);
  }

  if (requiredKeywords.length > 0) {
    rules.push(`- contains keywords: ${requiredKeywords.join(', ')}`);
  }

  if (requirements.required_link) {
    rules.push(`- contains link: ${requirements.required_link}`);
  }

  if (requirements.min_length && requirements.min_length > 0) {
    rules.push(`- text length >= ${requirements.min_length}`);
  }

  if (requirements.requires_media) {
    rules.push('- includes media');
  }

  if (requirements.min_followers && requirements.min_followers > 0) {
    rules.push(`- author followers >= ${requirements.min_followers}`);
  }

  if (
    requirements.min_account_age_days &&
    requirements.min_account_age_days > 0
  ) {
    rules.push(
      `- author account age in days >= ${requirements.min_account_age_days}`,
    );
  }

  if (
    requirements.min_live_duration_hours &&
    requirements.min_live_duration_hours > 0
  ) {
    rules.push(
      `- post live duration in hours >= ${requirements.min_live_duration_hours}`,
    );
  }

  return `Validate this X post for campaign compliance.

Post URL: ${postUrl}

Rules:
${rules.join('\n')}

Risk scoring:
- low = clear legitimacy evidence
- medium = limited or mixed evidence
- high = strong suspicious signals

Use only the post, the author profile, and minimal live X lookups.
Do not inspect individual followers.
Infer followerAuthenticity only from high-level public profile and engagement signals.
If a required rule cannot be verified, set that boolean to false.
If evidence is limited for bot or follower quality, prefer medium over low.
overallBotProbability must not be low when followerAuthenticity is medium or high unless strong counter-evidence exists.
Do not treat crypto-related content alone as a risk signal.`;
}
