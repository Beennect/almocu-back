import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({
  timestamps: true,
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({ required: true, index: true })
  restaurantId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  userName!: string;

  @Prop({ required: true })
  userRole!: string;

  /** Ex: 'stock.create', 'menu.update', 'order.cancel' */
  @Prop({ required: true, index: true })
  action!: string;

  /** Ex: 'stock', 'menu', 'order', 'staff' */
  @Prop({ required: true, index: true })
  entityType!: string;

  @Prop({ required: true })
  entityId!: string;

  @Prop({ type: Object })
  previousState?: Record<string, any>;

  @Prop({ type: Object })
  newState?: Record<string, any>;

  @Prop()
  description?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ restaurantId: 1, entityType: 1, createdAt: -1 });
