import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsMongoId,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateStockDto {
  @ApiProperty({ example: 'Feijão Carioca' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'Kicaldo', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 'un' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @ApiProperty({ example: 10, required: false })
  @IsNumber()
  @IsOptional()
  minQuantity?: number;

  @ApiProperty({
    example: '64f1a2b3c4d5e6f7a8b9c0d3',
    description: 'ID do fornecedor preferencial',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  supplierId?: string;
}

export class UpdateStockDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  unit?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  minQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  supplierId?: string;
}

export class AdjustStockDto {
  @ApiProperty({
    example: -2,
    description: 'Valor a ser somado ou subtraído da quantidade atual',
  })
  @IsNumber()
  @Min(-100000)
  @Max(100000)
  delta!: number;
}
