import { SubmissionRejectionReason } from '../../common/constants/errors';
import { IGrokValidationResult, IManifest } from '../../common/interfaces/job';

export class SaveSolutionsDto {
  public url: string;
  public hash: string;
}

export type SubmissionValidationRule = {
  isValid: (validation: IGrokValidationResult, manifest: IManifest) => boolean;
  rejectionReason: SubmissionRejectionReason;
};
