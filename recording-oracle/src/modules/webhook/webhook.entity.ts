import { ChainId } from '@human-protocol/sdk';
import { Column, Entity } from 'typeorm';
import { NS } from '../../common/constants';
import { EventType, WebhookStatus } from '../../common/enums/webhook';
import { BaseEntity } from '../../database/base.entity';

@Entity({ schema: NS, name: 'webhooks' })
export class WebhookEntity extends BaseEntity {
  @Column({ type: 'int' })
  chainId: ChainId;

  @Column({ type: 'varchar' })
  escrowAddress: string;

  @Column({
    type: 'enum',
    enum: EventType,
  })
  eventType: EventType;

  @Column({ type: 'jsonb', nullable: true })
  eventData?: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
  })
  status: WebhookStatus = WebhookStatus.PENDING;

  @Column({ type: 'int' })
  retriesCount = 0;

  @Column({ type: 'timestamptz' })
  waitUntil: Date = new Date();

  @Column({ type: 'varchar', nullable: true })
  failureDetail?: string | null;
}
