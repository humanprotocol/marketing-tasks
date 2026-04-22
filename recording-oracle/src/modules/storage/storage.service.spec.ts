import {
  ChainId,
  Encryption,
  EncryptionUtils,
  EscrowClient,
  KVStoreUtils,
} from '@human-protocol/sdk';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  MOCK_ADDRESS,
  MOCK_FILE_URL,
  mockConfig,
} from '../../../test/constants';
import { PGPConfigService } from '../../common/config/pgp-config.service';
import { S3ConfigService } from '../../common/config/s3-config.service';
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
    address: '0x1234567890123456789012345678901234567892',
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
    it('should upload the solutions with encryption correctly', async () => {
      const workerAddress = '0x1234567890123456789012345678901234567891';
      const escrowAddress = '0x1234567890123456789012345678901234567890';
      const chainId = ChainId.LOCALHOST;
      const postUrl = 'https://x.com/example/status/12345';

      storageService.minioClient.bucketExists = jest
        .fn()
        .mockResolvedValue(true);

      EncryptionUtils.encrypt = jest.fn().mockResolvedValue('encrypted');

      KVStoreUtils.getPublicKey = jest.fn().mockResolvedValue('publicKey');
      jest.spyOn(pgpConfigService, 'encrypt', 'get').mockReturnValue(true);

      const jobSolution = {
        workerAddress,
        postUrl,
        status: 'accepted' as const,
      };
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

    it('should fail if the bucket does not exist', async () => {
      const workerAddress = '0x1234567890123456789012345678901234567891';
      const escrowAddress = '0x1234567890123456789012345678901234567890';
      const chainId = ChainId.LOCALHOST;
      const postUrl = 'https://x.com/example/status/12345';

      storageService.minioClient.bucketExists = jest
        .fn()
        .mockResolvedValue(false);

      const jobSolution = {
        workerAddress,
        postUrl,
        status: 'accepted' as const,
      };
      await expect(
        storageService.uploadJobSolutions(escrowAddress, chainId, [
          jobSolution,
        ]),
      ).rejects.toThrow('Bucket not found');
    });

    it('should fail if the file cannot be uploaded', async () => {
      const workerAddress = '0x1234567890123456789012345678901234567891';
      const escrowAddress = '0x1234567890123456789012345678901234567890';
      const chainId = ChainId.LOCALHOST;
      const postUrl = 'https://x.com/example/status/12345';

      storageService.minioClient.bucketExists = jest
        .fn()
        .mockResolvedValue(true);
      storageService.minioClient.putObject = jest
        .fn()
        .mockRejectedValue('Network error');
      jest.spyOn(pgpConfigService, 'encrypt', 'get').mockReturnValue(false);
      const jobSolution = {
        workerAddress,
        postUrl,
        status: 'accepted' as const,
      };

      await expect(
        storageService.uploadJobSolutions(escrowAddress, chainId, [
          jobSolution,
        ]),
      ).rejects.toThrow('File not uploaded');
    });

    it('should fail if public key is missing', async () => {
      const workerAddress = '0x1234567890123456789012345678901234567891';
      const escrowAddress = '0x1234567890123456789012345678901234567890';
      const chainId = ChainId.LOCALHOST;
      const postUrl = 'https://x.com/example/status/12345';

      storageService.minioClient.bucketExists = jest
        .fn()
        .mockResolvedValue(true);
      EncryptionUtils.encrypt = jest.fn().mockResolvedValue('encrypted');
      KVStoreUtils.getPublicKey = jest.fn().mockResolvedValue('');
      jest.spyOn(pgpConfigService, 'encrypt', 'get').mockReturnValue(true);
      const jobSolution = {
        workerAddress,
        postUrl,
        status: 'accepted' as const,
      };
      await expect(
        storageService.uploadJobSolutions(escrowAddress, chainId, [
          jobSolution,
        ]),
      ).rejects.toThrow('Encryption error');
    });
  });

  describe('download', () => {
    const downloadFileFromUrlMock = jest.mocked(downloadFileFromUrl);
    it('should download the non encrypted file correctly', async () => {
      const exchangeAddress = '0x1234567890123456789012345678901234567892';
      const workerAddress = '0x1234567890123456789012345678901234567891';
      const postUrl = 'https://x.com/example/status/12345';

      const expectedJobFile = {
        exchangeAddress,
        solutions: [
          {
            workerAddress,
            postUrl,
          },
        ],
      };

      downloadFileFromUrlMock.mockResolvedValue(expectedJobFile);
      EncryptionUtils.isEncrypted = jest.fn().mockReturnValue(false);
      const solutionsFile = await storageService.download(MOCK_FILE_URL);
      expect(solutionsFile).toStrictEqual(expectedJobFile);
    });

    it('should download the encrypted file correctly', async () => {
      const exchangeAddress = '0x1234567890123456789012345678901234567892';
      const workerAddress = '0x1234567890123456789012345678901234567891';
      const postUrl = 'https://x.com/example/status/12345';

      const expectedJobFile = {
        exchangeAddress,
        solutions: [
          {
            workerAddress,
            postUrl,
          },
        ],
      };

      downloadFileFromUrlMock.mockResolvedValue('encrypted-content');

      Encryption.build = jest.fn().mockResolvedValue({
        decrypt: jest.fn().mockResolvedValue(JSON.stringify(expectedJobFile)),
      });
      EncryptionUtils.isEncrypted = jest.fn().mockReturnValue(true);
      const solutionsFile = await storageService.download(MOCK_FILE_URL);
      expect(solutionsFile).toStrictEqual(expectedJobFile);
    });

    it('should return empty array when file cannot be downloaded', async () => {
      downloadFileFromUrlMock.mockRejectedValue('Network error');

      const solutionsFile = await storageService.download(MOCK_FILE_URL);
      expect(solutionsFile).toStrictEqual([]);
    });
  });
});
