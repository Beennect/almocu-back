import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

export const authMiddleware = (roles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // Prioritizar contexto injetado pelo Gateway (x-tenant-id)
      const restaurantId = req.headers['x-tenant-id'] || req.headers['x-restaurant-id'] || decoded.restaurantId;
      const role = req.headers['x-user-role'] || decoded.role;

      (req as any).user = {
        ...decoded,
        restaurantId,
        role
      };

      if (roles.length > 0) {
        // Se o gateway passou x-user-role, usamos ele para a validação de cargo
        const activeRole = (req as any).user.role;
        const globalRoles = decoded.globalRoles || [];
        
        const hasRole = roles.includes(activeRole) || roles.some(r => globalRoles.includes(r));
        
        if (!hasRole) {
          return res.status(403).json({ message: 'Acesso negado: cargo insuficiente' });
        }
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
  };
};
