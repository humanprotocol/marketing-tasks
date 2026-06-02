import { Injectable } from '@nestjs/common';

import {
  ErrorJob,
  SubmissionRejectionReason,
} from '../../common/constants/errors';
import { JobRequestType } from '../../common/enums/job';
import { ValidationError } from '../../common/errors';
import { IManifest } from '../../common/interfaces/job';
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

  async validateSubmissions(
    submissions: SubmissionEntity[],
    manifest: IManifest,
  ): Promise<SubmissionValidationResult[]> {
    switch (manifest.requestType) {
      case JobRequestType.SOCIAL_MEDIA_PROMOTION:
        return this.grokService.validateSubmissions(submissions, manifest);
      case JobRequestType.SOCIAL_MEDIA_ENGAGEMENT:
        return this.xApiService.validateSubmissions(submissions, manifest);
      default:
        throw new ValidationError(ErrorJob.InvalidJobType);
    }
  }
}
