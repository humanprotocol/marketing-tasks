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
  jobType!: JobRequestType;

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
  @Type(() => ManifestRequirementsDto)
  requirements!: ManifestRequirementsDto;

  @ValidateNested()
  @Type(() => ManifestAiValidationDto)
  aiValidation!: ManifestAiValidationDto;

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
