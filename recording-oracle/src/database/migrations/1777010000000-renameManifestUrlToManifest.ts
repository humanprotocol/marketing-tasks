import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameManifestUrlToManifest1777010000000 implements MigrationInterface {
  name = 'RenameManifestUrlToManifest1777010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "hmt"."jobs" RENAME COLUMN "manifest_url" TO "manifest"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "hmt"."jobs" RENAME COLUMN "manifest" TO "manifest_url"
        `);
  }
}
