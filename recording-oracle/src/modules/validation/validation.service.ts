import { Injectable } from '@nestjs/common';

import { SubmissionRejectionReason } from '../../common/constants/errors';
import {
  ISocialMediaEngagementManifest,
  ISocialMediaPromotionManifest,
} from '../../common/interfaces/job';
import type { SubmissionEntity } from '../submission/submission.entity';
import { GrokService } from './grok/grok.service';
import { XApiService } from './x-api/x-api.service';

export type SubmissionValidationResult = {
  submission: SubmissionEntity;
  rejectionReason: SubmissionRejectionReason | null;
};

@Injectable()
export class ValidationService {
  constructor(
    private readonly grokService: GrokService,
    private readonly xApiService: XApiService,
  ) {}

  validatePromotionSubmission(
    submission: SubmissionEntity,
    manifest: ISocialMediaPromotionManifest,
  ): Promise<SubmissionValidationResult> {
    return this.grokService.validateSubmission(submission, manifest);
  }

  validateEngagementSubmissions(
    submissions: SubmissionEntity[],
    manifest: ISocialMediaEngagementManifest,
  ): Promise<SubmissionValidationResult[]> {
    return this.xApiService.validateSubmissions(submissions, manifest);
  }
}
