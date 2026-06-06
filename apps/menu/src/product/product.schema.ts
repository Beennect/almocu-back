import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
class Ingredient {
  @ApiProperty()
  @Prop({ type: Types.ObjectId, required: true })
  stockProductId!: Types.ObjectId;

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  quantity!: number;
}

const IngredientSchema = SchemaFactory.createForClass(Ingredient);

@Schema({ timestamps: true })
export class Product extends Document {
  @ApiProperty()
  @Prop({ required: true })
  name!: string;

  @ApiProperty({ example: 'Hamburgueres', description: 'Categoria do produto' })
  @Prop({ required: true })
  category!: string;

  @ApiProperty()
  @Prop({ required: true })
  price!: number;

  @ApiProperty()
  @Prop()
  description?: string;

  @ApiProperty({
    required: false,
    description: 'URL da imagem do produto',
  })
  @Prop()
  imageUrl?: string;

  @ApiProperty({ type: [Ingredient] })
  @Prop({ type: [IngredientSchema], required: true })
  ingredients!: Ingredient[];

  @ApiProperty()
  @Prop({ required: true, index: true })
  restaurantId!: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index(
  { name: 1, category: 1, restaurantId: 1 },
  { unique: true },
);
