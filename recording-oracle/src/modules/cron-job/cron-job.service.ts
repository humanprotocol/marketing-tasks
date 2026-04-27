import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { EventType } from '../../common/enums/webhook';
import { IRecordingResult } from '../../common/interfaces/job';
import logger from '../../logger';
import { JobService } from '../../modules/job/job.service';
import { SubmissionService } from '../../modules/submission/submission.service';
import { WebhookService } from '../../modules/webhook/webhook.service';

import { CronJobType } from './constants';
import { CronJobEntity } from './cron-job.entity';
import { CronJobRepository } from './cron-job.repository';
import { SubmissionStatus } from '../../common/enums/submission';

@Injectable()
export class CronJobService {
  private readonly logger = logger.child({ context: CronJobService.name });

  constructor(
    private readonly cronJobRepository: CronJobRepository,
    private readonly jobService: JobService,
    private readonly submissionService: SubmissionService,
    private readonly webhookService: WebhookService,
  ) {}

  async startCronJob(cronJobType: CronJobType): Promise<CronJobEntity> {
    const existingCronJob =
      await this.cronJobRepository.findOneByType(cronJobType);

    if (!existingCronJob) {
      const cronJob = new CronJobEntity();
      cronJob.cronJobType = cronJobType;
      cronJob.startedAt = new Date();
      cronJob.completedAt = null;
      return this.cronJobRepository.createUnique(cronJob);
    }

    existingCronJob.startedAt = new Date();
    existingCronJob.completedAt = null;
    return this.cronJobRepository.updateOne(existingCronJob);
  }

  async completeCronJob(cronJob: CronJobEntity): Promise<void> {
    cronJob.completedAt = new Date();
    await this.cronJobRepository.updateOne(cronJob);
  }

  async isCronJobRunning(cronJobType: CronJobType): Promise<boolean> {
    const cronJob = await this.cronJobRepository.findOneByType(cronJobType);
    return Boolean(cronJob && !cronJob.completedAt);
  }

  @Cron('*/2 * * * *')
  async processJobsAfterSubmissionDeadline(): Promise<void> {
    if (
      await this.isCronJobRunning(
        CronJobType.ProcessJobsAfterSubmissionDeadline,
      )
    ) {
      return;
    }

    const cronJob = await this.startCronJob(
      CronJobType.ProcessJobsAfterSubmissionDeadline,
    );

    try {
      const jobs = await this.jobService.getJobsAfterSubmissionDeadline();

      for (const job of jobs) {
        try {
          const manifest = await this.jobService.getManifest(job.manifestUrl);
          const existingResults: IRecordingResult[] = [];
          const allResults = [...existingResults];

          for (const submission of job.submissions ?? []) {
            if (submission.status !== SubmissionStatus.PENDING) {
              continue;
            }

            const result = await this.submissionService.processSubmission(
              submission,
              manifest,
            );
            allResults.push(result);
          }

          await this.jobService.storeResults(
            job,
            manifest.submissions_required,
            allResults,
          );
          await this.webhookService.createWebhook(
            job.chainId,
            job.escrowAddress,
            EventType.JOB_COMPLETED,
          );
        } catch (error) {
          this.logger.error(
            'Error processing job after submission deadline',
            error,
          );
          await this.jobService.handleProcessingError(job);
        }
      }
    } catch (error) {
      this.logger.error(
        'Error processing jobs after submission deadline',
        error,
      );
    }

    await this.completeCronJob(cronJob);
  }

  @Cron('*/2 * * * *')
  async processPendingOutgoingWebhooks(): Promise<void> {
    if (
      await this.isCronJobRunning(CronJobType.ProcessPendingOutgoingWebhooks)
    ) {
      return;
    }

    const cronJob = await this.startCronJob(
      CronJobType.ProcessPendingOutgoingWebhooks,
    );

    try {
      await this.webhookService.processPendingWebhooks();
    } catch (error) {
      this.logger.error('Error processing pending outgoing webhooks', error);
    }

    await this.completeCronJob(cronJob);
  }
}
