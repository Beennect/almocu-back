import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';

// Mock ioredis
const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    jest.clearAllMocks();
  });

  describe('set', () => {
    it('deve salvar valor sem TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key1', 'value1');

      expect(mockRedis.set).toHaveBeenCalledWith('key1', 'value1');
    });

    it('deve salvar valor com TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key1', 'value1', 60);

      expect(mockRedis.set).toHaveBeenCalledWith('key1', 'value1', 'EX', 60);
    });
  });

  describe('get', () => {
    it('deve retornar o valor quando a chave existe', async () => {
      mockRedis.get.mockResolvedValue('value1');

      const result = await service.get('key1');

      expect(result).toBe('value1');
      expect(mockRedis.get).toHaveBeenCalledWith('key1');
    });

    it('deve retornar null quando a chave não existe', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('deve deletar a chave', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('key1');

      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });
  });

  describe('addToBlacklist', () => {
    it('deve adicionar token na blacklist com prefixo e TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

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
      mockRedis.get.mockResolvedValue('true');

      const result = await service.isBlacklisted('blacklisted-token');

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('blacklist:blacklisted-token');
    });

    it('deve retornar false quando token não está na blacklist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.isBlacklisted('valid-token');

      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('deve fechar a conexão com Redis', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
