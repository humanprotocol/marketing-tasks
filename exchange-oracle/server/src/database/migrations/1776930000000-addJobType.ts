import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobType1776930000000 implements MigrationInterface {
  name = 'AddJobType1776930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "hmt"."jobs" ADD "job_type" character varying NOT NULL DEFAULT 'social_media_promotion'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "hmt"."jobs" DROP COLUMN "job_type"
        `);
  }
}
