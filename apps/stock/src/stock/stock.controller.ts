import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Query, BadRequestException } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, UpdateStockDto, AdjustStockDto } from './dto/stock.dto';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';

@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo item no estoque' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  create(
    @Body() createStockDto: CreateStockDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    if (!userId || !restaurantId) throw new BadRequestException('Headers de autenticação ausentes.');
    return this.stockService.create(createStockDto, userId, restaurantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista itens do estoque com paginação' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  findAll(
    @Headers('x-tenant-id') restaurantId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    if (!restaurantId) throw new BadRequestException('Header de restaurante ausente.');
    return this.stockService.findAll(
      restaurantId,
      parseInt(page) || 1,
      parseInt(limit) || 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um item específico' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  findOne(@Param('id') id: string, @Headers('x-tenant-id') restaurantId: string) {
    return this.stockService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza detalhes de um item' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  update(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    return this.stockService.update(id, updateStockDto, restaurantId);
  }

  @Patch(':id/adjust')
  @ApiOperation({ summary: 'Ajusta a quantidade (entrada/saída) de um item' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  adjust(
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    return this.stockService.adjustQuantity(id, adjustStockDto.delta, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um item do estoque' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  remove(@Param('id') id: string, @Headers('x-tenant-id') restaurantId: string) {
    return this.stockService.remove(id, restaurantId);
  }
}
