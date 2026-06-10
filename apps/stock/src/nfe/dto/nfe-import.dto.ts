import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class NfeImportItemDto {
  @ApiProperty({ example: 'Arroz Tipo 1 5KG' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'Kg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 5.9, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ example: 'Grãos', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;
}

export class NfeImportDto {
  @ApiProperty({ type: [NfeImportItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NfeImportItemDto)
  items!: NfeImportItemDto[];

  @ApiProperty({ example: 'Distribuidora de Alimentos LTDA', required: false })
  @IsString()
  @IsOptional()
  supplierName?: string;

  @ApiProperty({ example: '12345678000195', required: false })
  @IsString()
  @IsOptional()
  supplierCnpj?: string;

  @ApiProperty({
    example: '35200612345678000195001100000012345678901234',
    required: false,
  })
  @IsString()
  @IsOptional()
  accessKey?: string;
}
