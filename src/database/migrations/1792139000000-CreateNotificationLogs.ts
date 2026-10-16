import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationLogs1792139000000
  implements MigrationInterface
{
  name = 'CreateNotificationLogs1792139000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_logs" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "message" character varying(255) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_notification_logs_orderId" UNIQUE ("orderId"),
        CONSTRAINT "PK_notification_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_logs_order"
          FOREIGN KEY ("orderId")
          REFERENCES "orders"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_logs"`);
  }
}