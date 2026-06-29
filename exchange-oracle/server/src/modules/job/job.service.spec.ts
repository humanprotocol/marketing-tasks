import { faker } from '@faker-js/faker';
import { createMock } from '@golevelup/ts-jest';
import { HMToken__factory } from '@human-protocol/core/typechain-types';
import { Encryption, EscrowClient, EscrowUtils } from '@human-protocol/sdk';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ethers } from 'ethers';

import {
  MOCK_ADDRESS,
  MOCK_MANIFEST_URL,
  mockConfig,
} from '../../../test/constants';
import { createManifest } from '../../../test/fixtures/manifest';
import { PGPConfigService } from '../../common/config/pgp-config.service';
import {
  ErrorAssignment,
  ErrorJob,
  ErrorWebhook,
} from '../../common/constant/errors';
import {
  AssignmentStatus,
  JobFieldName,
  JobStatus,
  JobType,
} from '../../common/enums/job';
import { EventType } from '../../common/enums/webhook';
import { ConflictError, NotFoundError, ServerError } from '../../common/errors';
import { downloadFileFromUrl } from '../../common/utils/storage';
import { AssignmentEntity } from '../assignment/assignment.entity';
import { AssignmentRepository } from '../assignment/assignment.repository';
import { Web3Service } from '../web3/web3.service';
import { WebhookDto } from '../webhook/webhook.dto';
import { WebhookService } from '../webhook/webhook.service';
import { ManifestDto } from './job.dto';
import { JobEntity } from './job.entity';
import { JobRepository } from './job.repository';
import { JobService } from './job.service';

jest.mock('@human-protocol/sdk', () => ({
  ...jest.requireActual('@human-protocol/sdk'),
  EscrowClient: {
    build: jest.fn(),
  },
  Encryption: {
    build: jest.fn(),
  },
}));

jest.mock('../../common/utils/storage', () => ({
  ...jest.requireActual('../../common/utils/storage'),
  downloadFileFromUrl: jest.fn(),
}));

