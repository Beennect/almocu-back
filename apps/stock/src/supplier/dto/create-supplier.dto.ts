import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @ApiProperty({ example: 'Rua das Flores' })
  @IsString()
  @IsNotEmpty()
  street!: string;

  @ApiProperty({ example: '123' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @ApiProperty({ example: 'Centro', required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ example: 'SP', maxLength: 2 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  state!: string;

  @ApiProperty({ example: '01001-000', required: false })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ example: 'Galpão B', required: false })
  @IsOptional()
  @IsString()
  complement?: string;
}

export class CreateSupplierDto {
  @ApiProperty({ example: 'Distribuidora de Alimentos LTDA' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Maria Silva', required: false })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({ example: '(11) 99999-8888', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'contato@distribuidora.com', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: '12.345.678/0001-90', required: false })
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiProperty({ required: false, type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty({
    example: 'Prazos de entrega: 5 dias úteis',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
