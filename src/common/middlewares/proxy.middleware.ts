import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../auth/auth.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
  ) {}

  private proxies: Record<string, any> = {
    '/api/stock': createProxyMiddleware({
      target: 'http://stock-app:3000',
      changeOrigin: true,
      on: {
        proxyReq: fixRequestBody,
      },
    }),
    '/api/menu': createProxyMiddleware({
      target: 'http://menu-app:3000',
      changeOrigin: true,
      on: {
        proxyReq: fixRequestBody,
      },
    }),
    '/api/order': createProxyMiddleware({
      target: 'http://order-app:3000',
      changeOrigin: true,
      on: {
        proxyReq: fixRequestBody,
      },
    }),
  };

  async use(req: Request, res: Response, next: NextFunction) {
    const route = Object.keys(this.proxies).find(path => req.originalUrl.startsWith(path));
    
    if (route) {
      // 1. Validar Autenticação e Tenancy antes de proxiar
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token não fornecido ou inválido' });
      }

      const token = authHeader.substring(7);
      let payload: any;
      
      try {
        payload = this.jwtService.verify(token);
      } catch (e) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
      }

      // 2. Lógica de Tenancy Dinâmica (x-restaurant-id)
      const headerRestaurantId = req.headers['x-restaurant-id'] as string;
      let restaurantId = payload.restaurantId;
      let role = payload.role;

      if (headerRestaurantId && headerRestaurantId !== restaurantId) {
        try {
          const link = await this.authService.validateUserRestaurantAccess(payload.sub, headerRestaurantId);
          restaurantId = headerRestaurantId;
          role = link.role;
          
          // Importante: Para que o microserviço saiba o contexto correto,
          // podemos injetar headers específicos que o microserviço confie.
          req.headers['x-user-id'] = payload.sub;
          req.headers['x-tenant-id'] = restaurantId;
          req.headers['x-user-role'] = role;
        } catch (e) {
          return res.status(403).json({ message: 'Acesso negado ao restaurante solicitado' });
        }
      }

      // 3. Preparar a URL e Proxiar
      let newUrl = req.originalUrl.replace(route, '');
      
      if (route === '/api/stock') {
        newUrl = '/stock' + newUrl;
      }
      
      req.url = newUrl;
      
      return this.proxies[route](req, res, next);
    }
    
    next();
  }
}
