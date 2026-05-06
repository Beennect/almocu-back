import { Router } from 'express';
import { 
    createOrder, 
    getAllOrders, 
    getOrderById, 
    updateOrder,
    deleteOrder,
    getAllUserOrders
} from './controller';

import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Aplica o authMiddleware globalmente para garantir token, userId e restaurantId
router.use(authMiddleware());

router.get('/user/all', getAllUserOrders);
router.get('/', getAllOrders);
router.get('/:id', getOrderById);

router.post('/', createOrder);

router.patch('/:id', updateOrder);

router.delete('/:id', authMiddleware(['admin']), deleteOrder);

export default router;
