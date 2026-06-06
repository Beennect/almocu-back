import { Module } from '@nestjs/common';
import { JwtAuthModule } from '@app/common';
import { ProductModule } from '../product/product.module';
import { InternalProductController } from './internal.controller';

@Module({
  imports: [JwtAuthModule, ProductModule],
  controllers: [InternalProductController],
})
export class InternalModule {}
