import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProductImageService } from './product-image.service';

@Controller()
export class ProductImageController {
  constructor(
    private readonly productImageService: ProductImageService,
  ) {}

  @Get('uploads/products/:id/image')
  async getImage(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const image = await this.productImageService.findByProductId(id);
    if (!image) {
      throw new NotFoundException('Imagem não encontrada.');
    }
    res.setHeader('Content-Type', image.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(image.data);
  }
}
