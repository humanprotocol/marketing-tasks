import {
  ChainId,
  EscrowClient,
  EscrowStatus,
  EscrowUtils,
} from '@human-protocol/sdk';
import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';
import { ethers } from 'ethers';

import { Web3ConfigService } from '../../common/config/web3-config.service';
import { ErrorCommon, ErrorJob } from '../../common/constants/errors';
import { JobRequestType, JobStatus } from '../../common/enums/job';
import { VerificationResult } from '../../common/enums/submission';
import { EventType, WebhookStatus } from '../../common/enums/webhook';
import { ValidationError } from '../../common/errors';
import { IRecordingResult } from '../../common/interfaces/job';
import { StorageService } from '../../modules/storage/storage.service';
import { Web3Service } from '../../modules/web3/web3.service';
import { WebhookRepository } from '../../modules/webhook/webhook.repository';
import {
  generateJob,
  generateManifest,
  generateRecordingResult,
} from './fixtures';
import { JobRepository } from './job.repository';
import { JobService } from './job.service';

jest.mock('@human-protocol/sdk', () => ({
  ...jest.requireActual('@human-protocol/sdk'),
  EscrowClient: {
    build: jest.fn(),
  },
  EscrowUtils: {
    getEscrow: jest.fn(),
  },
}));

describe('JobService', () => {
  let jobService: JobService;
  let jobRepository: jest.Mocked<JobRepository>;
  let webhookRepository: jest.Mocked<WebhookRepository>;
  let storageService: jest.Mocked<StorageService>;
  let web3Service: jest.Mocked<Web3Service>;

  const chainId = ChainId.LOCALHOST;
  const escrowAddress = faker.finance.ethereumAddress();
  const recordingOracleAddress = ethers.getAddress(
    faker.finance.ethereumAddress(),
  );
  const signer = {
    getAddress: jest.fn().mockResolvedValue(recordingOracleAddress),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: JobRepository,
          useValue: {
            createUnique: jest.fn(),
            findOneByChainIdAndEscrowAddress: jest.fn(),
            findAfterSubmissionDeadline: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: WebhookRepository,
          useValue: {
            createUnique: jest.fn(),
          },
        },
        {
          provide: Web3Service,
          useValue: {
            getSigner: jest.fn().mockReturnValue(signer),
          },
        },
        {
          provide: StorageService,
          useValue: {
            download: jest.fn(),
            uploadJobSolutions: jest.fn(),
          },
        },
        {
          provide: Web3ConfigService,
          useValue: {
            txTimeoutMs: 10_000,
          },
        },
      ],
    }).compile();

    jobService = moduleRef.get(JobService);
    jobRepository = moduleRef.get(JobRepository);
    webhookRepository = moduleRef.get(WebhookRepository);
    storageService = moduleRef.get(StorageService);
    web3Service = moduleRef.get(Web3Service);
  });

  it('creates the service', () => {
    expect(jobService).toBeDefined();
  });

  describe('createJob', () => {
    describe('succeed', () => {
      it('returns an existing job without loading the manifest', async () => {
        const job = generateJob({ chainId, escrowAddress });
        jobRepository.findOneByChainIdAndEscrowAddress.mockResolvedValue(job);

        await expect(
          jobService.createJob(chainId, escrowAddress),
        ).resolves.toBe(job);

        expect(web3Service.getSigner).not.toHaveBeenCalled();
        expect(storageService.download).not.toHaveBeenCalled();
        expect(jobRepository.createUnique).not.toHaveBeenCalled();
      });

      it('creates a job from a valid escrow manifest', async () => {
        const manifestUrl = faker.internet.url();
        const manifest = generateManifest();
        const escrowClient = {
          getManifest: jest.fn().mockResolvedValue(manifestUrl),
        };

        jobRepository.findOneByChainIdAndEscrowAddress.mockResolvedValue(null);
        (EscrowClient.build as jest.Mock).mockResolvedValue(escrowClient);
        storageService.download.mockResolvedValue(manifest);
        jobRepository.createUnique.mockImplementation(async (job) => job);

        const job = await jobService.createJob(chainId, escrowAddress);

        expect(web3Service.getSigner).toHaveBeenCalledWith(chainId);
        expect(escrowClient.getManifest).toHaveBeenCalledWith(escrowAddress);
        expect(jobRepository.createUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            chainId,
            escrowAddress,
            jobType: JobRequestType.SOCIAL_MEDIA_PROMOTION,
            manifestUrl,
            endDate: new Date(manifest.endDate),
          }),
        );
        expect(job.manifestUrl).toBe(manifestUrl);
      });
    });

    describe('fail', () => {
      it('rejects manifests with unsupported job types', async () => {
        const escrowClient = {
          getManifest: jest.fn().mockResolvedValue(faker.internet.url()),
        };

        jobRepository.findOneByChainIdAndEscrowAddress.mockResolvedValue(null);
        (EscrowClient.build as jest.Mock).mockResolvedValue(escrowClient);
        storageService.download.mockResolvedValue(
          generateManifest({ requestType: 'unsupported' as JobRequestType }),
        );

        await expect(
          jobService.createJob(chainId, escrowAddress),
        ).rejects.toThrow(ErrorJob.InvalidManifest);
        expect(jobRepository.createUnique).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleProcessingError', () => {
    describe('succeed', () => {
      it('increments retries and marks the job as failed at the retry limit', async () => {
        const job = generateJob({ retriesCount: 4 });

        await jobService.handleProcessingError(job);

        expect(jobRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({
            retriesCount: 5,
            status: JobStatus.FAILED,
          }),
        );
      });
    });
  });

  describe('storeResults', () => {
    const results: IRecordingResult[] = [
      generateRecordingResult({
        workerAddress: faker.finance.ethereumAddress(),
        postUrl: faker.internet.url(),
        verificationResult: VerificationResult.ACCEPTED,
      }),
      generateRecordingResult({
        workerAddress: faker.finance.ethereumAddress(),
        postUrl: faker.internet.url(),
        verificationResult: VerificationResult.REJECTED,
      }),
    ];

    describe('succeed', () => {
      it('does not store empty result sets', async () => {
        await jobService.storeResults(generateJob(), 2, []);

        expect(storageService.uploadJobSolutions).not.toHaveBeenCalled();
        expect(jobRepository.updateOne).not.toHaveBeenCalled();
      });

      it('uploads results and stores the accepted reserved amount on-chain', async () => {
        const job = generateJob({ chainId, escrowAddress });
        const uploadedResults = {
          url: faker.internet.url(),
          hash: faker.string.hexadecimal({ length: 66 }),
        };
        const escrowClient = {
          storeResults: jest.fn(),
        };

        (EscrowClient.build as jest.Mock).mockResolvedValue(escrowClient);
        (EscrowUtils.getEscrow as jest.Mock).mockResolvedValue({
          totalFundedAmount: 99n,
          recordingOracleFee: 1,
          reputationOracleFee: 1,
          exchangeOracleFee: 1,
        });
        storageService.uploadJobSolutions.mockResolvedValue(uploadedResults);

        await jobService.storeResults(job, 2, results);

        expect(storageService.uploadJobSolutions).toHaveBeenCalledWith(
          escrowAddress,
          chainId,
          results,
        );
        expect(escrowClient.storeResults).toHaveBeenCalledWith(
          escrowAddress,
          uploadedResults.url,
          uploadedResults.hash,
          49n,
          { timeoutMs: 10_000 },
        );
        expect(jobRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({ status: JobStatus.COMPLETED }),
        );
      });
    });

    describe('fail', () => {
      it('fails when the escrow cannot be found', async () => {
        (EscrowClient.build as jest.Mock).mockResolvedValue({
          storeResults: jest.fn(),
        });
        (EscrowUtils.getEscrow as jest.Mock).mockResolvedValue(null);
        storageService.uploadJobSolutions.mockResolvedValue({
          url: faker.internet.url(),
          hash: faker.string.hexadecimal({ length: 66 }),
        });

        await expect(
          jobService.storeResults(generateJob(), 2, results),
        ).rejects.toThrow(ErrorCommon.EscrowNotFound);
      });
    });
  });

  describe('cancelJob', () => {
    describe('succeed', () => {
      it('stores cancellation results, queues a webhook, and completes the local job', async () => {
        const job = generateJob({ chainId, escrowAddress });
        const intermediateResultsURL = faker.internet.url();
        const intermediateResultsHash = faker.string.hexadecimal({
          length: 66,
        });
        const escrowClient = {
          getRecordingOracleAddress: jest
            .fn()
            .mockResolvedValue(recordingOracleAddress),
          getStatus: jest.fn().mockResolvedValue(EscrowStatus.ToCancel),
          getIntermediateResultsUrl: jest
            .fn()
            .mockResolvedValue(intermediateResultsURL),
          getIntermediateResultsHash: jest
            .fn()
            .mockResolvedValue(intermediateResultsHash),
          storeResults: jest.fn(),
        };

        (EscrowClient.build as jest.Mock).mockResolvedValue(escrowClient);
        jobRepository.findOneByChainIdAndEscrowAddress.mockResolvedValue(job);

        await expect(
          jobService.cancelJob({ chainId, escrowAddress } as never),
        ).resolves.toBe('Job canceled successfully.');

        expect(escrowClient.storeResults).toHaveBeenCalledWith(
          escrowAddress,
          intermediateResultsURL,
          intermediateResultsHash,
          0n,
          { timeoutMs: 10_000 },
        );
        expect(webhookRepository.createUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            chainId,
            escrowAddress,
            eventType: EventType.JOB_CANCELED,
            status: WebhookStatus.PENDING,
          }),
        );
        expect(jobRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({ status: JobStatus.COMPLETED }),
        );
      });
    });

    describe('fail', () => {
      it('rejects when the configured signer is not the recording oracle', async () => {
        (EscrowClient.build as jest.Mock).mockResolvedValue({
          getRecordingOracleAddress: jest
            .fn()
            .mockResolvedValue(faker.finance.ethereumAddress()),
        });

        await expect(
          jobService.cancelJob({ chainId, escrowAddress } as never),
        ).rejects.toThrow(ErrorJob.AddressMismatches);
      });
    });
  });

  describe('getManifest', () => {
    describe('succeed', () => {
      it('downloads and validates a manifest', async () => {
        const manifest = generateManifest();
        storageService.download.mockResolvedValue(manifest);

        await expect(
          jobService.getManifest(faker.internet.url()),
        ).resolves.toEqual(
          expect.objectContaining({
            requestType: JobRequestType.SOCIAL_MEDIA_PROMOTION,
            submissionsRequired: manifest.submissionsRequired,
          }),
        );
      });
    });

    describe('fail', () => {
      it('rejects invalid manifests', async () => {
        storageService.download.mockResolvedValue({
          ...generateManifest(),
          submissionsRequired: 0,
        });

        await expect(
          jobService.getManifest(faker.internet.url()),
        ).rejects.toBeInstanceOf(ValidationError);
      });
    });
  });
});
