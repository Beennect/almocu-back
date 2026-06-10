import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Stock, StockSchema } from '../stock/stock.schema';
import { SupplierModule } from '../supplier/supplier.module';
import { NfeController } from './nfe.controller';
import { NfeService } from './nfe.service';
import { NfeImport, NfeImportSchema } from './nfe-import.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NfeImport.name, schema: NfeImportSchema },
      { name: Stock.name, schema: StockSchema },
    ]),
    HttpModule.register({ timeout: 10000 }),
    SupplierModule,
  ],
  controllers: [NfeController],
  providers: [NfeService],
})
export class NfeModule {}
