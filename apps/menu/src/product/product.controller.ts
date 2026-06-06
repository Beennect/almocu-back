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
  Req,
  Headers,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
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
const IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const UPLOADS_DIR = join(__dirname, '..', '..', '..', 'uploads', 'products');

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
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: any,
    @RestaurantId() restaurantId: string,
  ) {
    const token = req.headers.authorization;
    return this.productService.create(
      createProductDto,
      restaurantId,
      token,
      req.user.role,
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
  @ApiOkResponse({
    type: ProductPageDto,
    description: 'Lista paginada de produtos',
  })
  findAll(
    @RestaurantId() restaurantId: string,
    @PageableParams() pageable: Pageable,
  ) {
    return this.productService.findAll(restaurantId, pageable);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um produto específico' })
  @Roles('WAITER', 'KITCHEN', 'DELIVERY', 'OWNER', 'MANAGER')
  findOne(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.productService.findOne(id, restaurantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um produto' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @RestaurantId() restaurantId: string,
  ) {
    return this.productService.update(id, updateProductDto, restaurantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um produto do cardápio' })
  @Roles('OWNER', 'MANAGER')
  @ApiForbiddenResponse({ description: 'Apenas proprietários e gerentes' })
  remove(@Param('id') id: string, @RestaurantId() restaurantId: string) {
    return this.productService.remove(id, restaurantId);
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
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname).toLowerCase();
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

    const imageUrl = `/uploads/products/${file.filename}`;
    return this.productService.updateImage(id, restaurantId, imageUrl);
  }

  /**
   * Endpoint INTERNO (service-to-service).
   * Remove um ingrediente de TODOS os produtos do restaurante.
   * Chamado pelo stock-app quando um item de estoque é excluído.
   */
  @Delete('internal/ingredient/:stockProductId')
  @HttpCode(204)
  @ApiOperation({
    summary: '[Interno] Remove ingrediente de todos os produtos',
    description: 'Endpoint service-to-service. Requer x-internal-key.',
  })
  @ApiHeader({
    name: 'x-internal-key',
    description: 'Chave interna de autenticação entre serviços',
    required: true,
  })
  async removeIngredientFromAllProducts(
    @Param('stockProductId') stockProductId: string,
    @RestaurantId() restaurantId: string,
    @Headers('x-internal-key') internalKey: string,
  ) {
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expectedKey || internalKey !== expectedKey) {
      throw new UnauthorizedException('Chave interna inválida');
    }

    return this.productService.removeIngredientFromAllProducts(
      stockProductId,
      restaurantId,
    );
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
}
