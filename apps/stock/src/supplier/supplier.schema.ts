import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SupplierDocument = Supplier & Document;

@Schema({ _id: false })
class Address {
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

const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({
  timestamps: true,
  collection: 'suppliers',
})
export class Supplier {
  @ApiProperty({ example: 'Distribuidora de Alimentos LTDA' })
  @Prop({ required: true, index: true })
  name!: string;

  @ApiProperty({ example: 'Maria Silva', required: false })
  @Prop()
  contactName?: string;

  @ApiProperty({ example: '(11) 99999-8888', required: false })
  @Prop()
  phone?: string;

  @ApiProperty({ example: 'contato@distribuidora.com', required: false })
  @Prop()
  email?: string;

  @ApiProperty({ example: '12.345.678/0001-90', required: false })
  @Prop()
  cnpj?: string;

  @ApiProperty({
    description: 'Endereço do fornecedor',
    required: false,
    type: () => Address,
  })
  @Prop({ type: AddressSchema })
  address?: Address;

  @ApiProperty({
    example: 'Prazos de entrega: 5 dias úteis',
    required: false,
  })
  @Prop()
  notes?: string;

  @ApiProperty({ default: true })
  @Prop({ default: true })
  isActive!: boolean;

  @ApiProperty({ example: '64f1a2b3c4d5e6f7a8b9c0d1' })
  @Prop({ required: true, type: String })
  restaurantId!: string;

  @ApiProperty({ example: '64f1a2b3c4d5e6f7a8b9c0d2' })
  @Prop({ required: true, type: String })
  userId!: string;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);

// Índice único por nome + restaurantId
SupplierSchema.index({ name: 1, restaurantId: 1 }, { unique: true });
// Índice para busca por CNPJ
SupplierSchema.index(
  { cnpj: 1, restaurantId: 1 },
  {
    unique: true,
    sparse: true,
  },
);
