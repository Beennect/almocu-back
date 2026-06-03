import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBase64,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngredientDto {
  @ApiProperty({ example: '60d5ecb8b392d70015f8e32c' })
  @IsMongoId()
  @IsNotEmpty()
  stockProductId!: string;

  @ApiProperty({ example: 0.5 })
  @IsNumber({}, { message: 'Quantidade deve ser um número' })
  @IsPositive({ message: 'Quantidade deve ser positiva' })
  @Max(100000, { message: 'Quantidade máxima excedida' })
  quantity!: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Hamburguer Gourmet' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'Hamburgueres' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @ApiProperty({ example: 35.0 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 'Delicioso hamburguer com blend especial' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    required: false,
    example: 'https://images.com/hamburguer.jpg',
    description: 'URL da imagem do produto',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiProperty({
    required: false,
    description:
      'Imagem codificada em Base64 (data:image/...;base64,...). Se informada, sobrescreve imageUrl.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10 * 1024 * 1024) // ~10MB
  imageBase64?: string;

  @ApiProperty({
    type: [IngredientDto],
    example: [{ stockProductId: '60d5ecb8b392d70015f8e32c', quantity: 2 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients!: IngredientDto[];
}

export class BatchIdsDto {
  @ApiProperty({
    type: [String],
    example: ['60d5ecb8b392d70015f8e32c'],
    description: 'Lista de IDs dos produtos',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true, message: 'Cada ID deve ser um MongoId válido' })
  ids!: string[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
