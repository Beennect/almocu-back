import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type StockDocument = Stock & Document;

@Schema({ timestamps: true, collection: 'products' }) // Mantendo 'products' para compatibilidade com os dados atuais
export class Stock {
  @ApiProperty()
  @Prop({ required: true })
  unit: string;

  @ApiProperty()
  @Prop({ default: 0 })
  minQuantity: number;

  @ApiProperty()
  @Prop({ required: true, index: true })
  name: string;

  @Prop({ default: '' })
  brand: string;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ required: true, type: String }) // Usando String para facilitar a integração via headers
  restaurantId: string;

  @Prop({ required: true, type: String })
  userId: string;
}

export const StockSchema = SchemaFactory.createForClass(Stock);

// Índice único para evitar duplicados na mesma filial
StockSchema.index({ name: 1, brand: 1, restaurantId: 1 }, { unique: true });
