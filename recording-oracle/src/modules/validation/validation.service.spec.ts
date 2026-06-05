import { Test } from '@nestjs/testing';

import { JobRequestType } from '../../common/enums/job';
import {
  ISocialMediaEngagementManifest,
  ISocialMediaPromotionManifest,
} from '../../common/interfaces/job';
import { generateManifest } from '../job/fixtures';
import { generateSubmission } from '../submission/fixtures';
import { GrokService } from './grok/grok.service';
import { ValidationService } from './validation.service';
import { XApiService } from './x-api/x-api.service';

describe('ValidationService', () => {
  let validationService: ValidationService;
  let grokService: jest.Mocked<GrokService>;
  let xApiService: jest.Mocked<XApiService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ValidationService,
        {
          provide: GrokService,
          useValue: {
            validateSubmission: jest.fn(),
          },
        },
        {
          provide: XApiService,
          useValue: {
            validateSubmissions: jest.fn(),
          },
        },
      ],
    }).compile();

    validationService = moduleRef.get(ValidationService);
    grokService = moduleRef.get(GrokService);
    xApiService = moduleRef.get(XApiService);
  });

  it('delegates promotion validation to Grok', async () => {
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_PROMOTION,
    }) as ISocialMediaPromotionManifest;
    const submission = generateSubmission();
    const validationResult = {
      submission,
      rejectionReason: null,
    };
    grokService.validateSubmission.mockResolvedValue(validationResult);

    await expect(
      validationService.validatePromotionSubmission(submission, manifest),
    ).resolves.toBe(validationResult);

    expect(grokService.validateSubmission).toHaveBeenCalledWith(
      submission,
      manifest,
    );
    expect(xApiService.validateSubmissions).not.toHaveBeenCalled();
  });

  it('delegates engagement validation to X API', async () => {
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
    }) as ISocialMediaEngagementManifest;
    const submissions = [generateSubmission({ solution: 'humanprotocol' })];
    const validationResults = [
      {
        submission: submissions[0],
        rejectionReason: null,
      },
    ];
    xApiService.validateSubmissions.mockResolvedValue(validationResults);

    await expect(
      validationService.validateEngagementSubmissions(submissions, manifest),
    ).resolves.toBe(validationResults);

    expect(xApiService.validateSubmissions).toHaveBeenCalledWith(
      submissions,
      manifest,
    );
    expect(grokService.validateSubmission).not.toHaveBeenCalled();
  });
});
