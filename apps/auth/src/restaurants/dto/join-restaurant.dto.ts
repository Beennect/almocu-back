import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class JoinRestaurantDto {
  @ApiProperty({ 
    description: 'Código de convite único do restaurante',
    example: 'ABC123' 
  })
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}
