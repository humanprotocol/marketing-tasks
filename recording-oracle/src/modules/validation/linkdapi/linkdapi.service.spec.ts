import { Test } from '@nestjs/testing';

import { LinkdapiConfigService } from '../../../common/config/linkdapi-config.service';
import {
  ErrorJob,
  SubmissionRejectionReason,
} from '../../../common/constants/errors';
import { JobRequestType } from '../../../common/enums/job';
import { ISocialMediaEngagementManifest } from '../../../common/interfaces/job';
import { generateManifest } from '../../job/fixtures';
import { generateSubmission } from '../../submission/fixtures';
import { LinkdapiService } from './linkdapi.service';

type LinkdapiConfigServiceMock = {
  apiKey?: string;
  baseUrl: string;
  pageSize: number;
  maxPagesPerAction: number;
};

describe('LinkdapiService', () => {
  let service: LinkdapiService;
  let fetchMock: jest.Mock;
  let linkdapiConfigService: LinkdapiConfigServiceMock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    linkdapiConfigService = {
      apiKey: 'linkdapi-key',
      baseUrl: 'https://linkdapi.com',
      pageSize: 100,
      maxPagesPerAction: 3,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LinkdapiService,
        {
          provide: LinkdapiConfigService,
          useValue: linkdapiConfigService,
        },
      ],
    }).compile();

    service = moduleRef.get(LinkdapiService);
  });

  it('paginates liking users and matches LinkedIn profile slugs case-insensitively', async () => {
    mockLinkdapiResponse({
      data: {
        likes: [
          {
            profile: {
              profileUrl: 'https://www.linkedin.com/in/Alice-Builder/',
            },
          },
          ...Array.from({ length: 9 }, () => ({
            profile: { publicIdentifier: 'someone-else' },
          })),
        ],
      },
    });
    mockLinkdapiResponse({
      data: {
        likes: [{ profile: { publicIdentifier: 'bob-builder' } }],
      },
    });

    const result = await service.getLikingUsers(
      '7353638537595932672',
      new Set(['alice-builder', 'bob-builder']),
    );

    expect(result).toEqual(new Set(['alice-builder', 'bob-builder']));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      '/api/v1/posts/likes',
    );
    expect(fetchMock.mock.calls[1][0].toString()).toContain('start=10');
    expect(fetchMock.mock.calls[0][1].headers['X-linkdapi-apikey']).toBe(
      'linkdapi-key',
    );
  });

  it('stops paginating likes when LinkdAPI returns the final page', async () => {
    mockLinkdapiResponse({
      data: {
        currentPage: 1,
        pages: 1,
        likes: Array.from({ length: 10 }, () => ({
          actor: { publicIdentifier: 'bob-builder' },
        })),
      },
    });

    const result = await service.getLikingUsers(
      '7353638537595932672',
      new Set(['alice-builder']),
    );

    expect(result).toEqual(new Set());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('validates LinkedIn engagement submissions with likes and comments', async () => {
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
      platforms: ['linkedin'],
      requirements: {
        targetPostUrl:
          'https://www.linkedin.com/feed/update/urn:li:activity:7353638537595932672/',
        checkLike: true,
        checkComment: true,
      },
    }) as ISocialMediaEngagementManifest;
    const submissions = [
      generateSubmission({
        id: 1,
        solution: 'https://www.linkedin.com/in/alice-builder/',
      }),
      generateSubmission({ id: 2, solution: 'bob-builder' }),
    ];

    jest
      .spyOn(service, 'getLikingUsers')
      .mockResolvedValue(new Set(['alice-builder', 'bob-builder']));
    jest
      .spyOn(service, 'getCommentingUsers')
      .mockResolvedValue(new Set(['alice-builder']));

    await expect(
      service.validateSubmissions(submissions, manifest),
    ).resolves.toEqual([
      {
        submission: submissions[0],
        rejectionReason: null,
      },
      {
        submission: submissions[1],
        rejectionReason: SubmissionRejectionReason.MissingRequiredComment,
      },
    ]);

    expect(service.getLikingUsers).toHaveBeenCalledWith(
      '7353638537595932672',
      new Set(['alice-builder', 'bob-builder']),
    );
    expect(service.getCommentingUsers).toHaveBeenCalledWith(
      '7353638537595932672',
      new Set(['alice-builder', 'bob-builder']),
    );
  });

  it('requests LinkedIn comments with the configured page size', async () => {
    mockLinkdapiResponse({
      data: {
        comments: [{ commenter: { publicIdentifier: 'alice-builder' } }],
      },
    });

    const result = await service.getCommentingUsers(
      '7353638537595932672',
      new Set(['alice-builder']),
    );

    expect(result).toEqual(new Set(['alice-builder']));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe('/api/v1/posts/comments');
    expect(requestUrl.searchParams.get('urn')).toBe('7353638537595932672');
    expect(requestUrl.searchParams.get('start')).toBe('0');
    expect(requestUrl.searchParams.get('count')).toBe('100');
    expect(requestUrl.searchParams.has('sortBy')).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers['X-linkdapi-apikey']).toBe(
      'linkdapi-key',
    );
  });

  it('stops paginating LinkedIn comments when the page is shorter than the configured page size', async () => {
    mockLinkdapiResponse({
      data: {
        comments: [{ commenter: { publicIdentifier: 'bob-builder' } }],
      },
    });

    const result = await service.getCommentingUsers(
      '7353638537595932672',
      new Set(['alice-builder']),
    );

    expect(result).toEqual(new Set());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('paginates full LinkedIn comment pages by the configured page size', async () => {
    mockLinkdapiResponse({
      data: {
        comments: Array.from({ length: 100 }, () => ({
          commenter: { publicIdentifier: 'bob-builder' },
        })),
      },
    });
    mockLinkdapiResponse({
      data: {
        comments: [{ commenter: { publicIdentifier: 'alice-builder' } }],
      },
    });

    const result = await service.getCommentingUsers(
      '7353638537595932672',
      new Set(['alice-builder']),
    );

    expect(result).toEqual(new Set(['alice-builder']));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondRequestUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(secondRequestUrl.searchParams.get('start')).toBe('100');
  });

  it('treats later body-level LinkdAPI failures as the end of engagement results', async () => {
    mockLinkdapiResponse({
      data: {
        likes: Array.from({ length: 10 }, () => ({
          actor: { publicIdentifier: 'bob-builder' },
        })),
      },
    });
    mockLinkdapiResponse({
      success: false,
      message: "the data cannot be displayed or it doesn't exist",
    });

    const result = await service.getLikingUsers(
      '7353638537595932672',
      new Set(['alice-builder']),
    );

    expect(result).toEqual(new Set());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats later paginated 404 responses as the end of LinkedIn engagement results', async () => {
    mockLinkdapiResponse({
      data: {
        comments: Array.from({ length: 100 }, () => ({
          commenter: { publicIdentifier: 'bob-builder' },
        })),
      },
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'missing' })),
    });

    const result = await service.getCommentingUsers(
      '7353638537595932672',
      new Set(['alice-builder']),
    );

    expect(result).toEqual(new Set());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported LinkedIn repost and quote checks', async () => {
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
      platforms: ['linkedin'],
      requirements: {
        targetPostUrl:
          'https://www.linkedin.com/feed/update/urn:li:activity:7353638537595932672/',
        checkRepost: true,
        checkQuote: true,
      },
    }) as ISocialMediaEngagementManifest;

    await expect(
      service.validateSubmissions(
        [generateSubmission({ solution: 'alice-builder' })],
        manifest,
      ),
    ).rejects.toThrow(ErrorJob.InvalidManifest);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns target post rejection when the LinkedIn post URN cannot be extracted', async () => {
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
      platforms: ['linkedin'],
      requirements: {
        targetPostUrl: 'https://www.linkedin.com/posts/no-post-id',
        checkLike: true,
      },
    }) as ISocialMediaEngagementManifest;
    const submissions = [generateSubmission({ solution: 'alice-builder' })];

    await expect(
      service.validateSubmissions(submissions, manifest),
    ).resolves.toEqual([
      {
        submission: submissions[0],
        rejectionReason: SubmissionRejectionReason.TargetPostNotFound,
      },
    ]);
  });

  it('throws a clear server error when LinkdAPI credentials are missing', async () => {
    const serviceWithoutApiKey = new LinkdapiService({
      ...linkdapiConfigService,
      apiKey: undefined,
    } as LinkdapiConfigService);

    await expect(
      serviceWithoutApiKey.getLikingUsers(
        '7353638537595932672',
        new Set(['alice']),
      ),
    ).rejects.toThrow(
      'LinkdAPI config is required to process LinkedIn social_media_engagement jobs',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 404 LinkdAPI responses to target post not found', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'missing' })),
    });

    await expect(
      service.getLikingUsers('7353638537595932672', new Set(['alice'])),
    ).rejects.toThrow(SubmissionRejectionReason.TargetPostNotFound);
  });

  function mockLinkdapiResponse(payload: unknown): void {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(payload),
    });
  }
});
