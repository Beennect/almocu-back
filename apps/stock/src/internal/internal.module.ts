import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StockModule } from '../stock/stock.module';
import { InternalStockController } from './internal.controller';

@Module({
  imports: [ConfigModule, StockModule],
  controllers: [InternalStockController],
})
export class InternalModule {}
