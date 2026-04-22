import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { HttpModule } from '@nestjs/axios';
import { Web3Module } from '../web3/web3.module';
import { WebhookModule } from '../webhook/webhook.module';
import { JobRepository } from './job.repository';
import { JobEntity } from './job.entity';
import { AssignmentEntity } from '../assignment/assignment.entity';
import { AssignmentRepository } from '../assignment/assignment.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity, AssignmentEntity]),
    ConfigModule,
    HttpModule,
    Web3Module,
    forwardRef(() => WebhookModule),
  ],
  controllers: [JobController],
  providers: [JobService, JobRepository, AssignmentRepository],
  exports: [JobService],
})
export class JobModule {}
