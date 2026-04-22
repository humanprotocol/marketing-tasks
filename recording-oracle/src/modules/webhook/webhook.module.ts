import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { JobModule } from '../job/job.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { SubmissionModule } from '../submission/submission.module';
import { Web3Module } from '../web3/web3.module';
import { WebhookRepository } from './webhook.repository';

@Module({
  imports: [HttpModule, JobModule, SubmissionModule, Web3Module],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookRepository],
  exports: [WebhookService],
})
export class WebhookModule {}
