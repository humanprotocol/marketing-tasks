import { Test } from '@nestjs/testing';

import { SubmissionService } from './submission.service';
import { JobService } from '../../modules/job/job.service';
import { SubmissionRepository } from './submission.repository';
import { ValidationService } from '../validation/validation.service';
import {
  ErrorJob,
  SubmissionRejectionReason,
} from '../../common/constants/errors';
import { EventType } from '../../common/enums/webhook';
import { WebhookDto } from '../webhook/webhook.dto';

describe('SubmissionService', () => {
  let submissionService: SubmissionService;
  let submissionRepository: jest.Mocked<SubmissionRepository>;
  let jobService: jest.Mocked<JobService>;

  const webhook: WebhookDto = {
    chainId: 80002,
    escrowAddress: '0x1234567890123456789012345678901234567890',
    eventType: EventType.SUBMISSION_IN_REVIEW,
    eventData: {
      assigneeId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      postUrl: 'https://x.com/example/status/12345?utm_source=test#ignored',
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

    jobService.createJob.mockResolvedValue({ id: 1 } as any);
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
    ).toHaveBeenCalledWith(1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(submissionRepository.findOneByJobIdAndPostUrl).toHaveBeenCalledWith(
      1,
      'https://x.com/example/status/12345',
    );
    expect(submissionRepository.createUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 1,
        workerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        postUrl: 'https://x.com/example/status/12345',
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
