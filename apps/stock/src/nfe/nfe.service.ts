import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { XMLParser } from 'fast-xml-parser';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Stock, StockDocument } from '../stock/stock.schema';
import { SupplierService } from '../supplier/supplier.service';
import {
  NfeProcess,
  NfeDet,
  NfeUploadResult,
  NfeInvoiceItem,
} from './nfe.types';
import { NfeInvoice, NfeInvoiceDocument } from './schemas/nfe-invoice.schema';
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

@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name);
  private readonly parser: XMLParser;
  private readonly brasilApiUrl: string;

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @InjectModel(NfeInvoice.name)
    private readonly invoiceModel: Model<NfeInvoiceDocument>,
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
    this.brasilApiUrl =
      this.configService.get<string>('BRASIL_API_URL') ||
      'https://brasilapi.com.br/api/cnpj/v1';
  }

  async processXml(
    xmlBuffer: Buffer,
    restaurantId: string,
    userId: string,
  ): Promise<NfeUploadResult> {
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

    // Extrai dados do emitente (fornecedor)
    const emitCnpj = infNFe.emit?.CNPJ;
    const emitNome = infNFe.emit?.xNome;

    // Tenta encontrar ou criar o fornecedor automaticamente
    let supplier: { name: string; cnpj: string } | null = null;
    let supplierObjectId: string | undefined;

    if (emitCnpj) {
      const cleanCnpj = emitCnpj.trim();

      try {
        const found = await this.supplierService.findByCnpj(
          cleanCnpj,
          restaurantId,
        );
        supplier = { name: found.name, cnpj: cleanCnpj };
        supplierObjectId = (found as any)._id?.toString();
        this.logger.log(`Fornecedor encontrado: ${found.name}`);
      } catch {
        this.logger.log(
          `Fornecedor CNPJ ${cleanCnpj} não encontrado. Consultando BrasilAPI...`,
        );
        try {
          const result = await this.autoCreateSupplier(cleanCnpj, restaurantId);
          if (result) {
            supplier = { name: result.name, cnpj: cleanCnpj };
            supplierObjectId = result.id;
            this.logger.log(`Fornecedor criado via BrasilAPI: ${result.name}`);
          }
        } catch (apiError: any) {
          this.logger.warn(
            `Não foi possível criar fornecedor para CNPJ ${cleanCnpj}: ${apiError.message}. ` +
              `Itens serão importados sem vínculo de fornecedor.`,
          );
        }
      }
    }

    // Normaliza det para array
    const dets: NfeDet[] = Array.isArray(infNFe.det)
      ? infNFe.det
      : [infNFe.det];

    const summary = {
      total: dets.length,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };
    const invoiceItems: NfeInvoiceItem[] = [];

    for (const det of dets) {
      const prod = det.prod;
      const name = prod.xProd.trim();
      const unit = prod.uCom.trim();
      const quantity = Number(prod.qCom);
      const unitPrice = Number(prod.vUnCom);
      const totalPrice = prod.vProd ? Number(prod.vProd) : quantity * unitPrice;

      if (!name) {
        summary.errors.push('Item ignorado: nome vazio.');
        continue;
      }

      if (!unit) {
        summary.errors.push(
          `Item "${name}" ignorado: unidade de medida vazia.`,
        );
        continue;
      }

      if (Number.isNaN(quantity) || quantity <= 0) {
        summary.errors.push(
          `Item "${name}" ignorado: quantidade inválida (${prod.qCom}).`,
        );
        continue;
      }

      // Adiciona ao array de itens da nota (para o histórico)
      invoiceItems.push({
        name,
        unit,
        quantity,
        unitPrice: Number.isNaN(unitPrice) ? 0 : unitPrice,
        totalPrice: Number.isNaN(totalPrice) ? 0 : totalPrice,
      });

      try {
        const existing = await this.stockModel
          .findOne({ name, brand: '', restaurantId })
          .exec();

        if (existing) {
          await this.stockModel.updateOne(
            { _id: existing._id },
            { $inc: { quantity } },
          );
          summary.updated++;
        } else {
          await this.stockModel.create({
            name,
            brand: '',
            quantity,
            unit,
            minQuantity: 0,
            restaurantId,
            supplierId: supplierObjectId,
          });
          summary.created++;
        }
      } catch (error: any) {
        if (error?.code === 11000) {
          try {
            await this.stockModel.updateOne(
              { name, brand: '', restaurantId },
              { $inc: { quantity } },
            );
            summary.updated++;
            continue;
          } catch (updateError: any) {
            summary.errors.push(
              `Erro ao atualizar "${name}" após conflito: ${updateError.message}`,
            );
            continue;
          }
        }

        const msg = `Erro ao processar "${name}": ${error.message}`;
        this.logger.error(msg);
        summary.errors.push(msg);
      }
    }

    // Extrai dados da nota fiscal
    const ide = infNFe.ide;
    const protInfo = parsed.nfeProc?.protNFe?.infProt;
    const totalInfo = infNFe.total?.ICMSTot;

    const accessKey =
      protInfo?.chNFe || this.extractAccessKeyFromId((infNFe as any)['@_Id']);
    const nProt = protInfo?.nProt;
    const issueDate = ide?.dhEmi ? new Date(ide.dhEmi) : undefined;
    const totalValue = totalInfo?.vNF
      ? Number(totalInfo.vNF)
      : invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Salva o registro da nota fiscal no histórico
    let invoiceId: string;
    try {
      const invoice = await this.invoiceModel.create({
        accessKey: accessKey || 'unknown',
        nProt,
        issueDate,
        supplierName: emitNome?.trim(),
        supplierCnpj: emitCnpj?.trim(),
        supplierId: supplierObjectId,
        totalValue,
        items: invoiceItems,
        restaurantId,
        userId,
      });
      invoiceId = (invoice as any)._id.toString();
      this.logger.log(`Nota fiscal salva no histórico: ${accessKey}`);
    } catch (error: any) {
      if (error?.code === 11000) {
        this.logger.warn(
          `Nota fiscal ${accessKey} já importada anteriormente.`,
        );
        const existing = await this.invoiceModel
          .findOne({ accessKey })
          .exec();
        invoiceId = (existing as any)._id.toString();
      } else {
        this.logger.error(`Erro ao salvar nota fiscal: ${error.message}`);
        invoiceId = 'unknown';
      }
    }

    return { supplier, invoiceId, summary };
  }

  async findAll(
    restaurantId: string,
    pageable: Pageable,
  ): Promise<Page<NfeInvoice>> {
    const [items, total] = await Promise.all([
      this.invoiceModel
        .find({ restaurantId })
        .sort({ createdAt: -1 })
        .skip(pageable.skip)
        .limit(pageable.limit)
        .lean()
        .exec(),
      this.invoiceModel.countDocuments({ restaurantId }).exec(),
    ]);

    return new Page(items, total, pageable);
  }

  async findOne(id: string, restaurantId: string): Promise<NfeInvoice> {
    const invoice = await this.invoiceModel
      .findOne({ _id: id, restaurantId })
      .lean()
      .exec();
    if (!invoice) {
      throw new BadRequestException('Nota fiscal não encontrada.');
    }
    return invoice;
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const result = await this.invoiceModel
      .deleteOne({ _id: id, restaurantId })
      .exec();
    if (result.deletedCount === 0) {
      throw new BadRequestException('Nota fiscal não encontrada.');
    }
  }

  private extractAccessKeyFromId(id: string | undefined): string | undefined {
    if (!id) return undefined;
    return id.startsWith('NFe') ? id.substring(3) : id;
  }

  private async fetchCompanyByCnpj(
    cnpj: string,
  ): Promise<BrasilApiResponse | null> {
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      this.logger.warn(`CNPJ inválido: ${cnpj}`);
      return null;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<BrasilApiResponse>(
          `${this.brasilApiUrl}/${cleanCnpj}`,
          { timeout: 8000 },
        ),
      );
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`CNPJ ${cnpj} não encontrado na BrasilAPI.`);
        return null;
      }
      if (error.response?.status === 429) {
        this.logger.warn(`Rate limit da BrasilAPI atingido para CNPJ ${cnpj}.`);
        return null;
      }
      throw new Error(
        `Falha ao consultar BrasilAPI: ${error.message}`,
      );
    }
  }

  private async autoCreateSupplier(
    cnpj: string,
    restaurantId: string,
  ): Promise<{ id: string; name: string } | null> {
    const data = await this.fetchCompanyByCnpj(cnpj);
    if (!data) return null;

    const name =
      data.razao_social?.trim() || data.nome_fantasia?.trim();
    if (!name) {
      this.logger.warn(
        `BrasilAPI não retornou nome para CNPJ ${cnpj}.`,
      );
      return null;
    }

    try {
      const created = await this.supplierService.create(
        {
          name,
          cnpj: cnpj.replace(/\D/g, ''),
          email: data.email || undefined,
          phone: data.ddd_telefone_1
            ? `(${data.ddd_telefone_1}) ${data.telefone_1 || ''}`
            : undefined,
          address: data.logradouro
            ? {
                street: data.logradouro,
                number: data.numero || 'S/N',
                neighborhood: data.bairro || undefined,
                city: data.municipio || '',
                state: data.uf || '',
                zipCode: data.cep || undefined,
                complement: data.complemento || undefined,
              }
            : undefined,
          isActive: true,
        },
        restaurantId,
      );
      return { id: (created as any)._id.toString(), name: created.name };
    } catch (error: any) {
      if (error.message?.includes('Já existe')) {
        try {
          const existing = await this.supplierService.findByCnpj(
            cnpj,
            restaurantId,
          );
          return {
            id: (existing as any)._id.toString(),
            name: existing.name,
          };
        } catch {
          return null;
        }
      }
      throw error;
    }
  }
}
