import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
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

  use(req: Request, res: Response, next: NextFunction) {
    const route = Object.keys(this.proxies).find(path => req.originalUrl.startsWith(path));
    
    if (route) {
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
