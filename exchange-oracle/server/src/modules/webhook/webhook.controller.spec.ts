import { createMock } from '@golevelup/ts-jest';
import { Test } from '@nestjs/testing';

import { EventType } from '../../common/enums/webhook';
import { AssignmentRepository } from '../assignment/assignment.repository';
import { JobService } from '../job/job.service';
import { WebhookController } from './webhook.controller';
import { WebhookDto } from './webhook.dto';

jest.mock('../../common/utils/signature');

describe('webhookController', () => {
  let webhookController: WebhookController;
  let jobService: JobService;
  const chainId = 1;
  const escrowAddress = '0x1234567890123456789012345678901234567890';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [],
      controllers: [WebhookController],
      providers: [
        { provide: JobService, useValue: createMock<JobService>() },
        {
          provide: AssignmentRepository,
          useValue: createMock<AssignmentRepository>(),
        },
      ],
    }).compile();

    webhookController = moduleRef.get<WebhookController>(WebhookController);
    jobService = moduleRef.get<JobService>(JobService);
  });

  describe('processWebhook', () => {
    describe('succeed', () => {
      it('should call jobService.createJob', async () => {
        const webhook: WebhookDto = {
          chainId,
          escrowAddress,
          eventType: EventType.ESCROW_CREATED,
        };
        jest.spyOn(jobService, 'createJob').mockResolvedValue();

        await webhookController.processWebhook(webhook);

        expect(jobService.createJob).toHaveBeenCalledWith(webhook);
      });
    });
  });
});
