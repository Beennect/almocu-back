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
      
      // Cast para 'any' para evitar erro de tipagem do Express no build
      (req as any).user = decoded;

      // Se pedirmos roles específicas, verificamos aqui
      if (roles.length > 0) {
        const userRoles = decoded.roles || [];
        const hasRole = roles.some(role => userRoles.includes(role));
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
