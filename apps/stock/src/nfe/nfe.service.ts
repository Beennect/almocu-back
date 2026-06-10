import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { XMLParser } from 'fast-xml-parser';
import {
  NfeProcess,
  NfeDet,
  NfeParseItem,
  NfeParseResult,
  NfeDuplicateInfo,
} from './nfe.types';
import { NfeImport, NfeImportDocument } from './nfe-import.schema';

@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name);
  private readonly parser: XMLParser;

  constructor(
    @InjectModel(NfeImport.name)
    private readonly nfeImportModel: Model<NfeImportDocument>,
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
    // Id format: "NFe" + 44-digit access key
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
