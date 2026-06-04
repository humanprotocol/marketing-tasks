import { SubmissionRejectionReason } from '../../common/constants/errors';
import {
  IPostValidationResult,
  ISocialMediaPromotionManifest,
} from '../../common/interfaces/job';

export class SaveSolutionsDto {
  public url: string;
  public hash: string;
}

export type SubmissionValidationRule = {
  isValid: (
    validation: IPostValidationResult,
    manifest: ISocialMediaPromotionManifest,
  ) => boolean;
  rejectionReason: SubmissionRejectionReason;
};
