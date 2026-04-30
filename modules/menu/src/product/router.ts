import { Router } from 'express';
import { 
    getOneProduct, 
    getAllProducts, 
    createOneProduct, 
    createManyProducts, 
    updateOneProduct, 
    deleteOneProduct, 
    deleteManyProducts,
    getAllUserProducts
} from './controller';

import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Aplica o authMiddleware globalmente para garantir token, userId e restaurantId
router.use(authMiddleware());

// Rota para pegar todos os produtos do usuário independente da filial
router.get('/user/all', getAllUserProducts);

router.get('/:id', getOneProduct);
router.get('/', getAllProducts);

router.post('/', createOneProduct);
router.post('/batch', createManyProducts);

router.patch('/:id', updateOneProduct);

// A regra de admin é composta com a authMiddleware global
router.delete('/:id', authMiddleware(['admin']), deleteOneProduct);
router.delete('/batch', authMiddleware(['admin']), deleteManyProducts);

export default router;
