import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './product.schema';
import { Pageable, Page, RedisService } from '@app/common';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout } from 'rxjs';
import { writeFile, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const writeFileAsync = promisify(writeFile);

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  private readonly uploadsDir = join(__dirname, '..', '..', '..', 'uploads', 'products');

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.redisService.incr(`products:cache:version:${restaurantId}`);
  }

  /**
   * Decodifica uma imagem base64 e salva no disco.
   * Retorna a URL pública ou null se não houver imagem.
   */
  private async saveBase64Image(base64?: string): Promise<string | null> {
    if (!base64) return null;

    const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new BadRequestException(
        'Formato inválido. Use data:image/{ext};base64,...',
      );
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = matches[2];
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const filepath = join(this.uploadsDir, `${filename}`);

    // Garante que a pasta existe
    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true });
    }

    await writeFileAsync(filepath, data, 'base64');
    this.logger.log(`Imagem salva: ${filepath}`);

    return `/uploads/products/${filename}`;
  }

  private async validateStockItem(
    stockProductId: string,
    restaurantId: string,
  ): Promise<void> {
    const stockServiceUrl =
      this.configService.get<string>('STOCK_SERVICE_URL') ||
      'http://stock-app:3000';
    const internalKey = this.configService.get<string>('INTERNAL_API_KEY');

    try {
      await firstValueFrom(
        this.httpService.get(`${stockServiceUrl}/internal/stock/${stockProductId}`, {
          headers: {
            'x-internal-key': internalKey,
            'x-tenant-id': restaurantId,
          },
        }),
      );
    } catch (error: any) {
      const detail =
        error.response?.data?.message || error.message || 'erro desconhecido';

      const status = error.response?.status || 'sem status';

      throw new BadRequestException(
        `Ingrediente (ID: ${stockProductId}) inválido: ${detail} (HTTP ${status})`,
      );
    }
  }

  /**
   * Valida múltiplos ingredientes em uma única chamada batch ao serviço de estoque.
   */
  private async validateStockItems(
    stockProductIds: string[],
    restaurantId: string,
  ): Promise<void> {
    if (!stockProductIds.length) return;

    const stockServiceUrl =
      this.configService.get<string>('STOCK_SERVICE_URL') ||
      'http://stock-app:3000';
    const internalKey = this.configService.get<string>('INTERNAL_API_KEY');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${stockServiceUrl}/internal/stock/batch`,
          { ids: stockProductIds },
          {
            headers: {
              'x-internal-key': internalKey,
              'x-tenant-id': restaurantId,
            },
          },
        ).pipe(timeout(10000)),
      );

      const foundIds: string[] = (response.data || []).map(
        (item: any) => item._id?.toString() || item.id,
      );

      const missingIds = stockProductIds.filter((id) => !foundIds.includes(id));
      if (missingIds.length > 0) {
        throw new BadRequestException(
          `Ingredientes não encontrados no estoque: ${missingIds.join(', ')}`,
        );
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      const detail =
        error.response?.data?.message || error.message || 'erro desconhecido';
      throw new BadRequestException(
        `Erro ao validar ingredientes no estoque: ${detail}`,
      );
    }
  }

  async create(
    createProductDto: CreateProductDto,
    restaurantId: string,
  ) {
    // Valida TODOS os ingredientes em uma única chamada batch
    const ingredientIds =
      createProductDto.ingredients?.map((ing) => ing.stockProductId) || [];
    if (ingredientIds.length > 0) {
      await this.validateStockItems(ingredientIds, restaurantId);
    }

    // Extrai imageBase64 e processa a imagem
    const { imageBase64, ...dto } = createProductDto;
    const imageUrl = await this.saveBase64Image(imageBase64);

    try {
      const newProduct = new this.productModel({
        ...dto,
        ...(imageUrl ? { imageUrl } : {}),
        restaurantId,
      });
      const saved = await newProduct.save();
      try {
        await this.invalidateCache(restaurantId);
      } catch (cacheError) {
        this.logger.error(
          `Falha ao invalidar cache: ${cacheError}`,
        );
      }
      return saved;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(
          'Produto com este nome e categoria já existe neste restaurante.',
        );
      }
      throw error;
    }
  }

  async findAll(
    restaurantId: string,
    pageable: Pageable,
  ): Promise<Page<Product>> {
    const cacheVersion =
      (await this.redisService.get(`products:cache:version:${restaurantId}`)) ||
      '0';
    const cacheKey = `products:${restaurantId}:v${cacheVersion}:page:${pageable.page}:limit:${pageable.limit}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Page<Product>;
    }

    const [items, total] = await Promise.all([
      this.productModel
        .find({ restaurantId })
        .sort({ name: 1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.productModel.countDocuments({ restaurantId }).exec(),
    ]);

    const result = new Page(items as unknown as Product[], total, pageable);

    await this.redisService.set(cacheKey, JSON.stringify(result), 'EX', 3600);
    return result;
  }

  async findOne(id: string, restaurantId: string) {
    const product = await this.productModel
      .findOne({ _id: id, restaurantId })
      .lean()
      .exec();
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    restaurantId: string,
  ) {
    // Valida ingredientes se estiverem sendo atualizados
    const ingredientIds =
      updateProductDto.ingredients?.map((ing) => ing.stockProductId) || [];
    if (ingredientIds.length > 0) {
      await this.validateStockItems(ingredientIds, restaurantId);
    }

    // Extrai imageBase64 e processa a imagem
    const { imageBase64, ...dto } = updateProductDto;
    const imageUrl = await this.saveBase64Image(imageBase64);

    const updateData: Record<string, any> = { ...dto };
    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    const updated = await this.productModel
      .findOneAndUpdate({ _id: id, restaurantId }, { $set: updateData }, {
        new: true,
      })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Produto não encontrado.');

    await this.invalidateCache(restaurantId);
    return updated;
  }

  async remove(id: string, restaurantId: string) {
    const deleted = await this.productModel
      .findOneAndDelete({ _id: id, restaurantId })
      .exec();
    if (!deleted) throw new NotFoundException('Produto não encontrado.');

    await this.invalidateCache(restaurantId);
    return { message: 'Produto removido com sucesso' };
  }

  async updateImage(
    id: string,
    restaurantId: string,
    imageUrl: string,
  ) {
    const updated = await this.productModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: { imageUrl } },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Produto não encontrado.');

    await this.invalidateCache(restaurantId);
    return updated;
  }

  /**
   * Remove um ingrediente (pelo stockProductId) de TODOS os produtos
   * de um restaurante. Usado quando um item de estoque é excluído.
   * @returns número de produtos modificados
   */
  async removeIngredientFromAllProducts(
    stockProductId: string,
    restaurantId: string,
  ): Promise<{ modifiedCount: number }> {
    const objectId = new Types.ObjectId(stockProductId);

    const result = await this.productModel
      .updateMany(
        {
          restaurantId,
          'ingredients.stockProductId': objectId,
        },
        {
          $pull: { ingredients: { stockProductId: objectId } },
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      // Verifica se algum produto ficou sem ingredientes
      const emptyProducts = await this.productModel
        .find({ restaurantId, ingredients: { $size: 0 } })
        .lean()
        .exec();

      if (emptyProducts.length > 0) {
        this.logger.warn(
          `Produtos sem ingredientes após remoção do estoque: ${emptyProducts.map((p) => (p as any).name).join(', ')}`,
        );
      }

      await this.invalidateCache(restaurantId);
    }

    return { modifiedCount: result.modifiedCount };
  }

  async findByIds(ids: string[], restaurantId: string) {
    return this.productModel
      .find({
        _id: { $in: ids },
        restaurantId,
      })
      .lean()
      .exec();
  }
}
