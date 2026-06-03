import {
  Controller,
  Post,
  Get,
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

  private validateInternalKey(key: string): void {
    const expected = this.configService.get<string>('INTERNAL_API_KEY');
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Chave interna inválida');
    }
  }
}
