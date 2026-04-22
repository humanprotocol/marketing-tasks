import { Module } from '@nestjs/common';

import { JobModule } from '../../modules/job/job.module';
import { WebhookModule } from '../../modules/webhook/webhook.module';

import { CronJobRepository } from './cron-job.repository';
import { CronJobService } from './cron-job.service';
import { SubmissionModule } from '../submission/submission.module';

@Module({
  imports: [JobModule, WebhookModule, SubmissionModule],
  providers: [CronJobRepository, CronJobService],
})
export class CronJobModule {}
