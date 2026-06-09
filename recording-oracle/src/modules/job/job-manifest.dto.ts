import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
  ValidationError as ClassValidationError,
  validateSync,
} from 'class-validator';

import { ErrorJob } from '../../common/constants/errors';
import { JobRequestType } from '../../common/enums/job';
import { ValidationError } from '../../common/errors';
import {
  AbuseProbability,
  IManifest,
  ISocialMediaEngagementRequirements,
} from '../../common/interfaces/job';

class SocialMediaPromotionRequirementsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredHashtags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredKeywords?: string[];

  @IsOptional()
  @IsString()
  requiredLink?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minLength?: number;

  @IsOptional()
  @IsBoolean()
  requiresMedia?: boolean;

  @IsOptional()
  @IsBoolean()
  mustBePublic?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minLiveDurationHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minFollowers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAccountAgeDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minLikes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minReposts?: number;
}

class XApiCredentialsDto {
  @IsString()
  @IsNotEmpty()
  consumerKey!: string;

  @IsString()
  @IsNotEmpty()
  consumerSecret!: string;

  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  accessTokenSecret!: string;
}

class SocialMediaEngagementRequirementsDto {
  @IsString()
  @IsNotEmpty()
  targetPostUrl!: string;

  @IsOptional()
  @IsBoolean()
  checkLike?: boolean;

  @IsOptional()
  @IsBoolean()
  checkRepost?: boolean;

  @IsOptional()
  @IsBoolean()
  checkQuote?: boolean;

  @IsOptional()
  @IsBoolean()
  checkComment?: boolean;

  @ValidateNested()
  @IsOptional()
  @Type(() => XApiCredentialsDto)
  xApiCredentials?: XApiCredentialsDto;
}

class ManifestAiValidationDto {
  @IsIn(['low', 'medium', 'high'])
  allowedAbuseProbability!: AbuseProbability;
}

class ManifestCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}

class ManifestDto {
  @IsEnum(JobRequestType)
  requestType!: JobRequestType;

  @IsNumber()
  @Min(0)
  endDate!: number;

  @IsArray()
  @IsString({ each: true })
  platforms!: string[];

  @IsInt()
  @Min(1)
  submissionsRequired!: number;

  @ValidateNested()
  @Type(() => ManifestCampaignDto)
  campaign!: ManifestCampaignDto;

  @ValidateNested()
  @Type((options) =>
    options?.object?.requestType === JobRequestType.SOCIAL_MEDIA_ENGAGEMENT
      ? SocialMediaEngagementRequirementsDto
      : SocialMediaPromotionRequirementsDto,
  )
  requirements!:
    | SocialMediaPromotionRequirementsDto
    | SocialMediaEngagementRequirementsDto;

  @ValidateNested()
  @IsOptional()
  @Type(() => ManifestAiValidationDto)
  aiValidation?: ManifestAiValidationDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifications?: string[];
}

function flattenValidationErrors(errors: ClassValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenValidationErrors(error.children ?? []),
  ]);
}

export function validateManifestDto(manifest: IManifest): IManifest {
  const validatedManifest = plainToInstance(ManifestDto, manifest);
  const validationErrors = validateSync(validatedManifest, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });

  if (validationErrors.length > 0) {
    throw new ValidationError(
      ErrorJob.InvalidManifest,
      undefined,
      flattenValidationErrors(validationErrors),
    );
  }

  if (
    validatedManifest.requestType === JobRequestType.SOCIAL_MEDIA_PROMOTION &&
    !validatedManifest.aiValidation
  ) {
    throw new ValidationError(ErrorJob.InvalidManifest, undefined, [
      'aiValidation must be provided for social_media_promotion',
    ]);
  }

  if (
    validatedManifest.requestType === JobRequestType.SOCIAL_MEDIA_ENGAGEMENT
  ) {
    const requirements =
      validatedManifest.requirements as ISocialMediaEngagementRequirements;
    const hasAnyEngagementCheck =
      requirements.checkLike ||
      requirements.checkRepost ||
      requirements.checkQuote ||
      requirements.checkComment;

    if (!requirements.targetPostUrl || !hasAnyEngagementCheck) {
      throw new ValidationError(ErrorJob.InvalidManifest, undefined, [
        'targetPostUrl and at least one engagement check must be provided for social_media_engagement',
      ]);
    }

    if (
      requirements.checkComment &&
      !(requirements.checkLike && requirements.xApiCredentials) &&
      !requirements.checkRepost &&
      !requirements.checkQuote
    ) {
      throw new ValidationError(ErrorJob.InvalidManifest, undefined, [
        'checkComment requires checkRepost, checkQuote, or checkLike with xApiCredentials for social_media_engagement',
      ]);
    }

    if (requirements.checkLike && !requirements.xApiCredentials) {
      throw new ValidationError(ErrorJob.InvalidManifest, undefined, [
        'xApiCredentials must be provided when checkLike is enabled for social_media_engagement',
      ]);
    }

    if (requirements.xApiCredentials && !requirements.checkLike) {
      throw new ValidationError(ErrorJob.InvalidManifest, undefined, [
        'xApiCredentials can only be provided when checkLike is enabled for social_media_engagement',
      ]);
    }
  }

  return validatedManifest as IManifest;
}
