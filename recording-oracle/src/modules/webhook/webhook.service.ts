import {
  ChainId,
  EscrowClient,
  KVStoreKeys,
  KVStoreUtils,
} from '@human-protocol/sdk';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { ServerConfigService } from '../../common/config/server-config.service';
import { Web3ConfigService } from '../../common/config/web3-config.service';
import { HEADER_SIGNATURE_KEY } from '../../common/constants';
import { EventType, WebhookStatus } from '../../common/enums/webhook';
import { ValidationError } from '../../common/errors';
import { transformKeysFromCamelToSnake } from '../../common/utils/case-converter';
import { formatAxiosError } from '../../common/utils/http';
import { signMessage } from '../../common/utils/signature';
import { Web3Service } from '../../modules/web3/web3.service';

import { WebhookDto } from './webhook.dto';
import { WebhookEntity } from './webhook.entity';
import { WebhookRepository } from './webhook.repository';

@Injectable()
export class WebhookService {
  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly httpService: HttpService,
    private readonly web3Service: Web3Service,
    private readonly web3ConfigService: Web3ConfigService,
    private readonly serverConfigService: ServerConfigService,
  ) {}

  async createWebhook(
    chainId: ChainId,
    escrowAddress: string,
    eventType: EventType,
    eventData?: Record<string, unknown>,
  ): Promise<void> {
    const webhook = new WebhookEntity();
    webhook.chainId = chainId;
    webhook.escrowAddress = escrowAddress;
    webhook.eventType = eventType;
    webhook.eventData = eventData ?? null;
    webhook.waitUntil = new Date();
    webhook.status = WebhookStatus.PENDING;

    await this.webhookRepository.createUnique(webhook);
  }

  async sendWebhook(webhook: WebhookEntity): Promise<void> {
    const webhookUrl = await this.getWebhookUrl(
      webhook.chainId,
      webhook.escrowAddress,
      webhook.eventType,
    );

    if (!webhookUrl) {
      throw new Error('Webhook URL not found');
    }

    const body: WebhookDto = {
      chainId: webhook.chainId,
      escrowAddress: webhook.escrowAddress,
      eventType: webhook.eventType,
      eventData: webhook.eventData as WebhookDto['eventData'],
    };

    const transformedBody = transformKeysFromCamelToSnake(body) as Record<
      string,
      unknown
    >;
    const signedBody = await signMessage(
      transformedBody,
      this.web3ConfigService.privateKey,
    );

    try {
      await firstValueFrom(
        this.httpService.post(webhookUrl, transformedBody, {
          headers: { [HEADER_SIGNATURE_KEY]: signedBody },
        }),
      );
    } catch (error: any) {
      throw new Error(formatAxiosError(error).message);
    }
  }

  async processPendingWebhooks(): Promise<void> {
    const pendingWebhooks = await this.webhookRepository.findByStatus(
      WebhookStatus.PENDING,
    );

    for (const pendingWebhook of pendingWebhooks) {
      try {
        await this.sendWebhook(pendingWebhook);
        pendingWebhook.status = WebhookStatus.COMPLETED;
        await this.webhookRepository.updateOne(pendingWebhook);
      } catch {
        await this.handleWebhookError(pendingWebhook);
      }
    }
  }

  private async handleWebhookError(webhook: WebhookEntity): Promise<void> {
    webhook.retriesCount += 1;
    if (
      webhook.retriesCount >=
      this.serverConfigService.socialMediaValidationMaxRetries
    ) {
      webhook.status = WebhookStatus.FAILED;
    } else {
      webhook.waitUntil = new Date();
    }

    await this.webhookRepository.updateOne(webhook);
  }

  private async getWebhookUrl(
    chainId: ChainId,
    escrowAddress: string,
    eventType: EventType,
  ): Promise<string | undefined> {
    const signer = this.web3Service.getSigner(chainId);
    const escrowClient = await EscrowClient.build(signer);

    switch (eventType) {
      case EventType.JOB_COMPLETED:
      case EventType.JOB_CANCELED:
        return KVStoreUtils.get(
          chainId,
          await escrowClient.getReputationOracleAddress(escrowAddress),
          KVStoreKeys.webhookUrl,
        );
      case EventType.SUBMISSION_REJECTED:
        return KVStoreUtils.get(
          chainId,
          await escrowClient.getExchangeOracleAddress(escrowAddress),
          KVStoreKeys.webhookUrl,
        );
      default:
        throw new ValidationError(`Invalid outgoing event type: ${eventType}`);
    }
  }
}
