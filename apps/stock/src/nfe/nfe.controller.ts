import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiOkResponse,
  ApiParam,
  ApiBearerAuth,
  ApiHeader,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { RolesGuard } from '@app/common/guards/roles.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { RestaurantId } from '@app/common/decorators/restaurant-id.decorator';
import { PageableParams } from '@app/common';
import type { Pageable } from '@app/common';
import { NfeService } from './nfe.service';
import { UploadNfeDto } from './dto/upload-nfe.dto';
import { NfeInvoicePageDto } from './dto/nfe-invoice-page.dto';
import type { Request } from 'express';

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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Importar XML de NF-e',
    description:
      'Faz o upload do XML de uma Nota Fiscal Eletrônica, extrai os produtos e atualiza o estoque. ' +
      'Se o item já existir (mesmo nome), incrementa a quantidade. Se não existir, cria um novo. ' +
      'O fornecedor é vinculado automaticamente pelo CNPJ do emitente. ' +
      'A nota fiscal é salva no histórico de compras.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Arquivo XML da NF-e',
    type: UploadNfeDto,
  })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @RestaurantId() restaurantId: string,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo XML é obrigatório.');
    }

    if (!file.originalname.toLowerCase().endsWith('.xml')) {
      throw new BadRequestException('O arquivo deve ser um XML (.xml).');
    }

    if (file.size === 0) {
      throw new BadRequestException('O arquivo XML está vazio.');
    }

    const sizeLimit = 10 * 1024 * 1024;
    if (file.size > sizeLimit) {
      throw new BadRequestException(
        'O arquivo XML excede o limite de 10 MB.',
      );
    }

    const userId = (req.user as any)?.id || (req.user as any)?.sub || '';

    return this.nfeService.processXml(file.buffer, restaurantId, userId);
  }

  @Get('invoices')
  @ApiOperation({
    summary: 'Listar histórico de notas fiscais',
    description:
      'Retorna a lista paginada de notas fiscais importadas no restaurante.',
  })
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
    type: NfeInvoicePageDto,
    description: 'Lista paginada de notas fiscais',
  })
  async findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.nfeService.findAll(restaurantId, pageable);
  }

  @Get('invoices/:id')
  @ApiOperation({
    summary: 'Detalhar uma nota fiscal',
    description: 'Retorna os dados completos de uma nota fiscal importada.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID da nota fiscal',
  })
  @ApiOkResponse({
    description: 'Dados completos da nota fiscal',
  })
  async findOne(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.nfeService.findOne(id, restaurantId);
  }

  @Delete('invoices/:id')
  @ApiOperation({
    summary: 'Remover nota fiscal do histórico',
    description:
      'Remove o registro da nota fiscal do histórico. ' +
      'ATENÇÃO: Isto não altera o estoque — os itens já foram adicionados.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID da nota fiscal',
  })
  @ApiOkResponse({
    description: 'Nota fiscal removida com sucesso',
  })
  async remove(
    @Param('id') id: string,
    @RestaurantId() restaurantId: string,
  ) {
    await this.nfeService.remove(id, restaurantId);
    return { message: 'Nota fiscal removida do histórico com sucesso.' };
  }
}
