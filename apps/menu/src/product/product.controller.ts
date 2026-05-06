import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo produto no cardápio' })
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    return this.productService.create(createProductDto, userId, restaurantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista produtos do cardápio com paginação e cache' })
  findAll(
    @Req() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.productService.findAll(
      restaurantId,
      parseInt(page) || 1,
      parseInt(limit) || 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um produto específico' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const restaurantId = req.user.restaurantId;
    return this.productService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: any,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.productService.update(id, updateProductDto, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um produto do cardápio' })
  remove(@Param('id') id: string, @Req() req: any) {
    const restaurantId = req.user.restaurantId;
    return this.productService.remove(id, restaurantId);
  }
}
