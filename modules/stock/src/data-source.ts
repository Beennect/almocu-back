import mongoose from "mongoose";

export async function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/almocu";
  return mongoose.connect(uri);
}
