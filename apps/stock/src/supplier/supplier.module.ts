import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthModule } from '@app/common';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { Supplier, SupplierSchema } from './supplier.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
    ]),
    HttpModule.register({ timeout: 10000 }),
    JwtAuthModule,
  ],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
