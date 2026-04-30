import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
    name: string;
    brand: string;
    price: number;
    description?: string;
    stockProductId: string;
    restaurantId: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
    name: { type: String, required: true },
    brand: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    stockProductId: { type: String, required: true },
    restaurantId: { type: String, required: true },
    userId: { type: String, required: true }
}, {
    timestamps: true
});

// Um produto é duplicado quando tem o mesmo nome + marca + restaurante + usuario
ProductSchema.index({ name: 1, brand: 1, restaurantId: 1, userId: 1 }, { unique: true });

export const ProductModel = model<IProduct>("Product", ProductSchema);