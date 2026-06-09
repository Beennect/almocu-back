import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  UpdateProductDto,
  BatchIdsDto,
} from './dto/product.dto';
import { ProductPageDto } from './dto/product-page.dto';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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

/** Extensões de imagem permitidas */
const IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

@ApiTags('products')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-restaurant-id',
  description: 'ID do restaurante',
  required: true,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo produto no cardápio' })
  @Roles('OWNER', 'MANAGER', 'KITCHEN')
  @ApiForbiddenResponse({ description: 'Apenas proprietários, gerentes e cozinheiros' })
  create(
    @Body() createProductDto: CreateProductDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.productService.create(
      createProductDto,
      restaurantId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lista produtos do cardápio com paginação e cache' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
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
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false', 'all'],
    description: 'Filtrar por ativos (true), inativos (false) ou todos (all). Padrão: true',
    example: 'true',
  })
  @ApiOkResponse({
    type: ProductPageDto,
    description: 'Lista paginada de produtos',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
    @Query('active') active?: 'true' | 'false' | 'all',
  ) {
    return this.productService.findAll(restaurantId, pageable, active);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um produto específico' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.productService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto' })
  @Roles('OWNER', 'MANAGER', 'KITCHEN')
  @ApiForbiddenResponse({ description: 'Apenas proprietários, gerentes e cozinheiros' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.productService.update(id, updateProductDto, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desativa um produto do cardápio (soft delete)' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.productService.remove(id, restaurantId);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reativa um produto desativado do cardápio' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  reactivate(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.productService.reactivate(id, restaurantId);
  }

  @Post(':id/upload')
  @ApiOperation({ summary: 'Faz upload da imagem de um produto' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem (jpeg, png, gif ou webp)',
        },
      },
    },
  })
  @Roles('OWNER', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (IMAGE_MIMETYPES.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Formato de imagem inválido. Use: jpeg, png, gif ou webp.',
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @RestaurantId() restaurantId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }

    return this.productService.updateImage(id, restaurantId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    });
  }

  @Post('batch')
  @ApiOperation({ summary: 'Busca múltiplos produtos pelos IDs' })
  @ApiBody({ type: BatchIdsDto })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findByIds(
    @Body() batchIdsDto: BatchIdsDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.productService.findByIds(batchIdsDto.ids, restaurantId);
  }

  @Get('by-ingredient/:stockProductId')
  @ApiOperation({ summary: 'Busca produtos que usam um determinado ingrediente (item de estoque)' })
  @Roles('OWNER', 'MANAGER', 'KITCHEN')
  findByIngredient(
    @Param('stockProductId') stockProductId: string,
    @RestaurantId() restaurantId: string,
  ) {
    return this.productService.findByStockProductId(stockProductId, restaurantId);
  }
}
