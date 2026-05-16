import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RestaurantDocument = Restaurant & Document;

@Schema({ timestamps: true })
export class Restaurant {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  cnpj: string;

  @Prop({ unique: true, required: true })
  inviteCode: string;

  @Prop({
    enum: ['BASIC', 'PROFESSIONAL', 'NETWORK', 'PREMIUM'],
    default: 'BASIC',
  })
  plan: string;

  @Prop({ default: 1 })
  maxBranches: number;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', default: null })
  parentId: Types.ObjectId; // Se for null, é o restaurante principal/matriz

  @Prop({ default: 'active', enum: ['active', 'pending', 'suspended'] })
  status: string;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
