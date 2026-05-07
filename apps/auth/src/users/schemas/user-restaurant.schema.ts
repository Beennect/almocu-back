import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserRestaurantDocument = UserRestaurant & Document;

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  WAITER = 'WAITER',
  KITCHEN = 'KITCHEN',
  CASHIER = 'CASHIER',
}

@Schema({ timestamps: true })
export class UserRestaurant {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, enum: UserRole, default: UserRole.WAITER })
  role!: UserRole;

  @Prop({ default: 'active', enum: ['active', 'pending', 'inactive'] })
  status!: string;
}

export const UserRestaurantSchema = SchemaFactory.createForClass(UserRestaurant);

// Garantir que um usuário não tenha vínculos duplicados no mesmo restaurante
UserRestaurantSchema.index({ userId: 1, restaurantId: 1 }, { unique: true });
