import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'joao_silva' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
