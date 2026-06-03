import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@app/common';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ProxyMiddleware.name);
  private proxies!: Record<string, any>;

  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.proxies = {
      '/api/stock': this.createProxy('http://stock-app:3000'),
      '/api/menu': this.createProxy('http://menu-app:3000'),
      '/api/order': this.createProxy('http://order-app:3000'),
      '/uploads': this.createProxy('http://menu-app:3000'),
    };
  }

  private createProxy(target: string) {
    const proxyTimeout = this.configService.get<number>('PROXY_TIMEOUT', 10000);
    return createProxyMiddleware({
      target,
      changeOrigin: true,
      proxyTimeout,
      timeout: proxyTimeout,
      on: {
        proxyReq: fixRequestBody,
        proxyRes: (proxyRes) => {
          this.logger.debug(
            `Proxy response ${proxyRes.statusCode} from ${target}`,
          );
        },
        error: (err, _req, res) => {
          this.logger.error(`Proxy error for ${target}: ${err.message}`);
          if ((res as any).writeHead) {
            (res as any).writeHead(502, { 'Content-Type': 'application/json' });
            (res as any).end(
              JSON.stringify({
                statusCode: 502,
                message: 'Serviço temporariamente indisponível',
              }),
            );
          }
        },
      },
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const route = Object.keys(this.proxies).find((path) =>
      req.originalUrl.startsWith(path),
    );

    if (route) {
      // /uploads é arquivo estático — não precisa de auth, só proxy direto
      if (route === '/uploads') {
        req.url = req.originalUrl;
        return this.proxies[route](req, res, next);
      }

      const isSwaggerJson = req.originalUrl.split('?')[0].endsWith('/api-json');

      if (!isSwaggerJson) {
        // 1. Validar Autenticação e Tenancy antes de proxiar (apenas para requisições que não sejam do Swagger)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res
            .status(401)
            .json({ message: 'Token não fornecido ou inválido' });
        }

        const token = authHeader.substring(7);
        let payload: any;

        try {
          payload = this.jwtService.verify(token);
        } catch {
          return res
            .status(401)
            .json({ message: 'Token inválido ou expirado' });
        }

        // 2. Lógica de Tenancy Dinâmica
        // Apenas o header x-restaurant-id é confiável para tenancy
        const targetRestaurantId = req.headers['x-restaurant-id'] as string;

        let restaurantId = payload.restaurantId;
        let role = payload.role;

        // Se houver um restaurante alvo especificado ou se o usuário for um admin
        if (targetRestaurantId || payload.globalRoles?.includes('admin')) {
          const finalTargetId = targetRestaurantId || restaurantId;

          if (finalTargetId) {
            try {
              if (payload.globalRoles?.includes('admin')) {
                restaurantId = finalTargetId;
                role = UserRole.OWNER; // Admin age como OWNER
              } else if (finalTargetId !== payload.restaurantId) {
                const link =
                  await this.authService.validateUserRestaurantAccess(
                    payload.sub,
                    finalTargetId,
                  );
                restaurantId = finalTargetId;
                role = link.role;
              }
            } catch {
              return res
                .status(403)
                .json({ message: 'Acesso negado ao restaurante solicitado' });
            }
          }
        }

        // Injetar SEMPRE para que o microserviço tenha o contexto validado
        req.headers['x-user-id'] = payload.sub;
        req.headers['x-tenant-id'] = restaurantId;
        req.headers['x-user-role'] = role;
      }

      // 3. Preparar a URL e Proxiar
      let newUrl = req.originalUrl.replace(route, '');

      // Se for a spec do Swagger, encaminhamos direto para o /api-json do microserviço
      if (!isSwaggerJson) {
        if (route === '/api/stock') {
          // Stock items em /stock/*, fornecedores em /suppliers/* (mesmo app)
          if (!newUrl.startsWith('/suppliers')) {
            newUrl = '/stock' + newUrl;
          }
        } else if (route === '/api/menu') {
          newUrl = '/products' + newUrl;
        } else if (route === '/api/order') {
          // /api/order/stripe/* → /stripe/* (já está correto)
          // /api/order/* → /orders/*
          if (!newUrl.startsWith('/stripe')) {
            newUrl = '/orders' + newUrl;
          }
        }
      }

      req.url = newUrl;

      return this.proxies[route](req, res, next);
    }

    next();
  }
}
