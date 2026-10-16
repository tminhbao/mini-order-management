import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerInfoToOrders1792137639758 implements MigrationInterface {
    name = 'AddCustomerInfoToOrders1792137639758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerName" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerEmail" character varying(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerEmail"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerName"`);
    }

}
