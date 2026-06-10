import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ModuleAcquisitionDocument = ModuleAcquisition & Document;

@Schema({ timestamps: true })
export class ModuleAcquisition {
  @ApiProperty({ description: 'ID do restaurante' })
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true })
  restaurantId!: Types.ObjectId;

  @ApiProperty({ description: 'ID do módulo (ex: mesas, financeiro, fidelidade, delivery)' })
  @Prop({ required: true })
  moduleId!: string;

  @ApiProperty({ description: 'Data de aquisição do módulo' })
  @Prop({ default: Date.now })
  acquiredAt!: Date;
}

export const ModuleAcquisitionSchema = SchemaFactory.createForClass(ModuleAcquisition);

ModuleAcquisitionSchema.index({ restaurantId: 1, moduleId: 1 }, { unique: true });
