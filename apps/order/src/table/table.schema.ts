import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ timestamps: true })
export class Table extends Document {
  @ApiProperty({
    example: '65f1a2b3c4d5e6f7a8b9c0d1',
    description: 'ID do restaurante',
  })
  @Prop({ required: true, index: true })
  restaurantId: string;

  @ApiProperty({
    example: '5',
    description: 'Número ou identificação da mesa',
  })
  @Prop({ required: true, trim: true })
  number: string;

  @ApiProperty({
    example: 4,
    description: 'Capacidade máxima de pessoas',
  })
  @Prop({ required: true, min: 1 })
  capacity: number;

  @ApiProperty({
    example: true,
    description: 'Se a mesa está ativa (soft delete)',
  })
  @Prop({ default: true })
  isActive: boolean;
}

export const TableSchema = SchemaFactory.createForClass(Table);

// Índice único: número da mesa por restaurante
TableSchema.index({ restaurantId: 1, number: 1 }, { unique: true });
