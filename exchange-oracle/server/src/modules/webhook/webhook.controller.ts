import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AllowedRoles } from '../../common/decorators/role';
import { ErrorWebhook } from '../../common/constant/errors';
import { EventType } from '../../common/enums/webhook';
import { ValidationError } from '../../common/errors';
import { AuthSignatureRole } from '../../common/enums/role';
import { SignatureAuthGuard } from '../../common/guards';
import { HEADER_SIGNATURE_KEY } from '../../common/constant';
import { JobService } from '../job/job.service';
import { WebhookDto } from './webhook.dto';

@ApiTags('Webhook')
@Controller('/webhook')
export class WebhookController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @UseGuards(SignatureAuthGuard)
  @AllowedRoles([
    AuthSignatureRole.Recording,
    AuthSignatureRole.Reputation,
    AuthSignatureRole.JobLauncher,
  ])
  @ApiOperation({
    summary: 'Handle Webhook Events',
    description:
      'Receives webhook events related to escrow and task operations.',
  })
  @ApiHeader({
    name: HEADER_SIGNATURE_KEY,
    description: 'Signature header for authenticating the webhook request.',
    required: true,
  })
  @ApiBody({
    description:
      'Details of the webhook event, including the type of event and associated data.',
    type: WebhookDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook event processed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request.Invalid input parameters.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid credentials.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found. Could not find the requested content.',
  })
  @HttpCode(201)
  public async processWebhook(@Body() body: WebhookDto): Promise<void> {
    switch (body.eventType) {
      case EventType.ESCROW_CREATED:
        return this.jobService.createJob(body);

      case EventType.ESCROW_COMPLETED:
        return this.jobService.completeJob(body);

      case EventType.CANCELLATION_REQUESTED:
        return this.jobService.cancelJob(body);

      case EventType.SUBMISSION_REJECTED:
        return this.jobService.processInvalidJobSolution(body);

      case EventType.ABUSE_DETECTED:
        return this.jobService.cancelJob(body);

      case EventType.ESCROW_CANCELED:
        return;

      default:
        throw new ValidationError(
          `Invalid webhook event type: ${body.eventType}`,
          ErrorWebhook.UrlNotFound,
        );
    }
  }
}
