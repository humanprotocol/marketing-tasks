import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { NS } from '../../common/constants';
import { BaseEntity } from '../../database/base.entity';

import { SubmissionStatus } from '../../common/enums/submission';
import { JobEntity } from '../../modules/job/job.entity';

@Entity({ schema: NS, name: 'submissions' })
@Index(['jobId', 'workerAddress'], { unique: true })
export class SubmissionEntity extends BaseEntity {
  @Column({ type: 'int' })
  jobId: number;

  @Column({ type: 'varchar' })
  workerAddress: string;

  @Column({ type: 'varchar' })
  postUrl: string;

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
  })
  status: SubmissionStatus = SubmissionStatus.PENDING;

  @Column({ type: 'varchar', nullable: true })
  reason?: string | null;

  @ManyToOne(() => JobEntity, (job) => job.submissions, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job: JobEntity;
}
