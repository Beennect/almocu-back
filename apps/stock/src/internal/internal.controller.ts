import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBody } from '@nestjs/swagger';
import { InternalGuard } from '@app/common';
import { Types, Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { StockService } from '../stock/stock.service';
import { Stock, StockDocument } from '../stock/stock.schema';
import { BatchStockDto, BatchAdjustDto } from './dto/internal-stock.dto';
import { AdjustStockDto } from '../stock/dto/stock.dto';

@ApiTags('internal')
@UseGuards(InternalGuard)
@Controller('internal/stock')
export class InternalStockController {
  private readonly logger = new Logger(InternalStockController.name);

  constructor(
    private readonly stockService: StockService,
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
  ) {}

  /**
   * Retorna múltiplos itens do estoque por IDs.
   * Endpoint interno (service-to-service) — protegido por InternalGuard.
   */
  @Post('batch')
  @ApiOperation({
    summary: '[Interno] Retorna itens do estoque por IDs',
    description: 'Protegido por InternalGuard. Usado pelo order-service.',
  })
  @ApiBody({ type: BatchStockDto })
  @ApiHeader({ name: 'x-internal-key', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  async findByIds(
    @Body() batchStockDto: BatchStockDto,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    return this.stockService.findByIds(batchStockDto.ids, restaurantId);
  }

  /**
   * Retorna UM item do estoque por ID.
   * Endpoint interno (service-to-service).
   */
  @Get(':id')
  @ApiOperation({
    summary: '[Interno] Busca item de estoque por ID',
  })
  @ApiHeader({ name: 'x-internal-key', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  async findOne(
    @Param('id') id: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    return this.stockService.findOne(id, restaurantId);
  }

  /**
   * Ajusta a quantidade de um item de estoque.
   * Endpoint interno (service-to-service) — usado pelo order-service.
   */
  @Patch(':id/adjust')
  @ApiOperation({
    summary: '[Interno] Ajusta quantidade de item de estoque',
    description: 'Protegido por InternalGuard. Usado pelo order-service para deduzir ingredientes.',
  })
  @ApiBody({ type: AdjustStockDto })
  @ApiHeader({ name: 'x-internal-key', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  async adjust(
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    return this.stockService.adjustQuantity(id, adjustStockDto.delta, restaurantId);
  }

  /**
   * Ajusta múltiplos itens de estoque em uma única chamada atômica.
   * Endpoint interno (service-to-service) — usado pelo order-service.
   */
  @Post('batch/adjust')
  @ApiOperation({
    summary: '[Interno] Ajusta múltiplos itens em lote (atômico)',
    description: 'Protegido por InternalGuard. Usa bulkWrite do MongoDB para atomicidade.',
  })
  @ApiBody({ type: BatchAdjustDto })
  @ApiHeader({ name: 'x-internal-key', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  async batchAdjust(
    @Body() batchAdjustDto: BatchAdjustDto,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    // 1. Merge adjustments by ID (prevents duplicate ops on same document)
    const mergedMap = new Map<string, number>();
    for (const adj of batchAdjustDto.adjustments) {
      mergedMap.set(adj.id, (mergedMap.get(adj.id) || 0) + adj.delta);
    }

    const merged = Array.from(mergedMap.entries()).map(([id, delta]) => ({
      _id: id,
      delta,
    }));

    // 2. Validate — reject if any merged delta is zero
    for (const item of merged) {
      if (item.delta === 0) {
        throw new BadRequestException(
          `Ajuste líquido zero para o item ${item._id}. Remova duplicatas com sinais opostos.`,
        );
      }
    }

    // 3. Build bulkWrite operations for atomic batch update
    const bulkOps = merged.map(({ _id, delta }) => ({
      updateOne: {
        filter: {
          _id: new Types.ObjectId(_id),
          restaurantId,
          // Prevent negative stock: document must have enough quantity for deductions
          ...(delta < 0 ? { quantity: { $gte: -delta } } : {}),
        },
        update: { $inc: { quantity: delta } },
      },
    }));

    const result = await this.stockModel.bulkWrite(bulkOps, { ordered: false });

    // 4. Check for unmatched documents (invalid IDs or insufficient stock)
    const matched = result.matchedCount;
    const expected = merged.length;

    if (matched < expected) {
      const unmatchedIds = merged.map((m) => m._id);
      this.logger.error(
        `Batch adjust parcial: ${matched}/${expected} itens atualizados. IDs: ${unmatchedIds.join(', ')}`,
      );
      throw new BadRequestException(
        'Erro ao ajustar estoque em lote. Verifique se todos os itens existem e têm estoque suficiente.',
      );
    }

    return { adjusted: expected };
  }
}
