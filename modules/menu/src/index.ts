import 'dotenv/config';
import express from 'express';
import { connectDatabase } from './data-source';
import { connectRedis } from './redis';
import swaggerUi from 'swagger-ui-express';

import productRouter from './product/router';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const swaggerFile = require('../swagger-output.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// rotas
app.use('/product', productRouter);

// lidar com erros de json
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError) 
  {
    console.log("JSON inválido")
    return res.status(400).json("JSON inválido");
  }

  console.log(`Erro interno. Mais informações: \n ${err}`)
  return res.status(500).json("Erro interno! Cheque o terminal");
});

const start = async () => {
  await connectDatabase();
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((error) => console.log(error));