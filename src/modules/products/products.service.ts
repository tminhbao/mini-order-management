
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    this.validatePrice(dto.price);

    const product = this.productsRepository.create(dto);

    try {
      return await this.productsRepository.save(product);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(query: QueryProductsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      minPrice,
      maxPrice,
    } = query;

    if (minPrice !== undefined) this.validatePrice(minPrice);
    if (maxPrice !== undefined) this.validatePrice(maxPrice);

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      Number(minPrice) > Number(maxPrice)
    ) {
      throw new BadRequestException(
        'minPrice must be less than or equal to maxPrice',
      );
    }

    const queryBuilder = this.productsRepository.createQueryBuilder('product');

    if (search?.trim()) {
      queryBuilder.andWhere('product.name ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    queryBuilder
      .orderBy('product.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

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

  async findOne(id: number): Promise<Product> {
    const product = await this.productsRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (dto.price !== undefined) {
      this.validatePrice(dto.price);
    }

    Object.assign(product, dto);

    try {
      return await this.productsRepository.save(product);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    const product = await this.findOne(id);
    await this.productsRepository.softRemove(product);

    return { message: 'Product deleted successfully' };
  }

  private validatePrice(price: string): void {
    if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
      throw new BadRequestException(
        'price must be greater than 0 with up to 2 decimal places',
      );
    }
  }

  private handleDatabaseError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    ) {
      throw new ConflictException('SKU already exists');
    }

    throw error;
  }
}
