import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true, min: 0 })
  totalValue: number;

  @Prop({
    required: true,
    enum: ['pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado'],
    default: 'pendente',
  })
  status: string;

  @Prop({ maxlength: 50 })
  origin: string;

  @Prop({ maxlength: 500 })
  observations: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
