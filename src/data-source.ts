
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Product } from './modules/products/entities/product.entity.js';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,

  entities: [Product],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
