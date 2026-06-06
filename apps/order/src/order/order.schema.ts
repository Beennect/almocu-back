import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
class OrderItem {
  @Prop({ type: Types.ObjectId, required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  price: number;
}

const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class DeliveryAddress {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  number: string;

  @Prop()
  neighborhood?: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true, maxlength: 2 })
  state: string;

  @Prop()
  zipCode?: string;

  @Prop()
  complement?: string;
}

const DeliveryAddressSchema = SchemaFactory.createForClass(DeliveryAddress);

@Schema({ _id: false })
export class StatusHistoryEntry {
  @Prop({
    required: true,
    enum: [
      'pendente',
      'em_preparo',
      'pronto',
      'saiu_para_entrega',
      'entregue',
      'cancelado',
    ],
  })
  status!: string;

  @Prop({ required: true })
  timestamp!: Date;
}

const StatusHistoryEntrySchema =
  SchemaFactory.createForClass(StatusHistoryEntry);

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  deliveryUserId?: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true, min: 0 })
  totalValue: number;

  @ApiProperty({
    example: 'pendente',
    enum: [
      'pendente',
      'em_preparo',
      'pronto',
      'saiu_para_entrega',
      'entregue',
      'cancelado',
    ],
    description: 'Status atual do pedido',
  })
  @Prop({
    required: true,
    enum: [
      'pendente',
      'em_preparo',
      'pronto',
      'saiu_para_entrega',
      'entregue',
      'cancelado',
    ],
    default: 'pendente',
  })
  status: string;

  @Prop({ type: DeliveryAddressSchema })
  deliveryAddress?: DeliveryAddress;

  @Prop({ maxlength: 100 })
  clientName?: string;

  @Prop({ maxlength: 50 })
  origin: string;

  @Prop({ maxlength: 500 })
  observations: string;

  @Prop({
    enum: ['pending', 'paid', 'unpaid', 'canceled', 'refunded'],
    default: 'pending',
  })
  paymentStatus: string;

  @Prop()
  stripeSessionId: string;

  @Prop({ type: [StatusHistoryEntrySchema], default: [] })
  statusHistory!: StatusHistoryEntry[];
}

export { StatusHistoryEntrySchema };

export const OrderSchema = SchemaFactory.createForClass(Order);

// Índice composto para otimizar a ordenação por data dentro de cada restaurante
OrderSchema.index({ restaurantId: 1, createdAt: -1 });
// Índice composto para otimizar a ordenação por data para cada usuário
OrderSchema.index({ userId: 1, createdAt: -1 });
// Índice composto para queries de delivery person
OrderSchema.index({ restaurantId: 1, deliveryUserId: 1, createdAt: -1 });
