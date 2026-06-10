import { ApiProperty } from '@nestjs/swagger';
import { BillSplit } from '../bill-split.schema';

export class BillSplitPageDto {
  @ApiProperty({ type: [BillSplit], description: 'Splits de conta' })
  items!: BillSplit[];

  @ApiProperty({ example: 50, description: 'Total de splits' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página atual' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Itens por página' })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  pages!: number;
}
