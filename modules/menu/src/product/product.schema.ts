import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class Product extends Document {
  @ApiProperty()
  @Prop({ required: true })
  name: string;

  @ApiProperty()
  @Prop({ required: true })
  brand: string;

  @ApiProperty()
  @Prop({ required: true })
  price: number;

  @ApiProperty()
  @Prop()
  description: string;

  @ApiProperty()
  @Prop({ required: true })
  stockProductId: string;

  @ApiProperty()
  @Prop({ required: true, index: true })
  restaurantId: string;

  @ApiProperty()
  @Prop({ required: true })
  userId: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Índice de unicidade: Nome + Marca + Restaurante
ProductSchema.index({ name: 1, brand: 1, restaurantId: 1 }, { unique: true });
