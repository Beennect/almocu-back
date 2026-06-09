import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

const mockRedisInstance = {
  subscribe: mock(() => Promise.resolve('OK')),
  unsubscribe: mock(() => Promise.resolve('OK')),
  quit: mock(() => Promise.resolve('OK')),
  on: mock(() => {}),
};

mock.module('ioredis', () => ({
  default: mock().mockImplementation(() => mockRedisInstance),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisSubscriberService } from './redis-subscriber.service';

describe('RedisSubscriberService', () => {
  let service: RedisSubscriberService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisSubscriberService,
        {
          provide: ConfigService,
          useValue: {
            get: mock(() => 'redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<RedisSubscriberService>(RedisSubscriberService);

    mockRedisInstance.subscribe.mockClear();
    mockRedisInstance.unsubscribe.mockClear();
    mockRedisInstance.quit.mockClear();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should subscribe to a channel and invoke handler on message', async () => {
    let handledMessage: string | null = null;
    const handler = (msg: string) => { handledMessage = msg; };

    await service.subscribe('test:channel', handler);

    expect(mockRedisInstance.subscribe).toHaveBeenCalledWith('test:channel');

    // Simula mensagem recebida do Redis
    const messageCallback = mockRedisInstance.on.mock.calls.find(
      (call: any) => call[0] === 'message',
    )?.[1];
    expect(messageCallback).toBeDefined();

    if (messageCallback) {
      messageCallback('test:channel', '{"type":"test","payload":"ok"}');
      expect(handledMessage).toBe('{"type":"test","payload":"ok"}');
    }
  });

  it('should unsubscribe from a channel', async () => {
    const handler = mock(() => {});
    await service.subscribe('test:unsub', handler);
    await service.unsubscribe('test:unsub');

    expect(mockRedisInstance.unsubscribe).toHaveBeenCalledWith('test:unsub');
  });

  it('should handle handler errors gracefully', async () => {
    const handler = mock(() => { throw new Error('handler error'); });

    await service.subscribe('test:error', handler);

    // Não deve lançar exceção, apenas logar
    const messageCallback = mockRedisInstance.on.mock.calls.find(
      (call: any) => call[0] === 'message',
    )?.[1];

    if (messageCallback) {
      messageCallback('test:error', '{}');
    }

    expect(handler).toHaveBeenCalled();
  });
});
