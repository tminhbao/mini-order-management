
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity.js';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const quantities = new Map<number, number>();

    for (const item of dto.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const productRepository = manager.getRepository(Product);
      const orderRepository = manager.getRepository(Order);

      const orderItems: OrderItem[] = [];
      let totalCents = 0;

      const productIds = [...quantities.keys()].sort((a, b) => a - b);

      for (const productId of productIds) {
        const product = await productRepository.findOne({
          where: { id: productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${productId} not found`,
          );
        }

        const quantity = quantities.get(productId)!;

        if (product.stock < quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${productId}`,
          );
        }

        const [whole, fraction = ''] = product.price.split('.');
        const priceCents =
          Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

        totalCents += priceCents * quantity;

        orderItems.push(
          manager.create(OrderItem, {
            productId: product.id,
            quantity,
            unitPrice: product.price,
          }),
        );

        product.stock -= quantity;
        await productRepository.save(product);
      }

      const order = orderRepository.create({
        status: OrderStatus.PENDING,
        totalAmount: `${Math.floor(totalCents / 100)}.${String(
          totalCents % 100,
        ).padStart(2, '0')}`,
        items: orderItems,
      });

      return orderRepository.save(order);
    });
  }

  async findAll(page = 1, limit = 10, status?: OrderStatus) {
    if (!Number.isInteger(page) || page < 1) {
        throw new BadRequestException('page must be a positive integer');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new BadRequestException('limit must be between 1 and 100');
    }

    if (status && !Object.values(OrderStatus).includes(status)) {
        throw new BadRequestException('Invalid order status');
    }
    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .orderBy('order.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  
  async cancel(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);
      const itemRepository = manager.getRepository(OrderItem);
      const productRepository = manager.getRepository(Product);

      const order = await orderRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CONFIRMED
      ) {
        throw new ConflictException(
          `Cannot cancel an order with status ${order.status}`,
        );
      }

      const items = await itemRepository.find({
        where: { order: { id } },
      });

      const productIds = [
        ...new Set(items.map((item) => item.productId)),
      ].sort((a, b) => a - b);

      for (const productId of productIds) {
        const product = await productRepository
          .createQueryBuilder('product')
          .withDeleted()
          .setLock('pessimistic_write')
          .where('product.id = :productId', { productId })
          .getOne();

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${productId} not found while cancelling order`,
          );
        }

        const quantityToRestore = items
          .filter((item) => item.productId === productId)
          .reduce((sum, item) => sum + item.quantity, 0);

        product.stock += quantityToRestore;
        await productRepository.save(product);
      }

      order.status = OrderStatus.CANCELLED;
      await orderRepository.save(order);

      return {
        message: 'Order cancelled successfully',
        orderId: order.id,
        status: order.status,
      };
    });
  }

}
