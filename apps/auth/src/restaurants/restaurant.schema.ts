import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type RestaurantDocument = Restaurant & Document;

/** Planos disponíveis para restaurantes */
export enum Plan {
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  NETWORK = 'NETWORK',
  PREMIUM = 'PREMIUM',
}

/** Limite de filiais por plano — fonte única da verdade */
export const PLAN_LIMITS: Record<Plan, number> = {
  [Plan.BASIC]: 3,
  [Plan.PROFESSIONAL]: 6,
  [Plan.NETWORK]: 10,
  [Plan.PREMIUM]: 999, // Ilimitado na prática
};

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
    enum: Plan,
  })
  @Prop({
    type: String,
    enum: Plan,
    default: Plan.BASIC,
  })
  plan: Plan;

  @ApiProperty({ example: 3, description: 'Quantidade máxima de filiais' })
  @Prop({ default: PLAN_LIMITS[Plan.BASIC] })
  maxBranches: number;

  /** Contador atômico de filiais — usado para evitar TOCTOU em createBranch() */
  @Prop({ default: 0 })
  branchCount: number;

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
