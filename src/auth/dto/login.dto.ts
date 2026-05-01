import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'joao_silva' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
