import { MigrationInterface, QueryRunner } from 'typeorm';
import { NS } from '../../common/constants';

export class InitialMigration1776848870704 implements MigrationInterface {
  name = 'InitialMigration1776848870704';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema(NS, true);
    await queryRunner.query(`
            CREATE TYPE "hmt"."webhooks_event_type_enum" AS ENUM(
                'escrow_completed',
                'cancellation_requested',
                'job_completed',
                'job_canceled',
                'submission_rejected',
                'submission_in_review'
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "hmt"."webhooks_status_enum" AS ENUM('pending', 'completed', 'failed')
        `);
    await queryRunner.query(`
            CREATE TABLE "hmt"."webhooks" (
                "id" SERIAL NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "chain_id" integer NOT NULL,
                "escrow_address" character varying NOT NULL,
                "event_type" "hmt"."webhooks_event_type_enum" NOT NULL,
                "event_data" jsonb,
                "status" "hmt"."webhooks_status_enum" NOT NULL,
                "retries_count" integer NOT NULL,
                "wait_until" TIMESTAMP WITH TIME ZONE NOT NULL,
                "failure_detail" character varying,
                CONSTRAINT "PK_9e8795cfc899ab7bdaa831e8527" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "hmt"."jobs_job_type_enum" AS ENUM('social_media_promotion')
        `);
    await queryRunner.query(`
            CREATE TYPE "hmt"."jobs_status_enum" AS ENUM('pending', 'completed', 'failed')
        `);
    await queryRunner.query(`
            CREATE TABLE "hmt"."jobs" (
                "id" SERIAL NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "chain_id" integer NOT NULL,
                "escrow_address" character varying NOT NULL,
                "job_type" "hmt"."jobs_job_type_enum" NOT NULL,
                "manifest_url" character varying NOT NULL,
                "end_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                "status" "hmt"."jobs_status_enum" NOT NULL DEFAULT 'pending',
                "retries_count" integer NOT NULL DEFAULT '0',
                CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_59f6c552b618c432f019500e7c" ON "hmt"."jobs" ("chain_id", "escrow_address")
        `);
    await queryRunner.query(`
            CREATE TYPE "hmt"."submissions_status_enum" AS ENUM('pending', 'accepted', 'rejected', 'failed')
        `);
    await queryRunner.query(`
            CREATE TABLE "hmt"."submissions" (
                "id" SERIAL NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "job_id" integer NOT NULL,
                "worker_address" character varying NOT NULL,
                "post_url" character varying NOT NULL,
                "status" "hmt"."submissions_status_enum" NOT NULL,
                "reason" character varying,
                CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_b1667bc245dc698144e09383af" ON "hmt"."submissions" ("job_id", "worker_address")
        `);
    await queryRunner.query(`
            CREATE TYPE "hmt"."cron_jobs_cron_job_type_enum" AS ENUM(
                'process-ended-jobs',
                'process-pending-outgoing-webhooks'
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "hmt"."cron_jobs" (
                "id" SERIAL NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "cron_job_type" "hmt"."cron_jobs_cron_job_type_enum" NOT NULL,
                "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "completed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "UQ_10806950c3891e69783202e6f23" UNIQUE ("cron_job_type"),
                CONSTRAINT "PK_189a8029b8fff4f0e2040f652ee" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "hmt"."submissions"
            ADD CONSTRAINT "FK_5b6d188d93c6516dfd7aa3f9b53" FOREIGN KEY ("job_id") REFERENCES "hmt"."jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "hmt"."submissions" DROP CONSTRAINT "FK_5b6d188d93c6516dfd7aa3f9b53"
        `);
    await queryRunner.query(`
            DROP TABLE "hmt"."cron_jobs"
        `);
    await queryRunner.query(`
            DROP TYPE "hmt"."cron_jobs_cron_job_type_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "hmt"."IDX_b1667bc245dc698144e09383af"
        `);
    await queryRunner.query(`
            DROP TABLE "hmt"."submissions"
        `);
    await queryRunner.query(`
            DROP TYPE "hmt"."submissions_status_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "hmt"."IDX_59f6c552b618c432f019500e7c"
        `);
    await queryRunner.query(`
            DROP TABLE "hmt"."jobs"
        `);
    await queryRunner.query(`
            DROP TYPE "hmt"."jobs_status_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "hmt"."jobs_job_type_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "hmt"."webhooks"
        `);
    await queryRunner.query(`
            DROP TYPE "hmt"."webhooks_status_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "hmt"."webhooks_event_type_enum"
        `);
    await queryRunner.dropSchema(NS);
  }
}
