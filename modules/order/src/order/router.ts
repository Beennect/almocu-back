import { Router } from 'express';
import { 
    createOrder, 
    getAllOrders, 
    getOrderById, 
    updateOrder 
} from './controller';

import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getAllOrders);
router.get('/:id', getOrderById);

router.post('/', authMiddleware(), createOrder);

router.patch('/:id', authMiddleware(), updateOrder);

export default router;
