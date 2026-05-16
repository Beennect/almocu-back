import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisClient: Redis;

  constructor(private configService: ConfigService) {
    const redisUri = this.configService.get<string>(
      'REDIS_URI',
      'redis://localhost:6379',
    );
    this.redisClient = new Redis(redisUri);
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redisClient.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async addToBlacklist(token: string, expSeconds: number): Promise<void> {
    // expSeconds is the remaining time the token is valid
    await this.set(`blacklist:${token}`, 'true', expSeconds);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.get(`blacklist:${token}`);
    return result === 'true';
  }
}
