import 'dotenv/config';
import express from 'express';
import { connectDatabase } from './config/data-source';
import swaggerUi from 'swagger-ui-express';

import orderRouter from './order/router';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Rotas
app.use('/orders', orderRouter);

// Swagger configuration
if (process.env.NODE_ENV === 'development') {
    const swaggerFile = require('../swagger-output.json');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));
    console.log("Swagger UI available at http://localhost:3300/api-docs");
}

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

    const HOST = '0.0.0.0';
    app.listen(Number(PORT), HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
    });
};

start().catch((error) => console.log(error));
