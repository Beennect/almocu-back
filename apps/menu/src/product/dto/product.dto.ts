import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Hamburguer Gourmet' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Casa da Carne' })
  @IsString()
  @IsNotEmpty()
  brand!: string;

  @ApiProperty({ example: 35.0 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 'Delicioso hamburguer com blend especial' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '60d5ecb8b392d70015f8e32c' })
  @IsString()
  @IsNotEmpty()
  stockProductId!: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
