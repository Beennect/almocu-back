import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getModelToken } from '@nestjs/mongoose';
import { Product } from '@app/common';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    on: jest.fn(),
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn(),
  }),
}));

describe('ProductService', () => {
  let service: ProductService;

  const mockProductModel = {
    new: jest.fn().mockImplementation((dto) => dto),
    constructor: jest.fn().mockImplementation((dto) => dto),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exec: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getModelToken(Product.name),
          useValue: mockProductModel,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const items = [{ name: 'Test Product', price: 10 }];
      mockProductModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(items),
          }),
        }),
      });
      mockProductModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll('rest123');
      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
    });
  });
});
