import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillSplitService } from './bill-split.service';
import { BillSplitController } from './bill-split.controller';
import { BillSplit, BillSplitSchema } from './bill-split.schema';
import { Order, OrderSchema } from '../order/order.schema';
import { StripeModule } from '../stripe/stripe.module';
import { JwtAuthModule } from '@app/common';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BillSplit.name, schema: BillSplitSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    StripeModule,
    JwtAuthModule,
  ],
  controllers: [BillSplitController],
  providers: [BillSplitService],
  exports: [BillSplitService],
})
export class BillSplitModule {}
