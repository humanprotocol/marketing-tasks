import { MigrationInterface, QueryRunner } from 'typeorm';
import { NS } from '../../common/constant';

export class InitialMigration1776775194100 implements MigrationInterface {
  name = 'InitialMigration1776775194100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema(NS, true);
    await queryRunner.query(`
            CREATE TYPE "hmt"."assignments_status_enum" AS ENUM(
                'active',
                'validation',
                'completed',
                'expired',
                'canceled',
                'rejected'
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "hmt"."assignments" (
                "id" SERIAL NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "job_id" integer NOT NULL,
                "worker_address" character varying NOT NULL,
                "status" "hmt"."assignments_status_enum" NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "reward_amount" numeric(10, 2) NOT NULL,
                CONSTRAINT "PK_c54ca359535e0012b04dcbd80ee" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_f9fea6dcc065d190ed04d7f9d4" ON "hmt"."assignments" ("job_id", "worker_address")
        `);
    await queryRunner.query(`
            CREATE TYPE "hmt"."jobs_status_enum" AS ENUM('active', 'completed', 'canceled')
        `);
    await queryRunner.query(`
            CREATE TABLE "hmt"."jobs" (
                "id" SERIAL NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "chain_id" integer NOT NULL,
                "escrow_address" character varying NOT NULL,
                "manifest_url" character varying,
                "reward_token" character varying NOT NULL,
                "status" "hmt"."jobs_status_enum" NOT NULL,
                "reputation_network" character varying NOT NULL,
                CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_59f6c552b618c432f019500e7c" ON "hmt"."jobs" ("chain_id", "escrow_address")
        `);
    await queryRunner.query(`
            ALTER TABLE "hmt"."assignments"
            ADD CONSTRAINT "FK_4a6cf5345a71aa620ee6a0d9c8c" FOREIGN KEY ("job_id") REFERENCES "hmt"."jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "hmt"."assignments" DROP CONSTRAINT "FK_4a6cf5345a71aa620ee6a0d9c8c"
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
            DROP INDEX "hmt"."IDX_f9fea6dcc065d190ed04d7f9d4"
        `);
    await queryRunner.query(`
            DROP TABLE "hmt"."assignments"
        `);
    await queryRunner.query(`
            DROP TYPE "hmt"."assignments_status_enum"
        `);
    await queryRunner.dropSchema(NS);
  }
}
