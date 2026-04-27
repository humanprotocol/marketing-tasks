import { IManifest, IPostValidationResult } from '../../common/interfaces/job';

export abstract class ValidationService {
  abstract validatePost(
    postUrl: string,
    manifest: IManifest,
  ): Promise<IPostValidationResult | null>;
}
