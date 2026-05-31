import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type RestaurantDocument = Restaurant & Document;

@Schema({ timestamps: true })
export class Restaurant {
  @ApiProperty({
    example: 'Almocu do Chef',
    description: 'Nome do restaurante',
  })
  @Prop({ required: true, trim: true })
  name: string;

  @ApiProperty({
    example: '12.345.678/0001-90',
    description: 'CNPJ do restaurante',
  })
  @Prop({ required: true })
  cnpj: string;

  @ApiProperty({
    description:
      'Chave secreta TOTP para convites (oculta nas consultas normais)',
    readOnly: true,
  })
  @Prop({ unique: true, required: true, select: false })
  totpSecret: string;

  @ApiProperty({
    example: 'BASIC',
    enum: ['BASIC', 'PROFESSIONAL', 'NETWORK', 'PREMIUM'],
  })
  @Prop({
    enum: ['BASIC', 'PROFESSIONAL', 'NETWORK', 'PREMIUM'],
    default: 'BASIC',
  })
  plan: string;

  @ApiProperty({ example: 1, description: 'Quantidade máxima de filiais' })
  @Prop({ default: 1 })
  maxBranches: number;

  @ApiProperty({
    description: 'ID do restaurante pai (matriz)',
    required: false,
  })
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', default: null })
  parentId: Types.ObjectId;

  @ApiProperty({ example: 'active', enum: ['active', 'pending', 'suspended'] })
  @Prop({ default: 'active', enum: ['active', 'pending', 'suspended'] })
  status: string;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
