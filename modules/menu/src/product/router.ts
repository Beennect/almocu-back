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

router.post('/', createOneProduct);
router.post('/batch', createManyProducts);

router.patch('/:id', updateOneProduct);

router.delete('/:id', authMiddleware(['admin']), deleteOneProduct);
router.delete('/batch', authMiddleware(['admin']), deleteManyProducts);

export default router;
