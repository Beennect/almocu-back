import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisClient: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {
    const redisUri = this.configService.get<string>(
      'REDIS_URI',
      'redis://localhost:6379',
    );
    this.redisClient = new Redis(redisUri, {
      enableOfflineQueue: false, // Comandos falham imediatamente se sem conexão
      lazyConnect: true, // Só conecta quando o primeiro comando for executado
      maxRetriesPerRequest: null, // Não retry automático de comandos
      connectTimeout: 5000, // Timeout de conexão de 5s
      retryStrategy: () => null, // Não tenta reconectar automaticamente
    });
    this.redisClient.on('error', (err) => {
      this.logger.error('Redis connection error', err.message);
    });
  }

  async onModuleDestroy() {
    try {
      // Verifica se o cliente ainda está conectado antes de tentar quit
      if (this.redisClient.status === 'ready') {
        await this.redisClient.quit();
      } else {
        this.redisClient.disconnect();
      }
    } catch (error) {
      // Durante o encerramento do app, o stream pode já estar fechado.
      // Isso é comum em testes onde o lifecycle é mais agressivo.
      this.logger.warn('Redis quit during shutdown', (error as Error).message);
    }
  }

  async isBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await this.redisClient.get(`blacklist:${token}`);
      return result === 'true';
    } catch {
      // If Redis is down, allow the request (fail open) but log it
      this.logger.warn('Redis unavailable during blacklist check');
      return false;
    }
  }

  /** Obtém o valor de uma chave no Redis */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.error(
        `Redis GET error for key ${key}`,
        (error as Error).message,
      );
      return null;
    }
  }

  /** Define o valor de uma chave no Redis */
  async set(key: string, value: string, ...args: any[]): Promise<'OK' | null> {
    try {
      return await this.redisClient.set(key, value, ...args);
    } catch (error) {
      this.logger.error(
        `Redis SET error for key ${key}`,
        (error as Error).message,
      );
      return null;
    }
  }

  /** Incrementa o valor de uma chave no Redis */
  async incr(key: string): Promise<number> {
    try {
      return await this.redisClient.incr(key);
    } catch (error) {
      this.logger.error(
        `Redis INCR error for key ${key}`,
        (error as Error).message,
      );
      return 0;
    }
  }
}
