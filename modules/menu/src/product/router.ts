import { Router } from 'express';
import { 
    getOneProduct, 
    getAllProducts, 
    createOneProduct, 
    createManyProducts, 
    updateOneProduct, 
    deleteOneProduct, 
    deleteManyProducts 
} from './controller';

import { authMiddleware } from '../auth.middleware';

const router = Router();

router.get('/:id', getOneProduct);
router.get('/', getAllProducts);

router.post('/', authMiddleware(), createOneProduct);
router.post('/batch', authMiddleware(), createManyProducts);

router.patch('/:id', authMiddleware(), updateOneProduct);

router.delete('/:id', authMiddleware(['admin']), deleteOneProduct);
router.delete('/batch', authMiddleware(['admin']), deleteManyProducts);

export default router;
