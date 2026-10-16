
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { NotificationLog } from './entities/notification-log.entity.js';

@Processor('order-processing')
export class OrderProcessingProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job: Job<{ orderId: number }>): Promise<void> {
    const { orderId } = job.data;

    if (!orderId) {
      throw new Error(`Missing orderId in job ${job.id}`);
    }

    // Lock order and mark it PROCESSING before simulation.
    const shouldProcess = await this.dataSource.transaction(
      async (manager) => {
        const orderRepository = manager.getRepository(Order);

        const order = await orderRepository
          .createQueryBuilder('order')
          .setLock('pessimistic_write')
          .where('order.id = :orderId', { orderId })
          .getOne();

        if (
          !order ||
          order.status === OrderStatus.CANCELLED ||
          order.status === OrderStatus.CONFIRMED ||
          order.status === OrderStatus.COMPLETED ||
          order.status === OrderStatus.FAILED
        ) {
          console.log(
            `Skipping order ${orderId}: ${order?.status ?? 'not found'}`,
          );
          return false;
        }

        order.status = OrderStatus.PROCESSING;
        await orderRepository.save(order);

        return true;
      },
    );

    if (!shouldProcess) {
      return;
    }

    console.log(`Processing order ${orderId}`);

    const delay = Math.floor(Math.random() * 2000) + 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (Math.random() < 0.3) {
      throw new Error(`Simulated processing failure for order ${orderId}`);
    }

    await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);

      const order = await orderRepository
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();

      // Do not complete an order that was cancelled or changed.
      if (!order || order.status !== OrderStatus.PROCESSING) {
        return;
      }

      order.status = OrderStatus.CONFIRMED;
      await orderRepository.save(order);

      const notificationRepository =
      manager.getRepository(NotificationLog);

      const existingNotification = await notificationRepository.findOneBy({
        orderId: order.id,
      });

      if (!existingNotification) {
        await notificationRepository.save({
          orderId: order.id,
          message: `Order ${order.id} confirmed successfully`,
        });
      }
      });

    console.log(`Order ${orderId} confirmed successfully`);
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<{ orderId: number }> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;

    // Wait until all attempts have failed before refunding stock.
    if (job.attemptsMade < maxAttempts) {
      console.error(
        `Order ${job.data.orderId} failed attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
      );
      return;
    }

    const orderId = job.data.orderId;

    await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);
      const orderItemRepository = manager.getRepository(OrderItem);
      const productRepository = manager.getRepository(Product);

      const order = await orderRepository
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();

      if (
        !order ||
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.COMPLETED ||
        order.status === OrderStatus.FAILED
      ) {
        return;
      }

      // Only refund orders that were actually being processed.
      if (order.status !== OrderStatus.PROCESSING) {
        return;
      }

      const items = await orderItemRepository.find({
        where: { order: { id: orderId } },
      });

      const productIds = [
        ...new Set(items.map((item) => item.productId)),
      ].sort((a, b) => a - b);

      for (const productId of productIds) {
        const product = await productRepository
          .createQueryBuilder('product')
          .setLock('pessimistic_write')
          .where('product.id = :productId', { productId })
          .getOne();

        if (!product) {
          throw new Error(
            `Product ${productId} not found while refunding order ${orderId}`,
          );
        }

        const quantity = items
          .filter((item) => item.productId === productId)
          .reduce((sum, item) => sum + item.quantity, 0);

        product.stock += quantity;
        await productRepository.save(product);
      }

      order.status = OrderStatus.FAILED;
      await orderRepository.save(order);
    });

    console.error(
      `Order ${orderId} failed permanently: ${error.message}`,
    );
  }
}
