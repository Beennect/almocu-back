export interface NfeProcess {
  nfeProc: {
    NFe: {
      infNFe: {
        ide?: {
          dhEmi?: string;
          nNF?: string;
          serie?: string;
        };
        emit: {
          CNPJ: string;
          xNome: string;
          xFant?: string;
        };
        det: NfeDet[] | NfeDet;
        total?: {
          ICMSTot?: {
            vProd?: string;
            vNF?: string;
          };
        };
      };
    };
    protNFe?: {
      infProt?: {
        chNFe?: string;
        nProt?: string;
        dhRecbto?: string;
      };
    };
  };
}

export interface NfeDet {
  prod: {
    xProd: string;
    NCM?: string;
    CFOP?: string;
    uCom: string;
    qCom: string;
    vUnCom: string;
    vProd?: string;
  };
}

export interface NfeInvoiceItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface NfeUploadResult {
  supplier: { name: string; cnpj: string } | null;
  invoiceId: string;
  summary: {
    total: number;
    created: number;
    updated: number;
    errors: string[];
  };
}
