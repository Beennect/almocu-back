import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsOptional, IsBoolean } from 'class-validator';

export class UpdateTableDto {
  @ApiProperty({ example: '5', description: 'Número/identificação da mesa', required: false })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiProperty({ example: 6, description: 'Capacidade da mesa', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiProperty({ example: false, description: 'Desativar mesa', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
