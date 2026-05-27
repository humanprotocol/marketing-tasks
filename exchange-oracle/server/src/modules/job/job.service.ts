import {
  HMToken,
  HMToken__factory,
} from '@human-protocol/core/typechain-types';
import {
  Encryption,
  EncryptionUtils,
  EscrowClient,
  EscrowUtils,
} from '@human-protocol/sdk';
import { Inject, Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

import { PGPConfigService } from '../../common/config/pgp-config.service';
import {
  ErrorAssignment,
  ErrorJob,
  ErrorWebhook,
} from '../../common/constant/errors';
import { SortDirection } from '../../common/enums/collection';
import {
  AssignmentStatus,
  JobFieldName,
  JobSortField,
  JobStatus,
  JobType,
} from '../../common/enums/job';
import { EventType } from '../../common/enums/webhook';
import { ConflictError, NotFoundError, ServerError } from '../../common/errors';
import { PageDto } from '../../common/pagination/pagination.dto';
import { formatAxiosError } from '../../common/utils/http';
import { downloadFileFromUrl } from '../../common/utils/storage';
import { AssignmentEntity } from '../assignment/assignment.entity';
import { AssignmentRepository } from '../assignment/assignment.repository';
import { Web3Service } from '../web3/web3.service';
import { RejectionEventData, WebhookDto } from '../webhook/webhook.dto';
import { WebhookService } from '../webhook/webhook.service';
import { GetJobsDto, JobDto, ManifestDto } from './job.dto';
import { JobEntity } from './job.entity';
import { JobRepository } from './job.repository';

@Injectable()
export class JobService {
  constructor(
    private readonly pgpConfigService: PGPConfigService,
    public readonly jobRepository: JobRepository,
    public readonly assignmentRepository: AssignmentRepository,
    @Inject(Web3Service)
    private readonly web3Service: Web3Service,
    private readonly webhookService: WebhookService,
  ) {}

  public async createJob(webhook: WebhookDto): Promise<void> {
    const { chainId, escrowAddress } = webhook;
    const jobEntity = await this.jobRepository.findOneByChainIdAndEscrowAddress(
      chainId,
      escrowAddress,
    );

    if (jobEntity) {
      throw new ConflictError(ErrorJob.AlreadyExists);
    }

    const signer = this.web3Service.getSigner(chainId);
    const escrowClient = await EscrowClient.build(signer);
    const reputationOracleAddress =
      await escrowClient.getReputationOracleAddress(escrowAddress);

    const tokenAddress = await escrowClient.getTokenAddress(escrowAddress);
    const tokenContract: HMToken = HMToken__factory.connect(
      tokenAddress,
      signer,
    );

    const newJobEntity = new JobEntity();
    newJobEntity.escrowAddress = escrowAddress;
    newJobEntity.manifestUrl = await escrowClient.getManifest(escrowAddress);
    newJobEntity.chainId = chainId;
    newJobEntity.rewardToken = await tokenContract.symbol();
    newJobEntity.status = JobStatus.ACTIVE;
    newJobEntity.reputationNetwork = reputationOracleAddress;
    await this.jobRepository.createUnique(newJobEntity);
  }

  public async completeJob(webhook: WebhookDto): Promise<void> {
    const { chainId, escrowAddress } = webhook;

    const jobEntity =
      await this.jobRepository.findOneByChainIdAndEscrowAddressWithAssignments(
        chainId,
        escrowAddress,
      );

    if (!jobEntity) {
      throw new ServerError(ErrorJob.NotFound);
    }

    if (jobEntity.status === JobStatus.COMPLETED) {
      throw new ConflictError(ErrorJob.AlreadyCompleted);
    }

    jobEntity.status = JobStatus.COMPLETED;
    jobEntity.assignments.forEach((assignment: AssignmentEntity) => {
      assignment.status = AssignmentStatus.COMPLETED;
    });

    await this.jobRepository.save(jobEntity);
  }

  public async cancelJob(webhook: WebhookDto): Promise<void> {
    const { chainId, escrowAddress } = webhook;

    const jobEntity =
      await this.jobRepository.findOneByChainIdAndEscrowAddressWithAssignments(
        chainId,
        escrowAddress,
      );

    if (!jobEntity) {
      throw new ServerError(ErrorJob.NotFound);
    }

    if (jobEntity.status === JobStatus.CANCELED) {
      throw new ConflictError(ErrorJob.AlreadyCanceled);
    }

    jobEntity.status = JobStatus.CANCELED;
    jobEntity.assignments.forEach((assignment: AssignmentEntity) => {
      assignment.status = AssignmentStatus.CANCELED;
    });

    await this.jobRepository.save(jobEntity);
  }

  public async getJobList(
    data: GetJobsDto,
    reputationNetwork: string,
  ): Promise<PageDto<JobDto>> {
    if (data.jobType && data.jobType !== JobType.SOCIAL_MEDIA_PROMOTION)
      return new PageDto(data.page!, data.pageSize!, 0, []);

    const { entities, itemCount } = await this.jobRepository.fetchFiltered({
      ...data,
      pageSize: data.pageSize!,
      skip: data.skip!,
      reputationNetwork,
    });
    const jobs = await Promise.all(
      entities.map(async (entity) => {
        const job = new JobDto(
          entity.escrowAddress,
          entity.chainId,
          JobType.SOCIAL_MEDIA_PROMOTION,
          entity.status,
        );

        if (data.fields?.includes(JobFieldName.CreatedAt)) {
          job.createdAt = entity.createdAt.toISOString();
        }
        if (data.fields?.includes(JobFieldName.UpdatedAt)) {
          job.updatedAt = entity.updatedAt.toISOString();
        }
        if (
          data.fields?.includes(JobFieldName.JobDescription) ||
          data.fields?.includes(JobFieldName.RewardAmount) ||
          data.fields?.includes(JobFieldName.RewardToken) ||
          data.fields?.includes(JobFieldName.Qualifications) ||
          data.sortField === JobSortField.REWARD_AMOUNT
        ) {
          const manifest = await this.getManifest(
            entity.chainId,
            entity.escrowAddress,
            entity.manifestUrl,
          );
          if (data.fields?.includes(JobFieldName.JobDescription)) {
            job.jobDescription = manifest.campaign.description;
          }
          if (
            data.fields?.includes(JobFieldName.RewardAmount) ||
            data.sortField === JobSortField.REWARD_AMOUNT
          ) {
            job.rewardAmount = (
              await this.getRewardAmount(
                entity.chainId,
                entity.escrowAddress,
                manifest.submissionsRequired,
              )
            ).toString();
          }
          if (data.fields?.includes(JobFieldName.RewardToken)) {
            job.rewardToken = entity.rewardToken;
          }
          if (data.fields?.includes(JobFieldName.Qualifications)) {
            job.qualifications = manifest.qualifications;
          }
        }

        return job;
      }),
    );

    if (data.sortField === JobSortField.REWARD_AMOUNT) {
      jobs.sort((a, b) => {
        const rewardA = Number(a.rewardAmount ?? 0);
        const rewardB = Number(b.rewardAmount ?? 0);
        if (data.sort === SortDirection.DESC) {
          return rewardB - rewardA;
        } else {
          return rewardA - rewardB;
        }
      });
    }

    return new PageDto(data.page!, data.pageSize!, itemCount, jobs);
  }

  public async solveJob(assignmentId: number, postUrl: string): Promise<void> {
    const assignment =
      await this.assignmentRepository.findOneById(assignmentId);
    if (!assignment) {
      throw new ServerError(ErrorAssignment.NotFound);
    }

    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new ConflictError(ErrorAssignment.InvalidStatus);
    } else if (assignment.job.status !== JobStatus.ACTIVE) {
      throw new ConflictError(ErrorJob.InvalidStatus);
    }

    try {
      await this.webhookService.sendWebhook({
        chainId: assignment.job.chainId,
        escrowAddress: assignment.job.escrowAddress,
        eventType: EventType.SUBMISSION_IN_REVIEW,
        eventData: {
          assigneeId: assignment.workerAddress,
          postUrl: postUrl,
        },
      });
    } catch (error) {
      const formattedError = formatAxiosError(error as any);
      const userMessage =
        (error as any).responseMessage ?? ErrorWebhook.SubmissionForwardFailed;
      throw new ServerError(userMessage, formattedError.stack);
    }

    assignment.status = AssignmentStatus.VALIDATION;
    await this.assignmentRepository.updateOne(assignment);
  }

  public async processInvalidJobSolution(
    invalidJobSolution: WebhookDto,
  ): Promise<void> {
    if (!invalidJobSolution.eventData) {
      return;
    }

    const rejectionEventData =
      invalidJobSolution.eventData as RejectionEventData;
    const assignments = rejectionEventData.assignments ?? [];

    for (const invalidSolution of assignments) {
      const assignment =
        await this.assignmentRepository.findOneByEscrowAndWorker(
          invalidJobSolution.escrowAddress,
          invalidJobSolution.chainId,
          invalidSolution.assigneeId,
        );

      if (!assignment) {
        throw new ServerError(
          `Solution not found in Escrow: ${invalidJobSolution.escrowAddress}`,
        );
      }

      assignment.status = AssignmentStatus.REJECTED;
      await this.assignmentRepository.updateOne(assignment);
    }
  }

  public async getManifest(
    chainId: number,
    escrowAddress: string,
    manifestUrl: string,
  ): Promise<ManifestDto> {
    let manifest: ManifestDto | null = null;

    try {
      const manifestEncrypted = await downloadFileFromUrl(manifestUrl);

      if (
        typeof manifestEncrypted === 'string' &&
        EncryptionUtils.isEncrypted(manifestEncrypted)
      ) {
        const encryption = await Encryption.build(
          this.pgpConfigService.privateKey!,
          this.pgpConfigService.passphrase,
        );
        const decryptedData = await encryption.decrypt(manifestEncrypted);
        manifest = JSON.parse(Buffer.from(decryptedData).toString());
      } else {
        manifest =
          typeof manifestEncrypted === 'string'
            ? JSON.parse(manifestEncrypted)
            : manifestEncrypted;
      }
    } catch {
      manifest = null;
    }

    if (!manifest) {
      await this.webhookService.sendWebhook({
        chainId,
        escrowAddress,
        eventType: EventType.ESCROW_FAILED,
        eventData: { reason: ErrorJob.ManifestNotFound },
      });
      throw new NotFoundError(ErrorJob.ManifestNotFound);
    }

    return manifest;
  }

  public async getRewardAmount(
    chainId: number,
    escrowAddress: string,
    submissionsRequired: number,
  ): Promise<number> {
    const escrow = await EscrowUtils.getEscrow(chainId, escrowAddress);
    if (!escrow) {
      throw new NotFoundError(ErrorJob.NotFound);
    }

    const decimals = await HMToken__factory.connect(
      escrow.token,
      this.web3Service.getSigner(chainId),
    ).decimals();

    const netFundAmount = [
      escrow.recordingOracleFee,
      escrow.reputationOracleFee,
      escrow.exchangeOracleFee,
    ].reduce(
      (amount, fee) =>
        amount - (escrow.totalFundedAmount * BigInt(fee ?? 0)) / 100n,
      escrow.totalFundedAmount,
    );

    return (
      Number(ethers.formatUnits(netFundAmount, decimals)) / submissionsRequired
    );
  }
}
