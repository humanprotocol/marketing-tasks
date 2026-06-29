import { Escrow__factory } from '@human-protocol/core/typechain-types';
import { Injectable } from '@nestjs/common';

import logger from '../../logger';
import { ServerConfigService } from '../../common/config/server-config.service';
import { ErrorAssignment, ErrorJob } from '../../common/constant/errors';
import { AssignmentStatus, JobStatus, JobType } from '../../common/enums/job';
import {
  ConflictError,
  ServerError,
  ValidationError,
} from '../../common/errors';
import { PageDto } from '../../common/pagination/pagination.dto';
import { JwtUser } from '../../common/types/jwt';
import { JobRepository } from '../job/job.repository';
import { JobService } from '../job/job.service';
import { Web3Service } from '../web3/web3.service';
import {
  AssignmentDetailsDto,
  AssignmentDto,
  CreateAssignmentDto,
  GetAssignmentsDto,
} from './assignment.dto';
import { AssignmentEntity } from './assignment.entity';
import { AssignmentRepository } from './assignment.repository';

@Injectable()
export class AssignmentService {
  private readonly logger = logger.child({ context: AssignmentService.name });

  constructor(
    private readonly assignmentRepository: AssignmentRepository,
    private readonly jobRepository: JobRepository,
    private readonly jobService: JobService,
    private readonly web3Service: Web3Service,
    private readonly serverConfigService: ServerConfigService,
  ) {}

  public async createAssignment(
    data: CreateAssignmentDto,
    jwtUser: JwtUser,
  ): Promise<AssignmentEntity> {
    const jobEntity = await this.jobRepository.findOneByChainIdAndEscrowAddress(
      data.chainId,
      data.escrowAddress,
    );

    if (!jobEntity) {
      throw new ServerError(ErrorAssignment.JobNotFound);
    } else if (jobEntity.status !== JobStatus.ACTIVE) {
      throw new ConflictError(ErrorJob.InvalidStatus);
    } else if (jobEntity.reputationNetwork !== jwtUser.reputationNetwork) {
      this.logger.warn(ErrorAssignment.ReputationNetworkMismatch, {
        chainId: data.chainId,
        escrowAddress: data.escrowAddress,
        jobEntityId: jobEntity.id,
      });
      throw new ValidationError(ErrorAssignment.ReputationNetworkMismatch);
    }

    const assignmentEntity =
      await this.assignmentRepository.findOneByJobIdAndWorker(
        jobEntity.id,
        jwtUser.address,
      );

    if (
      assignmentEntity &&
      assignmentEntity.status !== AssignmentStatus.CANCELED
    ) {
      throw new ConflictError(ErrorAssignment.AlreadyExists);
    }

    const currentAssignments = await this.assignmentRepository.countByJobId(
      jobEntity.id,
    );

    const manifest = await this.jobService.getManifest(
      data.chainId,
      data.escrowAddress,
      jobEntity.manifest,
    );

    if (currentAssignments >= manifest.submissionsRequired) {
      throw new ValidationError(ErrorAssignment.FullyAssigned);
    }

    const jobEndDate = this.parseManifestEndDate(
      this.getManifestEndDate(manifest),
    );
    const requiredLiveDurationHours =
      manifest.requestType === JobType.SOCIAL_MEDIA_PROMOTION &&
      'minLiveDurationHours' in manifest.requirements
        ? (manifest.requirements.minLiveDurationHours ?? 0)
        : 0;
    const requiredLiveDurationMs = requiredLiveDurationHours * 60 * 60 * 1000;
    if (jobEndDate.getTime() - Date.now() < requiredLiveDurationMs) {
      throw new ValidationError(
        ErrorAssignment.InsufficientTimeForLiveDuration,
      );
    }

    // Check if all required qualifications are present
    const userQualificationsSet = new Set(jwtUser.qualifications);
    const missingQualifications = manifest.qualifications?.filter(
      (qualification) => !userQualificationsSet.has(qualification),
    );
    if (missingQualifications && missingQualifications.length > 0) {
      throw new ValidationError(ErrorAssignment.InvalidAssignmentQualification);
    }

    const signer = this.web3Service.getSigner(data.chainId);
    const escrow = Escrow__factory.connect(data.escrowAddress, signer);
    const expirationDate = new Date(Number(await escrow.duration()) * 1000);
    if (expirationDate < new Date()) {
      throw new ValidationError(ErrorAssignment.ExpiredEscrow);
    }

    const rewardAmount = await this.jobService.getRewardAmount(
      data.chainId,
      data.escrowAddress,
      manifest.submissionsRequired,
    );

    // Allow reassignation when status is Canceled
    if (assignmentEntity) {
      assignmentEntity.status = AssignmentStatus.ACTIVE;
      return this.assignmentRepository.updateOne(assignmentEntity);
    }

    const newAssignmentEntity = new AssignmentEntity();
    newAssignmentEntity.job = jobEntity;
    newAssignmentEntity.workerAddress = jwtUser.address;
    newAssignmentEntity.status = AssignmentStatus.ACTIVE;
    newAssignmentEntity.rewardAmount = rewardAmount;
    newAssignmentEntity.expiresAt = expirationDate;
    return this.assignmentRepository.createUnique(newAssignmentEntity);
  }

