import { Schema, model, Types } from "mongoose";

export interface ProductDocument {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  brand?: string;
  quantity: number;
  restaurantId: Types.ObjectId;
  userId: Types.ObjectId;
}

const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    restaurantId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, collection: "products" }
);

// Garante que name + brand + restaurantId + userId é único
productSchema.index({ name: 1, brand: 1, restaurantId: 1, userId: 1 }, { unique: true });

const ProductModel = model<ProductDocument>("Product", productSchema);
export default ProductModel;
