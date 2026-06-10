import { Injectable } from '@nestjs/common';

import {
  ErrorJob,
  SubmissionRejectionReason,
} from '../../common/constants/errors';
import { ValidationError } from '../../common/errors';
import {
  ISocialMediaEngagementManifest,
  ISocialMediaPromotionManifest,
} from '../../common/interfaces/job';
import type { SubmissionEntity } from '../submission/submission.entity';
import { GrokService } from './grok/grok.service';
import { LinkdapiService } from './linkdapi/linkdapi.service';
import { XApiService } from './x-api/x-api.service';

export type SubmissionValidationResult = {
  submission: SubmissionEntity;
  rejectionReason: SubmissionRejectionReason | null;
};

@Injectable()
export class ValidationService {
  constructor(
    private readonly grokService: GrokService,
    private readonly linkdapiService: LinkdapiService,
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
    const platform = this.getEngagementPlatform(manifest);

    switch (platform) {
      case 'linkedin':
        return this.linkdapiService.validateSubmissions(submissions, manifest);
      case 'x':
        return this.xApiService.validateSubmissions(submissions, manifest);
      default:
        throw new ValidationError(ErrorJob.UnsupportedSocialPlatform);
    }
  }

  private getEngagementPlatform(
    manifest: ISocialMediaEngagementManifest,
  ): string {
    return manifest.platforms[0]?.toLowerCase() ?? '';
  }
}
