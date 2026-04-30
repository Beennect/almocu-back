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
} from '../src/product/controller';

const routes = Router();

routes.get('/product/:id', getOneProduct);
routes.get('/products/:restaurantId', getAllProducts);

routes.post('/product', createOneProduct);
routes.post('/products', createManyProducts);
routes.patch('/product/:id', updateProduct);
routes.post('/product/:id/adjust', adjustProductQuantity);

routes.delete('/product/:id', deleteOneProduct);
routes.delete('/products', deleteManyProducts);

export default routes;
