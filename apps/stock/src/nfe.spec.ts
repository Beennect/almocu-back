import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { Stock } from './stock/stock.schema';
import { NfeService } from './nfe/nfe.service';
import { SupplierService } from './supplier/supplier.service';

// ── Minimal XML de NF-e válida para testes ──
const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35200612345678000190550010000000011000000010" versao="4.00">
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>DISTRIBUIDORA RYZEN LTDA</xNome>
      </emit>
      <det n="1">
        <prod>
          <xProd>AGUA MINERAL RYZEN 1L</xProd>
          <NCM>22011000</NCM>
          <uCom>UN</uCom>
          <qCom>100.0000</qCom>
          <vUnCom>2.5000</vUnCom>
        </prod>
      </det>
      <det n="2">
        <prod>
          <xProd>ARROZ TIPO 1 5KG</xProd>
          <NCM>10062000</NCM>
          <uCom>KG</uCom>
          <qCom>30.0000</qCom>
          <vUnCom>5.9000</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

const XML_SEM_EMIT = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe>
      <det n="1">
        <prod>
          <xProd>ITEM SEM EMITENTE</xProd>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>1.0000</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

// ── Mocks ──
function makeChainMock(value: any) {
  return mock(() => ({
    exec: mock(() => Promise.resolve(value)),
  }));
}

function buildSupplierMock(overrides: Record<string, any> = {}) {
  return {
    findOne: mock(() => ({
      exec: mock(() => Promise.resolve(null)),
      lean: mock(() => ({ exec: mock(() => Promise.resolve(null)) })),
    })),
    find: mock(() => ({
      sort: mock(() => ({
        skip: mock(() => ({
          limit: mock(() => ({
            lean: mock(() => ({ exec: mock(() => Promise.resolve([])) })),
          })),
        })),
      })),
    })),
    create: mock(() => {}),
    findOneAndUpdate: mock(() => ({
      exec: mock(() => Promise.resolve(null)),
    })),
    deleteOne: mock(() => ({
      exec: mock(() => Promise.resolve({ deletedCount: 0 })),
    })),
    countDocuments: mock(() => ({
      exec: mock(() => Promise.resolve(0)),
    })),
    ...overrides,
  };
}

