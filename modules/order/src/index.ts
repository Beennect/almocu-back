import 'dotenv/config';
import express from 'express';
import { connectDatabase } from './data-source';
import swaggerUi from 'swagger-ui-express';

import orderRouter from './order/router';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Rotas
app.use('/orders', orderRouter);

// Swagger
const swaggerFile = require('../swagger-output.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Tratamento de erros de JSON inválido
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError) {
        console.log('JSON inválido');
        return res.status(400).json({ message: 'JSON inválido' });
    }

    console.log(`Erro interno. Mais informações:\n ${err}`);
    return res.status(500).json({ message: 'Erro interno! Cheque o terminal' });
});

const start = async () => {
    await connectDatabase();

    app.listen(PORT, () => {
        console.log(`Server rodando na porta ${PORT}`);
        console.log(`Documentação disponível em http://localhost:${PORT}/api-docs`);
    });
};

start().catch((error) => console.log(error));
