import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthModule } from '@app/common';
import { StockModule } from '../stock/stock.module';
import { Stock, StockSchema } from '../stock/stock.schema';
import { InternalStockController } from './internal.controller';

@Module({
  imports: [
    ConfigModule,
    JwtAuthModule,
    StockModule,
    MongooseModule.forFeature([{ name: Stock.name, schema: StockSchema }]),
  ],
  controllers: [InternalStockController],
})
export class InternalModule {}
