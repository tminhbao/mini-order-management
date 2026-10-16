
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Nguyen Van An' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerName: string;

  @ApiProperty({ example: 'an@example.com' })
  @IsEmail()
  @MaxLength(255)
  customerEmail: string;

  @ApiProperty({
    type: [CreateOrderItemDto],
    example: [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
