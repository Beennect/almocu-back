import { Request, Response } from 'express';
export declare function createOrder(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getOrderById(req: Request<{
    id: string;
}>, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getAllOrders(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getAllUserOrders(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function updateOrder(req: Request<{
    id: string;
}>, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function deleteOrder(req: Request<{
    id: string;
}>, res: Response): Promise<Response<any, Record<string, any>>>;
