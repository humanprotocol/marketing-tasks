import { Module } from '@nestjs/common';
import { JobModule } from '../job/job.module';
import { SubmissionService } from './submission.service';
import { StorageModule } from '../storage/storage.module';
import { SubmissionRepository } from './submission.repository';
import { GrokModule } from '../grok/grok.module';

@Module({
  imports: [JobModule, StorageModule, GrokModule],
  providers: [SubmissionService, SubmissionRepository],
  exports: [SubmissionService],
})
export class SubmissionModule {}
