import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './modules/products/products.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { BullModule } from '@nestjs/bullmq';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: Number(configService.get('POSTGRES_PORT', 5432)),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: process.env.POSTGRES_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
    ProductsModule,
    OrdersModule,
    
    BullModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const useTls = config.get<string>('REDIS_TLS') === 'true';

      return {
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          username: config.get<string>('REDIS_USERNAME') || undefined,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          ...(useTls ? { tls: {} } : {}),
        },
      };
    },
  }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
