import { Test } from '@nestjs/testing';

import { ErrorJob } from '../../common/constants/errors';
import { JobRequestType } from '../../common/enums/job';
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
            validateSubmissions: jest.fn(),
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
    });
    const submissions = [generateSubmission()];
    const validationResults = [
      {
        submission: submissions[0],
        rejectionReason: null,
      },
    ];
    grokService.validateSubmissions.mockResolvedValue(validationResults);

    await expect(
      validationService.validateSubmissions(submissions, manifest),
    ).resolves.toBe(validationResults);

    expect(grokService.validateSubmissions).toHaveBeenCalledWith(
      submissions,
      manifest,
    );
    expect(xApiService.validateSubmissions).not.toHaveBeenCalled();
  });

  it('delegates engagement validation to X API', async () => {
    const manifest = generateManifest({
      requestType: JobRequestType.SOCIAL_MEDIA_ENGAGEMENT,
    });
    const submissions = [generateSubmission({ solution: 'humanprotocol' })];
    const validationResults = [
      {
        submission: submissions[0],
        rejectionReason: null,
      },
    ];
    xApiService.validateSubmissions.mockResolvedValue(validationResults);

    await expect(
      validationService.validateSubmissions(submissions, manifest),
    ).resolves.toBe(validationResults);

    expect(xApiService.validateSubmissions).toHaveBeenCalledWith(
      submissions,
      manifest,
    );
    expect(grokService.validateSubmissions).not.toHaveBeenCalled();
  });

  it('rejects unsupported job types', async () => {
    const manifest = generateManifest({
      requestType: 'unsupported' as JobRequestType,
    });

    await expect(
      validationService.validateSubmissions([generateSubmission()], manifest),
    ).rejects.toThrow(ErrorJob.InvalidJobType);
  });
});
