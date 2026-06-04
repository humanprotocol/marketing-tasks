import { Injectable } from '@nestjs/common';

import { GrokConfigService } from '../../../common/config/grok-config.service';
import { SubmissionRejectionReason } from '../../../common/constants/errors';
import { ServerError } from '../../../common/errors';
import {
  IPostValidationResult,
  ISocialMediaPromotionManifest,
} from '../../../common/interfaces/job';
import {
  ABUSE_PRIORITY,
  SUBMISSION_VALIDATION_RULES,
} from '../../submission/submission.constants';
import { SubmissionEntity } from '../../submission/submission.entity';
import type { SubmissionValidationResult } from '../validation.service';
import { GrokResponsesApiResponse } from './grok.interface';
import {
  buildGrokValidationPrompt,
  extractResponsesText,
  GROK_VALIDATION_RESPONSE_SCHEMA,
  GROK_VALIDATION_SYSTEM_PROMPT,
  normalizeValidationResult,
} from './grok.utils';

@Injectable()
export class GrokService {
  constructor(private readonly grokConfigService: GrokConfigService) {}

  async validateSubmission(
    submission: SubmissionEntity,
    manifest: ISocialMediaPromotionManifest,
  ): Promise<SubmissionValidationResult> {
    const validation = await this.validatePost(submission.solution, manifest);

    return {
      submission,
      rejectionReason: validation
        ? this.getRejectionReason(validation, manifest)
        : SubmissionRejectionReason.InvalidPostValidation,
    };
  }

  async validatePost(
    postUrl: string,
    manifest: ISocialMediaPromotionManifest,
  ): Promise<IPostValidationResult | null> {
    const apiKey = this.getApiKey();

    const response = await fetch(
      `${this.grokConfigService.baseUrl}/responses`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.grokConfigService.model,
          store: false,
          max_output_tokens: 60,
          input: [
            {
              role: 'system',
              content: GROK_VALIDATION_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: buildGrokValidationPrompt(postUrl, manifest),
            },
          ],
          tools: [{ type: 'x_search' }],
          text: {
            format: {
              type: 'json_schema',
              name: GROK_VALIDATION_RESPONSE_SCHEMA.json_schema.name,
              schema: GROK_VALIDATION_RESPONSE_SCHEMA.json_schema.schema,
              strict: true,
            },
          },
        }),
      },
    );

    const payload = (await response.json()) as GrokResponsesApiResponse;

    if (!response.ok) {
      throw new ServerError(
        payload.error?.message ??
          `Grok API request failed with HTTP ${response.status}`,
      );
    }

    const responseText = extractResponsesText(payload);

    try {
      return normalizeValidationResult(
        JSON.parse(responseText) as IPostValidationResult,
        manifest,
      );
    } catch {
      return null;
    }
  }

  private getRejectionReason(
    validation: IPostValidationResult,
    manifest: ISocialMediaPromotionManifest,
  ): SubmissionRejectionReason | null {
    for (const rule of SUBMISSION_VALIDATION_RULES) {
      if (!rule.isValid(validation, manifest)) {
        return rule.rejectionReason;
      }
    }

    if (
      ABUSE_PRIORITY[validation.overallBotProbability] >
      ABUSE_PRIORITY[manifest.aiValidation.allowedAbuseProbability]
    ) {
      return SubmissionRejectionReason.AbuseProbabilityTooHigh;
    }

    return null;
  }

  private getApiKey(): string {
    const { apiKey } = this.grokConfigService;

    if (!apiKey) {
      throw new ServerError(
        'Grok config is required to process social_media_promotion jobs',
      );
    }

    return apiKey;
  }
}
