import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty({ example: '60d5ecb8b392d70015f8e32a' })
  @IsMongoId()
  productId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

class DeliveryAddressDto {
  @ApiProperty({ example: 'Rua das Flores' })
  @IsString()
  street!: string;

  @ApiProperty({ example: '123' })
  @IsString()
  number!: string;

  @ApiProperty({ example: 'Centro', required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  city!: string;

  @ApiProperty({ example: 'SP', maxLength: 2 })
  @IsString()
  @MaxLength(2)
  state!: string;

  @ApiProperty({ example: '01001-000', required: false })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ example: 'Apto 42', required: false })
  @IsOptional()
  @IsString()
  complement?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({ type: DeliveryAddressDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @ApiProperty({ example: 'João', required: false })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiProperty({ example: 'Mesa 5', required: false })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiProperty({ example: 'Sem cebola', required: false })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ required: false, example: '60d5ecb8b392d70015f8e32a' })
  @IsOptional()
  @IsMongoId()
  deliveryUserId?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [
      'pendente',
      'em_preparo',
      'pronto',
      'saiu_para_entrega',
      'entregue',
      'cancelado',
    ],
  })
  @IsEnum([
    'pendente',
    'em_preparo',
    'pronto',
    'saiu_para_entrega',
    'entregue',
    'cancelado',
  ])
  status!: string;

  @ApiProperty({ required: false, example: '60d5ecb8b392d70015f8e32a' })
  @IsOptional()
  @IsMongoId()
  deliveryUserId?: string;
}
