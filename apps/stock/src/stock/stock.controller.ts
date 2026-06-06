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
  AuditService,
  PageableParams,
  RestaurantId,
} from '@app/common';
import { Roles } from '@app/common';
import type { Pageable } from '@app/common';
import type { Request } from 'express';

@ApiTags('stock')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo item no estoque' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  async create(
    @Body() createStockDto: CreateStockDto,
    @RestaurantId() restaurantId: string,
    @Req() req: Request,
  ) {
    const result = await this.stockService.create(createStockDto, restaurantId);
    this.auditService.log({
      restaurantId,
      userId: (req.user as any)?.id || '',
      userName: (req.user as any)?.username || '',
      userRole: (req.headers['x-user-role'] as string) || '',
      action: 'stock.create',
      entityType: 'stock',
      entityId: (result as any)._id.toString(),
      newState: createStockDto as any,
      description: `Criou item "${createStockDto.name}" no estoque`,
    });
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Lista itens do estoque com paginação' })
  @Roles('OWNER', 'MANAGER', 'KITCHEN', 'WAITER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários, gerentes, cozinheiros e garçons' })
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
  @Roles('OWNER', 'MANAGER', 'KITCHEN', 'WAITER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários, gerentes, cozinheiros e garçons' })
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.stockService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza detalhes de um item' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  async update(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @RestaurantId() restaurantId: string,
    @Req() req: Request,
  ) {
    const previous = await this.stockService.findOne(id, restaurantId);
    const result = await this.stockService.update(id, updateStockDto, restaurantId);
    this.auditService.log({
      restaurantId,
      userId: (req.user as any)?.id || '',
      userName: (req.user as any)?.username || '',
      userRole: (req.headers['x-user-role'] as string) || '',
      action: 'stock.update',
      entityType: 'stock',
      entityId: id,
      previousState: previous as any,
      newState: result as any,
      description: `Atualizou item "${(result as any).name}" no estoque`,
    });
    return result;
  }

  @Patch(':id/adjust')
  @ApiOperation({ summary: 'Ajusta a quantidade (entrada/saída) de um item' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  async adjust(
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @RestaurantId() restaurantId: string,
    @Req() req: Request,
  ) {
    const previous = await this.stockService.findOne(id, restaurantId);
    const result = await this.stockService.adjustQuantity(
      id,
      adjustStockDto.delta,
      restaurantId,
    );
    this.auditService.log({
      restaurantId,
      userId: (req.user as any)?.id || '',
      userName: (req.user as any)?.username || '',
      userRole: (req.headers['x-user-role'] as string) || '',
      action: 'stock.adjust',
      entityType: 'stock',
      entityId: id,
      previousState: { quantity: (previous as any).quantity },
      newState: { quantity: (result as any).quantity },
      description: `Ajustou estoque de "${(result as any).name}" em ${adjustStockDto.delta >= 0 ? '+' : ''}${adjustStockDto.delta} ${(result as any).unit}`,
    });
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um item do estoque' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  async remove(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
    @Req() req: Request,
  ) {
    const previous = await this.stockService.findOne(id, restaurantId);
    await this.stockService.remove(id, restaurantId);
    this.auditService.log({
      restaurantId,
      userId: (req.user as any)?.id || '',
      userName: (req.user as any)?.username || '',
      userRole: (req.headers['x-user-role'] as string) || '',
      action: 'stock.delete',
      entityType: 'stock',
      entityId: id,
      previousState: previous as any,
      description: `Removeu item "${(previous as any).name}" do estoque`,
    });
  }

  @Get('audit/history')
  @ApiOperation({ summary: '[Auditoria] Histórico de alterações do estoque' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  async getHistory(
    @RestaurantId() restaurantId: string,
  ) {
    return this.auditService.findByType(restaurantId, 'stock', 200, 0);
  }
}
