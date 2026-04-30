import express from 'express';
import { connectDb } from './data-source';
import routes from "./routes/routes";
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const app = express();

app.use(express.json());
app.use("/stock", routes);

// Rota de teste para validar conectividade
app.get('/', (req, res) => {
  res.send('API de Estoque (nosherp) está funcionando! Acesse /api-docs para a documentação.');
});

// Swagger configuration
if (process.env.NODE_ENV === 'development') {
  const swaggerFile = require('./swagger-output.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));
  console.log("Swagger UI available at http://localhost:3100/api-docs");
}

connectDb()
  .then(() => {
      console.log("Database connected");

      const PORT = 3100;
      const HOST = '0.0.0.0';
      app.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
        console.log(`Local access: http://localhost:${PORT}`);
      });
    })
  .catch((error) => console.log(error));

// lidar com erros de json
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError) {
    console.log("JSON inválido");
    return res.status(400).json("JSON inválido");
  }

  console.log(`Erro interno. Mais informações: \n ${err}`);
  return res.status(500).json("Erro interno! Cheque o terminal");
});
