import mongoose from 'mongoose';

export const connectDatabase = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/almocu-order';
        await mongoose.connect(mongoUrl);
        console.log('MongoDB conectado com Mongoose');
    } catch (error) {
        console.error('Erro ao conectar no MongoDB:', error);
    }
};
