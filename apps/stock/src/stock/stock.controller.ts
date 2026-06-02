import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { StockService } from './stock.service';
import {
  CreateStockDto,
  UpdateStockDto,
  AdjustStockDto,
} from './dto/stock.dto';
import { StockPageDto } from './dto/stock-page.dto';
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

@ApiTags('stock')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo item no estoque' })
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  create(
    @Body() createStockDto: CreateStockDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.stockService.create(createStockDto, restaurantId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista itens do estoque com paginação' })
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
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
    type: StockPageDto,
    description: 'Lista paginada de itens do estoque',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.stockService.findAll(restaurantId, pageable);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um item específico' })
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.stockService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza detalhes de um item' })
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  update(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.stockService.update(id, updateStockDto, restaurantId);
  }

  @Patch(':id/adjust')
  @ApiOperation({ summary: 'Ajusta a quantidade (entrada/saída) de um item' })
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  adjust(
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.stockService.adjustQuantity(
      id,
      adjustStockDto.delta,
      restaurantId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um item do estoque' })
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.stockService.remove(id, restaurantId);
  }
}
