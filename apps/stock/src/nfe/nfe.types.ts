export interface NfeProcess {
  nfeProc: {
    NFe: {
      infNFe: {
        emit: {
          CNPJ: string;
          xNome: string;
        };
        det: NfeDet[] | NfeDet;
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
  };
}

export interface NfeUploadResult {
  supplier: { name: string; cnpj: string } | null;
  summary: {
    total: number;
    created: number;
    updated: number;
    errors: string[];
  };
}
