import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductPageDto } from './dto/product-page.dto';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  RolesGuard,
  PageableParams,
  RestaurantId,
} from '@app/common';
import { Roles } from '@app/common';
import type { Pageable } from '@app/common';

@ApiTags('products')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo produto no cardápio' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: any,
    @RestaurantId() restaurantId: string,
  ) {
    const userId = req.user.id;
    const token = req.headers.authorization;
    return this.productService.create(
      createProductDto,
      userId,
      restaurantId,
      token,
      req.user.role,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lista produtos do cardápio com paginação e cache' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número da página (padrão: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Itens por página (padrão: 10, máximo: 100)',
    example: 10,
  })
  @ApiOkResponse({
    type: ProductPageDto,
    description: 'Lista paginada de produtos',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.productService.findAll(restaurantId, pageable);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um produto específico' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.productService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.productService.update(id, updateProductDto, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um produto do cardápio' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.productService.remove(id, restaurantId);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Busca múltiplos produtos pelos IDs' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findByIds(@Body('ids') ids: string[], @RestaurantId() restaurantId: string) {
    return this.productService.findByIds(ids, restaurantId);
  }
}
