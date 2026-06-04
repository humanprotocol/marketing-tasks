import { Test } from '@nestjs/testing';

import { XApiConfigService } from '../../../common/config/x-api-config.service';
import { SubmissionRejectionReason } from '../../../common/constants/errors';
import { JobRequestType } from '../../../common/enums/job';
import { generateManifest } from '../../job/fixtures';
import { generateSubmission } from '../../submission/fixtures';
import { XApiService } from './x-api.service';
import { ISocialMediaEngagementManifest } from '../../../common/interfaces/job';

type XApiConfigServiceMock = {
  consumerKey?: string;
  consumerSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  baseUrl: string;
  pageSize: number;
  maxPagesPerAction: number;
};

describe('XApiService', () => {
  let service: XApiService;
  let fetchMock: jest.Mock;
  let xApiConfigService: XApiConfigServiceMock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    xApiConfigService = {
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      accessToken: 'access-token',
      accessTokenSecret: 'access-token-secret',
      baseUrl: 'https://api.x.com/2',
      pageSize: 100,
      maxPagesPerAction: 3,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        XApiService,
        {
          provide: XApiConfigService,
          useValue: xApiConfigService,
        },
      ],
    }).compile();

    service = moduleRef.get(XApiService);
  });

  it('paginates liking users until all target usernames are found', async () => {
    mockXApiResponse({
      data: [{ id: '1', username: 'alice' }],
      meta: { next_token: 'next' },
    });
    mockXApiResponse({
      data: [{ id: '2', username: 'bob' }],
    });

    const result = await service.getLikingUsernames(
      '123',
      new Set(['alice', 'bob']),
    );

    expect(result).toEqual(new Set(['alice', 'bob']));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0].toString()).toContain(
      'pagination_token=next',
    );
  });

  it('does not call X API when there are no target usernames', async () => {
    await expect(service.getLikingUsernames('123', new Set())).resolves.toEqual(
      new Set(),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws retryable server errors for failed X API calls', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValue('rate limited'),
    });

    await expect(
      service.getRepostingUsernames('123', new Set(['alice'])),
    ).rejects.toThrow(
      'X API request failed with HTTP 429 for /tweets/123/retweeted_by: rate limited',
    );
  });

  it('returns app-oriented messages for forbidden X API responses', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          errors: [{ detail: 'Unsupported Authentication' }],
        }),
      ),
    });

    await expect(
      service.getLikingUsernames('123', new Set(['alice'])),
    ).rejects.toThrow(
      'X API request failed with HTTP 403 for /tweets/123/liking_users: Unsupported Authentication',
    );
  });

  it('authenticates X API requests with OAuth 1.0a user context', async () => {
    mockXApiResponse({ data: [] });

    await service.getLikingUsernames('123', new Set(['alice']));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      '/tweets/123/liking_users',
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^OAuth /);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toContain(
      'oauth_consumer_key="consumer-key"',
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toContain(
      'oauth_token="access-token"',
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toContain(
      'oauth_signature=',
    );
  });

  it('validates engagement submissions and checks comments only for users that passed previous checks', async () => {
    const targetPostUrl = 'https://x.com/human/status/123';
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
      requirements: {
        targetPostUrl,
        checkLike: true,
        checkRepost: true,
        checkQuote: true,
        checkComment: true,
      },
    });
    const submissions = [
      generateSubmission({ id: 1, solution: 'alice' }),
      generateSubmission({ id: 2, solution: 'bob' }),
    ];

    jest
      .spyOn(service, 'getLikingUsernames')
      .mockResolvedValue(new Set(['alice', 'bob']));
    jest
      .spyOn(service, 'getRepostingUsernames')
      .mockResolvedValue(new Set(['alice']));
    jest.spyOn(service, 'getQuotingUsernames').mockResolvedValue(new Set());
    jest
      .spyOn(service, 'getCommentingUsernames')
      .mockResolvedValue(new Set(['alice']));

    await expect(
      service.validateSubmissions(
        submissions,
        manifest as ISocialMediaEngagementManifest,
      ),
    ).resolves.toEqual([
      {
        submission: submissions[0],
        rejectionReason: SubmissionRejectionReason.MissingRequiredQuote,
      },
      {
        submission: submissions[1],
        rejectionReason: SubmissionRejectionReason.MissingRequiredRepost,
      },
    ]);

    expect(service.getLikingUsernames).toHaveBeenCalledWith(
      '123',
      new Set(['alice', 'bob']),
    );
    expect(service.getRepostingUsernames).toHaveBeenCalledWith(
      '123',
      new Set(['alice', 'bob']),
    );
    expect(service.getQuotingUsernames).toHaveBeenCalledWith(
      '123',
      new Set(['alice']),
    );
    expect(service.getCommentingUsernames).not.toHaveBeenCalled();
  });

  it('skips remaining engagement checks when no candidates remain', async () => {
    const targetPostUrl = 'https://x.com/human/status/123';
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
      requirements: {
        targetPostUrl,
        checkLike: true,
        checkRepost: true,
        checkQuote: true,
        checkComment: true,
      },
    });
    const submissions = [
      generateSubmission({ id: 1, solution: 'alice' }),
      generateSubmission({ id: 2, solution: 'bob' }),
    ];

    jest.spyOn(service, 'getLikingUsernames').mockResolvedValue(new Set());
    const getRepostingUsernamesSpy = jest.spyOn(
      service,
      'getRepostingUsernames',
    );
    const getQuotingUsernamesSpy = jest.spyOn(service, 'getQuotingUsernames');
    const getCommentingUsernamesSpy = jest.spyOn(
      service,
      'getCommentingUsernames',
    );

    await expect(
      service.validateSubmissions(
        submissions,
        manifest as ISocialMediaEngagementManifest,
      ),
    ).resolves.toEqual([
      {
        submission: submissions[0],
        rejectionReason: SubmissionRejectionReason.MissingRequiredLike,
      },
      {
        submission: submissions[1],
        rejectionReason: SubmissionRejectionReason.MissingRequiredLike,
      },
    ]);

    expect(getRepostingUsernamesSpy).not.toHaveBeenCalled();
    expect(getQuotingUsernamesSpy).not.toHaveBeenCalled();
    expect(getCommentingUsernamesSpy).not.toHaveBeenCalled();
  });

  it('validates comments only for users that passed required quote checks', async () => {
    const targetPostUrl = 'https://x.com/human/status/123';
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
      requirements: {
        targetPostUrl,
        checkLike: false,
        checkRepost: false,
        checkQuote: true,
        checkComment: true,
      },
    });
    const submissions = [
      generateSubmission({ id: 1, solution: 'alice' }),
      generateSubmission({ id: 2, solution: 'bob' }),
    ];

    jest
      .spyOn(service, 'getQuotingUsernames')
      .mockResolvedValue(new Set(['alice']));
    jest
      .spyOn(service, 'getCommentingUsernames')
      .mockResolvedValue(new Set(['alice']));

    await expect(
      service.validateSubmissions(
        submissions,
        manifest as ISocialMediaEngagementManifest,
      ),
    ).resolves.toEqual([
      {
        submission: submissions[0],
        rejectionReason: null,
      },
      {
        submission: submissions[1],
        rejectionReason: SubmissionRejectionReason.MissingRequiredQuote,
      },
    ]);

    expect(service.getQuotingUsernames).toHaveBeenCalledWith(
      '123',
      new Set(['alice', 'bob']),
    );
    expect(service.getCommentingUsernames).toHaveBeenCalledWith(
      '123',
      new Set(['alice']),
    );
  });

  it('skips comment requests when no user passed previous checks', async () => {
    const targetPostUrl = 'https://x.com/human/status/123';
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
      requirements: {
        targetPostUrl,
        checkLike: true,
        checkRepost: false,
        checkQuote: false,
        checkComment: true,
      },
    });
    const submissions = [
      generateSubmission({ id: 1, solution: 'alice' }),
      generateSubmission({ id: 2, solution: 'bob' }),
    ];

    jest.spyOn(service, 'getLikingUsernames').mockResolvedValue(new Set());
    const getCommentingUsernamesSpy = jest.spyOn(
      service,
      'getCommentingUsernames',
    );

    await expect(
      service.validateSubmissions(
        submissions,
        manifest as ISocialMediaEngagementManifest,
      ),
    ).resolves.toEqual([
      {
        submission: submissions[0],
        rejectionReason: SubmissionRejectionReason.MissingRequiredLike,
      },
      {
        submission: submissions[1],
        rejectionReason: SubmissionRejectionReason.MissingRequiredLike,
      },
    ]);

    expect(getCommentingUsernamesSpy).not.toHaveBeenCalled();
  });

  it('maps quote authors from includes users for quote validation', async () => {
    mockXApiResponse({
      data: [
        {
          id: '456',
          author_id: '1',
          conversation_id: '123',
          referenced_tweets: [{ type: 'replied_to', id: '123' }],
        },
      ],
      includes: {
        users: [{ id: '1', username: 'Alice' }],
      },
    });

    const result = await service.getQuotingUsernames('123', new Set(['alice']));

    expect(result).toEqual(new Set(['alice']));
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      '/tweets/123/quote_tweets',
    );
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      'expansions=author_id',
    );
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      'user.fields=username',
    );
  });

  it('maps reply authors from recent search for comment validation', async () => {
    mockXApiResponse({
      data: [
        {
          id: '456',
          author_id: '1',
          conversation_id: '123',
          referenced_tweets: [{ type: 'replied_to', id: '123' }],
        },
      ],
      includes: {
        users: [{ id: '1', username: 'Alice' }],
      },
    });

    const result = await service.getCommentingUsernames(
      '123',
      new Set(['alice']),
    );

    expect(result).toEqual(new Set(['alice']));
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      '/tweets/search/recent',
    );
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      'query=conversation_id%3A123+from%3Aalice',
    );
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      'expansions=author_id',
    );
  });

  function mockXApiResponse(payload: unknown): void {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(payload),
    });
  }
});
