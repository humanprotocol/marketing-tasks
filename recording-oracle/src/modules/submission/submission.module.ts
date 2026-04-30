import { Module } from '@nestjs/common';
import { JobModule } from '../job/job.module';
import { SubmissionService } from './submission.service';
import { SubmissionRepository } from './submission.repository';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [JobModule, ValidationModule],
  providers: [SubmissionService, SubmissionRepository],
  exports: [SubmissionService],
})
export class SubmissionModule {}
