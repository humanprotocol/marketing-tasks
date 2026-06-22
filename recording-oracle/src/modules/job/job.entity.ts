import { ChainId } from '@human-protocol/sdk';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { NS } from '../../common/constants';
import { BaseEntity } from '../../database/base.entity';
import { JobRequestType, JobStatus } from '../../common/enums/job';
import { SubmissionEntity } from '../submission/submission.entity';

@Entity({ schema: NS, name: 'jobs' })
@Index(['chainId', 'escrowAddress'], { unique: true })
export class JobEntity extends BaseEntity {
  @Column({ type: 'int' })
  chainId: ChainId;

  @Column({ type: 'varchar' })
  escrowAddress: string;

  @Column({
    type: 'enum',
    enum: JobRequestType,
  })
  jobType: JobRequestType;

  @Column({ type: 'varchar' })
  manifest: string;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ type: 'int', default: 0 })
  retriesCount: number;

  @OneToMany(() => SubmissionEntity, (submission) => submission.job)
  submissions: SubmissionEntity[];
}
