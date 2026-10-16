
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'IPHONE-15' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku: string;

  @ApiProperty({ example: 'iPhone 15' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: '199.99', description: 'Positive decimal, up to 2 decimal places' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'price must be a valid decimal with up to 2 decimal places',
  })
  price: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  stock: number;
}
