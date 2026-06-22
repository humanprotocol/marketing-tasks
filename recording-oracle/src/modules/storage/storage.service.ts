import {
  ChainId,
  EncryptionUtils,
  EscrowClient,
  KVStoreUtils,
} from '@human-protocol/sdk';
import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as Minio from 'minio';
import { ErrorStorage } from '../../common/constants/errors';
import { PGPConfigService } from '../../common/config/pgp-config.service';
import { S3ConfigService } from '../../common/config/s3-config.service';
import { ServerError, ValidationError } from '../../common/errors';
import { IRecordingResult } from '../../common/interfaces/job';
import { downloadFileFromUrl } from '../../common/utils/storage';
import { SaveSolutionsDto } from '../submission/submission.dto';
import { Web3Service } from '../web3/web3.service';

@Injectable()
export class StorageService {
  public readonly minioClient: Minio.Client;

  constructor(
    private s3ConfigService: S3ConfigService,
    private pgpConfigService: PGPConfigService,
    @Inject(Web3Service)
    private readonly web3Service: Web3Service,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: this.s3ConfigService.endpoint,
      port: this.s3ConfigService.port,
      accessKey: this.s3ConfigService.accessKey,
      secretKey: this.s3ConfigService.secretKey,
      useSSL: this.s3ConfigService.useSSL,
    });
  }
  public getJobUrl(hash: string): string {
    return `${this.s3ConfigService.useSSL ? 'https' : 'http'}://${
      this.s3ConfigService.endpoint
    }:${this.s3ConfigService.port}/${this.s3ConfigService.bucket}/${hash}.json`;
  }

  public async download(url: string): Promise<any> {
    try {
      return await downloadFileFromUrl(url);
    } catch {
      return [];
    }
  }

  public async uploadJobSolutions(
    escrowAddress: string,
    chainId: ChainId,
    solutions: IRecordingResult[],
  ): Promise<SaveSolutionsDto> {
    if (!(await this.minioClient.bucketExists(this.s3ConfigService.bucket))) {
      throw new ValidationError(ErrorStorage.BucketNotFound);
    }

    let fileToUpload = JSON.stringify(solutions);
    if (this.pgpConfigService.encrypt) {
      try {
        const signer = this.web3Service.getSigner(chainId);
        const escrowClient = await EscrowClient.build(signer);
        const reputationOracleAddress =
          await escrowClient.getReputationOracleAddress(escrowAddress);

        const recordingOraclePublicKey = await KVStoreUtils.getPublicKey(
          chainId,
          signer.address,
        );
        const reputationOraclePublicKey = await KVStoreUtils.getPublicKey(
          chainId,
          reputationOracleAddress,
        );
        if (
          !recordingOraclePublicKey ||
          !recordingOraclePublicKey.length ||
          !reputationOraclePublicKey ||
          !reputationOraclePublicKey.length
        ) {
          throw new ServerError(ErrorStorage.MissingPublicKey);
        }

        fileToUpload = await EncryptionUtils.encrypt(fileToUpload, [
          recordingOraclePublicKey,
          reputationOraclePublicKey,
        ]);
      } catch {
        throw new ServerError(ErrorStorage.EncryptionError);
      }
    }

    try {
      const hash = crypto.createHash('sha1').update(fileToUpload).digest('hex');
      await this.minioClient.putObject(
        this.s3ConfigService.bucket,
        `${hash}.json`,
        fileToUpload,
        undefined,
        {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      );

      return { url: this.getJobUrl(hash), hash };
    } catch {
      throw new ServerError(ErrorStorage.FileNotUploaded);
    }
  }
}
