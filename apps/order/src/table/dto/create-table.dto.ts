import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsNotEmpty } from 'class-validator';

export class CreateTableDto {
  @ApiProperty({ example: '5', description: 'Número/identificação da mesa' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @ApiProperty({ example: 4, description: 'Capacidade da mesa' })
  @IsInt()
  @Min(1)
  capacity!: number;
}
