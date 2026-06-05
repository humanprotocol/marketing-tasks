import { faker } from '@faker-js/faker';

import { EventType, WebhookStatus } from '../../../common/enums/webhook';
import { WebhookDto } from '../webhook.dto';
import { WebhookEntity } from '../webhook.entity';

export const generateWebhook = (
  overrides: Partial<WebhookEntity> = {},
): WebhookEntity =>
  ({
    id: faker.number.int({ min: 1 }),
    chainId: 80002,
    escrowAddress: faker.finance.ethereumAddress(),
    eventType: EventType.JOB_COMPLETED,
    eventData: null,
    retriesCount: 0,
    status: WebhookStatus.PENDING,
    waitUntil: faker.date.recent(),
    ...overrides,
  }) as WebhookEntity;

export const generateWebhookDto = (
  overrides: Partial<WebhookDto> = {},
): WebhookDto => ({
  chainId: 80002,
  escrowAddress: faker.finance.ethereumAddress(),
  eventType: EventType.JOB_COMPLETED,
  ...overrides,
});
