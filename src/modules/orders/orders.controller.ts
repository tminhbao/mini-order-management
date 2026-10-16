
import {
    BadRequestException,
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderStatus } from './entities/order.entity.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order and reserve stock' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders with pagination and status filter' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
  ) {
    if (page < 1) {
        throw new BadRequestException('page must be at least 1');
    }

    if (limit < 1 || limit > 100) {
        throw new BadRequestException('limit must be between 1 and 100');
    }

    if (
        status !== undefined &&
        !Object.values(OrderStatus).includes(status)
    ) {
        throw new BadRequestException('Invalid order status');
    }

    return this.ordersService.findAll(page, limit, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  
  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an order and restore stock' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.cancel(id);
  }

}
