import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Almoco do Chef' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'CNPJ inválido (Formato esperado: 00.000.000/0000-00)',
  })
  cnpj: string;

  @ApiProperty({
    example: 3,
    description: 'Quantidade máxima de locais (filiais) permitidas',
    default: 1,
  })
  @IsOptional()
  maxBranches?: number;
}

export class CreateBranchDto {
  @ApiProperty({ example: 'Almoco do Chef - Filial 1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '65f1a2b3c4d5e6f7a8b9c0d1',
    description: 'ID do restaurante principal (Master)',
  })
  @IsString()
  @IsNotEmpty()
  parentId: string;
}
