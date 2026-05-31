import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Stock, StockDocument } from './stock.schema';
import { CreateStockDto, UpdateStockDto } from './dto/stock.dto';
import { Pageable, Page } from '@app/common';
import { SupplierService } from '../supplier/supplier.service';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    private readonly supplierService: SupplierService,
  ) {}

  async create(
    createStockDto: CreateStockDto,
    userId: string,
    restaurantId: string,
  ): Promise<Stock> {
    const name = createStockDto.name.trim();
    const brand = createStockDto.brand?.trim() || '';

    await this.validateSupplier(createStockDto.supplierId, restaurantId);

    const sanitizedSupplierId = createStockDto.supplierId || undefined;

    try {
      const created = new this.stockModel({
        ...createStockDto,
        supplierId: sanitizedSupplierId,
        name,
        brand,
        userId,
        restaurantId,
      });
      return await created.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(`O item "${name}" já existe nesta filial.`);
      }
      throw error;
    }
  }

  async findAll(
    restaurantId: string,
    pageable: Pageable,
  ): Promise<Page<Stock>> {
    const [items, total] = await Promise.all([
      this.stockModel
        .find({ restaurantId })
        .sort({ name: 1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.stockModel.countDocuments({ restaurantId }).exec(),
    ]);

    return new Page(items, total, pageable);
  }

  async findOne(id: string, restaurantId: string): Promise<Stock> {
    this.validateObjectId(id);

    const item = await this.stockModel
      .findOne({ _id: id, restaurantId })
      .lean()
      .exec();
    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }
    return item;
  }

  async update(
    id: string,
    updateStockDto: UpdateStockDto,
    restaurantId: string,
  ): Promise<Stock> {
    this.validateObjectId(id);
    await this.validateSupplier(updateStockDto.supplierId, restaurantId);

    const updateData: Record<string, unknown> = {};
    if (updateStockDto.name !== undefined) {
      updateData.name = updateStockDto.name.trim();
    }
    if (updateStockDto.brand !== undefined) {
      updateData.brand = updateStockDto.brand.trim() || '';
    }
    if (updateStockDto.unit !== undefined) {
      updateData.unit = updateStockDto.unit;
    }
    if (updateStockDto.quantity !== undefined) {
      updateData.quantity = updateStockDto.quantity;
    }
    if (updateStockDto.minQuantity !== undefined) {
      updateData.minQuantity = updateStockDto.minQuantity;
    }
    if (updateStockDto.supplierId) {
      updateData.supplierId = updateStockDto.supplierId;
    } else if (updateStockDto.supplierId === null) {
      updateData.supplierId = null;
    }

    const updated = await this.stockModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    return updated;
  }

  async adjustQuantity(
    id: string,
    delta: number,
    restaurantId: string,
  ): Promise<Stock> {
    if (delta === 0) {
      throw new BadRequestException('Delta cannot be zero.');
    }
    this.validateObjectId(id);

    const filter =
      delta < 0
        ? { _id: id, restaurantId, quantity: { $gte: -delta } }
        : { _id: id, restaurantId };

    const updated = await this.stockModel
      .findOneAndUpdate(
        filter,
        { $inc: { quantity: delta } },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    return updated;
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    this.validateObjectId(id);
    const result = await this.stockModel
      .deleteOne({ _id: id, restaurantId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }
  }

  private validateObjectId(id: string, fieldName = 'ID'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        `O ${fieldName} informado não é um ID válido.`,
      );
    }
  }

  private async validateSupplier(
    supplierId: string | undefined,
    restaurantId: string,
  ): Promise<void> {
    if (!supplierId) return;

    try {
      await this.supplierService.findOne(supplierId, restaurantId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          'O fornecedor informado não existe neste restaurante.',
        );
      }
      throw error;
    }
  }
}
