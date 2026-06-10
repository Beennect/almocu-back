import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { JwtAuthModule } from '@app/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order, OrderSchema } from './order.schema';
import { TableModule } from '../table/table.module';
import { BillSplitModule } from '../bill-split/bill-split.module';
import * as http from 'http';
import * as https from 'https';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    HttpModule.register({
      timeout: 10000,
      httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
      httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
    }),
    JwtAuthModule,
    TableModule,
    BillSplitModule,
  ],

  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
