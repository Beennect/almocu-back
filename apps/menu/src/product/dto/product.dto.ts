import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngredientDto {
  @ApiProperty({ example: '60d5ecb8b392d70015f8e32c' })
  @IsMongoId()
  @IsNotEmpty()
  stockProductId!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

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

  @ApiProperty({
    type: [IngredientDto],
    example: [{ stockProductId: '60d5ecb8b392d70015f8e32c', quantity: 2 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients!: IngredientDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
