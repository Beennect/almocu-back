import { Router } from "express";
import {
  createManyProducts,
  createOneProduct,
  updateProduct,
  adjustProductQuantity,
  deleteManyProducts,
  deleteOneProduct,
  getAllProducts,
  getOneProduct,
} from '../product/controller';

import { authMiddleware } from '../middlewares/auth.middleware';

const routes = Router();

routes.get('/product/:id', getOneProduct);
routes.get('/products/:restaurantId', getAllProducts);

routes.post('/product', authMiddleware(), createOneProduct);
routes.post('/products', authMiddleware(), createManyProducts);
routes.patch('/product/:id', authMiddleware(), updateProduct);
routes.post('/product/:id/adjust', authMiddleware(), adjustProductQuantity);

routes.delete('/product/:id', authMiddleware(['admin']), deleteOneProduct);
routes.delete('/products', authMiddleware(['admin']), deleteManyProducts);

export default routes;
