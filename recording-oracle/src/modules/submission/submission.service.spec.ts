import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { JobService } from '../../modules/job/job.service';
import { generateJob } from '../../modules/job/fixtures';
import { ValidationService } from '../validation/validation.service';
import {
  ErrorJob,
  SubmissionRejectionReason,
} from '../../common/constants/errors';
import { generatePostUrl } from './fixtures';
import { SubmissionRepository } from './submission.repository';
import { SubmissionService } from './submission.service';
import { EventType } from '../../common/enums/webhook';

describe('SubmissionService', () => {
  let submissionService: SubmissionService;
  let submissionRepository: jest.Mocked<SubmissionRepository>;
  let jobService: jest.Mocked<JobService>;

  const job = generateJob({ id: 1 });
  const workerAddress = faker.finance.ethereumAddress();
  const normalizedPostUrl = generatePostUrl();
  const webhook = {
    chainId: job.chainId,
    eventType: EventType.SUBMISSION_IN_REVIEW,
    escrowAddress: job.escrowAddress,
    eventData: {
      assigneeId: workerAddress,
      postUrl: `${normalizedPostUrl}?utm_source=test#ignored`,
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubmissionService,
        {
          provide: SubmissionRepository,
          useValue: {
            createUnique: jest.fn(),
            findOneByJobIdAndWorkerAddress: jest.fn(),
            findOneByJobIdAndPostUrl: jest.fn(),
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
    submissionRepository = moduleRef.get(SubmissionRepository);
    jobService = moduleRef.get(JobService);

    jobService.createJob.mockResolvedValue(job);
    submissionRepository.findOneByJobIdAndWorkerAddress.mockResolvedValue(null);
    submissionRepository.findOneByJobIdAndPostUrl.mockResolvedValue(null);
  });

  it('creates the service', () => {
    expect(submissionService).toBeDefined();
  });

  it('creates a submission with a normalized post URL', async () => {
    await expect(submissionService.createSubmission(webhook)).resolves.toBe(
      'Submission received.',
    );

    expect(
      submissionRepository.findOneByJobIdAndWorkerAddress,
    ).toHaveBeenCalledWith(1, workerAddress);
    expect(submissionRepository.findOneByJobIdAndPostUrl).toHaveBeenCalledWith(
      1,
      normalizedPostUrl,
    );
    expect(submissionRepository.createUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 1,
        workerAddress,
        postUrl: normalizedPostUrl,
      }),
    );
  });

  it('rejects when the worker already submitted for the job', async () => {
    submissionRepository.findOneByJobIdAndWorkerAddress.mockResolvedValue({
      id: 1,
    } as any);

    await expect(submissionService.createSubmission(webhook)).rejects.toThrow(
      ErrorJob.SolutionAlreadyExists,
    );

    expect(
      submissionRepository.findOneByJobIdAndPostUrl,
    ).not.toHaveBeenCalled();
    expect(submissionRepository.createUnique).not.toHaveBeenCalled();
  });

  it('rejects duplicate post URLs for the same job', async () => {
    submissionRepository.findOneByJobIdAndPostUrl.mockResolvedValue({
      id: 2,
    } as any);

    await expect(submissionService.createSubmission(webhook)).rejects.toThrow(
      SubmissionRejectionReason.DuplicateSubmission,
    );

    expect(submissionRepository.createUnique).not.toHaveBeenCalled();
  });
});
