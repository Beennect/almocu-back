import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { StockService } from '../stock/stock.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('internal')
@Controller('internal/stock')
export class InternalStockController {
  private readonly logger = new Logger(InternalStockController.name);

  constructor(
    private readonly stockService: StockService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retorna múltiplos itens do estoque por IDs.
   * Endpoint interno (service-to-service) — NÃO valida JWT, apenas x-internal-key.
   */
  @Post('batch')
  @ApiOperation({
    summary: '[Interno] Retorna itens do estoque por IDs',
    description: 'Protegido por x-internal-key. Usado pelo order-service.',
  })
  @ApiHeader({
    name: 'x-internal-key',
    required: true,
  })
  @ApiHeader({
    name: 'x-tenant-id',
    required: true,
  })
  async findByIds(
    @Body() body: { ids: string[] },
    @Headers('x-internal-key') internalKey: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    this.validateInternalKey(internalKey);
    return this.stockService.findByIds(body.ids, restaurantId);
  }

  /**
   * Retorna UM item do estoque por ID.
   * Endpoint interno (service-to-service).
   */
  @Get(':id')
  @ApiOperation({
    summary: '[Interno] Busca item de estoque por ID',
  })
  async findOne(
    @Param('id') id: string,
    @Headers('x-internal-key') internalKey: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    this.validateInternalKey(internalKey);
    return this.stockService.findOne(id, restaurantId);
  }

  /**
   * Ajusta a quantidade de um item do estoque (entrada/saída).
   * Endpoint interno (service-to-service) — NÃO valida JWT, apenas x-internal-key.
   * Espelha o contrato do StockController.adjust público, mas sem passar pelo RolesGuard.
   * Usado pelo order-service para deduzir ingredientes após criar pedido.
   */
  @Patch(':id/adjust')
  @ApiOperation({
    summary: '[Interno] Ajusta quantidade de um item do estoque',
    description:
      'Protegido por x-internal-key. Usado pelo order-service para deduzir ingredientes.',
  })
  @ApiHeader({ name: 'x-internal-key', required: true })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  async adjustInternal(
    @Param('id') id: string,
    @Body() body: { delta: number },
    @Headers('x-internal-key') internalKey: string,
    @Headers('x-tenant-id') restaurantId: string,
  ) {
    this.validateInternalKey(internalKey);
    return this.stockService.adjustQuantity(id, body.delta, restaurantId);
  }

  private validateInternalKey(key: string): void {
    const expected = this.configService.get<string>('INTERNAL_API_KEY');
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Chave interna inválida');
    }
  }
}
