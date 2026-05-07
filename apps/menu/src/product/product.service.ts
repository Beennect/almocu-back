import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '@app/common';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { createClient } from 'redis';

@Injectable()
export class ProductService {
  private redisClient;

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    this.redisClient = createClient({ url: process.env.REDIS_URI || 'redis://redis:6379' });
    this.redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await this.redisClient.connect();
  }

  private async invalidateCache(restaurantId: string) {
    const keys = await this.redisClient.keys(`products:${restaurantId}:*`);
    if (keys.length > 0) {
      await this.redisClient.del(keys);
    }
  }

  async create(createProductDto: CreateProductDto, userId: string, restaurantId: string) {
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
        throw new ConflictException('Produto com este nome e marca já existe neste restaurante.');
      }
      throw error;
    }
  }

  async findAll(restaurantId: string, page: number = 1, limit: number = 10) {
    const cacheKey = `products:${restaurantId}:page:${page}:limit:${limit}`;
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.productModel.find({ restaurantId }).skip(skip).limit(limit).exec(),
      this.productModel.countDocuments({ restaurantId }),
    ]);

    const result = {
      items,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    };

    await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
    return result;
  }

  async findOne(id: string, restaurantId: string) {
    const product = await this.productModel.findOne({ _id: id, restaurantId }).exec();
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto, restaurantId: string) {
    const updated = await this.productModel
      .findOneAndUpdate({ _id: id, restaurantId }, updateProductDto, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Produto não encontrado.');

    await this.invalidateCache(restaurantId);
    return updated;
  }

  async remove(id: string, restaurantId: string) {
    const deleted = await this.productModel.findOneAndDelete({ _id: id, restaurantId }).exec();
    if (!deleted) throw new NotFoundException('Produto não encontrado.');

    await this.invalidateCache(restaurantId);
    return { message: 'Produto removido com sucesso' };
  }
  async findByIds(ids: string[], restaurantId: string) {
    return this.productModel.find({
      _id: { $in: ids },
      restaurantId,
    }).exec();
  }
}

