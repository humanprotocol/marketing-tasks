import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { JobModule } from '../job/job.module';
import { HttpModule } from '@nestjs/axios';
import { Web3Module } from '../web3/web3.module';
import { AssignmentRepository } from '../assignment/assignment.repository';
import { AssignmentEntity } from '../assignment/assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssignmentEntity]),
    forwardRef(() => JobModule),
    Web3Module,
    ConfigModule,
    HttpModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService, AssignmentRepository],
  exports: [WebhookService],
})
export class WebhookModule {}
