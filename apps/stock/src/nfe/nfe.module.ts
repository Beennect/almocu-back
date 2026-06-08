import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Stock, StockSchema } from '../stock/stock.schema';
import { NfeInvoice, NfeInvoiceSchema } from './schemas/nfe-invoice.schema';
import { SupplierModule } from '../supplier/supplier.module';
import { NfeController } from './nfe.controller';
import { NfeService } from './nfe.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Stock.name, schema: StockSchema },
      { name: NfeInvoice.name, schema: NfeInvoiceSchema },
    ]),
    HttpModule.register({ timeout: 10000 }),
    SupplierModule,
  ],
  controllers: [NfeController],
  providers: [NfeService],
})
export class NfeModule {}
