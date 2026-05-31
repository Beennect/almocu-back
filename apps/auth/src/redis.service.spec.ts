import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock ioredis
const mockRedis = {
  set: mock(() => Promise.resolve('OK')),
  get: mock(() => Promise.resolve(null)),
  del: mock(() => Promise.resolve(1)),
  quit: mock(() => Promise.resolve('OK')),
};

mock.module('ioredis', () => {
  return {
    default: mock().mockImplementation(() => mockRedis),
  };
});

// Imports do NestJS e de teste após o mock do módulo
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: mock(() => 'redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);

    mockRedis.set.mockClear();
    mockRedis.get.mockClear();
    mockRedis.del.mockClear();
    mockRedis.quit.mockClear();
  });

  describe('set', () => {
    it('deve salvar valor sem TTL', async () => {
      mockRedis.set.mockImplementation(() => Promise.resolve('OK'));

      await service.set('key1', 'value1');

      expect(mockRedis.set).toHaveBeenCalledWith('key1', 'value1');
    });

    it('deve salvar valor com TTL', async () => {
      mockRedis.set.mockImplementation(() => Promise.resolve('OK'));

      await service.set('key1', 'value1', 60);

      expect(mockRedis.set).toHaveBeenCalledWith('key1', 'value1', 'EX', 60);
    });
  });

  describe('get', () => {
    it('deve retornar o valor quando a chave existe', async () => {
      mockRedis.get.mockImplementation(() => Promise.resolve('value1'));

      const result = await service.get('key1');

      expect(result).toBe('value1');
      expect(mockRedis.get).toHaveBeenCalledWith('key1');
    });

    it('deve retornar null quando a chave não existe', async () => {
      mockRedis.get.mockImplementation(() => Promise.resolve(null));

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('deve deletar a chave', async () => {
      mockRedis.del.mockImplementation(() => Promise.resolve(1));

      await service.del('key1');

      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });
  });

  describe('addToBlacklist', () => {
    it('deve adicionar token na blacklist com prefixo e TTL', async () => {
      mockRedis.set.mockImplementation(() => Promise.resolve('OK'));

      await service.addToBlacklist('my-jwt-token', 3600);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:my-jwt-token',
        'true',
        'EX',
        3600,
      );
    });
  });

  describe('isBlacklisted', () => {
    it('deve retornar true quando token está na blacklist', async () => {
      mockRedis.get.mockImplementation(() => Promise.resolve('true'));

      const result = await service.isBlacklisted('blacklisted-token');

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('blacklist:blacklisted-token');
    });

    it('deve retornar false quando token não está na blacklist', async () => {
      mockRedis.get.mockImplementation(() => Promise.resolve(null));

      const result = await service.isBlacklisted('valid-token');

      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('deve fechar a conexão com Redis', async () => {
      mockRedis.quit.mockImplementation(() => Promise.resolve('OK'));

      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
