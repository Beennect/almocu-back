import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, UpdateStockDto, AdjustStockDto } from './dto/stock.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo item no estoque' })
  create(
    @Body() createStockDto: CreateStockDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    return this.stockService.create(createStockDto, userId, restaurantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista itens do estoque com paginação' })
  findAll(
    @Req() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.stockService.findAll(
      restaurantId,
      parseInt(page) || 1,
      parseInt(limit) || 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um item específico' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const restaurantId = req.user.restaurantId;
    return this.stockService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza detalhes de um item' })
  update(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @Req() req: any,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.stockService.update(id, updateStockDto, restaurantId);
  }

  @Patch(':id/adjust')
  @ApiOperation({ summary: 'Ajusta a quantidade (entrada/saída) de um item' })
  adjust(
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @Req() req: any,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.stockService.adjustQuantity(id, adjustStockDto.delta, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um item do estoque' })
  remove(@Param('id') id: string, @Req() req: any) {
    const restaurantId = req.user.restaurantId;
    return this.stockService.remove(id, restaurantId);
  }
}
