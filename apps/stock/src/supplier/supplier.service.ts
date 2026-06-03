import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Supplier, SupplierDocument } from './supplier.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Pageable, Page } from '@app/common';

interface BrasilApiResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  ddd_telefone_1?: string;
  telefone_1?: string;
  email?: string;
}

export interface CnpjLookupResult {
  razao_social: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  ddd_telefone_1?: string;
  telefone_1?: string;
  email?: string;
}

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);
  private readonly brasilApiUrl: string;

  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.brasilApiUrl =
      this.configService.get<string>('BRASIL_API_URL') ||
      'https://brasilapi.com.br/api/cnpj/v1';
  }

  async create(
    createSupplierDto: CreateSupplierDto,
    restaurantId: string,
    userId: string = 'system',
  ): Promise<Supplier> {
    const name = createSupplierDto.name.trim();
    const cleanCnpj = createSupplierDto.cnpj.replace(/\D/g, '');

    // Verifica duplicidade de nome
    const existingName = await this.supplierModel
      .findOne({ name, restaurantId })
      .exec();
    if (existingName) {
      throw new ConflictException(
        `Já existe um fornecedor com o nome "${name}" neste restaurante.`,
      );
    }

    // Verifica duplicidade de CNPJ
    const existingCnpj = await this.supplierModel
      .findOne({ cnpj: cleanCnpj, restaurantId })
      .exec();
    if (existingCnpj) {
      throw new ConflictException(
        `Já existe um fornecedor com o CNPJ "${createSupplierDto.cnpj}" neste restaurante.`,
      );
    }

    const created = new this.supplierModel({
      ...createSupplierDto,
      name,
      cnpj: cleanCnpj,
      restaurantId,
      userId,
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
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateSupplierDto)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Sanitiza CNPJ se presente
    if (updateData.cnpj) {
      updateData.cnpj = (updateData.cnpj as string).replace(/\D/g, '');
    }

    // Se for alterar o nome, verifica duplicidade
    if (updateData.name) {
      if (typeof updateData.name !== 'string') {
        throw new ConflictException('Nome do fornecedor deve ser uma string.');
      }
      updateData.name = updateData.name.trim();

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

    // Se for alterar o CNPJ, verifica duplicidade
    if (updateData.cnpj) {
      const duplicateCnpj = await this.supplierModel
        .findOne({
          cnpj: updateData.cnpj,
          restaurantId,
          _id: { $ne: id },
        })
        .exec();

      if (duplicateCnpj) {
        throw new ConflictException(
          `Já existe outro fornecedor com o CNPJ "${updateData.cnpj}" neste restaurante.`,
        );
      }
    }

    const updated = await this.supplierModel
      .findOneAndUpdate(
        { _id: id, restaurantId },
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException(
        'Fornecedor não encontrado para atualização.',
      );
    }

    return updated as unknown as Supplier;
  }

  async findByCnpj(cnpj: string, restaurantId: string): Promise<Supplier> {
    const cleanCnpj = cnpj.replace(/\D/g, '');

    const supplier = await this.supplierModel
      .findOne({ cnpj: cleanCnpj, restaurantId })
      .lean()
      .exec();

    if (!supplier) {
      throw new NotFoundException(
        `Fornecedor com CNPJ ${cnpj} não encontrado neste restaurante.`,
      );
    }

    return supplier as unknown as Supplier;
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    // Verifica se existem itens de estoque vinculados a este fornecedor
    const linkedCount = await this.supplierModel.db
      .collection('stock_items')
      .countDocuments({ supplierId: id, restaurantId });

    if (linkedCount > 0) {
      throw new ConflictException(
        `Este fornecedor possui ${linkedCount} item(s) de estoque.`,
      );
    }

    const result = await this.supplierModel
      .deleteOne({ _id: id, restaurantId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Fornecedor não encontrado para remoção.');
    }
  }

  /**
   * Busca dados de empresa na BrasilAPI pelo CNPJ.
   * Usado pelo frontend para auto-preenchimento do cadastro de fornecedor.
   */
  async lookupCnpj(cnpj: string): Promise<CnpjLookupResult | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      return null;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<BrasilApiResponse>(
          `${this.brasilApiUrl}/${cleanCnpj}`,
          { timeout: 8000 },
        ),
      );

      return {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        logradouro: data.logradouro,
        numero: data.numero,
        bairro: data.bairro,
        cep: data.cep,
        uf: data.uf,
        municipio: data.municipio,
        ddd_telefone_1: data.ddd_telefone_1,
        telefone_1: data.telefone_1,
        email: data.email,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`CNPJ ${cnpj} não encontrado na BrasilAPI.`);
        return null;
      }
      if (error.response?.status === 429) {
        this.logger.warn(`Rate limit da BrasilAPI atingido para CNPJ ${cnpj}.`);
        return null;
      }
      throw new Error(`Falha ao consultar BrasilAPI: ${error.message}`);
    }
  }
}
