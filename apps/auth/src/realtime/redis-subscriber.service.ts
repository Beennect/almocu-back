import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisSubscriberService implements OnModuleDestroy {
  private readonly subscriber: Redis;
  private readonly logger = new Logger(RedisSubscriberService.name);
  private channelHandlers = new Map<string, (message: string) => void>();

  constructor(private configService: ConfigService) {
    const redisUri = this.configService.get<string>(
      'REDIS_URI',
      'redis://localhost:6379',
    );
    this.subscriber = new Redis(redisUri);

    this.subscriber.on('message', (channel: string, message: string) => {
      const handler = this.channelHandlers.get(channel);
      if (handler) {
        try {
          handler(message);
        } catch (err) {
          this.logger.error(
            `Error in handler for channel ${channel}: ${(err as Error).message}`,
          );
        }
      }
    });
  }

  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    this.channelHandlers.set(channel, handler);
    await this.subscriber.subscribe(channel);
    this.logger.log(`Subscribed to Redis channel: ${channel}`);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.channelHandlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
    this.logger.log(`Unsubscribed from Redis channel: ${channel}`);
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }
}
