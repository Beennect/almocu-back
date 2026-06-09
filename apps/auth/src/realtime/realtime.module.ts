import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { WsGateway } from './ws.gateway';
import { RedisSubscriberService } from './redis-subscriber.service';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [WsGateway, RedisSubscriberService],
  exports: [WsGateway, RedisSubscriberService],
})
export class RealtimeModule {}
