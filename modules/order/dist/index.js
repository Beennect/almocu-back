"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const data_source_1 = require("./data-source");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const router_1 = __importDefault(require("./order/router"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
// Rotas
app.use('/orders', router_1.default);
// Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Order API',
            version: '1.0.0',
            description: 'API para gerenciamento de pedidos do restaurante',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Servidor local',
            },
        ],
    },
    apis: ['./src/order/*.ts'],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
// Tratamento de erros de JSON inválido
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError) {
        console.log('JSON inválido');
        return res.status(400).json({ message: 'JSON inválido' });
    }
    console.log(`Erro interno. Mais informações:\n ${err}`);
    return res.status(500).json({ message: 'Erro interno! Cheque o terminal' });
});
const start = async () => {
    await (0, data_source_1.connectDatabase)();
    app.listen(PORT, () => {
        console.log(`Server rodando na porta ${PORT}`);
        console.log(`Documentação disponível em http://localhost:${PORT}/api-docs`);
    });
};
start().catch((error) => console.log(error));
