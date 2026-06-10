import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
class BillSplitItem {
  @Prop({ type: Types.ObjectId, required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  subtotal: number;
}

const BillSplitItemSchema = SchemaFactory.createForClass(BillSplitItem);

@Schema({ timestamps: true })
export class BillSplit extends Document {
  @ApiProperty({
    description: 'ID do pedido original',
  })
  @Prop({ type: Types.ObjectId, required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ required: true, index: true })
  restaurantId: string;

  @ApiProperty({
    type: [BillSplitItem],
    description: 'Itens deste split',
  })
  @Prop({ type: [BillSplitItemSchema], required: true })
  items: BillSplitItem[];

  @ApiProperty({
    example: 45.90,
    description: 'Valor total deste split',
  })
  @Prop({ required: true, min: 0 })
  totalValue: number;

  @ApiProperty({
    example: 'João',
    description: 'Nome do cliente responsável por este split',
    required: false,
  })
  @Prop({ maxlength: 100 })
  clientName?: string;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'paid', 'canceled', 'refunded'],
  })
  @Prop({
    enum: ['pending', 'paid', 'canceled', 'refunded'],
    default: 'pending',
  })
  paymentStatus: string;

  @Prop()
  stripeSessionId?: string;
}

export const BillSplitSchema = SchemaFactory.createForClass(BillSplit);

BillSplitSchema.index({ orderId: 1, paymentStatus: 1 });
BillSplitSchema.index({ restaurantId: 1, createdAt: -1 });
