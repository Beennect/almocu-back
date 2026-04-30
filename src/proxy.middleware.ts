import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private proxies: Record<string, any> = {
    '/api/stock': createProxyMiddleware({
      target: 'http://stock-app:3100',
      changeOrigin: true,
      pathRewrite: { '^/api/stock': '' },
    }),
    '/api/menu': createProxyMiddleware({
      target: 'http://menu-app:3000',
      changeOrigin: true,
      pathRewrite: { '^/api/menu': '' },
    }),
    '/api/order': createProxyMiddleware({
      target: 'http://order-app:3000',
      changeOrigin: true,
      pathRewrite: { '^/api/order': '' },
    }),
  };

  use(req: Request, res: Response, next: NextFunction) {
    const originalUrl = req.originalUrl;
    const route = Object.keys(this.proxies).find(path => originalUrl.startsWith(path));
    
    if (route) {
      // Sincroniza req.url com originalUrl para o pathRewrite do proxy funcionar corretamente
      req.url = originalUrl;
      return this.proxies[route](req, res, next);
    }
    
    next();
  }
}
