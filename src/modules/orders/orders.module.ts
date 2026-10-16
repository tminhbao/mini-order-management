
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';
import { BullModule } from '@nestjs/bullmq';
import { OrderProcessingProcessor } from './order-processing.processor.js';
import { Product } from '../products/entities/product.entity.js';
import { OrderAutoCancelProcessor } from './order-auto-cancel.processor.js';
import { NotificationLog } from './entities/notification-log.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Order, OrderItem, NotificationLog]),
    BullModule.registerQueue(
      { name: 'order-processing' },
      { name: 'order-auto-cancel' },
    ),
  ],
  providers: [OrdersService, OrderProcessingProcessor, OrderAutoCancelProcessor],
  controllers: [OrdersController],
})
export class OrdersModule {}
