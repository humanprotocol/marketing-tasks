import { Injectable } from '@nestjs/common';
import { DataSource, LessThanOrEqual } from 'typeorm';

import { BaseRepository } from '../../database/base.repository';
import { JobStatus } from '../../common/enums/job';

import { JobEntity } from './job.entity';

@Injectable()
export class JobRepository extends BaseRepository<JobEntity> {
  constructor(dataSource: DataSource) {
    super(JobEntity, dataSource);
  }

  findOneByChainIdAndEscrowAddress(
    chainId: number,
    escrowAddress: string,
  ): Promise<JobEntity | null> {
    return this.findOne({
      where: {
        chainId,
        escrowAddress,
      },
    });
  }

  findAfterSubmissionDeadline(now: Date): Promise<JobEntity[]> {
    return this.find({
      where: {
        endDate: LessThanOrEqual(now),
        status: JobStatus.PENDING,
      },
      relations: {
        submissions: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }
}
