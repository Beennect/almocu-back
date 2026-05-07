import {
  Injectable, NotFoundException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Stock, StockDocument } from './stock.schema';
import { CreateStockDto, UpdateStockDto } from './dto/stock.dto';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
  ) { }

  async create(createStockDto: CreateStockDto, userId: string, restaurantId: string): Promise<Stock> {
    const name = createStockDto.name.trim();
    const brand = createStockDto.brand?.trim() || '';

    const existing = await this.stockModel.findOne({ name, brand, restaurantId }).exec();
    if (existing) {
      throw new ConflictException(`O item "${name}" já existe nesta filial.`);
    }

    const created = new this.stockModel({
      ...createStockDto,
      name,
      brand,
      userId,
      restaurantId,
    });

    return created.save();
  }

  async findAll(restaurantId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.stockModel.find({ restaurantId }).skip(skip).limit(limit).exec(),
      this.stockModel.countDocuments({ restaurantId }).exec(),
    ]);

    return {
      items,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    };
  }

  async findOne(id: string, restaurantId: string): Promise<Stock> {
    const item = await this.stockModel.findOne({ _id: id, restaurantId }).exec();
    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado nesta filial.');
    }
    return item;
  }

  async update(id: string, updateStockDto: UpdateStockDto, restaurantId: string): Promise<Stock> {
    const updated = await this.stockModel.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: updateStockDto },
      { new: true, runValidators: true },
    ).exec();

    if (!updated) {
      throw new NotFoundException('Item de estoque não encontrado para atualização.');
    }

    return updated;
  }

  async adjustQuantity(id: string, delta: number, restaurantId: string): Promise<Stock> {
    if (delta === 0) {
      throw new BadRequestException('Delta não pode ser zero.');
    }

    // Para saídas (delta negativo), a query só encontra o item se houver quantidade suficiente
    // evitando race condition entre requests simultâneos
    const filter = delta < 0
      ? { _id: id, restaurantId, quantity: { $gte: -delta } }
      : { _id: id, restaurantId };

    const updated = await this.stockModel.findOneAndUpdate(
      filter,
      { $inc: { quantity: delta } },
      { new: true, runValidators: true },
    ).exec();

    if (!updated) {
      const exists = await this.stockModel.exists({ _id: id, restaurantId });
      if (!exists) throw new NotFoundException('Item de estoque não encontrado.');
      throw new BadRequestException('A quantidade resultante não pode ser negativa.');
    }

    return updated;
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const result = await this.stockModel.deleteOne({ _id: id, restaurantId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Item de estoque não encontrado para remoção.');
    }
  }
}