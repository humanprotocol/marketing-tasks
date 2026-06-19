import {
  ChainId,
  Encryption,
  EncryptionUtils,
  EscrowClient,
  KVStoreUtils,
} from '@human-protocol/sdk';
import { faker } from '@faker-js/faker';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { VerificationResult } from '../../common/enums/submission';
import { MOCK_ADDRESS, mockConfig } from '../../../test/constants';
import { PGPConfigService } from '../../common/config/pgp-config.service';
import { S3ConfigService } from '../../common/config/s3-config.service';
import { generateRecordingResult } from '../job/fixtures';
import { generatePostUrl } from '../submission/fixtures';
import { Web3Service } from '../web3/web3.service';
import { StorageService } from './storage.service';
import { downloadFileFromUrl } from '../../common/utils/storage';

jest.mock('@human-protocol/sdk', () => ({
  ...jest.requireActual('@human-protocol/sdk'),
  Encryption: {
    build: jest.fn(),
  },
  EncryptionUtils: {
    encrypt: jest.fn(),
  },
  KVStoreUtils: {
    getPublicKey: jest.fn(),
  },
  EscrowClient: {
    build: jest.fn(),
  },
}));

jest.mock('../../common/utils/storage', () => ({
  ...jest.requireActual('../../common/utils/storage'),
  downloadFileFromUrl: jest.fn(),
}));

jest.mock('minio', () => {
  class Client {
    putObject = jest.fn();
    bucketExists = jest.fn();
    constructor() {
      (this as any).protocol = 'http:';
      (this as any).host = 'localhost';
      (this as any).port = 9000;
    }
  }

  return { Client };
});