describe('JobService', () => {
  let jobService: JobService;
  let jobRepository: JobRepository;
  let assignmentRepository: AssignmentRepository;
  let webhookService: WebhookService;

  const chainId = 1;
  const escrowAddress = '0x1234567890123456789012345678901234567890';
  const workerAddress = '0x1234567890123456789012345678901234567891';
  const reputationNetwork = '0x1234567890123456789012345678901234567892';

  const signerMock = {
    address: '0x1234567890123456789012345678901234567892',
    getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
            getOrThrow: jest.fn((key: string) => {
              if (!mockConfig[key]) {
                throw new Error(`Configuration key "${key}" does not exist`);
              }
              return mockConfig[key];
            }),
          },
        },
        PGPConfigService,
        {
          provide: Web3Service,
          useValue: {
            getSigner: jest.fn().mockReturnValue(signerMock),
          },
        },
        { provide: JobRepository, useValue: createMock<JobRepository>() },
        {
          provide: AssignmentRepository,
          useValue: createMock<AssignmentRepository>(),
        },
        {
          provide: WebhookService,
          useValue: createMock<WebhookService>(),
        },
      ],
    }).compile();

    jobService = moduleRef.get<JobService>(JobService);
    jobRepository = moduleRef.get<JobRepository>(JobRepository);
    assignmentRepository =
      moduleRef.get<AssignmentRepository>(AssignmentRepository);
    webhookService = moduleRef.get<WebhookService>(WebhookService);
  });

  describe('createJob', () => {
    beforeAll(async () => {
      jest.spyOn(jobRepository, 'createUnique');
      (EscrowClient.build as any).mockImplementation(() => ({
        getManifest: jest.fn().mockResolvedValue(MOCK_MANIFEST_URL),
        getReputationOracleAddress: jest
          .fn()
          .mockResolvedValue(reputationNetwork),
        getTokenAddress: jest.fn().mockResolvedValue(MOCK_ADDRESS),
      }));

      const mockTokenContract: any = {
        symbol: jest.fn(),
      };
      jest
        .spyOn(HMToken__factory, 'connect')
        .mockReturnValue(mockTokenContract);
      jest.spyOn(mockTokenContract, 'symbol').mockReturnValue('HMT');
    });

    const webhook: WebhookDto = {
      chainId,
      escrowAddress,
      eventType: EventType.ESCROW_CREATED,
    };

    describe('succeed', () => {
      it('should create a new job in the database', async () => {
        jest
          .spyOn(jobRepository, 'findOneByChainIdAndEscrowAddress')
          .mockResolvedValue(null);
        const getManifestSpy = jest
          .spyOn(jobService, 'getManifest')
          .mockResolvedValue(createManifest());

        await jobService.createJob(webhook);
        getManifestSpy.mockRestore();

        expect(jobRepository.createUnique).toHaveBeenCalledWith({
          chainId,
          escrowAddress,
          manifest: MOCK_MANIFEST_URL,
          jobType: JobType.SOCIAL_MEDIA_PROMOTION,
          reputationNetwork,
          rewardToken: 'HMT',
          status: JobStatus.ACTIVE,
        });
      });

      it('should create a new job using requestType from the manifest', async () => {
        jest
          .spyOn(jobRepository, 'findOneByChainIdAndEscrowAddress')
          .mockResolvedValue(null);
        const getManifestSpy = jest
          .spyOn(jobService, 'getManifest')
          .mockResolvedValue(
            createManifest({
              requestType: JobType.SOCIAL_MEDIA_ENGAGEMENT,
            }),
          );

        await jobService.createJob(webhook);
        getManifestSpy.mockRestore();

        expect(jobRepository.createUnique).toHaveBeenCalledWith({
          chainId,
          escrowAddress,
          manifest: MOCK_MANIFEST_URL,
          jobType: JobType.SOCIAL_MEDIA_ENGAGEMENT,
          reputationNetwork,
          rewardToken: 'HMT',
          status: JobStatus.ACTIVE,
        });
      });

      it('should create a new job with an inline manifest source', async () => {
        const manifest = createManifest();
        const manifestSource = JSON.stringify(manifest);
        (EscrowClient.build as any).mockResolvedValueOnce({
          getManifest: jest.fn().mockResolvedValue(manifestSource),
          getReputationOracleAddress: jest
            .fn()
            .mockResolvedValue(reputationNetwork),
          getTokenAddress: jest.fn().mockResolvedValue(MOCK_ADDRESS),
        });
        jest
          .spyOn(jobRepository, 'findOneByChainIdAndEscrowAddress')
          .mockResolvedValue(null);
        const getManifestSpy = jest
          .spyOn(jobService, 'getManifest')
          .mockResolvedValue(manifest);

        await jobService.createJob(webhook);

        expect(getManifestSpy).toHaveBeenCalledWith(
          chainId,
          escrowAddress,
          manifestSource,
        );
        expect(jobRepository.createUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            manifest: manifestSource,
            jobType: manifest.requestType,
          }),
        );
        getManifestSpy.mockRestore();
      });
    });

    describe('fail', () => {
      it('should fail if job already exists', async () => {
        jest
          .spyOn(jobRepository, 'findOneByChainIdAndEscrowAddress')
          .mockResolvedValue({
            chainId,
            escrowAddress,
            status: JobStatus.ACTIVE,
          } as JobEntity);

        await expect(jobService.createJob(webhook)).rejects.toThrow(
          'Job already exists',
        );
      });
    });
  });

  describe('completeJob', () => {
    const webhook: WebhookDto = {
      chainId,
      escrowAddress,
      eventType: EventType.ESCROW_COMPLETED,
    };

    describe('succeed', () => {
      it('should complete a job and update all related assignments', async () => {
        const jobEntity = new JobEntity();
        jobEntity.chainId = chainId;
        jobEntity.escrowAddress = escrowAddress;
        jobEntity.status = JobStatus.ACTIVE;
        jobEntity.assignments = [
          {
            id: 1,
            jobId: jobEntity.id,
            status: AssignmentStatus.ACTIVE,
          } as AssignmentEntity,
          {
            id: 2,
            jobId: jobEntity.id,
            status: AssignmentStatus.ACTIVE,
          } as AssignmentEntity,
        ];

        jest
          .spyOn(
            jobRepository,
            'findOneByChainIdAndEscrowAddressWithAssignments',
          )
          .mockResolvedValue(jobEntity);

        await jobService.completeJob(webhook);

        expect(jobRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: JobStatus.COMPLETED,
          }),
        );
      });
    });

    describe('fail', () => {
      it('should throw ServerError if job does not exist', async () => {
        jest
          .spyOn(
            jobRepository,
            'findOneByChainIdAndEscrowAddressWithAssignments',
          )
          .mockResolvedValue(null);

        await expect(jobService.completeJob(webhook)).rejects.toThrow(
          new ServerError(ErrorJob.NotFound),
        );
      });

      it('should throw ConflictError if job is already completed', async () => {
        const jobEntity = new JobEntity();
        jobEntity.chainId = chainId;
        jobEntity.escrowAddress = escrowAddress;
        jobEntity.status = JobStatus.COMPLETED;

        jest
          .spyOn(
            jobRepository,
            'findOneByChainIdAndEscrowAddressWithAssignments',
          )
          .mockResolvedValue(jobEntity);

        await expect(jobService.completeJob(webhook)).rejects.toThrow(
          new ConflictError(ErrorJob.AlreadyCompleted),
        );
      });
    });
  });

  describe('cancelJob', () => {
    const webhook: WebhookDto = {
      chainId,
      escrowAddress,
      eventType: EventType.ESCROW_CANCELED,
    };

    describe('succeed', () => {
      it('should cancel a job and update all related assignments', async () => {
        const jobEntity = new JobEntity();
        jobEntity.chainId = chainId;
        jobEntity.escrowAddress = escrowAddress;
        jobEntity.status = JobStatus.ACTIVE;
        jobEntity.assignments = [
          {
            id: 1,
            jobId: jobEntity.id,
            status: AssignmentStatus.ACTIVE,
          } as AssignmentEntity,
          {
            id: 2,
            jobId: jobEntity.id,
            status: AssignmentStatus.ACTIVE,
          } as AssignmentEntity,
        ];

        jest
          .spyOn(
            jobRepository,
            'findOneByChainIdAndEscrowAddressWithAssignments',
          )
          .mockResolvedValue(jobEntity);

        await jobService.cancelJob(webhook);

        expect(jobRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: JobStatus.CANCELED,
          }),
        );
      });
    });

    describe('fail', () => {
      it('should throw ServerError if job does not exist', async () => {
        jest
          .spyOn(
            jobRepository,
            'findOneByChainIdAndEscrowAddressWithAssignments',
          )
          .mockResolvedValue(null);

        await expect(jobService.cancelJob(webhook)).rejects.toThrow(
          new ServerError(ErrorJob.NotFound),
        );
      });

      it('should throw ConflictError if job is already canceled', async () => {
        const jobEntity = new JobEntity();
        jobEntity.chainId = chainId;
        jobEntity.escrowAddress = escrowAddress;
        jobEntity.status = JobStatus.CANCELED;

        jest
          .spyOn(
            jobRepository,
            'findOneByChainIdAndEscrowAddressWithAssignments',
          )
          .mockResolvedValue(jobEntity);

        await expect(jobService.cancelJob(webhook)).rejects.toThrow(
          new ConflictError(ErrorJob.AlreadyCanceled),
        );
      });
    });
  });

  describe('getJobList', () => {
    const jobs = [
      {
        jobId: 1,
        chainId: 1,
        escrowAddress,
        manifest: MOCK_MANIFEST_URL,
        jobType: JobType.SOCIAL_MEDIA_PROMOTION,
        status: JobStatus.ACTIVE,
        createdAt: new Date(),
      },
    ];

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('succeed', () => {
      it('should return an array of jobs calling the manifest', async () => {
        const manifest: ManifestDto = createManifest();

        jest.spyOn(jobService, 'getManifest').mockResolvedValue(manifest);
        jest
          .spyOn(jobRepository, 'fetchFiltered')
          .mockResolvedValueOnce({ entities: jobs as any, itemCount: 1 });

        const result = await jobService.getJobList(
          {
            chainId,
            jobType: JobType.SOCIAL_MEDIA_PROMOTION,
            fields: [JobFieldName.JobDescription],
            escrowAddress,
            status: JobStatus.ACTIVE,
            page: 0,
            pageSize: 10,
            skip: 0,
          },
          workerAddress,
        );

        expect(result.totalResults).toEqual(1);
        expect(result.results[0]).toMatchObject({
          chainId: 1,
          jobDescription: manifest.campaign.description,
          escrowAddress,
          jobType: JobType.SOCIAL_MEDIA_PROMOTION,
          status: JobStatus.ACTIVE,
        });
      });

      it('should calculate reward amount from net funded amount', async () => {
        const decimals = faker.number.int({ min: 6, max: 18 });
        const submissionsRequired = faker.number.int({ min: 1, max: 10 });
        const fundedAmount = faker.number.int({ min: 100, max: 1000 });
        const recordingOracleFee = faker.number.int({ min: 1, max: 5 });
        const reputationOracleFee = faker.number.int({ min: 1, max: 5 });
        const exchangeOracleFee = faker.number.int({ min: 1, max: 5 });
        const totalFundedAmount =
          BigInt(fundedAmount) * 10n ** BigInt(decimals);
        const netFundAmount =
          totalFundedAmount -
          (totalFundedAmount * BigInt(recordingOracleFee)) / 100n -
          (totalFundedAmount * BigInt(reputationOracleFee)) / 100n -
          (totalFundedAmount * BigInt(exchangeOracleFee)) / 100n;
        const expectedRewardAmount = (
          Number(ethers.formatUnits(netFundAmount, decimals)) /
          submissionsRequired
        ).toString();
        const manifest: ManifestDto = createManifest({
          submissionsRequired,
        });

        jest.spyOn(jobService, 'getManifest').mockResolvedValue(manifest);
        jest.spyOn(EscrowUtils, 'getEscrow').mockResolvedValue({
          token: faker.finance.ethereumAddress(),
          totalFundedAmount,
          recordingOracleFee,
          reputationOracleFee,
          exchangeOracleFee,
        } as any);
        jest.spyOn(HMToken__factory, 'connect').mockReturnValue({
          decimals: jest.fn().mockResolvedValue(decimals),
        } as any);
        jest
          .spyOn(jobRepository, 'fetchFiltered')
          .mockResolvedValueOnce({ entities: jobs as any, itemCount: 1 });

        const result = await jobService.getJobList(
          {
            chainId,
            jobType: JobType.SOCIAL_MEDIA_PROMOTION,
            fields: [JobFieldName.RewardAmount],
            escrowAddress,
            status: JobStatus.ACTIVE,
            page: 0,
            pageSize: 10,
            skip: 0,
          },
          workerAddress,
        );

        expect(result.results[0].rewardAmount).toBe(expectedRewardAmount);
      });

      it('should return an array of jobs without calling the manifest', async () => {
        jest.spyOn(jobService, 'getManifest');
        jest
          .spyOn(jobRepository, 'fetchFiltered')
          .mockResolvedValueOnce({ entities: jobs as any, itemCount: 1 });

        const result = await jobService.getJobList(
          {
            chainId,
            jobType: JobType.SOCIAL_MEDIA_PROMOTION,
            fields: [JobFieldName.CreatedAt],
            escrowAddress,
            status: JobStatus.ACTIVE,
            page: 0,
            pageSize: 10,
            skip: 0,
          },
          workerAddress,
        );

        expect(result.totalResults).toEqual(1);
        expect(result.results[0]).toEqual({
          chainId: 1,
          createdAt: expect.any(String),
          escrowAddress,
          jobType: JobType.SOCIAL_MEDIA_PROMOTION,
          status: JobStatus.ACTIVE,
        });
      });

      it('should return engagement jobs with their persisted job type', async () => {
        jest.spyOn(jobRepository, 'fetchFiltered').mockResolvedValueOnce({
          entities: [
            {
              ...jobs[0],
              jobType: JobType.SOCIAL_MEDIA_ENGAGEMENT,
            },
          ] as any,
          itemCount: 1,
        });

        const result = await jobService.getJobList(
          {
            chainId,
            jobType: JobType.SOCIAL_MEDIA_ENGAGEMENT,
            fields: [],
            escrowAddress,
            status: JobStatus.ACTIVE,
            page: 0,
            pageSize: 10,
            skip: 0,
          },
          workerAddress,
        );

        expect(result.results[0].jobType).toBe(JobType.SOCIAL_MEDIA_ENGAGEMENT);
      });
    });
  });

  describe('solveJob', () => {
    const assignment = {
      id: 1,
      jobId: 1,
      workerAddress,
      status: AssignmentStatus.ACTIVE,
      job: {
        escrowAddress,
        chainId,
        status: JobStatus.ACTIVE,
      },
    } as AssignmentEntity;

    beforeEach(() => {
      jest.clearAllMocks();
      assignment.status = AssignmentStatus.ACTIVE;
      assignment.job.status = JobStatus.ACTIVE;
    });

    describe('succeed', () => {
      it('should forward the submission to the recording oracle and update assignment status', async () => {
        jest
          .spyOn(assignmentRepository, 'findOneById')
          .mockResolvedValue(assignment as AssignmentEntity);
        jest.spyOn(webhookService, 'sendWebhook').mockResolvedValue(undefined);

        await jobService.solveJob(assignment.id, 'https://x.com/test/status/1');

        expect(webhookService.sendWebhook).toHaveBeenCalledWith({
          chainId,
          escrowAddress,
          eventType: EventType.SUBMISSION_IN_REVIEW,
          eventData: {
            assigneeId: workerAddress,
            solution: 'https://x.com/test/status/1',
          },
        });
        expect(assignmentRepository.updateOne).toHaveBeenCalledWith(
          expect.objectContaining({
            id: assignment.id,
            status: AssignmentStatus.VALIDATION,
          }),
        );
      });
    });

    describe('fail', () => {
      it('should fail if assignment status is not ACTIVE', async () => {
        assignment.status = AssignmentStatus.CANCELED;
        jest
          .spyOn(assignmentRepository, 'findOneById')
          .mockResolvedValue(assignment as AssignmentEntity);

        await expect(
          jobService.solveJob(1, 'https://x.com/test/status/1'),
        ).rejects.toThrow(new ConflictError(ErrorAssignment.InvalidStatus));
      });

      it('should fail if user is not assigned to the job', async () => {
        jest.spyOn(assignmentRepository, 'findOneById').mockResolvedValue(null);

        await expect(
          jobService.solveJob(1, 'https://x.com/test/status/1'),
        ).rejects.toThrow('Assignment not found');
      });

      it('should fail if job status is not ACTIVE', async () => {
        assignment.job.status = JobStatus.COMPLETED;
        jest
          .spyOn(assignmentRepository, 'findOneById')
          .mockResolvedValue(assignment as AssignmentEntity);

        await expect(
          jobService.solveJob(1, 'https://x.com/test/status/1'),
        ).rejects.toThrow(new ConflictError(ErrorJob.InvalidStatus));
      });

      it('should surface a generic retry-later error when webhook forwarding fails', async () => {
        jest
          .spyOn(assignmentRepository, 'findOneById')
          .mockResolvedValue(assignment as AssignmentEntity);
        jest
          .spyOn(webhookService, 'sendWebhook')
          .mockRejectedValue(new Error('network failure'));

        await expect(
          jobService.solveJob(1, 'https://x.com/test/status/1'),
        ).rejects.toThrow(
          new ServerError(ErrorWebhook.SubmissionForwardFailed),
        );
      });

      it('should surface the downstream webhook message when available', async () => {
        jest
          .spyOn(assignmentRepository, 'findOneById')
          .mockResolvedValue(assignment as AssignmentEntity);
        const downstreamError: any = new Error(
          'Request failed with status code 400',
        );
        downstreamError.responseMessage =
          'Manifest does not contain the required data';
        jest
          .spyOn(webhookService, 'sendWebhook')
          .mockRejectedValue(downstreamError);

        await expect(
          jobService.solveJob(1, 'https://x.com/test/status/1'),
        ).rejects.toThrow(
          new ServerError('Manifest does not contain the required data'),
        );
      });
    });
  });

  describe('processInvalidJobSolution', () => {
    describe('succeed', () => {
      it('should mark a worker assignment as rejected', async () => {
        assignmentRepository.findOneByEscrowAndWorker = jest
          .fn()
          .mockResolvedValue({
            id: 1,
            status: AssignmentStatus.VALIDATION,
          });

        await jobService.processInvalidJobSolution({
          chainId,
          escrowAddress,
          eventType: EventType.SUBMISSION_REJECTED,
          eventData: { assignments: [{ assigneeId: workerAddress }] },
        });

        expect(assignmentRepository.updateOne).toHaveBeenCalledWith({
          id: 1,
          status: AssignmentStatus.REJECTED,
        });
      });
    });

    describe('fail', () => {
      it('should throw an error if the assignment is not found', async () => {
        assignmentRepository.findOneByEscrowAndWorker = jest
          .fn()
          .mockResolvedValue(null);

        await expect(
          jobService.processInvalidJobSolution({
            chainId,
            escrowAddress,
            eventType: EventType.SUBMISSION_REJECTED,
            eventData: { assignments: [{ assigneeId: workerAddress }] },
          }),
        ).rejects.toThrow(`Solution not found in Escrow: ${escrowAddress}`);
      });
    });
  });

  describe('getManifest', () => {
    const downloadFileFromUrlMock = jest.mocked(downloadFileFromUrl);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('succeed', () => {
      it('should return a parsed manifest', async () => {
        const manifest = createManifest();
        downloadFileFromUrlMock.mockResolvedValueOnce(manifest);

        await expect(
          jobService.getManifest(chainId, escrowAddress, MOCK_MANIFEST_URL),
        ).resolves.toEqual(manifest);
      });

      it('should return an inline JSON manifest', async () => {
        const manifest = createManifest();

        await expect(
          jobService.getManifest(
            chainId,
            escrowAddress,
            JSON.stringify(manifest),
          ),
        ).resolves.toEqual(manifest);

        expect(downloadFileFromUrlMock).not.toHaveBeenCalled();
      });

      it('should return an inline JSON manifest with encrypted X API credentials', async () => {
        const manifest = {
          ...createManifest(),
          requestType: JobType.SOCIAL_MEDIA_ENGAGEMENT,
          platforms: ['x'],
          requirements: {
            targetPostUrl: faker.internet.url(),
            checkLike: true,
            xApiCredentials:
              '-----BEGIN PGP MESSAGE-----\ncontent\n-----END PGP MESSAGE-----',
          },
        };

        await expect(
          jobService.getManifest(
            chainId,
            escrowAddress,
            JSON.stringify(manifest),
          ),
        ).resolves.toEqual(manifest);

        expect(Encryption.build).not.toHaveBeenCalled();
        expect(downloadFileFromUrlMock).not.toHaveBeenCalled();
      });

      it('should decrypt an encrypted manifest', async () => {
        const manifest = createManifest();
        downloadFileFromUrlMock.mockResolvedValueOnce(
          '-----BEGIN PGP MESSAGE-----\nencrypted\n-----END PGP MESSAGE-----',
        );
        (Encryption.build as any).mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue(JSON.stringify(manifest)),
        });

        await expect(
          jobService.getManifest(chainId, escrowAddress, MOCK_MANIFEST_URL),
        ).resolves.toEqual(manifest);
      });
    });

    describe('fail', () => {
      it('should send an escrow failed webhook and throw when manifest is missing', async () => {
        downloadFileFromUrlMock.mockRejectedValueOnce(new Error('missing'));
        jest.spyOn(webhookService, 'sendWebhook').mockResolvedValue(undefined);

        await expect(
          jobService.getManifest(chainId, escrowAddress, MOCK_MANIFEST_URL),
        ).rejects.toThrow(new NotFoundError(ErrorJob.ManifestNotFound));

        expect(webhookService.sendWebhook).toHaveBeenCalledWith({
          chainId,
          escrowAddress,
          eventType: EventType.ESCROW_FAILED,
          eventData: { reason: ErrorJob.ManifestNotFound },
        });
      });
    });
  });
});
