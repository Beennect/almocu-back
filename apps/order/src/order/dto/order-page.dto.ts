import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../order.schema';

export class OrderPageDto {
  @ApiProperty({ type: [Order], description: 'Pedidos' })
  items!: Order[];

  @ApiProperty({ example: 50, description: 'Total de pedidos' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Página atual' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Itens por página' })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total de páginas' })
  pages!: number;
}
