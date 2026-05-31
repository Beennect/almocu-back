import { ApiProperty } from '@nestjs/swagger';
import { Stock } from '../stock.schema';

export class StockPageDto {
  @ApiProperty({ type: [Stock], description: 'Itens do estoque' })
  items!: Stock[];

  @ApiProperty({ example: 50, description: 'Total de itens' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página atual' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Itens por página' })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  pages!: number;
}
