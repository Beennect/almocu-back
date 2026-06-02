import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderModule } from './order/order.module';
import { JwtAuthModule } from '@app/common';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/almocu_order',
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      }),
    }),
    JwtAuthModule,
    OrderModule,
    StripeModule,
  ],
})
export class AppModule {}
