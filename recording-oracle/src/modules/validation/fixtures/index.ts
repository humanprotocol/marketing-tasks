import { IPostValidationResult } from '../../../common/interfaces/job';

export const generatePostValidationResult = (
  overrides: Partial<IPostValidationResult> = {},
): IPostValidationResult => ({
  postExists: true,
  isPublic: true,
  hasRequiredHashtags: true,
  hasRequiredKeywords: true,
  hasRequiredLink: true,
  meetsMinLength: true,
  hasRequiredMedia: true,
  meetsMinFollowers: true,
  meetsMinAccountAgeDays: true,
  meetsMinLiveDurationHours: true,
  meetsMinLikes: true,
  meetsMinReposts: true,
  followerAuthenticity: 'low',
  overallBotProbability: 'low',
  ...overrides,
});
