import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { XMLParser } from 'fast-xml-parser';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Stock, StockDocument } from '../stock/stock.schema';
import { SupplierService } from '../supplier/supplier.service';
import { NfeImportItemDto } from './dto/nfe-import.dto';
import {
  NfeProcess,
  NfeDet,
  NfeParseItem,
  NfeParseResult,
  NfeDuplicateInfo,
  NfeImportResult,
} from './nfe.types';
import { NfeImport, NfeImportDocument } from './nfe-import.schema';

@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name);
  private readonly parser: XMLParser;

  constructor(
    @InjectModel(NfeImport.name)
    private readonly nfeImportModel: Model<NfeImportDocument>,
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    private readonly supplierService: SupplierService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true,
      parseTagValue: false,
    });
  }

  private extractAccessKey(infNFe: any): string | undefined {
    const rawId = infNFe?.['@_Id'];
    if (!rawId || typeof rawId !== 'string') return undefined;
    const match = rawId.match(/^NFe(\d{44})$/);
    return match?.[1];
  }

  async parseXml(xmlBuffer: Buffer, restaurantId?: string): Promise<NfeParseResult> {
    const xmlString = xmlBuffer.toString('utf-8');

    let parsed: NfeProcess;
    try {
      parsed = this.parser.parse(xmlString) as NfeProcess;
    } catch {
      throw new BadRequestException(
        'XML inválido: não foi possível fazer o parsing.',
      );
    }

    const infNFe =
      parsed?.nfeProc?.NFe?.infNFe ?? parsed?.NFe?.infNFe;
    if (!infNFe) {
      throw new BadRequestException(
        'XML inválido: estrutura nfeProc/NFe/infNFe (ou NFe/infNFe) não encontrada.',
      );
    }

    const accessKey = this.extractAccessKey(infNFe);

    const dets: NfeDet[] = Array.isArray(infNFe.det)
      ? infNFe.det
      : [infNFe.det];

    const items: NfeParseItem[] = dets
      .filter((det) => {
        const name = det.prod.xProd.trim();
        if (!name) {
          this.logger.warn('Item ignorado: nome vazio.');
          return false;
        }
        return true;
      })
      .map((det) => ({
        name: det.prod.xProd.trim(),
        ncm: det.prod.NCM,
        unit: det.prod.uCom.trim(),
        quantity: Number(det.prod.qCom) || 0,
        unitPrice: Number(det.prod.vUnCom) || 0,
        totalPrice: Number(det.prod.vProd) || 0,
      }));

    let duplicate: NfeDuplicateInfo | undefined;
    if (accessKey && restaurantId) {
      const dup = await this.nfeImportModel
        .findOne({ accessKey, restaurantId })
        .sort({ createdAt: -1 })
        .lean();
      if (dup) {
        duplicate = {
          importedAt: dup.createdAt!,
          userName: dup.userName,
          itemCount: dup.itemCount,
        };
      }
    }

    return {
      items,
      supplierName: infNFe.emit?.xNome?.trim(),
      supplierCnpj: infNFe.emit?.CNPJ?.trim(),
      accessKey,
      duplicate,
    };
  }

  async checkDuplicate(
    accessKey: string,
    restaurantId: string,
  ): Promise<NfeDuplicateInfo | null> {
    const existing = await this.nfeImportModel
      .findOne({ accessKey, restaurantId })
      .sort({ createdAt: -1 })
      .lean();
    if (!existing) return null;
    return {
      importedAt: existing.createdAt!,
      userName: existing.userName,
      itemCount: existing.itemCount,
    };
  }

  async importItems(
    data: {
      items: NfeImportItemDto[];
      supplierName?: string;
      supplierCnpj?: string;
      accessKey?: string;
    },
    restaurantId: string,
    userId: string,
    userName: string,
  ): Promise<NfeImportResult> {
    const summary = {
      total: data.items.length,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    let supplier: { id: string; name: string; cnpj: string } | null = null;
    const cleanCnpj = data.supplierCnpj?.replace(/\D/g, '');

    if (cleanCnpj) {
      try {
        const found = await this.supplierService.findByCnpj(
          cleanCnpj,
          restaurantId,
        );
        supplier = {
          id: (found as any)._id.toString(),
          name: found.name,
          cnpj: cleanCnpj,
        };
        this.logger.log(`Fornecedor encontrado: ${found.name}`);
      } catch {
        if (data.supplierName) {
          try {
            const created = await this.supplierService.create(
              {
                name: data.supplierName,
                cnpj: cleanCnpj,
              },
              restaurantId,
              userId,
            );
            supplier = {
              id: (created as any)._id.toString(),
              name: created.name,
              cnpj: cleanCnpj,
            };
            this.logger.log(`Fornecedor criado: ${created.name}`);
          } catch (createError: any) {
            if (createError.message?.includes('Já existe')) {
              try {
                const existing = await this.supplierService.findByCnpj(
                  cleanCnpj,
                  restaurantId,
                );
                supplier = {
                  id: (existing as any)._id.toString(),
                  name: existing.name,
                  cnpj: cleanCnpj,
                };
              } catch {
                this.logger.warn(
                  `Fornecedor não pôde ser criado nem encontrado para CNPJ ${cleanCnpj}`,
                );
              }
            } else {
              this.logger.warn(
                `Erro ao criar fornecedor: ${createError.message}`,
              );
            }
          }
        } else {
          this.logger.warn(
            `CNPJ do fornecedor informado (${data.supplierCnpj}) sem nome. Fornecedor não criado.`,
          );
        }
      }
    }

    for (const item of data.items) {
      try {
        const existing = await this.stockModel
          .findOne({
            name: item.name.trim(),
            brand: '',
            restaurantId,
          })
          .exec();

        if (existing) {
          await this.stockModel.updateOne(
            { _id: existing._id },
            { $inc: { quantity: item.quantity } },
          );
          summary.updated++;
        } else {
          await this.stockModel.create({
            name: item.name.trim(),
            brand: '',
            quantity: item.quantity,
            unit: item.unit,
            minQuantity: 0,
            category: item.category || 'Outra',
            unitPrice: item.unitPrice,
            restaurantId,
            supplierId: supplier?.id,
          });
          summary.created++;
        }
      } catch (error: any) {
        if (error?.code === 11000) {
          try {
            await this.stockModel.updateOne(
              { name: item.name.trim(), brand: '', restaurantId },
              { $inc: { quantity: item.quantity } },
            );
            summary.updated++;
            continue;
          } catch (updateError: any) {
            summary.errors.push(
              `Erro ao atualizar "${item.name}" após conflito: ${updateError.message}`,
            );
            continue;
          }
        }

        const msg = `Erro ao processar "${item.name}": ${error.message}`;
        this.logger.error(msg);
        summary.errors.push(msg);
      }
    }

    if (data.accessKey) {
      try {
        await this.nfeImportModel.create({
          accessKey: data.accessKey,
          restaurantId,
          userId,
          userName,
          supplierName: data.supplierName,
          supplierCnpj: data.supplierCnpj,
          itemCount: data.items.length,
        });
      } catch (error: any) {
        if (error?.code === 11000) {
          this.logger.warn(
            `Nota fiscal ${data.accessKey} já foi registrada anteriormente.`,
          );
        } else {
          this.logger.error(
            `Erro ao registrar importação: ${error.message}`,
          );
        }
      }
    }

    return { supplier, summary };
  }

  async recordImport(data: {
    accessKey: string;
    restaurantId: string;
    userId: string;
    userName: string;
    supplierName?: string;
    supplierCnpj?: string;
    itemCount: number;
  }): Promise<void> {
    await this.nfeImportModel.create(data);
  }
}
