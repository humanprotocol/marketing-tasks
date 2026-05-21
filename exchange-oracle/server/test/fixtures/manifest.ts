import { faker } from '@faker-js/faker';

import { JobType } from '../../src/common/enums/job';
import type { ManifestDto } from '../../src/modules/job/job.dto';

export function createManifest(
  overrides: Partial<ManifestDto> = {},
): ManifestDto {
  return {
    jobType: JobType.SOCIAL_MEDIA_PROMOTION,
    submissionsRequired: faker.number.int({ min: 1, max: 10 }),
    endDate: faker.date
      .soon({ days: 30, refDate: Date.now() + 14 * 24 * 60 * 60 * 1000 })
      .getTime(),
    platforms: ['x'],
    campaign: {
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentences({ min: 1, max: 2 }),
    },
    requirements: {
      requiredHashtags: [`#${faker.word.sample()}`],
      requiredKeywords: [faker.company.name()],
      requiredLink: faker.internet.url({ protocol: 'https' }),
      minLength: faker.number.int({ min: 20, max: 280 }),
      requiresMedia: faker.datatype.boolean(),
      mustBePublic: true,
      minLiveDurationHours: faker.number.int({ min: 1, max: 24 }),
      minFollowers: faker.number.int({ min: 0, max: 10000 }),
      minAccountAgeDays: faker.number.int({ min: 0, max: 3650 }),
      minLikes: faker.number.int({ min: 0, max: 1000 }),
      minReposts: faker.number.int({ min: 0, max: 1000 }),
    },
    aiValidation: {
      allowedAbuseProbability: faker.helpers.arrayElement([
        'low',
        'medium',
        'high',
      ]),
    },
    ...overrides,
  };
}
