import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order/order.service';
import { getModelToken } from '@nestjs/mongoose';
import { Order } from './order/order.schema';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Pageable } from '@app/common';

describe('OrderService', () => {
  let service: OrderService;

  const mockOrderModel = {
    new: mock((dto) => dto),
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
    findOneAndUpdate: mock(() => ({
      lean: mock(() => ({
        exec: mock(() => Promise.resolve(null)),
      })),
    })),
    deleteOne: mock(() => Promise.resolve({ deletedCount: 0 })),
    save: mock(() => Promise.resolve({ _id: 'mock-id' })),
    countDocuments: mock(() => ({
      exec: mock(() => Promise.resolve(0)),
    })),
  };

  const mockHttpService = {
    post: mock(() => ({ pipe: mock(() => Promise.resolve({ data: [] })) })),
    patch: mock(() => ({ pipe: mock(() => Promise.resolve({ data: {} })) })),
  };

  const mockConfigService = {
    get: mock(() => 'http://mock-menu-service'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
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

    service = module.get<OrderService>(OrderService);

    mockOrderModel.find.mockClear();
    mockOrderModel.findOne.mockClear();
    mockOrderModel.findOneAndUpdate.mockClear();
    mockOrderModel.deleteOne.mockClear();
    mockOrderModel.save.mockClear();
    mockOrderModel.countDocuments.mockClear();
    mockHttpService.post.mockClear();
    mockConfigService.get.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByUser', () => {
    it('should return paginated orders for a user', async () => {
      const items = [{ totalValue: 100, status: 'pending' }];
      mockOrderModel.find.mockImplementation(() => ({
        sort: mock(() => ({
          skip: mock(() => ({
            limit: mock(() => ({
              lean: mock(() => ({
                exec: mock(() => Promise.resolve(items)),
              })),
            })),
          })),
        })),
      }));
      mockOrderModel.countDocuments.mockReturnValue({
        exec: mock(() => Promise.resolve(1)),
      });

      const pageable: Pageable = { page: 1, limit: 10, skip: 0 };
      const result = await service.findAllByUser(
        '507f1f77bcf86cd799439011',
        pageable,
      );
      expect(result.items).toBe(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });
  });
});
