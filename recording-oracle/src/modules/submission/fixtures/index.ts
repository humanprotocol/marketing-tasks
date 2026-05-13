import { faker } from '@faker-js/faker';

import { SubmissionStatus } from '../../../common/enums/submission';
import { EventType } from '../../../common/enums/webhook';
import { WebhookDto } from '../../../modules/webhook/webhook.dto';
import { SubmissionEntity } from '../submission.entity';

export const generatePostUrl = (): string =>
  `https://x.com/${faker.internet.username()}/status/${faker.string.numeric(8)}`;

export const generateSubmission = (
  overrides: Partial<SubmissionEntity> = {},
): SubmissionEntity =>
  ({
    id: faker.number.int({ min: 1 }),
    jobId: faker.number.int({ min: 1 }),
    workerAddress: faker.finance.ethereumAddress(),
    postUrl: generatePostUrl(),
    status: SubmissionStatus.PENDING,
    reason: null,
    ...overrides,
  }) as SubmissionEntity;
