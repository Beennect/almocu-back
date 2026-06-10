import { ApiProperty } from '@nestjs/swagger';
import { Table } from '../table.schema';

export class TablePageDto {
  @ApiProperty({ type: [Table], description: 'Mesas' })
  items!: Table[];

  @ApiProperty({ example: 50, description: 'Total de mesas' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página atual' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Itens por página' })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  pages!: number;
}
