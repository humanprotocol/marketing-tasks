import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { JobService } from '../../modules/job/job.service';
import { generateJob } from '../../modules/job/fixtures';
import { ValidationService } from '../validation/validation.service';
import {
  ErrorJob,
  SubmissionRejectionReason,
} from '../../common/constants/errors';
import { generatePostUrl, generateSubmission } from './fixtures';
import { SubmissionRepository } from './submission.repository';
import { SubmissionService } from './submission.service';
import { EventType } from '../../common/enums/webhook';
import { JobRequestType } from '../../common/enums/job';
import { generateManifest } from '../job/fixtures';
import {
  SubmissionStatus,
  VerificationResult,
} from '../../common/enums/submission';

describe('SubmissionService', () => {
  let submissionService: SubmissionService;
  let submissionRepository: jest.Mocked<SubmissionRepository>;
  let jobService: jest.Mocked<JobService>;
  let validationService: jest.Mocked<ValidationService>;

  const job = generateJob({ id: 1 });
  const workerAddress = faker.finance.ethereumAddress();
  const normalizedPostUrl = generatePostUrl();
  const webhook = {
    chainId: job.chainId,
    eventType: EventType.SUBMISSION_IN_REVIEW,
    escrowAddress: job.escrowAddress,
    eventData: {
      assigneeId: workerAddress,
      solution: `${normalizedPostUrl}?utm_source=test#ignored`,
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
            findOneByJobIdAndSolution: jest.fn(),
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
            validateSubmissions: jest.fn(),
          },
        },
      ],
    }).compile();

    submissionService = moduleRef.get(SubmissionService);
    submissionRepository = moduleRef.get(SubmissionRepository);
    jobService = moduleRef.get(JobService);
    validationService = moduleRef.get(ValidationService);

    jobService.createJob.mockResolvedValue(job);
    submissionRepository.findOneByJobIdAndWorkerAddress.mockResolvedValue(null);
    submissionRepository.findOneByJobIdAndSolution.mockResolvedValue(null);
  });

  it('creates the service', () => {
    expect(submissionService).toBeDefined();
  });

  describe('createSubmission', () => {
    describe('succeed', () => {
      it('creates a submission with a normalized post URL', async () => {
        await expect(submissionService.createSubmission(webhook)).resolves.toBe(
          'Submission received.',
        );

        expect(
          submissionRepository.findOneByJobIdAndWorkerAddress,
        ).toHaveBeenCalledWith(1, workerAddress);
        expect(
          submissionRepository.findOneByJobIdAndSolution,
        ).toHaveBeenCalledWith(1, normalizedPostUrl);
        expect(submissionRepository.createUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            jobId: 1,
            workerAddress,
            solution: normalizedPostUrl,
          }),
        );
      });

      it('creates an engagement submission with a normalized username', async () => {
        jobService.createJob.mockResolvedValue(
          generateJob({ jobType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT }),
        );

        await expect(
          submissionService.createSubmission({
            ...webhook,
            eventData: {
              assigneeId: workerAddress,
              solution: '@HumanProtocol',
            },
          }),
        ).resolves.toBe('Submission received.');

        expect(submissionRepository.createUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            solution: 'humanprotocol',
          }),
        );
      });
    });

    describe('fail', () => {
      it('rejects when the worker already submitted for the job', async () => {
        submissionRepository.findOneByJobIdAndWorkerAddress.mockResolvedValue({
          id: 1,
        } as any);

        await expect(
          submissionService.createSubmission(webhook),
        ).rejects.toThrow(ErrorJob.SolutionAlreadyExists);

        expect(
          submissionRepository.findOneByJobIdAndSolution,
        ).not.toHaveBeenCalled();
        expect(submissionRepository.createUnique).not.toHaveBeenCalled();
      });

      it('rejects duplicate post URLs for the same job', async () => {
        submissionRepository.findOneByJobIdAndSolution.mockResolvedValue({
          id: 2,
        } as any);

        await expect(
          submissionService.createSubmission(webhook),
        ).rejects.toThrow(SubmissionRejectionReason.DuplicateSubmission);

        expect(submissionRepository.createUnique).not.toHaveBeenCalled();
      });
    });
  });

  describe('processSubmissions', () => {
    it('keeps existing results and processes promotion pending submissions individually', async () => {
      const manifest = generateManifest();
      const firstPendingSubmission = generateSubmission({
        id: 1,
        status: SubmissionStatus.PENDING,
      });
      const secondPendingSubmission = generateSubmission({
        id: 2,
        status: SubmissionStatus.PENDING,
      });
      const rejectedSubmission = generateSubmission({
        status: SubmissionStatus.REJECTED,
        reason: SubmissionRejectionReason.MissingRequiredKeyword,
      });
      validationService.validateSubmissions.mockResolvedValueOnce([
        {
          submission: firstPendingSubmission,
          rejectionReason: null,
        },
      ]);
      validationService.validateSubmissions.mockResolvedValueOnce([
        {
          submission: secondPendingSubmission,
          rejectionReason: null,
        },
      ]);

      await expect(
        submissionService.processSubmissions(
          [firstPendingSubmission, rejectedSubmission, secondPendingSubmission],
          manifest,
        ),
      ).resolves.toEqual([
        {
          workerAddress: rejectedSubmission.workerAddress,
          solution: rejectedSubmission.solution,
          verificationResult: VerificationResult.REJECTED,
          rejectionReason: rejectedSubmission.reason,
        },
        {
          workerAddress: firstPendingSubmission.workerAddress,
          solution: firstPendingSubmission.solution,
          verificationResult: VerificationResult.ACCEPTED,
        },
        {
          workerAddress: secondPendingSubmission.workerAddress,
          solution: secondPendingSubmission.solution,
          verificationResult: VerificationResult.ACCEPTED,
        },
      ]);

      expect(validationService.validateSubmissions).toHaveBeenNthCalledWith(
        1,
        [firstPendingSubmission],
        manifest,
      );
      expect(validationService.validateSubmissions).toHaveBeenNthCalledWith(
        2,
        [secondPendingSubmission],
        manifest,
      );
      expect(submissionRepository.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          id: firstPendingSubmission.id,
          status: SubmissionStatus.ACCEPTED,
          reason: null,
        }),
      );
      expect(submissionRepository.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          id: secondPendingSubmission.id,
          status: SubmissionStatus.ACCEPTED,
          reason: null,
        }),
      );
    });

    it('uses the same validation entrypoint for engagement submissions', async () => {
      const manifest = generateManifest({
        requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
        requirements: {
          targetPostUrl: normalizedPostUrl,
          checkLike: true,
        },
      });
      const submissions = [
        generateSubmission({ solution: 'alice' }),
        generateSubmission({ solution: 'bob' }),
      ];
      validationService.validateSubmissions.mockResolvedValue(
        submissions.map((submission) => ({
          submission,
          rejectionReason: null,
        })),
      );

      await expect(
        submissionService.processSubmissions(submissions, manifest),
      ).resolves.toEqual(
        submissions.map((submission) => ({
          workerAddress: submission.workerAddress,
          solution: submission.solution,
          verificationResult: VerificationResult.ACCEPTED,
        })),
      );

      expect(validationService.validateSubmissions).toHaveBeenCalledWith(
        submissions,
        manifest,
      );
    });
  });
});
