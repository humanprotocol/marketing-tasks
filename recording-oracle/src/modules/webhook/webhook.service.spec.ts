import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';

import { EventType, WebhookStatus } from '../../common/enums/webhook';
import { ServerConfigService } from '../../common/config/server-config.service';
import { Web3ConfigService } from '../../common/config/web3-config.service';
import { Web3Service } from '../web3/web3.service';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let webhookRepository: WebhookRepository;

  const chainId = 1;
  const escrowAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: WebhookRepository,
          useValue: {
            createUnique: jest.fn(),
            findByStatus: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        { provide: HttpService, useValue: { post: jest.fn() } },
        { provide: Web3Service, useValue: { getSigner: jest.fn() } },
        {
          provide: Web3ConfigService,
          useValue: { privateKey: '0x123' },
        },
        {
          provide: ServerConfigService,
          useValue: { socialMediaValidationMaxRetries: 5 },
        },
      ],
    }).compile();

    webhookService = moduleRef.get<WebhookService>(WebhookService);
    webhookRepository = moduleRef.get<WebhookRepository>(WebhookRepository);
  });

  it('creates the service', () => {
    expect(webhookService).toBeDefined();
  });

  it('queues an outgoing webhook', async () => {
    await webhookService.createWebhook(
      chainId,
      escrowAddress,
      EventType.JOB_COMPLETED,
      { foo: 'bar' },
    );

    expect(webhookRepository.createUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId,
        escrowAddress,
        eventType: EventType.JOB_COMPLETED,
        eventData: { foo: 'bar' },
        status: WebhookStatus.PENDING,
      }),
    );
  });

  it('marks an outgoing webhook as failed after max retries', async () => {
    const webhook = {
      chainId,
      escrowAddress,
      eventType: EventType.JOB_COMPLETED,
      eventData: null,
      retriesCount: 4,
      status: WebhookStatus.PENDING,
      waitUntil: new Date(),
    };

    jest
      .spyOn(webhookRepository, 'findByStatus')
      .mockResolvedValue([webhook as any]);
    jest
      .spyOn(webhookService, 'sendWebhook')
      .mockRejectedValue(new Error('HTTP request failed'));

    await webhookService.processPendingWebhooks();

    expect(webhookRepository.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        retriesCount: 5,
        status: WebhookStatus.FAILED,
      }),
    );
  });

  it('fails an outgoing webhook already at max retries without sending it again', async () => {
    const webhook = {
      chainId,
      escrowAddress,
      eventType: EventType.JOB_COMPLETED,
      eventData: null,
      retriesCount: 6,
      status: WebhookStatus.PENDING,
      waitUntil: new Date(),
    };

    jest
      .spyOn(webhookRepository, 'findByStatus')
      .mockResolvedValue([webhook as any]);
    const sendWebhookSpy = jest.spyOn(webhookService, 'sendWebhook');

    await webhookService.processPendingWebhooks();

    expect(sendWebhookSpy).not.toHaveBeenCalled();
    expect(webhookRepository.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        retriesCount: 6,
        status: WebhookStatus.FAILED,
      }),
    );
  });
});
