import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { VerificationResult } from '../../common/enums/submission';
import { EventType } from '../../common/enums/webhook';
import { IRecordingResult } from '../../common/interfaces/job';
import { generateJob, generateManifest } from '../../modules/job/fixtures';
import { JobService } from '../../modules/job/job.service';
import { generateSubmission } from '../../modules/submission/fixtures';
import { SubmissionService } from '../../modules/submission/submission.service';
import { WebhookService } from '../../modules/webhook/webhook.service';
import { CronJobType } from './constants';
import { CronJobRepository } from './cron-job.repository';
import { CronJobService } from './cron-job.service';
import { generateCronJob } from './fixtures';

describe('CronJobService', () => {
  let cronJobService: CronJobService;
  let cronJobRepository: jest.Mocked<CronJobRepository>;
  let jobService: jest.Mocked<JobService>;
  let submissionService: jest.Mocked<SubmissionService>;
  let webhookService: jest.Mocked<WebhookService>;

  const chainId = 80002;
  const escrowAddress = faker.finance.ethereumAddress();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CronJobService,
        {
          provide: CronJobRepository,
          useValue: {
            createUnique: jest.fn(),
            findOneByType: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: JobService,
          useValue: {
            getJobsAfterSubmissionDeadline: jest.fn(),
            getManifest: jest.fn(),
            storeResults: jest.fn(),
            handleProcessingError: jest.fn(),
          },
        },
        {
          provide: SubmissionService,
          useValue: {
            processSubmissions: jest.fn(),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            createWebhook: jest.fn(),
            processPendingWebhooks: jest.fn(),
          },
        },
      ],
    }).compile();

    cronJobService = moduleRef.get(CronJobService);
    cronJobRepository = moduleRef.get(CronJobRepository);
    jobService = moduleRef.get(JobService);
    submissionService = moduleRef.get(SubmissionService);
    webhookService = moduleRef.get(WebhookService);
  });

  it('creates the service', () => {
    expect(cronJobService).toBeDefined();
  });

  describe('startCronJob', () => {
    describe('succeed', () => {
      it('creates a cron job state when none exists', async () => {
        const cronJob = generateCronJob({ completedAt: null });
        cronJobRepository.findOneByType.mockResolvedValue(null);
        cronJobRepository.createUnique.mockResolvedValue(cronJob);

        await expect(
          cronJobService.startCronJob(
            CronJobType.ProcessJobsAfterSubmissionDeadline,
          ),
        ).resolves.toBe(cronJob);

        expect(cronJobRepository.createUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            cronJobType: CronJobType.ProcessJobsAfterSubmissionDeadline,
            completedAt: null,
          }),
        );
      });

      it('restarts an existing cron job state', async () => {
        const cronJob = generateCronJob();
        cronJobRepository.findOneByType.mockResolvedValue(cronJob);
        cronJobRepository.updateOne.mockImplementation(async (value) => value);

        await cronJobService.startCronJob(
          CronJobType.ProcessJobsAfterSubmissionDeadline,
        );

        expect(cronJobRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({ completedAt: null }),
        );
      });
    });
  });

  describe('processJobsAfterSubmissionDeadline', () => {
    describe('succeed', () => {
      it('does not process jobs when the cron job is already running', async () => {
        cronJobRepository.findOneByType.mockResolvedValue(
          generateCronJob({ completedAt: null }),
        );

        await cronJobService.processJobsAfterSubmissionDeadline();

        expect(
          jobService.getJobsAfterSubmissionDeadline,
        ).not.toHaveBeenCalled();
      });

      it('processes submissions, stores results, and queues completion webhooks', async () => {
        const manifest = generateManifest({ submissionsRequired: 3 });
        const pendingSubmission = generateSubmission();
        const job = generateJob({
          chainId,
          escrowAddress,
          endDate: faker.date.past(),
          submissions: [pendingSubmission],
        });
        const processedResult: IRecordingResult = {
          workerAddress: pendingSubmission.workerAddress,
          solution: pendingSubmission.solution,
          verificationResult: VerificationResult.ACCEPTED,
        };

        cronJobRepository.findOneByType.mockResolvedValue(null);
        cronJobRepository.createUnique.mockResolvedValue(generateCronJob());
        jobService.getJobsAfterSubmissionDeadline.mockResolvedValue([job]);
        jobService.getManifest.mockResolvedValue(manifest);
        submissionService.processSubmissions.mockResolvedValue([
          processedResult,
        ]);

        await cronJobService.processJobsAfterSubmissionDeadline();

        expect(submissionService.processSubmissions).toHaveBeenCalledWith(
          job.submissions,
          manifest,
        );
        expect(jobService.storeResults).toHaveBeenCalledWith(
          job,
          manifest.submissionsRequired,
          [processedResult],
        );
        expect(webhookService.createWebhook).toHaveBeenCalledWith(
          chainId,
          escrowAddress,
          EventType.JOB_COMPLETED,
        );
        expect(cronJobRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({ completedAt: expect.any(Date) }),
        );
      });
    });

    describe('fail', () => {
      it('marks a job processing error for retry and still completes the cron job', async () => {
        const job = generateJob();

        cronJobRepository.findOneByType.mockResolvedValue(null);
        cronJobRepository.createUnique.mockResolvedValue(generateCronJob());
        jobService.getJobsAfterSubmissionDeadline.mockResolvedValue([job]);
        jobService.getManifest.mockRejectedValue(new Error('Invalid manifest'));

        await cronJobService.processJobsAfterSubmissionDeadline();

        expect(jobService.handleProcessingError).toHaveBeenCalledWith(job);
        expect(cronJobRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({ completedAt: expect.any(Date) }),
        );
      });
    });
  });

  describe('processPendingOutgoingWebhooks', () => {
    describe('succeed', () => {
      it('does not process outgoing webhooks when the cron job is already running', async () => {
        cronJobRepository.findOneByType.mockResolvedValue(
          generateCronJob({ completedAt: null }),
        );

        await cronJobService.processPendingOutgoingWebhooks();

        expect(webhookService.processPendingWebhooks).not.toHaveBeenCalled();
      });

      it('processes pending outgoing webhooks and completes the cron job', async () => {
        cronJobRepository.findOneByType.mockResolvedValue(null);
        cronJobRepository.createUnique.mockResolvedValue(
          generateCronJob({
            cronJobType: CronJobType.ProcessPendingOutgoingWebhooks,
          }),
        );

        await cronJobService.processPendingOutgoingWebhooks();

        expect(webhookService.processPendingWebhooks).toHaveBeenCalled();
        expect(cronJobRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({ completedAt: expect.any(Date) }),
        );
      });
    });
  });
});
