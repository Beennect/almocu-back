import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Supplier, SupplierDocument } from './supplier.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Pageable, Page } from '@app/common';

@Injectable()
export class SupplierService {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
  ) {}

  async create(
    createSupplierDto: CreateSupplierDto,
    userId: string,
    restaurantId: string,
  ): Promise<Supplier> {
    const name = createSupplierDto.name.trim();

    const existing = await this.supplierModel
      .findOne({ name, restaurantId })
      .exec();
    if (existing) {
      throw new ConflictException(
        `Já existe um fornecedor com o nome "${name}" neste restaurante.`,
      );
    }

    const created = new this.supplierModel({
      ...createSupplierDto,
      name,
      userId,
      restaurantId,
    });

    return created.save();
  }

  async findAll(
    restaurantId: string,
    pageable: Pageable,
  ): Promise<Page<Supplier>> {
    const [items, total] = await Promise.all([
      this.supplierModel
        .find({ restaurantId })
        .sort({ name: 1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.supplierModel.countDocuments({ restaurantId }).exec(),
    ]);

    return new Page(items as unknown as Supplier[], total, pageable);
  }

  async findOne(id: string, restaurantId: string): Promise<Supplier> {
    const supplier = await this.supplierModel
      .findOne({ _id: id, restaurantId })
      .lean()
      .exec();

    if (!supplier) {
      throw new NotFoundException(
        'Fornecedor não encontrado neste restaurante.',
      );
    }

    return supplier as unknown as Supplier;
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
    restaurantId: string,
  ): Promise<Supplier> {
    const updateData: Record<string, unknown> = { ...updateSupplierDto };

    // Se for alterar o nome, verifica duplicidade
    if (updateData.name) {
      updateData.name = (updateData.name as string).trim();

      const duplicate = await this.supplierModel
        .findOne({
          name: updateData.name,
          restaurantId,
          _id: { $ne: id },
        })
        .exec();

      if (duplicate) {
        throw new ConflictException(
          `Já existe outro fornecedor com o nome "${updateData.name}" neste restaurante.`,
        );
      }
    }

    const updated = await this.supplierModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(
        'Fornecedor não encontrado para atualização.',
      );
    }

    return updated;
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const result = await this.supplierModel
      .deleteOne({ _id: id, restaurantId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Fornecedor não encontrado para remoção.');
    }
  }
}
