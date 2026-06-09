import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type StockDocument = Stock & Document;

@Schema({ _id: false })
class PreviousProductRelation {
  @Prop({ type: Types.ObjectId, required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  productName!: string;

  @Prop({ required: true, min: 0 })
  quantity!: number;
}

const PreviousProductRelationSchema = SchemaFactory.createForClass(PreviousProductRelation);

@Schema({
  timestamps: true,
  collection: 'stock_items',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Stock {
  @ApiProperty({ example: 'kg', description: 'Unidade de medida do item' })
  @Prop({ required: true })
  unit!: string;

  @ApiProperty({
    example: 0,
    description: 'Quantidade mínima antes do alerta de estoque baixo',
  })
  @Prop({ default: 0 })
  minQuantity!: number;

  @ApiProperty({ example: 'Farinha de trigo', description: 'Nome do item' })
  @Prop({ required: true, index: true })
  name!: string;

  @ApiProperty({
    example: 'Dona Benta',
    description: 'Marca do item',
    required: false,
  })
  @Prop({ default: '' })
  brand!: string;

  @ApiProperty({ example: 10, description: 'Quantidade atual em estoque' })
  @Prop({ required: true, min: 0 })
  quantity!: number;

  @ApiProperty({
    example: false,
    description: 'Indica se o estoque está baixo (quantity <= minQuantity)',
  })
  lowStock?: boolean;

  // String em vez de ObjectId para facilitar integração via headers (x-restaurant-id)
  @ApiProperty({ example: '64f1a2b3c4d5e6f7a8b9c0d1' })
  @Prop({ required: true, type: String })
  restaurantId!: string;

  @ApiProperty({
    example: '64f1a2b3c4d5e6f7a8b9c0d3',
    description: 'ID do fornecedor preferencial',
    required: false,
  })
  @Prop({ type: String })
  supplierId?: string;

  @ApiProperty({ default: true, description: 'Se o item está ativo no estoque' })
  @Prop({ default: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'Relações com produtos do cardápio antes da desativação (para reativação)',
    required: false,
  })
  @Prop({ type: [PreviousProductRelationSchema], default: [] })
  previousProductRelations?: PreviousProductRelation[];
}

export const StockSchema = SchemaFactory.createForClass(Stock);

StockSchema.virtual('lowStock').get(function (this: StockDocument) {
  return this.quantity <= this.minQuantity;
});

// Índice único para evitar duplicados na mesma filial
StockSchema.index({ name: 1, brand: 1, restaurantId: 1 }, { unique: true });
StockSchema.index({ restaurantId: 1, isActive: 1 });
