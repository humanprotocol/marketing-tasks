import { Module } from '@nestjs/common';
import { JobModule } from '../job/job.module';
import { SubmissionService } from './submission.service';
import { StorageModule } from '../storage/storage.module';
import { SubmissionRepository } from './submission.repository';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [JobModule, StorageModule, ValidationModule],
  providers: [SubmissionService, SubmissionRepository],
  exports: [SubmissionService],
})
export class SubmissionModule {}
