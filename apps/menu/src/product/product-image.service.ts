import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductImage } from './product-image.schema';

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(
    @InjectModel(ProductImage.name)
    private readonly productImageModel: Model<ProductImage>,
  ) {}

  async save(
    productId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<ProductImage> {
    await this.deleteByProductId(productId);

    const newImage = new this.productImageModel({
      productId: new Types.ObjectId(productId),
      data: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
      size: file.size,
    });

    const saved = await newImage.save();
    this.logger.log(`Imagem salva para produto ${productId} (${file.size} bytes)`);
    return saved;
  }

  async saveFromBase64(
    productId: string,
    base64: string,
  ): Promise<ProductImage> {
    const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Formato inválido. Use data:image/{ext};base64,...');
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = Buffer.from(matches[2], 'base64');

    return this.save(productId, {
      buffer: data,
      mimetype: `image/${matches[1] === 'jpeg' ? 'jpeg' : matches[1]}`,
      originalname: `product-${productId}.${ext}`,
      size: data.length,
    });
  }

  async findByProductId(productId: string): Promise<ProductImage | null> {
    return this.productImageModel
      .findOne({ productId: new Types.ObjectId(productId) })
      .exec();
  }

  async deleteByProductId(productId: string): Promise<boolean> {
    const result = await this.productImageModel
      .deleteMany({ productId: new Types.ObjectId(productId) })
      .exec();
    if (result.deletedCount > 0) {
      this.logger.log(`Imagem removida para produto ${productId}`);
    }
    return result.deletedCount > 0;
  }
}
