/**
 * Represents error messages associated with a job.
 */
export enum ErrorJob {
  AddressMismatches = 'Escrow Recording Oracle address mismatches the current one',
  InvalidStatus = 'Escrow is not in the Pending status',
  InvalidManifest = 'Manifest does not contain the required data',
  InvalidJobType = 'Manifest contains an invalid job type',
  SolutionAlreadyExists = 'Solution already exists',
  InvalidPostUrl = 'Post URL must be a valid x.com status URL',
  InvalidXUsername = 'X username must be a valid handle',
}

/**
 * Represents error messages associated with submissions.
 */
export enum ErrorSubmission {
  MissingSubmissionData = 'Missing submission data',
  UnknownSubmissionError = 'Unknown submission error',
}

/**
 * Represents submission rejection reasons.
 */
export enum SubmissionRejectionReason {
  DuplicateSubmission = 'Duplicated submission',
  InvalidPostValidation = 'Invalid post URL or unable to validate post',
  PostNotFound = 'Post not found',
  PostNotPublic = 'Post not public',
  MissingRequiredHashtag = 'Missing required hashtag',
  MissingRequiredKeyword = 'Missing required keyword',
  MissingRequiredLink = 'Missing required link',
  MinLengthNotMet = 'Minimum length not met',
  RequiredMediaMissing = 'Required media missing',
  MinFollowersNotMet = 'Minimum followers not met',
  MinAccountAgeNotMet = 'Minimum account age not met',
  MinLiveDurationNotMet = 'Minimum live duration not met',
  MinLikesNotMet = 'Minimum likes not met',
  MinRepostsNotMet = 'Minimum reposts not met',
  InvalidXUsername = 'Invalid X username',
  TargetPostNotFound = 'Target post not found',
  MissingRequiredLike = 'Missing required like',
  MissingRequiredRepost = 'Missing required repost',
  MissingRequiredQuote = 'Missing required quote',
  MissingRequiredComment = 'Missing required comment',
  AbuseProbabilityTooHigh = 'Abuse probability too high',
}

/**
 * Represents common validation and authentication errors.
 */
export enum ErrorCommon {
  ValidationFailed = 'Validation failed',
  ValidationError = 'Validation error',
  InvalidPayload = 'Invalid payload',
  Unauthorized = 'Unauthorized',
  EscrowNotFound = 'Escrow not found',
  SignatureNotVerified = 'Signature not verified',
  InvalidSignature = 'Invalid signature',
}

/**
 * Represents storage and encryption related errors.
 */
export enum ErrorStorage {
  UnableDecryptManifest = 'Unable to decrypt manifest',
  BucketNotFound = 'Bucket not found',
  MissingPublicKey = 'Missing public key',
  EncryptionError = 'Encryption error',
  FileNotUploaded = 'File not uploaded',
}
