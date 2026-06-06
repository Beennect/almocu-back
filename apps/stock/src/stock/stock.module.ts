import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '@app/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Stock, StockSchema } from './stock.schema';
import { SupplierModule } from '../supplier/supplier.module';
import * as http from 'http';
import * as https from 'https';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Stock.name, schema: StockSchema }]),
    HttpModule.register({
      timeout: 10000,
      httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
      httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
    }),
    SupplierModule,
    AuditModule,
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
