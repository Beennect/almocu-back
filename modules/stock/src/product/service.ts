import { Types } from "mongoose";
import ProductModel, { ProductDocument } from "./model";

type CreateProductInput = {
  name: string;
  brand?: string;
  quantity: number;
  restaurantId: string;
};

type UpdateProductInput = {
  name?: string;
  brand?: string;
  quantity?: number;
  restaurantId?: string | Types.ObjectId;
};

export class ProductService {
  public async getOne(id: string): Promise<ProductDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return ProductModel.findById(id);
  }

  public async getMany(restaurantId: string): Promise<ProductDocument[]> {
    if (!Types.ObjectId.isValid(restaurantId)) return [];
    return ProductModel.find({ restaurantId: new Types.ObjectId(restaurantId) });
  }

  public async createOne(data: CreateProductInput): Promise<ProductDocument> {
    if (!data.name || data.name.trim() === "") throw new Error("Nome do produto é obrigatório");
    if (data.quantity < 0) throw new Error("Quantidade inválida");
    if (!Types.ObjectId.isValid(data.restaurantId)) throw new Error("ID do restaurante inválido");

    const cleanName = data.name.trim();
    const restaurantObjectId = new Types.ObjectId(data.restaurantId);

    const productFound = await ProductModel.findOne({
      name: cleanName,
      brand: data.brand?.trim() || "",
      restaurantId: restaurantObjectId,
    });

    if (productFound) throw new Error(`Produto ${productFound.name} (${productFound.brand || "sem marca"}) já existe!`);

    return ProductModel.create({
      name: cleanName,
      brand: data.brand || "",
      quantity: data.quantity,
      restaurantId: restaurantObjectId,
    });
  }

  public async createMany(data: CreateProductInput[]): Promise<ProductDocument[]> {
    if (!data || data.length === 0) throw new Error("Lista de produtos vazia");

    const prepared = data.map((item) => {
      if (!item.name || item.name.trim() === "") throw new Error("Nome do produto é obrigatório");
      if (item.quantity < 0) throw new Error(`Quantidade inválida para ${item.name}`);
      if (!Types.ObjectId.isValid(item.restaurantId)) throw new Error("ID do restaurante inválido");

      return {
        name: item.name.trim(),
        brand: item.brand || "",
        quantity: item.quantity,
        restaurantId: new Types.ObjectId(item.restaurantId),
      };
    });

    for (const item of prepared) {
      const productFound = await ProductModel.findOne({
        name: item.name,
        brand: item.brand,
        restaurantId: item.restaurantId,
      });

      if (productFound) throw new Error(`Produto ${productFound.name} (${productFound.brand || "sem marca"}) já existe!`);
    }

    return ProductModel.insertMany(prepared);
  }

  public async updateOne(id: string, data: UpdateProductInput): Promise<ProductDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!data || Object.keys(data).length === 0) throw new Error("Nenhum dado para atualizar");

    const updates: Partial<UpdateProductInput> = {};

    if (data.name !== undefined) {
      if (data.name.trim() === "") throw new Error("Nome do produto é obrigatório");
      updates.name = data.name.trim();
    }

    if (data.brand !== undefined) {
      updates.brand = data.brand;
    }

    if (data.quantity !== undefined) {
      if (data.quantity < 0) throw new Error("Quantidade inválida");
      updates.quantity = data.quantity;
    }

    if (data.restaurantId !== undefined) {
      if (!Types.ObjectId.isValid(data.restaurantId)) throw new Error("ID do restaurante inválido");
      updates.restaurantId = new Types.ObjectId(data.restaurantId);
    }

    if (updates.name || updates.restaurantId) {
      const duplicateQuery: any = { _id: { $ne: new Types.ObjectId(id) } };
      if (updates.name) duplicateQuery.name = updates.name;
      if (updates.restaurantId) duplicateQuery.restaurantId = updates.restaurantId;
      const productFound = await ProductModel.findOne(duplicateQuery);
      if (productFound) throw new Error(`Produto ${productFound.name} (${productFound.brand || "sem marca"}) já existe!`);
    }

    return ProductModel.findByIdAndUpdate(id, updates, { new: true });
  }

  public async adjustQuantity(id: string, delta: number): Promise<ProductDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (typeof delta !== "number" || Number.isNaN(delta)) throw new Error("Delta inválido");

    const product = await ProductModel.findById(id);
    if (!product) return null;

    const updatedQuantity = product.quantity + delta;
    if (updatedQuantity < 0) throw new Error("Quantidade resultante não pode ser negativa");

    return ProductModel.findByIdAndUpdate(id, { quantity: updatedQuantity }, { new: true });
  }

  public async deleteOne(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;

    const deleted = await ProductModel.findByIdAndDelete(id);
    return deleted !== null;
  }

  public async deleteMany(ids: string[]): Promise<{ deletedCount: number }> {
    if (!ids || ids.length === 0) return { deletedCount: 0 };

    const validIds = ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
    if (validIds.length === 0) return { deletedCount: 0 };

    const result = await ProductModel.deleteMany({ _id: { $in: validIds } });
    return { deletedCount: result.deletedCount ?? 0 };
  }
}
