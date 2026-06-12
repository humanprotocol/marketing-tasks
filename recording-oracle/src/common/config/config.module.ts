import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerConfigService } from './server-config.service';
import { PGPConfigService } from './pgp-config.service';
import { S3ConfigService } from './s3-config.service';
import { Web3ConfigService } from './web3-config.service';
import { NetworkConfigService } from './network-config.service';
import { DatabaseConfigService } from './database-config.service';
import { GrokConfigService } from './grok-config.service';
import { LinkdapiConfigService } from './linkdapi-config.service';
import { XApiConfigService } from './x-api-config.service';

@Global()
@Module({
  providers: [
    ConfigService,
    ServerConfigService,
    Web3ConfigService,
    S3ConfigService,
    PGPConfigService,
    NetworkConfigService,
    DatabaseConfigService,
    GrokConfigService,
    LinkdapiConfigService,
    XApiConfigService,
  ],
  exports: [
    ConfigService,
    ServerConfigService,
    Web3ConfigService,
    S3ConfigService,
    PGPConfigService,
    NetworkConfigService,
    DatabaseConfigService,
    GrokConfigService,
    LinkdapiConfigService,
    XApiConfigService,
  ],
})
export class EnvConfigModule {}
