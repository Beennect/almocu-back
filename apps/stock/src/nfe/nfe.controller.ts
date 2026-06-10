import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { RolesGuard } from '@app/common/guards/roles.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { RestaurantId } from '@app/common/decorators/restaurant-id.decorator';
import { NfeService } from './nfe.service';
import { NfeParseResult, NfeImportResult } from './nfe.types';
import { NfeImportDto } from './dto/nfe-import.dto';

@ApiTags('nfe')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante (contexto de tenancy)',
  required: true,
})
@Controller('nfe')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
export class NfeController {
  constructor(private readonly nfeService: NfeService) {}

  @Post('parse')
  @ApiOperation({
    summary: 'Parsear XML de NF-e',
    description:
      'Recebe o conteúdo XML de uma Nota Fiscal Eletrônica e retorna os itens extraídos. ' +
      'Nenhum dado é salvo no banco — apenas o parsing é realizado.',
  })
  @ApiBody({
    description: 'Conteúdo XML da NF-e',
    schema: {
      type: 'object',
      properties: {
        xml: {
          type: 'string',
          example: '<?xml version="1.0" encoding="UTF-8"?><NFe>...</NFe>',
          description: 'Conteúdo completo do XML da NF-e',
        },
      },
      required: ['xml'],
    },
  })
  @ApiOkResponse({
    description: 'Itens extraídos da NF-e',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Prato Executivo - Filé de Frango' },
              ncm: { type: 'string', example: '21069090' },
              unit: { type: 'string', example: 'UN' },
              quantity: { type: 'number', example: 2 },
              unitPrice: { type: 'number', example: 32.9 },
              totalPrice: { type: 'number', example: 65.8 },
            },
          },
        },
        supplierName: { type: 'string', example: 'Restaurante Sabor da Casa LTDA' },
        supplierCnpj: { type: 'string', example: '12345678000195' },
        accessKey: { type: 'string', example: '35200612345678000195001100000012345678901234' },
        duplicate: {
          type: 'object',
          properties: {
            importedAt: { type: 'string', format: 'date-time' },
            userName: { type: 'string', example: 'joao' },
            itemCount: { type: 'number', example: 5 },
          },
        },
      },
    },
  })
  async parse(
    @Body('xml') xml: string,
    @RestaurantId() restaurantId: string,
  ): Promise<NfeParseResult> {
    if (!xml || typeof xml !== 'string' || !xml.trim()) {
      throw new BadRequestException('O campo "xml" é obrigatório.');
    }

    const buffer = Buffer.from(xml, 'utf-8');

    if (buffer.length === 0) {
      throw new BadRequestException('O XML está vazio.');
    }

    const sizeLimit = 10 * 1024 * 1024;
    if (buffer.length > sizeLimit) {
      throw new BadRequestException('O XML excede o limite de 10 MB.');
    }

    return this.nfeService.parseXml(buffer, restaurantId);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Importar itens de NF-e em lote',
    description:
      'Recebe a lista de itens revisados e os dados do emitente, cria ou atualiza o fornecedor ' +
      'automaticamente pelo CNPJ, cria ou atualiza os itens no estoque e registra a importação.',
  })
  @ApiBody({ type: NfeImportDto })
  @ApiOkResponse({
    description: 'Resultado da importação',
    schema: {
      type: 'object',
      properties: {
        supplier: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            cnpj: { type: 'string' },
          },
        },
        summary: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            created: { type: 'number' },
            updated: { type: 'number' },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  async importNfe(
    @Body() dto: NfeImportDto,
    @RestaurantId() restaurantId: string,
    @Req() req: any,
  ): Promise<NfeImportResult> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('A lista de itens não pode estar vazia.');
    }

    const userId = req.user.id;
    const userName = req.user.username;

    return this.nfeService.importItems(
      {
        items: dto.items,
        supplierName: dto.supplierName,
        supplierCnpj: dto.supplierCnpj,
        accessKey: dto.accessKey,
      },
      restaurantId,
      userId,
      userName,
    );
  }

  @Post('record')
  @ApiOperation({
    summary: 'Registrar importação de NF-e',
    description:
      'Salva o registro de importação de uma NF-e após a confirmação dos itens pelo usuário.',
  })
  @ApiBody({
    description: 'Dados da importação',
    schema: {
      type: 'object',
      properties: {
        accessKey: { type: 'string', example: '35200612345678000195001100000012345678901234' },
        supplierName: { type: 'string', example: 'Fornecedor LTDA' },
        supplierCnpj: { type: 'string', example: '12345678000195' },
        itemCount: { type: 'number', example: 5 },
      },
      required: ['accessKey', 'itemCount'],
    },
  })
  async record(
    @Body() body: { accessKey: string; supplierName?: string; supplierCnpj?: string; itemCount: number },
    @RestaurantId() restaurantId: string,
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    if (!body.accessKey || typeof body.accessKey !== 'string') {
      throw new BadRequestException('accessKey é obrigatório.');
    }
    if (!body.itemCount || typeof body.itemCount !== 'number') {
      throw new BadRequestException('itemCount é obrigatório.');
    }

    await this.nfeService.recordImport({
      accessKey: body.accessKey,
      restaurantId,
      userId: req.user.id,
      userName: req.user.username,
      supplierName: body.supplierName,
      supplierCnpj: body.supplierCnpj,
      itemCount: body.itemCount,
    });

    return { success: true };
  }
}
