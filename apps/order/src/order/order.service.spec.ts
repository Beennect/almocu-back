import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { getModelToken } from '@nestjs/mongoose';
import { Order } from './order.schema';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

describe('OrderService', () => {
  let service: OrderService;

  const mockOrderModel = {
    new: jest.fn().mockImplementation((dto) => dto),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    save: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://mock-menu-service'),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByUser', () => {
    it('should return orders for a user', async () => {
      const result = [{ totalValue: 100, status: 'pending' }];
      mockOrderModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(result),
          }),
        }),
      });

      expect(await service.findAllByUser('507f1f77bcf86cd799439011')).toBe(result);
    });
  });
});