describe('NfeService', () => {
  let service: NfeService;
  let mockStockModel: ReturnType<typeof buildSupplierMock>;
  let mockSupplierService: {
    findByCnpj: ReturnType<typeof mock>;
    create: ReturnType<typeof mock>;
  };
  let mockHttpService: { get: ReturnType<typeof mock> };
  let mockConfigService: { get: ReturnType<typeof mock> };

  beforeEach(async () => {
    mockStockModel = buildSupplierMock();
    mockSupplierService = {
      findByCnpj: mock(() => Promise.reject(new Error('Not found'))),
      create: mock(() =>
        Promise.resolve({ _id: 'supplier-123', name: 'Supplier' }),
      ),
    };
    mockHttpService = {
      get: mock(() => of({ data: null })),
    };
    mockConfigService = {
      get: mock(() => 'https://brasilapi.com.br/api/cnpj/v1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NfeService,
        { provide: getModelToken(Stock.name), useValue: mockStockModel },
        { provide: SupplierService, useValue: mockSupplierService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NfeService>(NfeService);

    // Clear all mocks between tests
    mockStockModel.findOne.mockClear();
    mockStockModel.create.mockClear();
    mockStockModel.updateOne = mock(() => Promise.resolve({ modifiedCount: 1 }));
    mockSupplierService.findByCnpj.mockClear();
    mockSupplierService.create.mockClear();
    mockHttpService.get.mockClear();
    mockConfigService.get.mockClear();
  });

  // ─────────────── processXml ───────────────

  describe('processXml', () => {
    it('should parse valid XML and create new stock items', async () => {
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.created).toBe(2);
      expect(result.summary.updated).toBe(0);
      expect(result.summary.errors).toEqual([]);
      expect(result.supplier).toBeNull(); // supplier not found + BrasilAPI not called
    });

    it('should update existing items (increment quantity)', async () => {
      // First call (AGUA) returns existing, second call (ARROZ) returns existing
      let callCount = 0;
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => {
          callCount++;
          return Promise.resolve({
            _id: `existing-${callCount}`,
            name: callCount === 1 ? 'AGUA MINERAL RYZEN 1L' : 'ARROZ TIPO 1 5KG',
            quantity: 10,
          });
        }),
      }));
      mockStockModel.updateOne = mock(() =>
        Promise.resolve({ modifiedCount: 1 }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.created).toBe(0);
      expect(result.summary.updated).toBe(2);
    });

    it('should throw BadRequestException for malformed XML', async () => {
      await expect(
        service.processXml(Buffer.from('not xml'), 'restaurant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for XML without nfeProc', async () => {
      await expect(
        service.processXml(
          Buffer.from('<root><foo>bar</foo></root>'),
          'restaurant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should link supplier when CNPJ matches existing supplier', async () => {
      mockSupplierService.findByCnpj.mockImplementation(() =>
        Promise.resolve({
          _id: 'supplier-abc',
          name: 'DISTRIBUIDORA RYZEN LTDA',
          cnpj: '12345678000190',
        }),
      );
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(result.supplier).toEqual({
        name: 'DISTRIBUIDORA RYZEN LTDA',
        cnpj: '12345678000190',
      });
      expect(result.summary.created).toBe(2);
    });

    it('should try BrasilAPI when supplier not found locally', async () => {
      // findeByCnpj rejeita (não encontrado)
      mockSupplierService.findByCnpj.mockImplementation(() =>
        Promise.reject(new Error('Not found')),
      );
      // BrasilAPI retorna dados
      mockHttpService.get.mockImplementation(() =>
        of({
          data: {
            cnpj: '12345678000190',
            razao_social: 'DISTRIBUIDORA RYZEN LTDA',
            nome_fantasia: 'RYZEN DIST',
            logradouro: 'RUA A',
            numero: '100',
            bairro: 'CENTRO',
            municipio: 'SAO PAULO',
            uf: 'SP',
            cep: '01001000',
            ddd_telefone_1: '11',
            telefone_1: '30000000',
            email: 'contato@ryzen.com',
          },
        }),
      );
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      // SupplierService.create deve retornar o nome que foi passado
      mockSupplierService.create.mockImplementation((dto: any) =>
        Promise.resolve({ _id: 'supplier-abc', name: dto.name, cnpj: dto.cnpj }),
      );
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(result.supplier).toEqual({
        name: 'DISTRIBUIDORA RYZEN LTDA',
        cnpj: '12345678000190',
      });
      expect(mockSupplierService.create).toHaveBeenCalled();
      // Verifica se chamou a BrasilAPI
      expect(mockHttpService.get).toHaveBeenCalled();
    });

    it('should process items without supplier if BrasilAPI fails', async () => {
      mockSupplierService.findByCnpj.mockImplementation(() =>
        Promise.reject(new Error('Not found')),
      );
      // BrasilAPI retorna 404
      const headers = new AxiosHeaders();
      mockHttpService.get.mockImplementation(() =>
        throwError(
          () =>
            new AxiosError(
              'Not found',
              '404',
              undefined,
              null,
              {
                status: 404,
                data: { message: 'CNPJ not found' },
                statusText: 'Not Found',
                headers,
                config: { headers } as any,
              },
            ),
        ),
      );
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      // Fornecedor null mas itens criados mesmo assim
      expect(result.supplier).toBeNull();
      expect(result.summary.created).toBe(2);
    });

    it('should skip items with invalid quantity', async () => {
      const xmlWithInvalid = VALID_XML.replace('100.0000', '0.0000');
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(xmlWithInvalid),
        'restaurant-1',
      );

      expect(result.summary.created).toBe(1);
      expect(result.summary.errors.length).toBe(1);
      expect(result.summary.errors[0]).toContain('quantidade inválida');
    });

    it('should handle duplicate key error (11000) gracefully', async () => {
      // Primeira chamada: não encontrou
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      // Create lança erro 11000 (race condition — outro processo criou no meio tempo)
      mockStockModel.create.mockImplementation(() => {
        const err = new Error('Duplicate key') as any;
        err.code = 11000;
        throw err;
      });
      // updateOne deve ser chamado como fallback
      mockStockModel.updateOne = mock(() =>
        Promise.resolve({ modifiedCount: 1 }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(result.summary.updated).toBe(2);
      expect(mockStockModel.updateOne).toHaveBeenCalled();
    });

    it('should work with XML that has no CNPJ (sem emitente)', async () => {
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(XML_SEM_EMIT),
        'restaurant-1',
      );

      expect(result.supplier).toBeNull();
      expect(result.summary.created).toBe(1);
    });
  });

  // ─────────────── fetchCompanyByCnpj ───────────────

  describe('fetchCompanyByCnpj (private via autoCreateSupplier)', () => {
    it('should return null for invalid CNPJ (non-14 digits)', async () => {
      mockSupplierService.findByCnpj.mockImplementation(() =>
        Promise.reject(new Error('Not found')),
      );
      mockHttpService.get.mockImplementation(() =>
        of({ data: { razao_social: 'EMPRESA TESTE' } }),
      );
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-id', ...data }),
      );

      // Substitui apenas o CNPJ do emitente (5 dígitos — inválido)
      const xmlWithInvalidCnpj = VALID_XML.replace(
        '<CNPJ>12345678000190</CNPJ>',
        '<CNPJ>12345</CNPJ>',
      );
      const result = await service.processXml(
        Buffer.from(xmlWithInvalidCnpj),
        'restaurant-1',
      );

      expect(result.supplier).toBeNull();
      // Itens criados sem fornecedor
      expect(result.summary.created).toBe(2);
    });
  });

  // ─────────────── autoCreateSupplier ───────────────

  describe('autoCreateSupplier (via processXml)', () => {
    it('should create supplier from BrasilAPI data', async () => {
      mockSupplierService.findByCnpj.mockImplementation(() =>
        Promise.reject(new Error('Not found')),
      );
      mockHttpService.get.mockImplementation(() =>
        of({
          data: {
            cnpj: '12345678000190',
            razao_social: 'DISTRIBUIDORA RYZEN LTDA',
            nome_fantasia: 'RYZEN DIST',
            logradouro: 'RUA DAS INDUSTRIAS',
            numero: '1000',
            bairro: 'DISTRITO INDUSTRIAL',
            municipio: 'SAO PAULO',
            uf: 'SP',
            cep: '01001001',
            ddd_telefone_1: '11',
            telefone_1: '30000000',
            email: 'contato@ryzen.com',
          },
        }),
      );
      mockSupplierService.create.mockImplementation((dto: any) =>
        Promise.resolve({
          _id: 'new-supplier-id',
          name: dto.name,
          cnpj: dto.cnpj,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          isActive: dto.isActive,
        }),
      );
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(mockSupplierService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DISTRIBUIDORA RYZEN LTDA',
          cnpj: '12345678000190',
          email: 'contato@ryzen.com',
          address: expect.objectContaining({
            street: 'RUA DAS INDUSTRIAS',
            number: '1000',
            city: 'SAO PAULO',
            state: 'SP',
          }),
        }),
        'restaurant-1',
      );

      expect(result.supplier).toEqual({
        name: 'DISTRIBUIDORA RYZEN LTDA',
        cnpj: '12345678000190',
      });
    });

    it('should fallback if SupplierService.create throws ConflictException', async () => {
      mockSupplierService.findByCnpj.mockImplementation(() =>
        Promise.reject(new Error('Not found')),
      );
      mockHttpService.get.mockImplementation(() =>
        of({
          data: {
            cnpj: '12345678000190',
            razao_social: 'DISTRIBUIDORA RYZEN LTDA',
          },
        }),
      );
      // create lança erro de nome duplicado
      mockSupplierService.create.mockImplementation(() => {
        throw new Error('Já existe um fornecedor com o nome');
      });
      // Depois findByCnpj funciona (concorrência)
      mockSupplierService.findByCnpj
        .mockImplementationOnce(() => Promise.reject(new Error('Not found'))) // primeira chamada
        .mockImplementationOnce(() =>
          Promise.resolve({
            _id: 'existing-supplier',
            name: 'DISTRIBUIDORA RYZEN LTDA',
            cnpj: '12345678000190',
          }),
        ); // retry após conflict

      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      mockStockModel.create.mockImplementation((data: any) =>
        Promise.resolve({ _id: 'new-stock-id', ...data }),
      );

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(result.supplier).toEqual({
        name: 'DISTRIBUIDORA RYZEN LTDA',
        cnpj: '12345678000190',
      });
    });
  });

  // ─────────────── Error handling ───────────────

  describe('error handling', () => {
    it('should collect errors and continue processing other items', async () => {
      mockSupplierService.findByCnpj.mockImplementation(() =>
        Promise.reject(new Error('Not found')),
      );
      mockStockModel.findOne.mockImplementation(() => ({
        exec: mock(() => Promise.resolve(null)),
      }));
      // Primeiro create falha, segundo funciona
      let createCount = 0;
      mockStockModel.create.mockImplementation((data: any) => {
        createCount++;
        if (createCount === 1) {
          throw new Error('Database connection error');
        }
        return Promise.resolve({ _id: 'new-stock-id', ...data });
      });

      const result = await service.processXml(
        Buffer.from(VALID_XML),
        'restaurant-1',
      );

      expect(result.summary.created).toBe(1);
      expect(result.summary.errors.length).toBe(1);
      expect(result.summary.errors[0]).toContain('AGUA MINERAL RYZEN 1L');
    });
  });
});
