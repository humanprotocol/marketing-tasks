import { Module } from '@nestjs/common';

import { StorageModule } from '../../modules/storage/storage.module';
import { Web3Module } from '../../modules/web3/web3.module';
import { WebhookRepository } from '../../modules/webhook/webhook.repository';

import { JobRepository } from './job.repository';
import { JobService } from './job.service';

@Module({
  imports: [StorageModule, Web3Module],
  providers: [JobService, JobRepository, WebhookRepository],
  exports: [JobService, JobRepository],
})
export class JobModule {}