  public async getAssignmentList(
    data: GetAssignmentsDto,
    workerAddress: string,
    reputationNetwork: string,
  ): Promise<PageDto<AssignmentDto>> {
    const { entities, itemCount } =
      await this.assignmentRepository.fetchFiltered({
        ...data,
        reputationNetwork,
        workerAddress,
        skip: data.skip!,
        pageSize: data.pageSize ?? 10,
      });
    const assignments = await Promise.all(
      entities.map(async (entity) => {
        return this.toAssignmentDto(entity);
      }),
    );
    return new PageDto(data.page!, data.pageSize!, itemCount, assignments);
  }

  public async getAssignmentDetails(
    assignmentId: number,
  ): Promise<AssignmentDetailsDto> {
    const entity = await this.assignmentRepository.findOneById(assignmentId);

    if (!entity) {
      throw new ServerError(ErrorAssignment.NotFound);
    }

    const manifest = await this.jobService.getManifest(
      entity.job.chainId,
      entity.job.escrowAddress,
      entity.job.manifest,
    );
    const assignment = this.toAssignmentDto(entity);

    return new AssignmentDetailsDto(
      assignment,
      manifest.campaign.description,
      this.parseManifestEndDate(
        this.getManifestEndDate(manifest),
      ).toISOString(),
      entity.job.manifest,
      manifest.platforms,
      this.getPublicRequirements(manifest.requirements),
    );
  }

  async resign(assignmentId: number, workerAddress: string): Promise<void> {
    const assignment =
      await this.assignmentRepository.findOneById(assignmentId);

    if (!assignment) {
      throw new ServerError(ErrorAssignment.NotFound);
    }
    if (assignment.workerAddress !== workerAddress) {
      throw new ConflictError(ErrorAssignment.InvalidAssignment);
    }

    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new ConflictError(ErrorAssignment.InvalidStatus);
    }

    assignment.status = AssignmentStatus.CANCELED;
    await this.assignmentRepository.updateOne(assignment);
  }

  private toAssignmentDto(entity: AssignmentEntity): AssignmentDto {
    const assignment = new AssignmentDto(
      entity.id.toString(),
      entity.job.escrowAddress,
      entity.job.chainId,
      entity.job.jobType,
      entity.status,
      entity.rewardAmount,
      entity.job.rewardToken,
      entity.createdAt.toISOString(),
      entity.expiresAt.toISOString(),
      entity.updatedAt.toISOString(),
    );

    if (entity.status === AssignmentStatus.ACTIVE) {
      assignment.url =
        this.serverConfigService.feURL + '/assignment/' + entity.id.toString();
    }

    return assignment;
  }

  private getPublicRequirements(requirements: object): Record<string, unknown> {
    const publicRequirements = {
      ...(requirements as Record<string, unknown>),
    };
    delete publicRequirements.xApiCredentials;

    return publicRequirements;
  }

  private getManifestEndDate(manifest: unknown): unknown {
    if (!manifest || typeof manifest !== 'object') {
      return undefined;
    }

    const manifestRecord = manifest as Record<string, unknown>;
    return manifestRecord.endDate ?? manifestRecord.end_date;
  }

  private parseManifestEndDate(endDate: unknown): Date {
    if (endDate === null || endDate === undefined) {
      throw new ValidationError(ErrorAssignment.InvalidEndDate);
    }

    if (
      typeof endDate !== 'string' &&
      typeof endDate !== 'number' &&
      !(endDate instanceof Date)
    ) {
      throw new ValidationError(ErrorAssignment.InvalidEndDate);
    }

    const timestamp =
      typeof endDate === 'string' && endDate.trim() !== ''
        ? Number(endDate)
        : endDate;
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      throw new ValidationError(ErrorAssignment.InvalidEndDate);
    }

    return date;
  }
}
