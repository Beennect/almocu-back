import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockDto {
  @ApiProperty({ example: 'Feijão Carioca' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Kicaldo', required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 'un' })
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiProperty({ example: 10, required: false })
  @IsNumber()
  @IsOptional()
  minQuantity?: number;
}

export class UpdateStockDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  minQuantity?: number;
}

export class AdjustStockDto {
  @ApiProperty({
    example: -2,
    description: 'Valor a ser somado ou subtraído da quantidade atual',
  })
  @IsNumber()
  delta!: number;
}
