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
        ],
        pagination: { nextCursor: 'next' },
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
    expect(fetchMock.mock.calls[1][0].toString()).toContain('start=1');
    expect(fetchMock.mock.calls[0][1].headers['X-linkdapi-apikey']).toBe(
      'linkdapi-key',
    );
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
