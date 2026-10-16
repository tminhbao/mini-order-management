import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';

import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Product } from '../products/entities/product.entity.js';

describe('OrdersService', () => {
  let service: OrdersService;

  let dataSource: DataSource;
  let ordersRepository: any;
  let productRepository: any;
  let itemRepository: any;
  let manager: any;
  let orderQueue: any;
  let autoCancelQueue: any;

  beforeEach(() => {
    ordersRepository = {
      create: vi.fn((data) => data),
      save: vi.fn(async (order) => ({ id: 101, ...order })),
      findOne: vi.fn(),
    };

    productRepository = {
      findOne: vi.fn(),
      save: vi.fn(async (product) => product),
      createQueryBuilder: vi.fn(),
    };

    itemRepository = {
      find: vi.fn(),
    };

    manager = {
      getRepository: vi.fn((entity) => {
        if (entity === Product) return productRepository;
        if (entity === Order) return ordersRepository;
        if (entity === OrderItem) return itemRepository;
        throw new Error(`Unexpected entity: ${entity.name}`);
      }),
      create: vi.fn((_entity, data) => data),
    };

    dataSource = {
      transaction: vi.fn(async (callback: any) => callback(manager)),
    } as unknown as DataSource;

    orderQueue = { add: vi.fn().mockResolvedValue({}) };
    autoCancelQueue = { add: vi.fn().mockResolvedValue({}) };

    service = new OrdersService(
      dataSource,
      ordersRepository,
      orderQueue as Queue,
      autoCancelQueue as Queue,
    );
  });

  it('should create an order and enqueue background jobs', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'Keyboard',
      price: '25.00',
      stock: 5,
    });

    const dto: CreateOrderDto = {
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      items: [{ productId: 1, quantity: 2 }],
    };

    const result = await service.create(dto);

    expect(dataSource.transaction).toHaveBeenCalledOnce();
    expect(productRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, stock: 3 }),
    );
    expect(ordersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        status: OrderStatus.PENDING,
        totalAmount: '50.00',
      }),
    );
    expect(result.id).toBe(101);
    expect(orderQueue.add).toHaveBeenCalledWith(
      'process-order',
      { orderId: 101 },
      expect.objectContaining({ attempts: 3 }),
    );
    expect(autoCancelQueue.add).toHaveBeenCalledOnce();
  });

  it('should reject an order when stock is insufficient', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'Keyboard',
      price: '25.00',
      stock: 1,
    });

    const dto: CreateOrderDto = {
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      items: [{ productId: 1, quantity: 2 }],
    };

    await expect(service.create(dto)).rejects.toThrow(
      BadRequestException,
    );

    expect(ordersRepository.save).not.toHaveBeenCalled();
    expect(orderQueue.add).not.toHaveBeenCalled();
    expect(autoCancelQueue.add).not.toHaveBeenCalled();
  });

  it('should cancel a pending order and restore product stock', async () => {
    ordersRepository.findOne.mockResolvedValue({
      id: 101,
      status: OrderStatus.PENDING,
    });

    itemRepository.find.mockResolvedValue([
      { productId: 1, quantity: 2 },
    ]);

    const product = {
      id: 1,
      stock: 3,
    };

    const queryBuilder = {
      withDeleted: vi.fn().mockReturnThis(),
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(product),
    };

    productRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.cancel(101);

    expect(productRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, stock: 5 }),
    );
    expect(ordersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        status: OrderStatus.CANCELLED,
      }),
    );
    expect(result).toEqual({
      message: 'Order cancelled successfully',
      orderId: 101,
      status: OrderStatus.CANCELLED,
    });
  });
});
