import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { ValidationError } from '../../common/errors';
import { EventType } from '../../common/enums/webhook';
import { Role } from '../../common/enums/role';
import { SignatureAuthGuard } from '../../common/guards';
import { JobService } from '../job/job.service';
import { SubmissionService } from '../submission/submission.service';
import { WebhookDto } from './webhook.dto';
import { HEADER_SIGNATURE_KEY } from '../../common/constants';

@Public()
@ApiTags('Webhook')
@Controller('/webhook')
export class WebhookController {
  constructor(
    private readonly jobService: JobService,
    private readonly submissionService: SubmissionService,
  ) {}

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
    status: 200,
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
  @UseGuards(
    new SignatureAuthGuard([Role.Exchange, Role.Reputation, Role.JobLauncher]),
  )
  @Post()
  async processWebhook(@Body() body: WebhookDto): Promise<any> {
    switch (body.eventType) {
      case EventType.ESCROW_COMPLETED:
        return;

      case EventType.SUBMISSION_IN_REVIEW:
        return this.submissionService.createSubmission(body);

      case EventType.CANCELLATION_REQUESTED:
        return this.jobService.cancelJob(body);

      default:
        throw new ValidationError(
          `Invalid webhook event type: ${body.eventType}`,
        );
    }
  }
}
