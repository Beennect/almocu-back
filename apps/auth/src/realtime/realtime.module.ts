import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WsGateway } from './ws.gateway';
import { RedisSubscriberService } from './redis-subscriber.service';

@Module({
  imports: [ConfigModule],
  providers: [WsGateway, RedisSubscriberService],
  exports: [WsGateway, RedisSubscriberService],
})
export class RealtimeModule {}
