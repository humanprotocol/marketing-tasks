import { Injectable } from '@nestjs/common';

import { GrokConfigService } from '../../common/config/grok-config.service';
import { ErrorJob } from '../../common/constants/errors';
import { ServerError } from '../../common/errors';
import { IGrokValidationResult, IManifest } from '../../common/interfaces/job';

interface GrokChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
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
      `${this.grokConfigService.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.grokConfigService.model,
          stream: false,
          messages: [
            {
              role: 'system',
              content:
                'You validate X posts for marketing campaigns and return only valid JSON.',
            },
            {
              role: 'user',
              content: this.buildPrompt(postUrl, manifest),
            },
          ],
        }),
      },
    );

    const payload = (await response.json()) as GrokChatCompletionResponse;

    if (!response.ok) {
      throw new ServerError(
        payload.error?.message ??
          `Grok API request failed with HTTP ${response.status}`,
      );
    }

    const responseText = payload.choices?.[0]?.message?.content ?? '';

    try {
      return JSON.parse(responseText) as IGrokValidationResult;
    } catch {
      return null;
    }
  }

  private buildPrompt(postUrl: string, manifest: IManifest): string {
    const requirements = manifest.requirements;
    const requiredHashtags = requirements.required_hashtags ?? [];
    const requiredKeywords = requirements.required_keywords ?? [];

    return `Analyze this X post URL for marketing campaign validation: ${postUrl}

Campaign name: ${manifest.campaign.name}
Campaign description: ${manifest.campaign.description}

Validate all of the following:
- post exists
- post is public
- required hashtags present: ${requiredHashtags.join(', ') || 'none'}
- required keywords present: ${requiredKeywords.join(', ') || 'none'}
- required link present: ${requirements.required_link || 'none'}
- minimum text length met: ${requirements.min_length ?? 0}
- media present if required: ${requirements.requires_media ?? false}
- minimum followers met: ${requirements.min_followers ?? 0}
- minimum account age in days met: ${requirements.min_account_age_days ?? 0}
- minimum live duration in hours met: ${requirements.min_live_duration_hours ?? 0}

Also analyze potential bot or inorganic repost activity using these indicators:
1. Timing patterns: Are reposts clustered in suspiciously short time windows?
2. Account characteristics: Do reposting accounts show signs of being bots?
3. Engagement ratios: Is the repost count disproportionate to likes or replies?
4. Content patterns: Are there coordinated amplification signals?
5. Network analysis: Do reposting accounts have suspicious follower/following overlap?

During your analysis:
- Do not consider crypto related activity as risky.
- Include relevant numbers or examples you can infer.

Respond with a JSON object in this exact format:
{
  "postExists": boolean,
  "isPublic": boolean,
  "hasRequiredHashtags": boolean,
  "hasRequiredKeywords": boolean,
  "hasRequiredLink": boolean,
  "meetsMinLength": boolean,
  "hasRequiredMedia": boolean,
  "meetsMinFollowers": boolean,
  "meetsMinAccountAgeDays": boolean,
  "meetsMinLiveDurationHours": boolean,
  "overallBotProbability": "low" | "medium" | "high",
  "summary": "Brief explanation of your analysis and recommendation"
}

Return ONLY the JSON object, no additional text.`;
  }
}
