import { faker } from '@faker-js/faker';

import { JobRequestType, JobStatus } from '../../../common/enums/job';
import { VerificationResult } from '../../../common/enums/submission';
import { IManifest, IRecordingResult } from '../../../common/interfaces/job';
import { JobEntity } from '../job.entity';

export const generateManifest = (
  overrides: Partial<IManifest> = {},
): IManifest => ({
  requestType: JobRequestType.SOCIAL_MEDIA_PROMOTION,
  endDate: faker.date.future().getTime(),
  platforms: ['x'],
  submissionsRequired: 2,
  campaign: {
    name: faker.company.name(),
    description: faker.lorem.sentence(),
  },
  requirements: {},
  aiValidation: {
    allowedAbuseProbability: 'medium',
  },
  ...overrides,
});

export const generateJob = (overrides: Partial<JobEntity> = {}): JobEntity =>
  ({
    id: faker.number.int({ min: 1 }),
    chainId: 80002,
    escrowAddress: faker.finance.ethereumAddress(),
    jobType: JobRequestType.SOCIAL_MEDIA_PROMOTION,
    manifestUrl: faker.internet.url(),
    endDate: faker.date.future(),
    status: JobStatus.PENDING,
    retriesCount: 0,
    submissions: [],
    ...overrides,
  }) as JobEntity;

export const generateRecordingResult = (
  overrides: Partial<IRecordingResult> = {},
): IRecordingResult => ({
  workerAddress: faker.finance.ethereumAddress(),
  postUrl: `https://x.com/${faker.internet.username()}/status/${faker.string.numeric(8)}`,
  verificationResult: VerificationResult.ACCEPTED,
  ...overrides,
});
