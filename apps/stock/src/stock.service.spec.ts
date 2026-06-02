import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { StockService } from './stock/stock.service';
import { SupplierService } from './supplier/supplier.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Stock } from './stock/stock.schema';
import { Pageable } from '@app/common';

describe('StockService', () => {
  let service: StockService;

  const mockStockModel = {
    find: mock(() => ({
      sort: mock(() => ({
        skip: mock(() => ({
          limit: mock(() => ({
            lean: mock(() => ({
              exec: mock(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    })),
    findOne: mock(() => ({
      lean: mock(() => ({
        exec: mock(() => Promise.resolve(null)),
      })),
    })),
    create: mock(() => {}),
    findOneAndUpdate: mock(() => {}),
    exec: mock(() => {}),
    countDocuments: mock(() => ({
      exec: mock(() => Promise.resolve(0)),
    })),
  };

  const mockSupplierService = {
    findOne: mock(() => Promise.resolve({ _id: 'supplier-id', name: 'Distribuidora' })),
  };

  const mockHttpService = {
    axiosRef: {
      delete: mock(() => Promise.resolve({ data: { message: 'ok' } })),
      post: mock(() => Promise.resolve({ data: {} })),
      get: mock(() => Promise.resolve({ data: {} })),
      patch: mock(() => Promise.resolve({ data: {} })),
    },
  };

  const mockConfigService = {
    get: mock(() => 'test-internal-key'),
    getOrThrow: mock(() => 'test-internal-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: getModelToken(Stock.name),
          useValue: mockStockModel,
        },
        {
          provide: SupplierService,
          useValue: mockSupplierService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);

    mockStockModel.find.mockClear();
    mockStockModel.findOne.mockClear();
    mockStockModel.create.mockClear();
    mockStockModel.findOneAndUpdate.mockClear();
    mockStockModel.countDocuments.mockClear();
    mockSupplierService.findOne.mockClear();
    mockHttpService.axiosRef.delete.mockClear();
    mockHttpService.axiosRef.post.mockClear();
    mockHttpService.axiosRef.get.mockClear();
    mockHttpService.axiosRef.patch.mockClear();
    mockConfigService.get.mockClear();
    mockConfigService.getOrThrow.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all stock items for a restaurant', async () => {
      const result = [{ product: 'Apple', quantity: 10 }];
      mockStockModel.find.mockImplementation(() => ({
        sort: mock(() => ({
          skip: mock(() => ({
            limit: mock(() => ({
              lean: mock(() => ({
                exec: mock(() => Promise.resolve(result)),
              })),
            })),
          })),
        })),
      }));

      mockStockModel.countDocuments.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(1)),
      }));

      const pageable: Pageable = { page: 1, limit: 10, skip: 0 };
      const response = await service.findAll(
        '507f1f77bcf86cd799439011',
        pageable,
      );
      expect(response.items).toBe(result);
      expect(response.total).toBe(1);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(10);
      expect(response.pages).toBe(1);
    });
  });
});
