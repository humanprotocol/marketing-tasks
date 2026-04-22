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
import { AbuseProbability, IManifest } from '../../common/interfaces/job';

class ManifestRequirementsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required_hashtags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required_keywords?: string[];

  @IsOptional()
  @IsString()
  required_link?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_length?: number;

  @IsOptional()
  @IsBoolean()
  requires_media?: boolean;

  @IsOptional()
  @IsBoolean()
  must_be_public?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_live_duration_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_followers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_account_age_days?: number;
}

class ManifestAiValidationDto {
  @IsIn(['low', 'medium', 'high'])
  allowed_abuse_probability!: AbuseProbability;
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
  job_type!: JobRequestType;

  @IsNumber()
  @Min(0)
  end_date!: number;

  @IsArray()
  @IsString({ each: true })
  platforms!: string[];

  @IsInt()
  @Min(1)
  submissions_required!: number;

  @ValidateNested()
  @Type(() => ManifestCampaignDto)
  campaign!: ManifestCampaignDto;

  @ValidateNested()
  @Type(() => ManifestRequirementsDto)
  requirements!: ManifestRequirementsDto;

  @ValidateNested()
  @Type(() => ManifestAiValidationDto)
  ai_validation!: ManifestAiValidationDto;

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

  return validatedManifest as IManifest;
}
