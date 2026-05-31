import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../product.schema';

export class ProductPageDto {
  @ApiProperty({ type: [Product], description: 'Produtos do cardápio' })
  items!: Product[];

  @ApiProperty({ example: 50, description: 'Total de produtos' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página atual' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Itens por página' })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  pages!: number;
}
