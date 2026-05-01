import { faker } from '@faker-js/faker';

import { JobType } from '../../src/common/enums/job';
import type { ManifestDto } from '../../src/modules/job/job.dto';

export function createManifest(
  overrides: Partial<ManifestDto> = {},
): ManifestDto {
  return {
    job_type: JobType.SOCIAL_MEDIA_PROMOTION,
    submissions_required: faker.number.int({ min: 1, max: 10 }),
    end_date: faker.date
      .soon({ days: 30, refDate: Date.now() + 14 * 24 * 60 * 60 * 1000 })
      .getTime(),
    platforms: ['x'],
    campaign: {
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentences({ min: 1, max: 2 }),
    },
    requirements: {
      required_hashtags: [`#${faker.word.sample()}`],
      required_keywords: [faker.company.name()],
      required_link: faker.internet.url({ protocol: 'https' }),
      min_length: faker.number.int({ min: 20, max: 280 }),
      requires_media: faker.datatype.boolean(),
      must_be_public: true,
      min_live_duration_hours: faker.number.int({ min: 1, max: 24 }),
      min_followers: faker.number.int({ min: 0, max: 10000 }),
      min_account_age_days: faker.number.int({ min: 0, max: 3650 }),
    },
    ai_validation: {
      allowed_abuse_probability: faker.helpers.arrayElement([
        'low',
        'medium',
        'high',
      ]),
    },
    ...overrides,
  };
}
