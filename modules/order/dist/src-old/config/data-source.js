"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = require("mongoose");
const connectDatabase = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/almocu-order';
        await mongoose_1.default.connect(mongoUrl);
        console.log('MongoDB conectado com Mongoose');
    }
    catch (error) {
        console.error('Erro ao conectar no MongoDB:', error);
    }
};
exports.connectDatabase = connectDatabase;
//# sourceMappingURL=data-source.js.map