describe('StorageService', () => {
  let storageService: StorageService;
  let pgpConfigService: PGPConfigService;
  let s3ConfigService: S3ConfigService;

  const signerMock = {
    address: faker.finance.ethereumAddress(),
    getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
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
        StorageService,
        {
          provide: Web3Service,
          useValue: {
            getSigner: jest.fn().mockReturnValue(signerMock),
          },
        },
        PGPConfigService,
        S3ConfigService,
      ],
    }).compile();

    storageService = moduleRef.get<StorageService>(StorageService);
    pgpConfigService = moduleRef.get<PGPConfigService>(PGPConfigService);
    s3ConfigService = moduleRef.get<S3ConfigService>(S3ConfigService);
  });

  describe('uploadJobSolutions', () => {
    beforeAll(async () => {
      (EscrowClient.build as any).mockImplementation(() => ({
        getReputationOracleAddress: jest.fn().mockResolvedValue(MOCK_ADDRESS),
      }));
    });
    describe('succeed', () => {
      it('should upload the solutions with encryption correctly', async () => {
        const workerAddress = faker.finance.ethereumAddress();
        const escrowAddress = faker.finance.ethereumAddress();
        const chainId = ChainId.LOCALHOST;
        const postUrl = generatePostUrl();

        storageService.minioClient.bucketExists = jest
          .fn()
          .mockResolvedValue(true);

        EncryptionUtils.encrypt = jest.fn().mockResolvedValue('encrypted');

        KVStoreUtils.getPublicKey = jest.fn().mockResolvedValue('publicKey');
        jest.spyOn(pgpConfigService, 'encrypt', 'get').mockReturnValue(true);

        const jobSolution = generateRecordingResult({
          workerAddress,
          solution: postUrl,
          verificationResult: VerificationResult.ACCEPTED,
        });
        const fileData = await storageService.uploadJobSolutions(
          escrowAddress,
          chainId,
          [jobSolution],
        );

        expect(fileData.url).toContain(
          `http://${s3ConfigService.endpoint}:${s3ConfigService.port}/${s3ConfigService.bucket}/`,
        );
        expect(fileData.hash).toBeDefined();
        expect(storageService.minioClient.putObject).toHaveBeenCalledWith(
          s3ConfigService.bucket,
          `${fileData.hash}.json`,
          'encrypted',
          undefined,
          {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        );
      });
    });

    describe('fail', () => {
      it('should fail if the bucket does not exist', async () => {
        const workerAddress = faker.finance.ethereumAddress();
        const escrowAddress = faker.finance.ethereumAddress();
        const chainId = ChainId.LOCALHOST;
        const postUrl = generatePostUrl();

        storageService.minioClient.bucketExists = jest
          .fn()
          .mockResolvedValue(false);

        const jobSolution = generateRecordingResult({
          workerAddress,
          solution: postUrl,
          verificationResult: VerificationResult.ACCEPTED,
        });
        await expect(
          storageService.uploadJobSolutions(escrowAddress, chainId, [
            jobSolution,
          ]),
        ).rejects.toThrow('Bucket not found');
      });

      it('should fail if the file cannot be uploaded', async () => {
        const workerAddress = faker.finance.ethereumAddress();
        const escrowAddress = faker.finance.ethereumAddress();
        const chainId = ChainId.LOCALHOST;
        const postUrl = generatePostUrl();

        storageService.minioClient.bucketExists = jest
          .fn()
          .mockResolvedValue(true);
        storageService.minioClient.putObject = jest
          .fn()
          .mockRejectedValue('Network error');
        jest.spyOn(pgpConfigService, 'encrypt', 'get').mockReturnValue(false);
        const jobSolution = generateRecordingResult({
          workerAddress,
          solution: postUrl,
          verificationResult: VerificationResult.ACCEPTED,
        });

        await expect(
          storageService.uploadJobSolutions(escrowAddress, chainId, [
            jobSolution,
          ]),
        ).rejects.toThrow('File not uploaded');
      });

      it('should fail if public key is missing', async () => {
        const workerAddress = faker.finance.ethereumAddress();
        const escrowAddress = faker.finance.ethereumAddress();
        const chainId = ChainId.LOCALHOST;
        const postUrl = generatePostUrl();

        storageService.minioClient.bucketExists = jest
          .fn()
          .mockResolvedValue(true);
        EncryptionUtils.encrypt = jest.fn().mockResolvedValue('encrypted');
        KVStoreUtils.getPublicKey = jest.fn().mockResolvedValue('');
        jest.spyOn(pgpConfigService, 'encrypt', 'get').mockReturnValue(true);
        const jobSolution = generateRecordingResult({
          workerAddress,
          solution: postUrl,
          verificationResult: VerificationResult.ACCEPTED,
        });
        await expect(
          storageService.uploadJobSolutions(escrowAddress, chainId, [
            jobSolution,
          ]),
        ).rejects.toThrow('Encryption error');
      });
    });
  });

  describe('download', () => {
    const downloadFileFromUrlMock = jest.mocked(downloadFileFromUrl);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('succeed', () => {
      it('should download the non encrypted file correctly', async () => {
        const exchangeAddress = faker.finance.ethereumAddress();
        const workerAddress = faker.finance.ethereumAddress();
        const postUrl = generatePostUrl();
        const fileUrl = faker.internet.url();

        const expectedJobFile = {
          exchangeAddress,
          solutions: [
            {
              workerAddress,
              solution: postUrl,
            },
          ],
        };

        downloadFileFromUrlMock.mockResolvedValue(expectedJobFile);
        EncryptionUtils.isEncrypted = jest.fn().mockReturnValue(false);
        const solutionsFile = await storageService.download(fileUrl);
        expect(solutionsFile).toStrictEqual(expectedJobFile);
      });

      it('should parse inline JSON content correctly', async () => {
        const expectedJobFile = {
          exchangeAddress: faker.finance.ethereumAddress(),
          solutions: [
            {
              workerAddress: faker.finance.ethereumAddress(),
              solution: generatePostUrl(),
            },
          ],
        };

        EncryptionUtils.isEncrypted = jest.fn().mockReturnValue(false);
        const solutionsFile = await storageService.download(
          JSON.stringify(expectedJobFile),
        );

        expect(solutionsFile).toStrictEqual(expectedJobFile);
        expect(downloadFileFromUrlMock).not.toHaveBeenCalled();
      });

      it('should download the encrypted file correctly', async () => {
        const exchangeAddress = faker.finance.ethereumAddress();
        const workerAddress = faker.finance.ethereumAddress();
        const postUrl = generatePostUrl();
        const fileUrl = faker.internet.url();

        const expectedJobFile = {
          exchangeAddress,
          solutions: [
            {
              workerAddress,
              solution: postUrl,
            },
          ],
        };

        downloadFileFromUrlMock.mockResolvedValue(
          '-----BEGIN PGP MESSAGE-----\nencrypted\n-----END PGP MESSAGE-----',
        );

        Encryption.build = jest.fn().mockResolvedValue({
          decrypt: jest.fn().mockResolvedValue(JSON.stringify(expectedJobFile)),
        });
        EncryptionUtils.isEncrypted = jest.fn().mockReturnValue(true);
        const solutionsFile = await storageService.download(fileUrl);
        expect(solutionsFile).toStrictEqual(expectedJobFile);
      });

      it('should decrypt encrypted X API credentials in an inline manifest', async () => {
        const expectedCredentials = {
          consumerKey: 'consumer-key',
          consumerSecret: 'consumer-secret',
          accessToken: 'access-token',
          accessTokenSecret: 'access-token-secret',
        };
        const manifest = {
          requestType: 'social_media_engagement',
          platforms: ['x'],
          requirements: {
            targetPostUrl: generatePostUrl(),
            checkLike: true,
            xApiCredentials:
              '-----BEGIN PGP MESSAGE-----\ncredentials\n-----END PGP MESSAGE-----',
          },
        };

        EncryptionUtils.isEncrypted = jest
          .fn()
          .mockImplementation(
            (content: string) =>
              content ===
              '-----BEGIN PGP MESSAGE-----\ncredentials\n-----END PGP MESSAGE-----',
          );
        Encryption.build = jest.fn().mockResolvedValue({
          decrypt: jest
            .fn()
            .mockResolvedValue(JSON.stringify(expectedCredentials)),
        });

        const jobFile = await storageService.download(JSON.stringify(manifest));

        expect(jobFile).toStrictEqual({
          ...manifest,
          requirements: {
            ...manifest.requirements,
            xApiCredentials: expectedCredentials,
          },
        });
        expect(downloadFileFromUrlMock).not.toHaveBeenCalled();
      });
    });

    describe('fail', () => {
      it('should return empty array when file cannot be downloaded', async () => {
        const fileUrl = faker.internet.url();
        downloadFileFromUrlMock.mockRejectedValue('Network error');

        const solutionsFile = await storageService.download(fileUrl);
        expect(solutionsFile).toStrictEqual([]);
      });
    });
  });
});
