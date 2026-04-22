import { ChainId, EscrowClient, OperatorUtils } from '@human-protocol/sdk';
import { HttpService } from '@nestjs/axios';
import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import {
  JOB_LAUNCHER_WEBHOOK_URL,
  MOCK_ADDRESS,
  MOCK_PRIVATE_KEY,
  MOCK_RECORDING_ORACLE_WEBHOOK_URL,
} from '../../../test/constants';
import { Web3ConfigService } from '../../common/config/web3-config.service';
import { HEADER_SIGNATURE_KEY } from '../../common/constant';
import { ErrorWebhook } from '../../common/constant/errors';
import { EventType } from '../../common/enums/webhook';
import { NotFoundError } from '../../common/errors';
import { Web3Service } from '../web3/web3.service';
import { WebhookDto } from './webhook.dto';
import { WebhookService } from './webhook.service';

jest.mock('@human-protocol/sdk', () => ({
  ...jest.requireActual('@human-protocol/sdk'),
  EscrowClient: {
    build: jest.fn(),
  },
  OperatorUtils: {
    getOperator: jest.fn(),
  },
  KVStoreUtils: {
    get: jest.fn(),
  },
}));

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let httpService: HttpService;

  const signerMock = {
    address: '0x1234567890123456789012345678901234567892',
    getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
  };

  const httpServicePostMock = jest
    .fn()
    .mockReturnValue(of({ status: 200, data: {} }));

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: Web3ConfigService,
          useValue: {
            privateKey: MOCK_PRIVATE_KEY,
          },
        },
        {
          provide: Web3Service,
          useValue: {
            getSigner: jest.fn().mockReturnValue(signerMock),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: httpServicePostMock,
            axiosRef: {
              get: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    webhookService = moduleRef.get<WebhookService>(WebhookService);
    httpService = moduleRef.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendWebhook', () => {
    const webhookDto: WebhookDto = {
      chainId: ChainId.LOCALHOST,
      escrowAddress: MOCK_ADDRESS,
      eventType: EventType.SUBMISSION_IN_REVIEW,
      eventData: {
        assigneeId: MOCK_ADDRESS,
        postUrl: 'https://x.com/test/status/1',
      },
    };

    it('should throw an error if webhook url is empty', async () => {
      jest
        .spyOn(webhookService as any, 'getOracleWebhookUrl')
        .mockResolvedValue('');

      await expect(
        (webhookService as any).sendWebhook(webhookDto),
      ).rejects.toThrow(ErrorWebhook.UrlNotFound);
    });

    it('should handle error if any exception is thrown', async () => {
      jest
        .spyOn(webhookService as any, 'getOracleWebhookUrl')
        .mockResolvedValue(MOCK_RECORDING_ORACLE_WEBHOOK_URL);
      jest.spyOn(httpService as any, 'post').mockImplementation(() => {
        return throwError(() => new Error('HTTP request failed'));
      });

      await expect(
        (webhookService as any).sendWebhook(webhookDto),
      ).rejects.toThrow('HTTP request failed');
    });

    it('should successfully process a webhook with signature', async () => {
      jest
        .spyOn(webhookService as any, 'getOracleWebhookUrl')
        .mockResolvedValue(MOCK_RECORDING_ORACLE_WEBHOOK_URL);
      jest.spyOn(httpService as any, 'post').mockImplementation(() => {
        return of({
          status: HttpStatus.CREATED,
        });
      });

      expect(await (webhookService as any).sendWebhook(webhookDto)).toBe(
        undefined,
      );

      expect(httpService.post).toHaveBeenCalledWith(
        MOCK_RECORDING_ORACLE_WEBHOOK_URL,
        {
          escrow_address: webhookDto.escrowAddress,
          chain_id: webhookDto.chainId,
          event_type: webhookDto.eventType,
          event_data: {
            assignee_id: MOCK_ADDRESS,
            post_url: 'https://x.com/test/status/1',
          },
        },
        { headers: { [HEADER_SIGNATURE_KEY]: expect.any(String) } },
      );
    });
  });

  describe('getOracleWebhookUrl', () => {
    it('should get the job launcher webhook URL', async () => {
      (EscrowClient.build as any).mockImplementation(() => ({
        getJobLauncherAddress: jest
          .fn()
          .mockResolvedValue(JOB_LAUNCHER_WEBHOOK_URL),
      }));

      (OperatorUtils.getOperator as any).mockResolvedValue({
        webhookUrl: JOB_LAUNCHER_WEBHOOK_URL,
      });

      const result = await (webhookService as any).getOracleWebhookUrl(
        JOB_LAUNCHER_WEBHOOK_URL,
        ChainId.LOCALHOST,
        EventType.ESCROW_FAILED,
      );

      expect(result).toBe(JOB_LAUNCHER_WEBHOOK_URL);
    });

    it('should get the recording oracle webhook URL', async () => {
      (EscrowClient.build as any).mockImplementation(() => ({
        getRecordingOracleAddress: jest
          .fn()
          .mockResolvedValue(MOCK_RECORDING_ORACLE_WEBHOOK_URL),
      }));

      (OperatorUtils.getOperator as any).mockResolvedValue({
        webhookUrl: MOCK_RECORDING_ORACLE_WEBHOOK_URL,
      });

      const result = await (webhookService as any).getOracleWebhookUrl(
        MOCK_RECORDING_ORACLE_WEBHOOK_URL,
        ChainId.LOCALHOST,
        EventType.SUBMISSION_IN_REVIEW,
      );

      expect(result).toBe(MOCK_RECORDING_ORACLE_WEBHOOK_URL);
    });

    it('should fail if the event type is not valid', async () => {
      await expect(
        (webhookService as any).getOracleWebhookUrl(
          JOB_LAUNCHER_WEBHOOK_URL,
          ChainId.LOCALHOST,
          EventType.ESCROW_CREATED,
        ),
      ).rejects.toThrow('Invalid outgoing event type');
    });

    it('should throw NotFoundError if operator is not found', async () => {
      (EscrowClient.build as any).mockImplementation(() => ({
        getJobLauncherAddress: jest.fn().mockResolvedValue(MOCK_ADDRESS),
      }));

      (OperatorUtils.getOperator as any).mockResolvedValue(null);

      await expect(
        (webhookService as any).getOracleWebhookUrl(
          JOB_LAUNCHER_WEBHOOK_URL,
          ChainId.LOCALHOST,
          EventType.ESCROW_FAILED,
        ),
      ).rejects.toThrow(new NotFoundError('Oracle not found'));
    });

    it('should throw NotFoundError if webhook url is not found', async () => {
      (EscrowClient.build as any).mockImplementation(() => ({
        getJobLauncherAddress: jest.fn().mockResolvedValue(MOCK_ADDRESS),
      }));

      (OperatorUtils.getOperator as any).mockResolvedValue({
        webhookUrl: null,
      });

      await expect(
        (webhookService as any).getOracleWebhookUrl(
          JOB_LAUNCHER_WEBHOOK_URL,
          ChainId.LOCALHOST,
          EventType.ESCROW_FAILED,
        ),
      ).rejects.toThrow(new NotFoundError('Oracle webhook URL not found'));
    });
  });
});
