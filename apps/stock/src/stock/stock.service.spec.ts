import { Test, TestingModule } from '@nestjs/testing';
import { StockService } from './stock.service';
import { getModelToken } from '@nestjs/mongoose';
import { Stock } from './stock.schema';

describe('StockService', () => {
  let service: StockService;

  const mockStockModel = {
    find: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exec: jest.fn(),
    countDocuments: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: getModelToken(Stock.name),
          useValue: mockStockModel,
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all stock items for a restaurant', async () => {
      const result = [{ product: 'Apple', quantity: 10 }];
      mockStockModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(result),
          }),
        }),
      });

      const response = await service.findAll('507f1f77bcf86cd799439011');
      expect(response.items).toBe(result);
    });
  });
});
