import { EscrowClient, EscrowStatus, EscrowUtils } from '@human-protocol/sdk';
import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

import { Web3ConfigService } from '../../common/config/web3-config.service';
import { ErrorCommon, ErrorJob } from '../../common/constants/errors';
import { JobRequestType, JobStatus } from '../../common/enums/job';
import { VerificationResult } from '../../common/enums/submission';
import { EventType, WebhookStatus } from '../../common/enums/webhook';
import { ConflictError, ValidationError } from '../../common/errors';
import { IManifest, IRecordingResult } from '../../common/interfaces/job';
import { StorageService } from '../../modules/storage/storage.service';
import { Web3Service } from '../../modules/web3/web3.service';
import { WebhookDto } from '../../modules/webhook/webhook.dto';
import { WebhookEntity } from '../../modules/webhook/webhook.entity';
import { WebhookRepository } from '../../modules/webhook/webhook.repository';

import { validateManifestDto } from './job-manifest.dto';
import { JobEntity } from './job.entity';
import { JobRepository } from './job.repository';

@Injectable()
export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly webhookRepository: WebhookRepository,
    private readonly web3Service: Web3Service,
    private readonly storageService: StorageService,
    private readonly web3ConfigService: Web3ConfigService,
  ) {}

  async createJob(chainId: number, escrowAddress: string): Promise<JobEntity> {
    const existingJob =
      await this.jobRepository.findOneByChainIdAndEscrowAddress(
        chainId,
        escrowAddress,
      );
    if (existingJob) {
      return existingJob;
    }

    const signer = this.web3Service.getSigner(chainId);
    const escrowClient = await EscrowClient.build(signer);
    const manifestUrl = await escrowClient.getManifest(escrowAddress);
    const manifest = await this.getManifest(manifestUrl);

    if (manifest.job_type !== JobRequestType.SOCIAL_MEDIA_PROMOTION) {
      throw new ValidationError(ErrorJob.InvalidJobType);
    }

    const job = new JobEntity();
    job.chainId = chainId;
    job.escrowAddress = escrowAddress;
    job.jobType = manifest.job_type;
    job.manifestUrl = manifestUrl;
    job.endDate = new Date(manifest.end_date);

    return await this.jobRepository.createUnique(job);
  }

  getJobsAfterSubmissionDeadline(): Promise<JobEntity[]> {
    return this.jobRepository.findAfterSubmissionDeadline(new Date());
  }

  async handleProcessingError(job: JobEntity): Promise<void> {
    job.retriesCount += 1;
    if (job.retriesCount >= 5) {
      job.status = JobStatus.FAILED;
    }
    await this.jobRepository.updateOne(job);
  }

  async storeResults(
    job: JobEntity,
    submissionsRequired: number,
    allResults: IRecordingResult[],
  ): Promise<void> {
    if (allResults.length === 0) {
      return;
    }

    const signer = this.web3Service.getSigner(job.chainId);
    const escrowClient = await EscrowClient.build(signer);
    const uploadedResults = await this.storageService.uploadJobSolutions(
      job.escrowAddress,
      job.chainId,
      allResults,
    );

    const escrow = await EscrowUtils.getEscrow(job.chainId, job.escrowAddress);
    if (!escrow) {
      throw new ValidationError(ErrorCommon.EscrowNotFound);
    }

    const acceptedCount = allResults.filter(
      (result) => result.verificationResult === VerificationResult.ACCEPTED,
    ).length;
    const reservedAmount =
      (escrow.totalFundedAmount / BigInt(submissionsRequired)) *
      BigInt(acceptedCount);

    await escrowClient.storeResults(
      job.escrowAddress,
      uploadedResults.url,
      uploadedResults.hash,
      reservedAmount,
      { timeoutMs: this.web3ConfigService.txTimeoutMs },
    );

    job.status = JobStatus.COMPLETED;
    await this.jobRepository.updateOne(job);
  }

  async cancelJob(webhook: WebhookDto): Promise<string> {
    const signer = this.web3Service.getSigner(webhook.chainId);
    const escrowClient = await EscrowClient.build(signer);

    const recordingOracleAddress = await escrowClient.getRecordingOracleAddress(
      webhook.escrowAddress,
    );

    if (
      ethers.getAddress(recordingOracleAddress) !== (await signer.getAddress())
    ) {
      throw new ValidationError(ErrorJob.AddressMismatches);
    }

    const escrowStatus = await escrowClient.getStatus(webhook.escrowAddress);
    if (escrowStatus !== EscrowStatus.ToCancel) {
      throw new ConflictError(ErrorJob.InvalidStatus);
    }

    const intermediateResultsURL = await escrowClient.getIntermediateResultsUrl(
      webhook.escrowAddress,
    );
    const intermediateResultsHash =
      await escrowClient.getIntermediateResultsHash(webhook.escrowAddress);

    await escrowClient.storeResults(
      webhook.escrowAddress,
      intermediateResultsURL,
      intermediateResultsHash,
      0n,
      { timeoutMs: this.web3ConfigService.txTimeoutMs },
    );

    const canceledWebhook = new WebhookEntity();
    canceledWebhook.chainId = webhook.chainId;
    canceledWebhook.escrowAddress = webhook.escrowAddress;
    canceledWebhook.eventType = EventType.JOB_CANCELED;
    canceledWebhook.status = WebhookStatus.PENDING;
    canceledWebhook.waitUntil = new Date();
    await this.webhookRepository.createUnique(canceledWebhook);

    const existingJob =
      await this.jobRepository.findOneByChainIdAndEscrowAddress(
        webhook.chainId,
        webhook.escrowAddress,
      );
    if (existingJob) {
      existingJob.status = JobStatus.COMPLETED;
      await this.jobRepository.updateOne(existingJob);
    }

    return 'Job canceled successfully.';
  }

  async getManifest(manifestUrl: string): Promise<IManifest> {
    return validateManifestDto(
      (await this.storageService.download(manifestUrl)) as IManifest,
    );
  }
}
