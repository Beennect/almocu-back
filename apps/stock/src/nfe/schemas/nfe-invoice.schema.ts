import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
class NfeInvoiceItem {
  @ApiProperty({ example: 'ARROZ TIPO 1 5KG' })
  @Prop({ required: true })
  name!: string;

  @ApiProperty({ example: 'KG' })
  @Prop({ required: true })
  unit!: string;

  @ApiProperty({ example: 30 })
  @Prop({ required: true })
  quantity!: number;

  @ApiProperty({ example: 5.9 })
  @Prop({ required: true })
  unitPrice!: number;

  @ApiProperty({ example: 177.0 })
  @Prop({ required: true })
  totalPrice!: number;
}

export const NfeInvoiceItemSchema = SchemaFactory.createForClass(NfeInvoiceItem);

export type NfeInvoiceDocument = NfeInvoice & Document;

@Schema({
  timestamps: true,
  collection: 'nfe_invoices',
})
export class NfeInvoice {
  @ApiProperty({
    example: '35200612345678000190550010000000011000000010',
    description: 'Chave de acesso de 44 dígitos',
  })
  @Prop({ required: true, unique: true })
  accessKey!: string;

  @ApiProperty({
    example: '135000000000001',
    description: 'Número do protocolo de autorização',
    required: false,
  })
  @Prop()
  nProt?: string;

  @ApiProperty({
    example: '2026-05-25T10:00:00-03:00',
    description: 'Data de emissão da NF-e',
    required: false,
  })
  @Prop()
  issueDate?: Date;

  @ApiProperty({
    example: 'DISTRIBUIDORA RYZEN LTDA',
    required: false,
  })
  @Prop()
  supplierName?: string;

  @ApiProperty({
    example: '12345678000190',
    required: false,
  })
  @Prop()
  supplierCnpj?: string;

  @ApiProperty({
    description: 'ID do fornecedor vinculado no sistema',
    required: false,
  })
  @Prop({ type: String })
  supplierId?: string;

  @ApiProperty({ example: 607.0 })
  @Prop({ required: true })
  totalValue!: number;

  @ApiProperty({
    type: [NfeInvoiceItem],
    description: 'Itens da nota fiscal',
  })
  @Prop({ type: [NfeInvoiceItemSchema], required: true })
  items!: NfeInvoiceItem[];

  @ApiProperty({
    example: '64f1a2b3c4d5e6f7a8b9c0d1',
  })
  @Prop({ required: true, type: String, index: true })
  restaurantId!: string;

  @ApiProperty({
    example: '64f1a2b3c4d5e6f7a8b9c0d2',
  })
  @Prop({ required: true, type: String })
  userId!: string;
}

export const NfeInvoiceSchema = SchemaFactory.createForClass(NfeInvoice);

NfeInvoiceSchema.index({ restaurantId: 1, createdAt: -1 });
