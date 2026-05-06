import { Request, Response, NextFunction } from 'express';
export declare const authMiddleware: (roles?: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
