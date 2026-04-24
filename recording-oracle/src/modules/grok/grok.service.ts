import { Injectable } from '@nestjs/common';

import { GrokConfigService } from '../../common/config/grok-config.service';
import { ErrorJob } from '../../common/constants/errors';
import { ServerError } from '../../common/errors';
import { IGrokValidationResult, IManifest } from '../../common/interfaces/job';
import {
  buildGrokValidationPrompt,
  GROK_VALIDATION_RESPONSE_SCHEMA,
  GROK_VALIDATION_SYSTEM_PROMPT,
} from './grok-prompt';

interface GrokResponsesApiResponse {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

function extractResponsesText(payload: GrokResponsesApiResponse): string {
  const message = payload.output?.find((item) => item.type === 'message');
  const text = message?.content?.find((item) => item.type === 'output_text');

  return text?.text ?? '';
}

function normalizeValidationResult(
  validation: IGrokValidationResult,
  manifest: IManifest,
): IGrokValidationResult {
  const requirements = manifest.requirements;

  return {
    ...validation,
    hasRequiredHashtags:
      !requirements.required_hashtags?.length || validation.hasRequiredHashtags,
    hasRequiredKeywords:
      !requirements.required_keywords?.length || validation.hasRequiredKeywords,
    hasRequiredLink: !requirements.required_link || validation.hasRequiredLink,
    meetsMinLength: !requirements.min_length || validation.meetsMinLength,
    hasRequiredMedia:
      !requirements.requires_media || validation.hasRequiredMedia,
    meetsMinFollowers:
      !requirements.min_followers || validation.meetsMinFollowers,
    meetsMinAccountAgeDays:
      !requirements.min_account_age_days || validation.meetsMinAccountAgeDays,
    meetsMinLiveDurationHours:
      !requirements.min_live_duration_hours ||
      validation.meetsMinLiveDurationHours,
  };
}

@Injectable()
export class GrokService {
  constructor(private readonly grokConfigService: GrokConfigService) {}

  async validatePost(
    postUrl: string,
    manifest: IManifest,
  ): Promise<IGrokValidationResult | null> {
    const apiKey = this.grokConfigService.apiKey;
    if (!apiKey) {
      throw new ServerError(ErrorJob.MissingGrokCredentials);
    }

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
        JSON.parse(responseText) as IGrokValidationResult,
        manifest,
      );
    } catch {
      return null;
    }
  }
}
