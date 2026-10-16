
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Product } from '../products/entities/product.entity.js';

@Processor('order-auto-cancel')
@Injectable()
export class OrderAutoCancelProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderAutoCancelProcessor.name);

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async process(job: { data: { orderId: number } }): Promise<void> {
    const { orderId } = job.data;

    await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);
      const itemRepository = manager.getRepository(OrderItem);
      const productRepository = manager.getRepository(Product);

      const order = await orderRepository
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();

      if (!order || order.status !== OrderStatus.PENDING) {
        this.logger.log(
          `Skip auto-cancel for order ${orderId}: order is missing or no longer PENDING`,
        );
        return;
      }

      const items = await itemRepository.find({
        where: { order: { id: orderId } },
      });

      const productIds = [...new Set(items.map((item) => item.productId))].sort(
        (a, b) => a - b,
      );

      for (const productId of productIds) {
        const product = await productRepository
          .createQueryBuilder('product')
          .withDeleted()
          .setLock('pessimistic_write')
          .where('product.id = :productId', { productId })
          .getOne();

        if (product) {
          const quantity = items
            .filter((item) => item.productId === productId)
            .reduce((sum, item) => sum + item.quantity, 0);

          product.stock += quantity;
          await productRepository.save(product);
        }
      }

      order.status = OrderStatus.CANCELLED;
      await orderRepository.save(order);

      this.logger.log(`Auto-cancelled order ${orderId} and restored stock`);
    });
  }
}
