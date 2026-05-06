"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = require("express");
const data_source_1 = require("./config/data-source");
const swagger_ui_express_1 = require("swagger-ui-express");
const router_1 = require("./order/router");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/orders', router_1.default);
if (process.env.NODE_ENV === 'development') {
    const swaggerFile = require('../swagger-output.json');
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerFile));
    console.log("Swagger UI available at http://localhost:3300/api-docs");
}
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
    const HOST = '0.0.0.0';
    app.listen(Number(PORT), HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
    });
};
start().catch((error) => console.log(error));
//# sourceMappingURL=index.js.map