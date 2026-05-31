import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @ApiProperty({ example: 'Prato Feito', description: 'Nome do item' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 2500,
    description: 'Valor em centavos (ex: 2500 = R$ 25,00)',
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 2, description: 'Quantidade do item' })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateCheckoutDto {
  @ApiProperty({
    type: [CheckoutItemDto],
    description: 'Lista de itens do pedido',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];
}
