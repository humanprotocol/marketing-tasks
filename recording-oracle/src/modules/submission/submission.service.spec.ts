import { Test } from '@nestjs/testing';

import { SubmissionService } from './submission.service';
import { StorageService } from '../../modules/storage/storage.service';
import { JobService } from '../../modules/job/job.service';
import { SubmissionRepository } from './submission.repository';
import { ValidationService } from '../validation/validation.service';

describe('SubmissionService', () => {
  let submissionService: SubmissionService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubmissionService,
        {
          provide: StorageService,
          useValue: { download: jest.fn(), uploadJobSolutions: jest.fn() },
        },
        {
          provide: SubmissionRepository,
          useValue: {
            createUnique: jest.fn(),
            findOneForSubmission: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: JobService,
          useValue: {
            createJob: jest.fn(),
            storeResultsForReputationOracle: jest.fn(),
          },
        },
        {
          provide: ValidationService,
          useValue: {
            validatePost: jest.fn(),
          },
        },
      ],
    }).compile();

    submissionService = moduleRef.get(SubmissionService);
  });

  it('creates the service', () => {
    expect(submissionService).toBeDefined();
  });
});
