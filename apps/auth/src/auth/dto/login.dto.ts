import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'joao_silva' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({
    example: '65f1a2b3c4d5e6f7a8b9c0d1',
    required: false,
    description: 'ID do restaurante para login direto em um contexto'
  })
  @IsString()
  @IsOptional()
  restaurantId?: string;
}
