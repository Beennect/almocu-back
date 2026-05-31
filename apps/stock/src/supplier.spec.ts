import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SupplierService } from './supplier/supplier.service';
import { getModelToken } from '@nestjs/mongoose';
import { Supplier } from './supplier/supplier.schema';
import { Pageable } from '@app/common';

describe('SupplierService', () => {
  let service: SupplierService;

  const mockSupplierModel = mock(() => ({
    save: mock(() =>
      Promise.resolve({ _id: 'new-id', name: 'Distribuidora' }),
    ),
  })) as any;

  mockSupplierModel.find = mock(() => ({
    sort: mock(() => ({
      skip: mock(() => ({
        limit: mock(() => ({
          lean: mock(() => ({
            exec: mock(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  }));
  mockSupplierModel.findOne = mock(() => ({
    exec: mock(() => Promise.resolve(null)),
  }));
  mockSupplierModel.findOneAndUpdate = mock(() => ({
    exec: mock(() => Promise.resolve(null)),
  }));
  mockSupplierModel.deleteOne = mock(() => ({
    exec: mock(() => Promise.resolve({ deletedCount: 0 })),
  }));
  mockSupplierModel.countDocuments = mock(() => ({
    exec: mock(() => Promise.resolve(0)),
  }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        {
          provide: getModelToken(Supplier.name),
          useValue: mockSupplierModel,
        },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);

    (mockSupplierModel as any).mockClear();
    mockSupplierModel.find.mockClear();
    mockSupplierModel.findOne.mockClear();
    mockSupplierModel.findOneAndUpdate.mockClear();
    mockSupplierModel.deleteOne.mockClear();
    mockSupplierModel.countDocuments.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      name: 'Distribuidora',
      contactName: 'João',
      phone: '(11) 99999-8888',
      email: 'joao@distribuidora.com',
    };
    const userId = 'user-id-123';
    const restaurantId = 'restaurant-id-456';

    it('should create a supplier successfully', async () => {
      mockSupplierModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      (mockSupplierModel as any).mockImplementation(() => ({
        save: mock(() =>
          Promise.resolve({
            _id: 'new-id',
            name: dto.name,
            userId,
            restaurantId,
          }),
        ),
      }));

      const result = await service.create(dto, userId, restaurantId);

      expect(result).toBeDefined();
      expect(result._id).toBe('new-id');
      expect(mockSupplierModel.findOne).toHaveBeenCalledWith({
        name: dto.name,
        restaurantId,
      });
    });

    it('should throw ConflictException when name already exists in the same restaurant', async () => {
      mockSupplierModel.findOne.mockImplementation(() => ({
        exec: mock(() =>
          Promise.resolve({ _id: 'existing-id', name: dto.name }),
        ),
      }));

      await expect(
        service.create(dto, userId, restaurantId),
      ).rejects.toThrow(ConflictException);
    });

    it('should trim the name before saving', async () => {
      const dtoWithSpaces = { ...dto, name: '  Distribuidora  ' };
      mockSupplierModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      (mockSupplierModel as any).mockImplementation(() => ({
        save: mock(() =>
          Promise.resolve({
            _id: 'new-id',
            name: 'Distribuidora',
          }),
        ),
      }));

      await service.create(dtoWithSpaces, userId, restaurantId);

      expect(mockSupplierModel.findOne).toHaveBeenCalledWith({
        name: 'Distribuidora',
        restaurantId,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated suppliers', async () => {
      const suppliers = [
        { _id: '1', name: 'Fornecedor A' },
        { _id: '2', name: 'Fornecedor B' },
      ];
      mockSupplierModel.find.mockImplementation(() => ({
        sort: mock(() => ({
          skip: mock(() => ({
            limit: mock(() => ({
              lean: mock(() => ({
                exec: mock(() => Promise.resolve(suppliers)),
              })),
            })),
          })),
        })),
      }));
      mockSupplierModel.countDocuments.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(2)),
      }));

      const pageable: Pageable = { page: 1, limit: 10, skip: 0 };
      const result = await service.findAll('restaurant-id', pageable);

      expect(result.items).toBe(suppliers);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a supplier when found', async () => {
      const supplier = { _id: 'supplier-id', name: 'Distribuidora' };
      mockSupplierModel.findOne.mockImplementation(() => ({
        lean: mock(() => ({
          exec: mock(() => Promise.resolve(supplier)),
        })),
      }));

      const result = await service.findOne('supplier-id', 'restaurant-id');

      expect(result).toBe(supplier);
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockSupplierModel.findOne.mockImplementation(() => ({
        lean: mock(() => ({
          exec: mock(() => Promise.resolve(null)),
        })),
      }));

      await expect(
        service.findOne('invalid-id', 'restaurant-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto = { name: 'Novo Nome' };
    const restaurantId = 'restaurant-id';

    it('should update a supplier successfully', async () => {
      mockSupplierModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockSupplierModel.findOneAndUpdate.mockImplementation(() => ({
        exec: mock(() =>
          Promise.resolve({
            _id: 'supplier-id',
            name: 'Novo Nome',
            restaurantId,
          }),
        ),
      }));

      const result = await service.update('supplier-id', dto, restaurantId);

      expect(result).toBeDefined();
      expect(result.name).toBe('Novo Nome');
    });

    it('should throw ConflictException when new name already exists (different supplier)', async () => {
      mockSupplierModel.findOne.mockImplementation(() => ({
        exec: mock(() =>
          Promise.resolve({ _id: 'other-id', name: 'Novo Nome' }),
        ),
      }));

      await expect(
        service.update('supplier-id', dto, restaurantId),
      ).rejects.toThrow(ConflictException);
    });

    it('should NOT throw ConflictException when the duplicate is itself', async () => {
      // findOne returns the SAME supplier (no rename conflict)
      mockSupplierModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockSupplierModel.findOneAndUpdate.mockImplementation(() => ({
        exec: mock(() =>
          Promise.resolve({ _id: 'supplier-id', name: 'Novo Nome' }),
        ),
      }));

      const result = await service.update('supplier-id', dto, restaurantId);

      expect(result.name).toBe('Novo Nome');
    });

    it('should throw NotFoundException when supplier to update does not exist', async () => {
      mockSupplierModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockSupplierModel.findOneAndUpdate.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));

      await expect(
        service.update('invalid-id', dto, restaurantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a supplier successfully', async () => {
      mockSupplierModel.deleteOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve({ deletedCount: 1 })),
      }));

      await service.remove('supplier-id', 'restaurant-id');

      expect(mockSupplierModel.deleteOne).toHaveBeenCalledWith({
        _id: 'supplier-id',
        restaurantId: 'restaurant-id',
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockSupplierModel.deleteOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve({ deletedCount: 0 })),
      }));

      await expect(
        service.remove('invalid-id', 'restaurant-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
