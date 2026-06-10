export interface NfeProcess {
  nfeProc?: {
    NFe: {
      infNFe: NfeInfNFe;
    };
    protNFe?: {
      infProt?: {
        chNFe?: string;
        nProt?: string;
        dhRecbto?: string;
      };
    };
  };
  NFe?: {
    infNFe: NfeInfNFe;
  };
}

interface NfeInfNFe {
  '@_Id'?: string;
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

export interface NfeParseItem {
  name: string;
  ncm?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface NfeDuplicateInfo {
  importedAt: Date;
  userName: string;
  itemCount: number;
}

export interface NfeParseResult {
  items: NfeParseItem[];
  supplierName?: string;
  supplierCnpj?: string;
  accessKey?: string;
  duplicate?: NfeDuplicateInfo;
}
