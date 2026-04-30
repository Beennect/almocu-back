import 'dotenv/config';
import express from 'express';
import { connectDatabase } from './data-source';
import { connectRedis } from './redis';
import swaggerUi from 'swagger-ui-express';

import productRouter from './product/router';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Swagger configuration
if (process.env.NODE_ENV === 'development') {
  const swaggerFile = require('../swagger-output.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));
  console.log("Swagger UI available at http://localhost:3200/api-docs");
}

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

app.get('/', (req, res) => {
  res.send('API de Cardápio (Menu) funcionando! Acesse /api-docs para documentação.');
});

const start = async () => {
  console.log("Iniciando microserviço de Menu...");
  
  console.log("Conectando ao MongoDB...");
  await connectDatabase();
  console.log("MongoDB conectado!");

  console.log("Conectando ao Redis...");
  await connectRedis();
  console.log("Redis finalizado (conectado ou em fallback)!");

  const HOST = '0.0.0.0';
  app.listen(Number(PORT), HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Swagger disponível em http://localhost:3200/api-docs`);
  });
};

start().catch((error) => console.log(error));