import { ApiProperty } from '@nestjs/swagger';
import { NfeInvoice } from '../schemas/nfe-invoice.schema';

export class NfeInvoicePageDto {
  @ApiProperty({ type: [NfeInvoice], description: 'Notas fiscais importadas' })
  items!: NfeInvoice[];

  @ApiProperty({ example: 50, description: 'Total de notas' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página atual' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Itens por página' })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  pages!: number;
}
