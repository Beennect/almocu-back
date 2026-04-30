import mongoose from "mongoose";

export const connectDatabase = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/almocu";
        await mongoose.connect(mongoUrl);
        console.log(`MongoDB connected with Mongoose`);
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
};