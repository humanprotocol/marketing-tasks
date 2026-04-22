import { Injectable } from '@nestjs/common';
import { DataSource, LessThanOrEqual } from 'typeorm';

import { ServerConfigService } from '../../common/config/server-config.service';
import { WebhookStatus } from '../../common/enums/webhook';
import { BaseRepository } from '../../database/base.repository';

import { WebhookEntity } from './webhook.entity';

@Injectable()
export class WebhookRepository extends BaseRepository<WebhookEntity> {
  constructor(
    dataSource: DataSource,
    private readonly serverConfigService: ServerConfigService,
  ) {
    super(WebhookEntity, dataSource);
  }

  findByStatus(status: WebhookStatus): Promise<WebhookEntity[]> {
    return this.find({
      where: {
        status,
        retriesCount: LessThanOrEqual(
          this.serverConfigService.socialMediaValidationMaxRetries,
        ),
        waitUntil: LessThanOrEqual(new Date()),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }
}
