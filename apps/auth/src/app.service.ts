import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface ServiceConfig {
  name: string;
  dockerUrl: string;
  localUrl: string;
  pathPrefix: string;
  microservicePrefix: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private baseSwaggerDocument: any = null;
  private unifiedCache: CacheEntry | null = null;
  private readonly CACHE_TTL_MS = 30_000; // 30 segundos de cache

  private readonly services: ServiceConfig[] = [
    {
      name: 'Stock',
      dockerUrl: 'http://stock-app:3000/api-json',
      localUrl: 'http://localhost:3100/api-json',
      pathPrefix: '/api/stock',
      microservicePrefix: '/stock',
    },
    {
      name: 'Menu',
      dockerUrl: 'http://menu-app:3000/api-json',
      localUrl: 'http://localhost:3200/api-json',
      pathPrefix: '/api/menu',
      microservicePrefix: '/products',
    },
    {
      name: 'Order',
      dockerUrl: 'http://order-app:3000/api-json',
      localUrl: 'http://localhost:3300/api-json',
      pathPrefix: '/api/order',
      microservicePrefix: '/orders',
    },
  ];

  getHello(): string {
    return 'Hello World!';
  }

  setBaseSwaggerDocument(document: any) {
    this.baseSwaggerDocument = document;
    // Invalida o cache ao trocar o documento base
    this.unifiedCache = null;
  }

  async getUnifiedSwaggerDocument(): Promise<any> {
    // 1. Cache em memória com TTL
    if (
      this.unifiedCache &&
      Date.now() - this.unifiedCache.timestamp < this.CACHE_TTL_MS
    ) {
      return this.unifiedCache.data;
    }

    // 2. Se não há documento base, retorna vazio
    if (!this.baseSwaggerDocument) {
      return { openapi: '3.0.0', paths: {}, components: {} };
    }

    // 3. Cria cópia profunda do documento base
    const unifiedDoc: any = JSON.parse(
      JSON.stringify(this.baseSwaggerDocument),
    );

    // 4. Busca specs de TODOS os serviços em PARALELO
    const results = await Promise.allSettled(
      this.services.map((service) => this.fetchServiceSpec(service)),
    );

    // 5. Processa cada spec que foi carregada com sucesso
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        this.logger.warn(
          `[Unified Swagger] ${this.services[i].name} indisponível: ${result.reason?.message || 'erro desconhecido'}`,
        );
        continue;
      }

      const serviceSpec = result.value;
      const service = this.services[i];

      this.mergePaths(unifiedDoc, serviceSpec, service);
      this.mergeSchemas(unifiedDoc, serviceSpec);
    }

    // 6. Armazena em cache e retorna
    this.unifiedCache = { data: unifiedDoc, timestamp: Date.now() };
    return unifiedDoc;
  }

  /** Tenta buscar o spec do serviço: primeiro Docker, depois localhost */
  private async fetchServiceSpec(service: ServiceConfig): Promise<any> {
    const urls = [service.dockerUrl, service.localUrl];

    for (const url of urls) {
      try {
        const response = await axios.get(url, { timeout: 800 });
        return response.data;
      } catch {
        // Tenta próxima URL
      }
    }

    throw new Error(`Todas as URLs falharam para ${service.name}`);
  }

  /** Mescla as rotas do serviço no documento unificado, ajustando os prefixos */
  private mergePaths(
    unifiedDoc: any,
    serviceSpec: any,
    service: ServiceConfig,
  ): void {
    if (!serviceSpec?.paths) return;

    for (const [pathKey, pathValue] of Object.entries(serviceSpec.paths)) {
      let gatewayPath: string;

      if (pathKey.startsWith(service.microservicePrefix)) {
        gatewayPath = pathKey.replace(
          service.microservicePrefix,
          service.pathPrefix,
        );
      } else {
        gatewayPath =
          service.pathPrefix +
          (pathKey.startsWith('/') ? pathKey : '/' + pathKey);
      }

      // Normaliza barras repetidas
      gatewayPath = gatewayPath.replace(/\/+/g, '/');
      unifiedDoc.paths[gatewayPath] = pathValue;
    }
  }

  /** Mescla os schemas do serviço no documento unificado */
  private mergeSchemas(unifiedDoc: any, serviceSpec: any): void {
    if (!serviceSpec?.components?.schemas) return;

    if (!unifiedDoc.components) {
      unifiedDoc.components = {};
    }
    if (!unifiedDoc.components.schemas) {
      unifiedDoc.components.schemas = {};
    }

    Object.assign(
      unifiedDoc.components.schemas,
      serviceSpec.components.schemas,
    );
  }
}
