import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Stock, StockDocument } from './stock.schema';
import { CreateStockDto, UpdateStockDto } from './dto/stock.dto';

@Injectable()
export class StockService {
  constructor(@InjectModel(Stock.name) private stockModel: Model<StockDocument>) {}

  async create(createStockDto: CreateStockDto, userId: string, restaurantId: string): Promise<Stock> {
    const { name, brand } = createStockDto;
    
    const existing = await this.stockModel.findOne({
      name: name.trim(),
      brand: brand || '',
      restaurantId,
    });

    if (existing) {
      throw new ConflictException(`O item "${name}" já existe nesta filial.`);
    }

    const createdStock = new this.stockModel({
      ...createStockDto,
      name: name.trim(),
      brand: brand || '',
      userId,
      restaurantId,
    });

    return createdStock.save();
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
    const item = await this.stockModel.findOne({ _id: id, restaurantId }).exec();
    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado para ajuste.');
    }

    const newQuantity = item.quantity + delta;
    if (newQuantity < 0) {
      throw new BadRequestException('A quantidade resultante não pode ser negativa.');
    }

    item.quantity = newQuantity;
    return item.save();
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const result = await this.stockModel.deleteOne({ _id: id, restaurantId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Item de estoque não encontrado para remoção.');
    }
  }
}
