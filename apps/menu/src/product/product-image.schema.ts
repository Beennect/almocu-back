import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'product_images' })
export class ProductImage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  filename!: string;

  @Prop({ required: true })
  mimetype!: string;

  @Prop({ required: true })
  data!: Buffer;

  @Prop({ default: 0 })
  size!: number;
}

export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);
