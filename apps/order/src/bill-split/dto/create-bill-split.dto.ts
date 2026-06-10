import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BillSplitItemDto {
  @ApiProperty({ example: '60d5ecb8b392d70015f8e32a' })
  @IsMongoId()
  productId!: string;

  @ApiProperty({ example: 1, description: 'Quantidade deste item no split' })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateBillSplitDto {
  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  @IsMongoId()
  orderId!: string;

  @ApiProperty({ type: [BillSplitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillSplitItemDto)
  items!: BillSplitItemDto[];

  @ApiProperty({ example: 'João', required: false })
  @IsOptional()
  @IsString()
  clientName?: string;
}

export class PayBillSplitDto {
  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  @IsMongoId()
  splitId!: string;
}
