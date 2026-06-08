import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthModule } from '@app/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductImageController } from './product-image.controller';
import { Product, ProductSchema } from './product.schema';
import { ProductImage, ProductImageSchema } from './product-image.schema';
import { ProductImageService } from './product-image.service';
import * as http from 'http';
import * as https from 'https';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductImage.name, schema: ProductImageSchema },
    ]),
    HttpModule.register({
      timeout: 10000,
      httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
      httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
    }),
    JwtAuthModule,
  ],
  controllers: [ProductController, ProductImageController],
  providers: [ProductService, ProductImageService],
  exports: [ProductService, ProductImageService],
})
export class ProductModule {}
