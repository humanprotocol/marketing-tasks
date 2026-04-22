/**
 * Represents error messages related to web3.
 */
export enum ErrorWeb3 {
  InvalidChainId = 'Invalid chain id provided for the configured environment',
}

/**
 * Represents error messages associated to webhook.
 */
export enum ErrorWebhook {
  NotSent = 'Webhook was not sent',
  NotFound = 'Webhook not found',
  UrlNotFound = 'Webhook URL not found',
  NotCreated = 'Webhook has not been created',
  SubmissionForwardFailed = 'An error occurred while sending your submission. Please try again later',
  InvalidOutgoingEventType = 'Invalid outgoing event type',
  OracleNotFound = 'Oracle not found',
  OracleWebhookUrlNotFound = 'Oracle webhook URL not found',
}

/**
 * Represents error messages associated with a cron job.
 */
export enum ErrorAssignment {
  NotFound = 'Assignment not found',
  InvalidStatus = 'Invalid assignment status',
  InvalidAssignment = 'Invalid assignment',
  InvalidAssignmentQualification = 'Invalid assignment qualification',
  InvalidUser = 'Assignment does not belong to the user',
  AlreadyExists = 'Assignment already exists',
  FullyAssigned = 'Fully assigned job',
  ExpiredEscrow = 'Expired escrow',
  InsufficientTimeForLiveDuration = 'Not enough time remains before the job end date to satisfy post duration',
  JobNotFound = 'Job not found',
  ReputationNetworkMismatch = 'Requested job is not in your reputation network',
}

/**
 * Represents error messages associated with jobs.
 */
export enum ErrorJob {
  AlreadyExists = 'Job already exists',
  InvalidAddress = 'Invalid address',
  InvalidPostUrl = 'Invalid X post URL',
  InvalidStatus = 'Invalid job status',
  NotAssigned = 'User is not assigned to the job',
  SolutionAlreadySubmitted = 'User has already submitted a solution',
  PostUrlAlreadySubmitted = 'Post URL has already been submitted',
  JobCompleted = 'This job has already been completed',
  ManifestDecryptionFailed = 'Unable to decrypt manifest',
  ManifestNotFound = 'Unable to get manifest',
  NotFound = 'Job not found',
  AlreadyCompleted = 'Job already completed',
  AlreadyCanceled = 'Job already canceled',
}

/**
 * Represents error messages associated with escrows.
 */
export enum ErrorEscrow {
  NotFound = 'Escrow not found',
}

/**
 * Represents error messages associated with signatures.
 */
export enum ErrorSignature {
  MissingRoles = 'Missing signature roles configuration',
}
