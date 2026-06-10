import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NfeImportDocument = NfeImport & Document;

@Schema({ timestamps: true, collection: 'nfe_imports' })
export class NfeImport {
  @Prop({ required: true })
  accessKey!: string;

  @Prop({ required: true })
  restaurantId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  userName!: string;

  @Prop()
  supplierName?: string;

  @Prop()
  supplierCnpj?: string;

  @Prop({ required: true })
  itemCount!: number;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NfeImportSchema = SchemaFactory.createForClass(NfeImport);

NfeImportSchema.index({ accessKey: 1, restaurantId: 1 }, { unique: true });
