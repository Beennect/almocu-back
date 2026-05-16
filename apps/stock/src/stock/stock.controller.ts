import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { StockService } from './stock.service';
import {
  CreateStockDto,
  UpdateStockDto,
  AdjustStockDto,
} from './dto/stock.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    restaurantId: string;
  };
}

@ApiTags('stock')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description:
    'ID do restaurante para contexto multi-tenant (opcional, sobrescreve o do token)',
  required: false,
})
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo item no estoque' })
  create(
    @Body() createStockDto: CreateStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.create(
      createStockDto,
      req.user.id,
      req.user.restaurantId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lista itens do estoque com paginação' })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.stockService.findAll(
      req.user.restaurantId,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um item específico' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.stockService.findOne(id, req.user.restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza detalhes de um item' })
  update(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.update(id, updateStockDto, req.user.restaurantId);
  }

  @Patch(':id/adjust')
  @ApiOperation({ summary: 'Ajusta a quantidade (entrada/saída) de um item' })
  adjust(
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.adjustQuantity(
      id,
      adjustStockDto.delta,
      req.user.restaurantId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um item do estoque' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.stockService.remove(id, req.user.restaurantId);
  }
}
