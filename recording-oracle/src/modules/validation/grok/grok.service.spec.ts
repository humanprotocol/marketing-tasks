import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { GrokConfigService } from '../../../common/config/grok-config.service';
import { ServerError } from '../../../common/errors';
import { generateManifest } from '../../../modules/job/fixtures';
import { generatePostUrl } from '../../../modules/submission/fixtures';
import { generatePostValidationResult } from '../../../modules/validation/fixtures';
import {
  GROK_VALIDATION_RESPONSE_SCHEMA,
  GROK_VALIDATION_SYSTEM_PROMPT,
} from './grok.utils';
import { generateGrokResponse } from './fixtures';
import { GrokService } from './grok.service';

describe('GrokService', () => {
  let grokService: GrokService;
  let fetchMock: jest.Mock;

  const baseUrl = 'https://api.x.ai/v1';
  const apiKey = faker.string.alphanumeric(32);
  const model = 'grok-4';

  const validationResult = generatePostValidationResult({
    hasRequiredHashtags: false,
    hasRequiredKeywords: false,
    hasRequiredLink: false,
    meetsMinLength: false,
    hasRequiredMedia: false,
    meetsMinFollowers: false,
    meetsMinAccountAgeDays: false,
    meetsMinLiveDurationHours: false,
    meetsMinLikes: false,
    meetsMinReposts: false,
    followerAuthenticity: 'medium',
    overallBotProbability: 'medium',
  });

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    const moduleRef = await Test.createTestingModule({
      providers: [
        GrokService,
        {
          provide: GrokConfigService,
          useValue: {
            apiKey,
            baseUrl,
            model,
          },
        },
      ],
    }).compile();

    grokService = moduleRef.get(GrokService);
  });

  it('creates the service', () => {
    expect(grokService).toBeDefined();
  });

  it('calls Grok responses API and normalizes optional requirements', async () => {
    const postUrl = generatePostUrl();
    const manifest = generateManifest({ submissions_required: 1 });

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue(
          generateGrokResponse(JSON.stringify(validationResult)),
        ),
    });

    await expect(grokService.validatePost(postUrl, manifest)).resolves.toEqual(
      expect.objectContaining({
        postExists: true,
        isPublic: true,
        hasRequiredHashtags: true,
        hasRequiredKeywords: true,
        hasRequiredLink: true,
        meetsMinLength: true,
        hasRequiredMedia: true,
        meetsMinFollowers: true,
        meetsMinAccountAgeDays: true,
        meetsMinLiveDurationHours: true,
        meetsMinLikes: true,
        meetsMinReposts: true,
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/responses`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }),
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toEqual(
      expect.objectContaining({
        model,
        store: false,
        max_output_tokens: 60,
        input: [
          {
            role: 'system',
            content: GROK_VALIDATION_SYSTEM_PROMPT,
          },
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(postUrl),
          }),
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
    );
  });

  it('keeps failed booleans when the related manifest requirement is enabled', async () => {
    const manifest = generateManifest({
      requirements: {
        required_hashtags: ['HumanProtocol'],
        required_keywords: ['oracle'],
        required_link: faker.internet.url(),
        min_length: 20,
        requires_media: true,
        min_followers: 100,
        min_account_age_days: 30,
        min_live_duration_hours: 12,
        min_likes: 10,
        min_reposts: 5,
      },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue(
          generateGrokResponse(JSON.stringify(validationResult)),
        ),
    });

    await expect(
      grokService.validatePost(faker.internet.url(), manifest),
    ).resolves.toEqual(validationResult);
  });

  it('throws a server error when Grok returns a non-ok response', async () => {
    const errorMessage = faker.lorem.sentence();

    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({
        error: {
          message: errorMessage,
        },
      }),
    });

    await expect(
      grokService.validatePost(faker.internet.url(), generateManifest()),
    ).rejects.toThrow(errorMessage);
  });

  it('throws a fallback server error when Grok omits an error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({}),
    });

    await expect(
      grokService.validatePost(faker.internet.url(), generateManifest()),
    ).rejects.toThrow('Grok API request failed with HTTP 500');
  });

  it('returns null when the model response cannot be parsed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(generateGrokResponse('not-json')),
    });

    await expect(
      grokService.validatePost(faker.internet.url(), generateManifest()),
    ).resolves.toBeNull();
  });

  it('returns null when the response text is missing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ output: [] }),
    });

    await expect(
      grokService.validatePost(faker.internet.url(), generateManifest()),
    ).resolves.toBeNull();
  });

  it('uses the ServerError class for failed Grok requests', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({}),
    });

    await expect(
      grokService.validatePost(faker.internet.url(), generateManifest()),
    ).rejects.toBeInstanceOf(ServerError);
  });
});
