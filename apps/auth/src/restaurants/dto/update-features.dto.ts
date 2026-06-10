import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFeaturesDto {
  @ApiProperty({
    description: 'Habilitar sistema de mesas e divisão de conta',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hasTables?: boolean;
}
