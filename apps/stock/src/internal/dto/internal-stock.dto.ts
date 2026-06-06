import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNumber,
  ArrayMaxSize,
  ArrayMinSize,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchStockDto {
  @ApiProperty({
    example: ['64f1a2b3c4d5e6f7a8b9c0d1', '64f1a2b3c4d5e6f7a8b9c0d2'],
    description: 'Lista de IDs dos itens de estoque (máx: 100)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];
}

export class AdjustItemDto {
  @ApiProperty({
    example: '64f1a2b3c4d5e6f7a8b9c0d1',
    description: 'ID do item de estoque',
  })
  @IsMongoId()
  id!: string;

  @ApiProperty({
    example: -2,
    description: 'Valor a ser somado ou subtraído da quantidade atual',
  })
  @IsNumber()
  @Min(-100000)
  @Max(100000)
  delta!: number;
}

export class BatchAdjustDto {
  @ApiProperty({
    type: [AdjustItemDto],
    description: 'Lista de ajustes a serem aplicados (máx: 200)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AdjustItemDto)
  adjustments!: AdjustItemDto[];
}
