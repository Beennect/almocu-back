import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { RolesGuard } from '@app/common/guards/roles.guard';
import { Roles } from '@app/common/decorators/roles.decorator';
import { RestaurantId } from '@app/common/decorators/restaurant-id.decorator';
import { NfeService } from './nfe.service';
import { UploadNfeDto } from './dto/upload-nfe.dto';

@ApiTags('nfe')
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
      'O fornecedor é vinculado automaticamente pelo CNPJ do emitente.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Arquivo XML da NF-e',
    type: UploadNfeDto,
  })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @RestaurantId() restaurantId: string,
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

    const sizeLimit = 10 * 1024 * 1024; // 10 MB
    if (file.size > sizeLimit) {
      throw new BadRequestException('O arquivo XML excede o limite de 10 MB.');
    }

    return this.nfeService.processXml(file.buffer, restaurantId);
  }
}
