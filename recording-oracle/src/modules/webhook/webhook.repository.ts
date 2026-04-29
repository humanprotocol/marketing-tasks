import { Injectable } from '@nestjs/common';
import { DataSource, LessThanOrEqual } from 'typeorm';

import { WebhookStatus } from '../../common/enums/webhook';
import { BaseRepository } from '../../database/base.repository';

import { WebhookEntity } from './webhook.entity';

@Injectable()
export class WebhookRepository extends BaseRepository<WebhookEntity> {
  constructor(dataSource: DataSource) {
    super(WebhookEntity, dataSource);
  }

  findByStatus(status: WebhookStatus): Promise<WebhookEntity[]> {
    return this.find({
      where: {
        status,
        waitUntil: LessThanOrEqual(new Date()),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }
}
