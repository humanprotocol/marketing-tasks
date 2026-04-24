import { Injectable } from '@nestjs/common';
import {
  ErrorJob,
  ErrorSubmission,
  SubmissionRejectionReason,
} from '../../common/constants/errors';
import {
  SubmissionStatus,
  VerificationResult,
} from '../../common/enums/submission';
import { ValidationError } from '../../common/errors';
import {
  IExchangeSolution,
  IGrokValidationResult,
  IManifest,
  IRecordingResult,
} from '../../common/interfaces/job';
import { GrokService } from '../../modules/grok/grok.service';
import { JobService } from '../../modules/job/job.service';
import { StorageService } from '../../modules/storage/storage.service';
import {
  SolutionEventData,
  SubmissionEventData,
  WebhookDto,
} from '../../modules/webhook/webhook.dto';

import {
  ABUSE_PRIORITY,
  SUBMISSION_VALIDATION_RULES,
} from './submission.constants';
import { SubmissionEntity } from './submission.entity';
import { SubmissionRepository } from './submission.repository';

@Injectable()
export class SubmissionService {
  constructor(
    private readonly storageService: StorageService,
    private readonly submissionRepository: SubmissionRepository,
    private readonly jobService: JobService,
    private readonly grokService: GrokService,
  ) {}

  async createSubmission(webhook: WebhookDto): Promise<string> {
    const job = await this.jobService.createJob(
      webhook.chainId,
      webhook.escrowAddress,
    );
    const solutionsUrl = (webhook.eventData as SolutionEventData | undefined)
      ?.solutionsUrl;
    const submissionEventData = webhook.eventData as
      | SubmissionEventData
      | undefined;

    if (submissionEventData?.assigneeId && submissionEventData?.postUrl) {
      await this.saveSubmission(
        job.id,
        submissionEventData.assigneeId,
        submissionEventData.postUrl,
      );
      return 'Submission received.';
    }

    if (solutionsUrl) {
      const payload = await this.storageService.download(solutionsUrl);
      const exchangeSolutions = Array.isArray(payload?.solutions)
        ? (payload.solutions as IExchangeSolution[])
        : Array.isArray(payload)
          ? (payload as IExchangeSolution[])
          : [];

      for (const solution of exchangeSolutions) {
        if (solution.error) {
          continue;
        }

        await this.saveSubmission(
          job.id,
          solution.workerAddress,
          solution.postUrl,
        );
      }

      return 'Submissions received.';
    }

    throw new ValidationError(ErrorSubmission.MissingSubmissionData);
  }

  async processSubmission(
    submission: SubmissionEntity,
    manifest: IManifest,
  ): Promise<IRecordingResult> {
    try {
      let finalResult: IRecordingResult;

      const validation = await this.grokService.validatePost(
        submission.postUrl,
        manifest,
      );

      if (!validation) {
        finalResult = {
          workerAddress: submission.workerAddress,
          postUrl: submission.postUrl,
          verificationResult: VerificationResult.REJECTED,
          rejectionReason: SubmissionRejectionReason.InvalidPostValidation,
        };
      } else {
        const rejectionReason = this.getRejectionReason(validation, manifest);

        if (rejectionReason) {
          finalResult = {
            workerAddress: submission.workerAddress,
            postUrl: submission.postUrl,
            verificationResult: VerificationResult.REJECTED,
            rejectionReason,
          };
        } else {
          finalResult = {
            workerAddress: submission.workerAddress,
            postUrl: submission.postUrl,
            verificationResult: VerificationResult.ACCEPTED,
          };
        }
      }

      submission.status =
        finalResult.verificationResult === VerificationResult.ACCEPTED
          ? SubmissionStatus.ACCEPTED
          : SubmissionStatus.REJECTED;
      submission.reason = finalResult.rejectionReason ?? null;
      await this.submissionRepository.updateOne(submission);

      return finalResult;
    } catch (error) {
      submission.status = SubmissionStatus.FAILED;
      submission.reason =
        error instanceof Error
          ? error.message
          : ErrorSubmission.UnknownSubmissionError;
      await this.submissionRepository.updateOne(submission);
      throw error;
    }
  }

  private async saveSubmission(
    jobId: number,
    workerAddress: string,
    postUrl: string,
  ): Promise<void> {
    const normalizedPostUrl = this.validatePostUrl(postUrl);
    const existingSubmission =
      await this.submissionRepository.findOneForSubmission(
        jobId,
        workerAddress,
        normalizedPostUrl,
      );

    if (existingSubmission) {
      throw new ValidationError(ErrorJob.SolutionAlreadyExists);
    }

    const submission = new SubmissionEntity();
    submission.jobId = jobId;
    submission.workerAddress = workerAddress;
    submission.postUrl = normalizedPostUrl;
    submission.status = SubmissionStatus.PENDING;
    await this.submissionRepository.createUnique(submission);
  }

  private validatePostUrl(postUrl: string): string {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(postUrl);
    } catch {
      throw new ValidationError(ErrorJob.InvalidPostUrl);
    }

    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'x.com') {
      throw new ValidationError(ErrorJob.InvalidPostUrl);
    }

    const path = parsedUrl.pathname.replace(/\/+$/, '');
    if (!/^\/[^/]+\/status\/\d+$/.test(path)) {
      throw new ValidationError(ErrorJob.InvalidPostUrl);
    }

    parsedUrl.search = '';
    parsedUrl.hash = '';
    parsedUrl.pathname = path;

    return parsedUrl.toString();
  }

  private getRejectionReason(
    validation: IGrokValidationResult,
    manifest: IManifest,
  ): SubmissionRejectionReason | null {
    for (const rule of SUBMISSION_VALIDATION_RULES) {
      if (!rule.isValid(validation, manifest)) {
        return rule.rejectionReason;
      }
    }

    if (
      ABUSE_PRIORITY[validation.overallBotProbability] >
      ABUSE_PRIORITY[manifest.ai_validation.allowed_abuse_probability]
    ) {
      return SubmissionRejectionReason.AbuseProbabilityTooHigh;
    }

    return null;
  }
}
