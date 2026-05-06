import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SwitchTenantDto {
  @ApiProperty({ 
    description: 'ID do restaurante para o qual deseja alternar o contexto',
    example: '65f1a2b3c4d5e6f7a8b9c0d1' 
  })
  @IsString()
  @IsNotEmpty()
  restaurantId: string;
}
