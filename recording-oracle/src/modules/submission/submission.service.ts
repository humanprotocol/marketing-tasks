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
import { JobRequestType } from '../../common/enums/job';
import { ValidationError } from '../../common/errors';
import {
  IManifest,
  IRecordingResult,
  ISocialMediaEngagementManifest,
  ISocialMediaPromotionManifest,
} from '../../common/interfaces/job';
import { JobService } from '../../modules/job/job.service';
import {
  SubmissionValidationResult,
  ValidationService,
} from '../validation/validation.service';
import {
  SubmissionEventData,
  WebhookDto,
} from '../../modules/webhook/webhook.dto';

import { SubmissionEntity } from './submission.entity';
import { SubmissionRepository } from './submission.repository';

@Injectable()
export class SubmissionService {
  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly jobService: JobService,
    private readonly validationService: ValidationService,
  ) {}

  async createSubmission(webhook: WebhookDto): Promise<string> {
    const job = await this.jobService.createJob(
      webhook.chainId,
      webhook.escrowAddress,
    );
    const submissionEventData = webhook.eventData as
      | SubmissionEventData
      | undefined;

    if (submissionEventData?.assigneeId && submissionEventData?.solution) {
      await this.saveSubmission(
        job.id,
        job.jobType,
        submissionEventData.assigneeId,
        submissionEventData.solution,
      );
      return 'Submission received.';
    }

    throw new ValidationError(ErrorSubmission.MissingSubmissionData);
  }

  async processSubmissions(
    submissions: SubmissionEntity[],
    manifest: IManifest,
  ): Promise<IRecordingResult[]> {
    const allResults: IRecordingResult[] = [];
    const pendingSubmissions: SubmissionEntity[] = [];

    for (const submission of submissions) {
      if (submission.status === SubmissionStatus.PENDING) {
        pendingSubmissions.push(submission);
        continue;
      }

      const existingResult = this.getProcessedSubmissionResult(submission);
      if (existingResult) {
        allResults.push(existingResult);
      }
    }

    if (pendingSubmissions.length === 0) {
      return allResults;
    }

    if (manifest.requestType === JobRequestType.SOCIAL_MEDIA_PROMOTION) {
      for (const submission of pendingSubmissions) {
        try {
          const validationResult =
            await this.validationService.validatePromotionSubmission(
              submission,
              manifest as ISocialMediaPromotionManifest,
            );
          allResults.push(await this.recordValidationResult(validationResult));
        } catch (error) {
          await this.handleFailedSubmission(submission, error);
        }
      }

      return allResults;
    }

    try {
      const validationResults =
        await this.validationService.validateEngagementSubmissions(
          pendingSubmissions,
          manifest as ISocialMediaEngagementManifest,
        );

      for (const validationResult of validationResults) {
        allResults.push(await this.recordValidationResult(validationResult));
      }

      return allResults;
    } catch (error) {
      for (const submission of pendingSubmissions) {
        await this.handleFailedSubmission(submission, error);
      }

      throw error;
    }
  }

  private async saveSubmission(
    jobId: number,
    jobType: JobRequestType,
    workerAddress: string,
    solution: string,
  ): Promise<void> {
    const normalizedSolution =
      jobType === JobRequestType.SOCIAL_MEDIA_ENGAGEMENT
        ? this.validateXUsername(solution)
        : this.validatePostUrl(solution);
    const existingSubmission =
      await this.submissionRepository.findOneByJobIdAndWorkerAddress(
        jobId,
        workerAddress,
      );

    if (existingSubmission) {
      throw new ValidationError(ErrorJob.SolutionAlreadyExists);
    }

    const existingSolutionSubmission =
      await this.submissionRepository.findOneByJobIdAndSolution(
        jobId,
        normalizedSolution,
      );

    if (existingSolutionSubmission) {
      throw new ValidationError(SubmissionRejectionReason.DuplicateSubmission);
    }

    const submission = new SubmissionEntity();
    submission.jobId = jobId;
    submission.workerAddress = workerAddress;
    submission.solution = normalizedSolution;
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

  private validateXUsername(username: string): string {
    const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{1,15}$/.test(normalizedUsername)) {
      throw new ValidationError(ErrorJob.InvalidXUsername);
    }

    return normalizedUsername;
  }

  private async recordValidationResult(
    validationResult: SubmissionValidationResult,
  ): Promise<IRecordingResult> {
    const { submission, rejectionReason } = validationResult;
    const verificationResult = rejectionReason
      ? VerificationResult.REJECTED
      : VerificationResult.ACCEPTED;

    submission.status =
      verificationResult === VerificationResult.ACCEPTED
        ? SubmissionStatus.ACCEPTED
        : SubmissionStatus.REJECTED;
    submission.reason = rejectionReason;
    await this.submissionRepository.updateOne(submission);

    return {
      workerAddress: submission.workerAddress,
      solution: submission.solution,
      verificationResult,
      ...(rejectionReason ? { rejectionReason } : {}),
    };
  }

  private async handleFailedSubmission(
    submission: SubmissionEntity,
    error: unknown,
  ): Promise<void> {
    submission.status = SubmissionStatus.FAILED;
    submission.reason =
      error instanceof Error
        ? error.message
        : ErrorSubmission.UnknownSubmissionError;
    await this.submissionRepository.updateOne(submission);
  }

  private getProcessedSubmissionResult(
    submission: SubmissionEntity,
  ): IRecordingResult | null {
    switch (submission.status) {
      case SubmissionStatus.ACCEPTED:
        return {
          workerAddress: submission.workerAddress,
          solution: submission.solution,
          verificationResult: VerificationResult.ACCEPTED,
        };
      case SubmissionStatus.REJECTED:
        return {
          workerAddress: submission.workerAddress,
          solution: submission.solution,
          verificationResult: VerificationResult.REJECTED,
          rejectionReason: submission.reason ?? undefined,
        };
      default:
        return null;
    }
  }
}
