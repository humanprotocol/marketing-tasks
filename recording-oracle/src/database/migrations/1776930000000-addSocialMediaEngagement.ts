import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialMediaEngagement1776930000000 implements MigrationInterface {
  name = 'AddSocialMediaEngagement1776930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TYPE "hmt"."jobs_job_type_enum" ADD VALUE IF NOT EXISTS 'social_media_engagement'
        `);
    await queryRunner.query(`
            DROP INDEX "hmt"."IDX_5e2bf3a0b98f75d6f3f3f7e5f4"
        `);
    await queryRunner.query(`
            ALTER TABLE "hmt"."submissions" RENAME COLUMN "post_url" TO "solution"
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_submissions_job_solution" ON "hmt"."submissions" ("job_id", "solution")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "hmt"."IDX_submissions_job_solution"
        `);
    await queryRunner.query(`
            ALTER TABLE "hmt"."submissions" RENAME COLUMN "solution" TO "post_url"
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_5e2bf3a0b98f75d6f3f3f7e5f4" ON "hmt"."submissions" ("job_id", "post_url")
        `);
  }
}
