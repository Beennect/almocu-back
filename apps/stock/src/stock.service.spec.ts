import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { StockService } from './stock/stock.service';
import { SupplierService } from './supplier/supplier.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Stock } from './stock/stock.schema';
import { Pageable } from '@app/common';
import { of, throwError } from 'rxjs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AxiosError } from 'axios';

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
    findOneAndDelete: mock(() => ({
      exec: mock(() => Promise.resolve(null)),
    })),
    create: mock(() => {}),
    findOneAndUpdate: mock(() => {}),
    exec: mock(() => {}),
    countDocuments: mock(() => ({
      exec: mock(() => Promise.resolve(0)),
    })),
  };

  const mockSupplierService = {
    findOne: mock(() =>
      Promise.resolve({ _id: 'supplier-id', name: 'Distribuidora' }),
    ),
  };

  const mockHttpService = {
    delete: mock(() => of({ data: { message: 'ok' }, status: 204 })),
    post: mock(() => of({ data: {} })),
    get: mock(() => of({ data: {} })),
    patch: mock(() => of({ data: {} })),
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
    mockStockModel.findOneAndDelete.mockClear();
    mockStockModel.create.mockClear();
    mockStockModel.findOneAndUpdate.mockClear();
    mockStockModel.countDocuments.mockClear();
    mockSupplierService.findOne.mockClear();
    mockHttpService.delete.mockClear();
    mockHttpService.post.mockClear();
    mockHttpService.get.mockClear();
    mockHttpService.patch.mockClear();
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

  describe('remove', () => {
    const validId = '507f1f77bcf86cd799439011';
    const restaurantId = '507f1f77bcf86cd799439012';
    const item = { _id: validId, name: 'Farinha', restaurantId };

    it('should delete item and call menu service on success', async () => {
      mockStockModel.findOneAndDelete.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(item)),
      }));
      mockHttpService.delete.mockImplementation(() =>
        of({ data: { message: 'ok' }, status: 204 }),
      );

      await service.remove(validId, restaurantId);

      expect(mockStockModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: validId,
        restaurantId,
      });
      expect(mockHttpService.delete).toHaveBeenCalledWith(
        expect.stringContaining(`/products/internal/ingredient/${validId}`),
        expect.objectContaining({
          headers: {
            'x-internal-key': 'test-internal-key',
            'x-tenant-id': restaurantId,
          },
        }),
      );
    });

    it('should succeed when menu service returns 404 (no product had the ingredient)', async () => {
      mockStockModel.findOneAndDelete.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(item)),
      }));
      const axiosError = new AxiosError(
        'Not Found',
        '404',
        undefined as any,
        undefined as any,
        { status: 404, data: {} } as any,
      );
      mockHttpService.delete.mockImplementation(() => throwError(() => axiosError));

      await expect(
        service.remove(validId, restaurantId),
      ).resolves.toBeUndefined();
    });

    it('should succeed when menu service is unreachable (network error, best-effort)', async () => {
      mockStockModel.findOneAndDelete.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(item)),
      }));
      const networkError = new Error('connect ECONNREFUSED');
      (networkError as any).response = undefined;
      mockHttpService.delete.mockImplementation(() => throwError(() => networkError));

      await expect(
        service.remove(validId, restaurantId),
      ).resolves.toBeUndefined();
    });

    it('should succeed when menu returns 500 (best-effort, item already deleted)', async () => {
      mockStockModel.findOneAndDelete.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(item)),
      }));
      const serverError = new AxiosError(
        'Internal Server Error',
        '500',
        undefined as any,
        undefined as any,
        { status: 500, data: {} } as any,
      );
      mockHttpService.delete.mockImplementation(() => throwError(() => serverError));

      await expect(
        service.remove(validId, restaurantId),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockStockModel.findOneAndDelete.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));

      await expect(
        service.remove(validId, restaurantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is invalid', async () => {
      await expect(
        service.remove('invalid-id', restaurantId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when restaurantId is invalid', async () => {
      await expect(
        service.remove(validId, 'invalid-restaurant-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
