import { SubmissionRejectionReason } from '../../common/constants/errors';
import { IManifest, IPostValidationResult } from '../../common/interfaces/job';

export class SaveSolutionsDto {
  public url: string;
  public hash: string;
}

export type SubmissionValidationRule = {
  isValid: (validation: IPostValidationResult, manifest: IManifest) => boolean;
  rejectionReason: SubmissionRejectionReason;
};
