import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class AcquireModuleDto {
  @ApiProperty({ description: 'Ativar ou desativar o módulo', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
