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
        meetsMinLikes: { type: 'boolean' },
        meetsMinReposts: { type: 'boolean' },
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
        'meetsMinLikes',
        'meetsMinReposts',
        'followerAuthenticity',
        'overallBotProbability',
      ],
    },
  },
} as const;

export function extractResponsesText(
  payload: GrokResponsesApiResponse,
): string {
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
      !requirements.requiredHashtags?.length || validation.hasRequiredHashtags,
    hasRequiredKeywords:
      !requirements.requiredKeywords?.length || validation.hasRequiredKeywords,
    hasRequiredLink: !requirements.requiredLink || validation.hasRequiredLink,
    meetsMinLength: !requirements.minLength || validation.meetsMinLength,
    hasRequiredMedia:
      !requirements.requiresMedia || validation.hasRequiredMedia,
    meetsMinFollowers:
      !requirements.minFollowers || validation.meetsMinFollowers,
    meetsMinAccountAgeDays:
      !requirements.minAccountAgeDays || validation.meetsMinAccountAgeDays,
    meetsMinLiveDurationHours:
      !requirements.minLiveDurationHours ||
      validation.meetsMinLiveDurationHours,
    meetsMinLikes: !requirements.minLikes || validation.meetsMinLikes,
    meetsMinReposts: !requirements.minReposts || validation.meetsMinReposts,
  };
}

export function buildGrokValidationPrompt(
  postUrl: string,
  manifest: IManifest,
): string {
  const requirements = manifest.requirements;
  const requiredHashtags = requirements.requiredHashtags ?? [];
  const requiredKeywords = requirements.requiredKeywords ?? [];
  const rules = ['- post exists'];

  if (requirements.mustBePublic ?? true) {
    rules.push('- post is public');
  }

  if (requiredHashtags.length > 0) {
    rules.push(`- contains hashtags: ${requiredHashtags.join(', ')}`);
  }

  if (requiredKeywords.length > 0) {
    rules.push(`- contains keywords: ${requiredKeywords.join(', ')}`);
  }

  if (requirements.requiredLink) {
    rules.push(`- contains link: ${requirements.requiredLink}`);
  }

  if (requirements.minLength && requirements.minLength > 0) {
    rules.push(`- text length >= ${requirements.minLength}`);
  }

  if (requirements.requiresMedia) {
    rules.push('- includes media');
  }

  if (requirements.minFollowers && requirements.minFollowers > 0) {
    rules.push(`- author followers >= ${requirements.minFollowers}`);
  }

  if (requirements.minAccountAgeDays && requirements.minAccountAgeDays > 0) {
    rules.push(
      `- author account age in days >= ${requirements.minAccountAgeDays}`,
    );
  }

  if (
    requirements.minLiveDurationHours &&
    requirements.minLiveDurationHours > 0
  ) {
    rules.push(
      `- post live duration in hours >= ${requirements.minLiveDurationHours}`,
    );
  }

  if (requirements.minLikes && requirements.minLikes > 0) {
    rules.push(`- post likes >= ${requirements.minLikes}`);
  }

  if (requirements.minReposts && requirements.minReposts > 0) {
    rules.push(`- post reposts >= ${requirements.minReposts}`);
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
