import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Query, BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo produto no cardápio' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  create(
    @Body() createProductDto: CreateProductDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    if (!userId || !restaurantId) throw new BadRequestException('Headers de autenticação ausentes.');
    return this.productService.create(createProductDto, userId, restaurantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista produtos do cardápio com paginação e cache' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  findAll(
    @Headers('x-tenant-id') restaurantId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    if (!restaurantId) throw new BadRequestException('Header de restaurante ausente.');
    return this.productService.findAll(
      restaurantId,
      parseInt(page) || 1,
      parseInt(limit) || 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um produto específico' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  findOne(@Param('id') id: string, @Headers('x-tenant-id') restaurantId: string) {
    return this.productService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    return this.productService.update(id, updateProductDto, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um produto do cardápio' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  remove(@Param('id') id: string, @Headers('x-tenant-id') restaurantId: string) {
    return this.productService.remove(id, restaurantId);
  }
}
