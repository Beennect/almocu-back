import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InternalGuard } from '@app/common';
import { ProductService } from '../product/product.service';

@ApiTags('internal')
@UseGuards(InternalGuard)
@Controller('products/internal')
export class InternalProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('by-stock/:stockProductId')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Interno] Retorna produtos que usam um determinado item de estoque',
  })
  @ApiHeader({
    name: 'x-internal-key',
    required: true,
  })
  @ApiHeader({
    name: 'x-tenant-id',
    required: true,
  })
  async findProductsByStockItem(
    @Param('stockProductId') stockProductId: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    return this.productService.findByStockProductId(stockProductId, restaurantId);
  }

  /**
   * Remove um ingrediente de TODOS os produtos do restaurante.
   * Endpoint interno (service-to-service) — chamado pelo stock-app
   * quando um item de estoque é excluído.
   */
  @Delete('ingredient/:stockProductId')
  @HttpCode(204)
  @ApiOperation({
    summary: '[Interno] Remove ingrediente de todos os produtos',
    description: 'Endpoint service-to-service. Protegido por InternalGuard.',
  })
  @ApiHeader({
    name: 'x-internal-key',
    description: 'Chave interna de autenticação entre serviços',
    required: true,
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'ID do restaurante',
    required: true,
  })
  async removeIngredientFromAllProducts(
    @Param('stockProductId') stockProductId: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    return this.productService.removeIngredientFromAllProducts(
      stockProductId,
      restaurantId,
    );
  }
}
