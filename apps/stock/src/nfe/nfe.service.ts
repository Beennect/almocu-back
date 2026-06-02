import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { XMLParser } from 'fast-xml-parser';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Stock, StockDocument } from '../stock/stock.schema';
import { SupplierService } from '../supplier/supplier.service';
import { NfeProcess, NfeDet, NfeUploadResult } from './nfe.types';

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
    private readonly supplierService: SupplierService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true,
      // Mantém valores como string — evitamos que CNPJ, CEP, etc. virem número
      parseTagValue: false,
    });
    this.brasilApiUrl =
      this.configService.get<string>('BRASIL_API_URL') ||
      'https://brasilapi.com.br/api/cnpj/v1';
  }

  async processXml(
    xmlBuffer: Buffer,
    restaurantId: string,
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

    const infNFe = parsed?.nfeProc?.NFe?.infNFe;
    if (!infNFe) {
      throw new BadRequestException(
        'XML inválido: estrutura nfeProc/NFe/infNFe não encontrada.',
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
        // 1. Tenta encontrar fornecedor existente pelo CNPJ
        const found = await this.supplierService.findByCnpj(
          cleanCnpj,
          restaurantId,
        );
        supplier = { name: found.name, cnpj: cleanCnpj };
        supplierObjectId = (found as any)._id?.toString();
        this.logger.log(`Fornecedor encontrado: ${found.name}`);
      } catch {
        // 2. Não encontrou — tenta buscar na BrasilAPI e criar automaticamente
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

    // Normaliza det para array (pode ser objeto único se só 1 item)
    const dets: NfeDet[] = Array.isArray(infNFe.det)
      ? infNFe.det
      : [infNFe.det];

    const summary = {
      total: dets.length,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const det of dets) {
      const prod = det.prod;
      const name = prod.xProd.trim();
      const unit = prod.uCom.trim();
      const quantity = Number(prod.qCom);

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

      try {
        // Busca por name + brand vazia + restaurantId (índice único)
        const existing = await this.stockModel
          .findOne({ name, brand: '', restaurantId })
          .exec();

        if (existing) {
          // Item já existe — incrementa a quantidade
          await this.stockModel.updateOne(
            { _id: existing._id },
            { $inc: { quantity } },
          );
          summary.updated++;
        } else {
          // Item novo — cria com os dados da NF-e
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
        // Erro 11000 = duplicate key (race condition rara)
        if (error?.code === 11000) {
          // Tenta dar update — o item foi criado entre a busca e a criação
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

    return { supplier, summary };
  }

  /**
   * Busca dados da empresa na BrasilAPI pelo CNPJ.
   * https://brasilapi.com.br/docs#tag/CNPJ
   */
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

  /**
   * Cria automaticamente um fornecedor a partir dos dados da BrasilAPI.
   * Retorna o ID do fornecedor criado, ou null se não for possível.
   */
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

    // Verifica se já existe fornecedor com este nome (evita duplicidade)
    try {
      // Tenta criar via SupplierService
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
      // Se já existe fornecedor com o mesmo nome, tenta buscar pelo CNPJ novamente
      // (pode ter sido criado em outra requisição concorrente)
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
