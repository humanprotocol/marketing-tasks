import { ChainId, EscrowClient, OperatorUtils } from '@human-protocol/sdk';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { Web3ConfigService } from '../../common/config/web3-config.service';
import { HEADER_SIGNATURE_KEY } from '../../common/constant';
import { ErrorWebhook } from '../../common/constant/errors';
import { EventType } from '../../common/enums/webhook';
import { NotFoundError, ValidationError } from '../../common/errors';
import { transformKeysFromCamelToSnake } from '../../common/utils/case-converter';
import { formatAxiosError } from '../../common/utils/http';
import { signMessage } from '../../common/utils/signature';
import logger from '../../logger';
import { Web3Service } from '../web3/web3.service';
import { WebhookDto } from './webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger = logger.child({ context: WebhookService.name });

  constructor(
    private readonly web3ConfigService: Web3ConfigService,
    private readonly httpService: HttpService,
    private readonly web3Service: Web3Service,
  ) {}

  public async sendWebhook(webhook: WebhookDto): Promise<void> {
    let config = {};
    const webhookUrl = await this.getOracleWebhookUrl(
      webhook.escrowAddress,
      webhook.chainId,
      webhook.eventType,
    );

    if (!webhookUrl) {
      throw new Error(ErrorWebhook.UrlNotFound);
    }

    const transformedWebhook: any = transformKeysFromCamelToSnake(webhook);
    const signedBody = await signMessage(
      transformedWebhook,
      this.web3ConfigService.privateKey,
    );

    config = {
      headers: { [HEADER_SIGNATURE_KEY]: signedBody },
    };

    try {
      await firstValueFrom(
        this.httpService.post(webhookUrl, transformedWebhook, config),
      );
    } catch (error: any) {
      const formattedError = formatAxiosError(error);
      this.logger.error('Webhook not sent', {
        webhook,
        error: formattedError,
      });
      const outboundError: any = new Error(formattedError.message);
      outboundError.responseMessage = formattedError.responseMessage;
      outboundError.validationErrors = formattedError.validationErrors;
      throw outboundError;
    }
  }

  private async getOracleWebhookUrl(
    escrowAddress: string,
    chainId: ChainId,
    eventType: EventType,
  ): Promise<string | undefined> {
    const signer = this.web3Service.getSigner(chainId);
    const escrowClient = await EscrowClient.build(signer);
    let oracleAddress: string;
    switch (eventType) {
      case EventType.ESCROW_FAILED:
        oracleAddress = await escrowClient.getJobLauncherAddress(escrowAddress);
        break;
      case EventType.SUBMISSION_IN_REVIEW:
        oracleAddress =
          await escrowClient.getRecordingOracleAddress(escrowAddress);
        break;
      default:
        throw new ValidationError(ErrorWebhook.InvalidOutgoingEventType);
    }
    const oracle = await OperatorUtils.getOperator(chainId, oracleAddress);
    if (!oracle) {
      throw new NotFoundError(ErrorWebhook.OracleNotFound);
    }
    if (!oracle.webhookUrl) {
      throw new NotFoundError(ErrorWebhook.OracleWebhookUrlNotFound);
    }

    return oracle.webhookUrl;
  }
}
