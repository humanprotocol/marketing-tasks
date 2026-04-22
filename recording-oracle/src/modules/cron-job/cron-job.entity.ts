import { Column, Entity } from 'typeorm';

import { NS } from '../../common/constants';
import { BaseEntity } from '../../database/base.entity';

import { CronJobType } from './constants';

@Entity({ schema: NS, name: 'cron_jobs' })
export class CronJobEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: CronJobType,
    unique: true,
  })
  cronJobType: CronJobType;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
