import { describe, it, expect, beforeEach, mock } from 'bun:test';

import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product/product.service';
import { getModelToken } from '@nestjs/mongoose';
import { Product } from './product/product.schema';
import { Pageable, RedisService } from '@app/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('ProductService', () => {
  let service: ProductService;

  const mockRedisService = {
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve('OK')),
    incr: mock(() => Promise.resolve(1)),
  };

  const mockProductModel = {
    new: mock((dto) => dto),
    constructor: mock((dto) => dto),
    find: mock(() => ({
      skip: mock(() => ({
        limit: mock(() => ({
          lean: mock(() => ({
            exec: mock(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    findOne: mock(() => ({
      lean: mock(() => ({
        exec: mock(() => Promise.resolve(null)),
      })),
    })),
    create: mock(() => Promise.resolve({ _id: 'mock-id' })),
    findOneAndUpdate: mock(() => ({
      lean: mock(() => ({
        exec: mock(() => Promise.resolve(null)),
      })),
    })),
    findOneAndDelete: mock(() => ({
      lean: mock(() => ({
        exec: mock(() => Promise.resolve(null)),
      })),
    })),
    exec: mock(() => Promise.resolve(null)),
    countDocuments: mock(() => ({
      exec: mock(() => Promise.resolve(0)),
    })),
    save: mock(() => Promise.resolve({ _id: 'mock-id' })),
  };

  const mockConfigService = {
    get: mock((_key: string, defaultValue?: string) => defaultValue || 'mock'),
    getOrThrow: mock((_key: string) => 'mock'),
  };

  const mockHttpService = {
    get: mock(() => of({ data: {} })),
    post: mock(() => of({ data: {} })),
    patch: mock(() => of({ data: {} })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getModelToken(Product.name),
          useValue: mockProductModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);

    mockRedisService.get.mockClear();
    mockRedisService.set.mockClear();
    mockRedisService.incr.mockClear();

    mockProductModel.find.mockClear();
    mockProductModel.findOne.mockClear();
    mockProductModel.create.mockClear();
    mockProductModel.findOneAndUpdate.mockClear();
    mockProductModel.findOneAndDelete.mockClear();
    mockProductModel.countDocuments.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const items = [{ name: 'Test Product', price: 10 }];
      mockProductModel.find.mockImplementation(() => ({
        skip: mock(() => ({
          limit: mock(() => ({
            lean: mock(() => ({
              exec: mock(() => Promise.resolve(items)),
            })),
          })),
        })),
      }));
      mockProductModel.countDocuments.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(1)),
      }));

      const pageable: Pageable = { page: 1, limit: 10, skip: 0 };
      const result = await service.findAll('rest123', pageable);
      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });
  });
});
