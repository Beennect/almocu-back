import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './product.schema';
import { Pageable, Page, RedisService } from '@app/common';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  private async invalidateCache(restaurantId: string): Promise<void> {
    await this.redisService.incr(`products:cache:version:${restaurantId}`);
  }

  private async validateStockItem(
    stockProductId: string,
    restaurantId: string,
    token: string,
    role: string,
  ): Promise<void> {
    const stockServiceUrl =
      this.configService.get<string>('STOCK_SERVICE_URL') ||
      'http://stock-app:3000';

    try {
      await firstValueFrom(
        this.httpService.get(`${stockServiceUrl}/stock/${stockProductId}`, {
          headers: {
            Authorization: token,
            'x-tenant-id': restaurantId,
            'x-user-role': role,
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

  async create(
    createProductDto: CreateProductDto,
    userId: string,
    restaurantId: string,
    token: string,
    role: string,
  ) {
    // Valida TODOS os ingredientes em paralelo
    if (createProductDto.ingredients?.length) {
      await Promise.all(
        createProductDto.ingredients.map((ingredient) =>
          this.validateStockItem(
            ingredient.stockProductId,
            restaurantId,
            token,
            role,
          ),
        ),
      );
    }

    try {
      const newProduct = new this.productModel({
        ...createProductDto,
        userId,
        restaurantId,
      });
      const saved = await newProduct.save();
      await this.invalidateCache(restaurantId);
      return saved;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(
          'Produto com este nome e marca já existe neste restaurante.',
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
    const updated = await this.productModel
      .findOneAndUpdate({ _id: id, restaurantId }, updateProductDto, {
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
