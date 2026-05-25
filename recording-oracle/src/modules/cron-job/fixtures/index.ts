import { faker } from '@faker-js/faker';

import { CronJobType } from '../constants';
import { CronJobEntity } from '../cron-job.entity';

export const generateCronJob = (
  overrides: Partial<CronJobEntity> = {},
): CronJobEntity =>
  ({
    id: faker.number.int({ min: 1 }),
    cronJobType: CronJobType.ProcessJobsAfterSubmissionDeadline,
    startedAt: faker.date.recent(),
    completedAt: faker.date.recent(),
    ...overrides,
  }) as CronJobEntity;
