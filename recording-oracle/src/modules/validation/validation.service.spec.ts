import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { IManifest, IPostValidationResult } from '../../common/interfaces/job';
import { generateManifest } from '../job/fixtures';
import { generatePostUrl } from '../submission/fixtures';
import { generatePostValidationResult } from './fixtures';
import { ValidationService } from './validation.service';

class TestValidationService extends ValidationService {
  validatePost = jest.fn<
    Promise<IPostValidationResult | null>,
    [string, IManifest]
  >();
}

describe('ValidationService', () => {
  let validationService: TestValidationService;

  const manifest = generateManifest({ submissionsRequired: 1 });
  const validationResult = generatePostValidationResult();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ValidationService,
          useClass: TestValidationService,
        },
      ],
    }).compile();

    validationService = moduleRef.get(ValidationService);
  });

  describe('validatePost', () => {
    describe('succeed', () => {
      it('resolves validation results through the validation service token', async () => {
        const postUrl = generatePostUrl();
        validationService.validatePost.mockResolvedValue(validationResult);

        await expect(
          validationService.validatePost(postUrl, manifest),
        ).resolves.toBe(validationResult);

        expect(validationService.validatePost).toHaveBeenCalledWith(
          postUrl,
          manifest,
        );
      });

      it('allows implementations to return null when validation cannot be completed', async () => {
        validationService.validatePost.mockResolvedValue(null);

        await expect(
          validationService.validatePost(faker.internet.url(), manifest),
        ).resolves.toBeNull();
      });
    });
  });
});
