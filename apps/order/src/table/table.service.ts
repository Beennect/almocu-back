import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Table } from './table.schema';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { Pageable, Page } from '@app/common';

@Injectable()
export class TableService {
  constructor(
    @InjectModel(Table.name) private tableModel: Model<Table>,
  ) {}

  async create(
    restaurantId: string,
    createTableDto: CreateTableDto,
  ): Promise<Table> {
    // Verificar duplicidade de número da mesa no restaurante
    const existing = await this.tableModel
      .findOne({
        restaurantId,
        number: createTableDto.number,
      })
      .exec();

    if (existing) {
      throw new ConflictException(
        `Já existe uma mesa com o número "${createTableDto.number}" neste restaurante`,
      );
    }

    const table = new this.tableModel({
      restaurantId,
      number: createTableDto.number,
      capacity: createTableDto.capacity,
    });

    return table.save();
  }

  async findAll(
    restaurantId: string,
    pageable: Pageable,
  ): Promise<Page<Table>> {
    const filter = { restaurantId, isActive: true };

    const [items, total] = await Promise.all([
      this.tableModel
        .find(filter)
        .sort({ number: 1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.tableModel.countDocuments(filter).exec(),
    ]);

    return new Page(items as unknown as Table[], total, pageable);
  }

  async findAllActive(restaurantId: string): Promise<Table[]> {
    const tables = await this.tableModel
      .find({ restaurantId, isActive: true })
      .sort({ number: 1 })
      .lean()
      .exec();
    return tables as unknown as Table[];
  }

  async findOne(id: string, restaurantId: string): Promise<Table> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID da mesa inválido');
    }

    const table = await this.tableModel
      .findOne({ _id: id, restaurantId })
      .exec();

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    return table;
  }

  async update(
    id: string,
    restaurantId: string,
    updateTableDto: UpdateTableDto,
  ): Promise<Table> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID da mesa inválido');
    }

    const table = await this.tableModel
      .findOne({ _id: id, restaurantId })
      .exec();

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    // Se estiver alterando o número, verificar duplicidade
    if (updateTableDto.number && updateTableDto.number !== table.number) {
      const existing = await this.tableModel
        .findOne({
          restaurantId,
          number: updateTableDto.number,
          _id: { $ne: id },
        })
        .exec();

      if (existing) {
        throw new ConflictException(
          `Já existe uma mesa com o número "${updateTableDto.number}" neste restaurante`,
        );
      }
    }

    const update: Record<string, any> = {};
    if (updateTableDto.number !== undefined) update.number = updateTableDto.number;
    if (updateTableDto.capacity !== undefined) update.capacity = updateTableDto.capacity;
    if (updateTableDto.isActive !== undefined) update.isActive = updateTableDto.isActive;

    const updated = await this.tableModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: update },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Mesa não encontrada');
    }

    return updated;
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID da mesa inválido');
    }

    const result = await this.tableModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: { isActive: false } },
      )
      .exec();

    if (!result) {
      throw new NotFoundException('Mesa não encontrada');
    }
  }
}
