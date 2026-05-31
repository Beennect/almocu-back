import { ApiProperty } from '@nestjs/swagger';
import { Supplier } from '../supplier.schema';

export class SupplierPageDto {
  @ApiProperty({ type: [Supplier], description: 'Fornecedores' })
  items!: Supplier[];

  @ApiProperty({ example: 50, description: 'Total de fornecedores' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página atual' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Itens por página' })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  pages!: number;
}
