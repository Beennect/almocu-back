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
  getAllUserProducts,
} from '../product/controller';

import { authMiddleware } from '../middlewares/auth.middleware';

const routes = Router();

// Aplica authMiddleware em todas as rotas para garantir que temos o userId e restaurantId
routes.use(authMiddleware());

routes.get('/product/:id', getOneProduct);

// Retorna produtos da filial atual do token
routes.get('/products', getAllProducts);

// Retorna produtos de TODAS as filiais do usuário
routes.get('/user/products', getAllUserProducts);

routes.post('/product', createOneProduct);
routes.post('/products', createManyProducts);
routes.patch('/product/:id', updateProduct);
routes.post('/product/:id/adjust', adjustProductQuantity);

// Rotas administrativas (ainda exigindo role admin se necessário, 
// mas o authMiddleware base já foi aplicado acima)
routes.delete('/product/:id', authMiddleware(['admin']), deleteOneProduct);
routes.delete('/products', authMiddleware(['admin']), deleteManyProducts);

export default routes;
