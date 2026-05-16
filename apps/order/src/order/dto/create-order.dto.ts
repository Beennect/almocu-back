import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty({ example: '60d5ecb8b392d70015f8e32a' })
  @IsMongoId()
  productId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({ example: 'App', required: false })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiProperty({ example: 'Sem cebola', required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'],
  })
  @IsEnum(['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'])
  status!: string;
}
