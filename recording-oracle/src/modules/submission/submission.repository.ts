import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BaseRepository } from '../../database/base.repository';

import { SubmissionStatus } from '../../common/enums/submission';

import { SubmissionEntity } from './submission.entity';

@Injectable()
export class SubmissionRepository extends BaseRepository<SubmissionEntity> {
  constructor(dataSource: DataSource) {
    super(SubmissionEntity, dataSource);
  }

  findOneByJobIdAndWorkerAddress(
    jobId: number,
    workerAddress: string,
  ): Promise<SubmissionEntity | null> {
    return this.findOne({
      where: {
        jobId,
        workerAddress,
      },
    });
  }

  findOneByJobIdAndSolution(
    jobId: number,
    solution: string,
  ): Promise<SubmissionEntity | null> {
    return this.findOne({
      where: {
        jobId,
        solution,
      },
    });
  }

  findPendingForJob(jobId: number): Promise<SubmissionEntity[]> {
    return this.find({
      where: {
        jobId,
        status: SubmissionStatus.PENDING,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  countOpenForJob(jobId: number): Promise<number> {
    return this.count({
      where: {
        jobId,
        status: SubmissionStatus.PENDING,
      },
    });
  }
}
