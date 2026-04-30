import { Types } from "mongoose";
import ProductModel, { ProductDocument } from "./model";

type CreateProductInput = {
  name: string;
  brand?: string;
  quantity: number;
  restaurantId: string;
  userId: string;
};

type UpdateProductInput = {
  name?: string;
  brand?: string;
  quantity?: number;
  restaurantId?: string | Types.ObjectId;
};

export class ProductService {
  /**
   * Retorna um produto específico garantindo que pertença ao usuário e restaurante corretos.
   */
  public async getOne(id: string, userId: string, restaurantId: string): Promise<ProductDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!Types.ObjectId.isValid(userId)) return null;
    if (!Types.ObjectId.isValid(restaurantId)) return null;

    return ProductModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
    });
  }

  /**
   * Retorna todos os produtos de uma filial específica do usuário.
   */
  public async getMany(userId: string, restaurantId: string): Promise<ProductDocument[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    if (!Types.ObjectId.isValid(restaurantId)) return [];

    return ProductModel.find({
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
    });
  }

  /**
   * Retorna todos os produtos de todas as filiais do usuário.
   */
  public async getAllFromUser(userId: string): Promise<ProductDocument[]> {
    if (!Types.ObjectId.isValid(userId)) return [];

    return ProductModel.find({
      userId: new Types.ObjectId(userId),
    });
  }

  public async createOne(data: CreateProductInput): Promise<ProductDocument> {
    if (!data.name || data.name.trim() === "") throw new Error("Nome do produto é obrigatório");
    if (data.quantity < 0) throw new Error("Quantidade inválida");
    if (!Types.ObjectId.isValid(data.restaurantId)) throw new Error("ID do restaurante inválido");
    if (!Types.ObjectId.isValid(data.userId)) throw new Error("ID do usuário inválido");

    const cleanName = data.name.trim();
    const restaurantObjectId = new Types.ObjectId(data.restaurantId);
    const userObjectId = new Types.ObjectId(data.userId);

    const productFound = await ProductModel.findOne({
      name: cleanName,
      brand: data.brand?.trim() || "",
      restaurantId: restaurantObjectId,
      userId: userObjectId,
    });

    if (productFound) throw new Error(`Produto ${productFound.name} (${productFound.brand || "sem marca"}) já existe!`);

    return ProductModel.create({
      name: cleanName,
      brand: data.brand || "",
      quantity: data.quantity,
      restaurantId: restaurantObjectId,
      userId: userObjectId,
    });
  }

  public async createMany(data: CreateProductInput[]): Promise<ProductDocument[]> {
    if (!data || data.length === 0) throw new Error("Lista de produtos vazia");

    const prepared = data.map((item) => {
      if (!item.name || item.name.trim() === "") throw new Error("Nome do produto é obrigatório");
      if (item.quantity < 0) throw new Error(`Quantidade inválida para ${item.name}`);
      if (!Types.ObjectId.isValid(item.restaurantId)) throw new Error("ID do restaurante inválido");
      if (!Types.ObjectId.isValid(item.userId)) throw new Error("ID do usuário inválido");

      return {
        name: item.name.trim(),
        brand: item.brand || "",
        quantity: item.quantity,
        restaurantId: new Types.ObjectId(item.restaurantId),
        userId: new Types.ObjectId(item.userId),
      };
    });

    for (const item of prepared) {
      const productFound = await ProductModel.findOne({
        name: item.name,
        brand: item.brand,
        restaurantId: item.restaurantId,
        userId: item.userId,
      });

      if (productFound) throw new Error(`Produto ${productFound.name} (${productFound.brand || "sem marca"}) já existe!`);
    }

    return ProductModel.insertMany(prepared);
  }

  public async updateOne(id: string, userId: string, restaurantId: string, data: UpdateProductInput): Promise<ProductDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!data || Object.keys(data).length === 0) throw new Error("Nenhum dado para atualizar");

    const updates: any = {};

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

    // Nota: restaurantId pode ser alterado se o produto for movido de filial,
    // mas deve-se manter o vínculo com o usuário.
    if (data.restaurantId !== undefined) {
      if (!Types.ObjectId.isValid(data.restaurantId)) throw new Error("ID do restaurante inválido");
      updates.restaurantId = new Types.ObjectId(data.restaurantId);
    }

    const filter = {
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
    };

    if (updates.name || updates.restaurantId) {
      const duplicateQuery: any = { 
        _id: { $ne: new Types.ObjectId(id) },
        userId: new Types.ObjectId(userId)
      };
      duplicateQuery.name = updates.name || data.name;
      duplicateQuery.restaurantId = updates.restaurantId || new Types.ObjectId(restaurantId);
      
      const productFound = await ProductModel.findOne(duplicateQuery);
      if (productFound) throw new Error(`Produto ${productFound.name} (${productFound.brand || "sem marca"}) já existe nesta filial!`);
    }

    return ProductModel.findOneAndUpdate(filter, updates, { new: true });
  }

  public async adjustQuantity(id: string, userId: string, restaurantId: string, delta: number): Promise<ProductDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (typeof delta !== "number" || Number.isNaN(delta)) throw new Error("Delta inválido");

    const filter = {
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
    };

    const product = await ProductModel.findOne(filter);
    if (!product) return null;

    const updatedQuantity = product.quantity + delta;
    if (updatedQuantity < 0) throw new Error("Quantidade resultante não pode ser negativa");

    return ProductModel.findOneAndUpdate(filter, { quantity: updatedQuantity }, { new: true });
  }

  public async deleteOne(id: string, userId: string, restaurantId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;

    const filter = {
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
    };

    const deleted = await ProductModel.findOneAndDelete(filter);
    return deleted !== null;
  }

  public async deleteMany(ids: string[], userId: string, restaurantId: string): Promise<{ deletedCount: number }> {
    if (!ids || ids.length === 0) return { deletedCount: 0 };

    const validIds = ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
    if (validIds.length === 0) return { deletedCount: 0 };

    const filter = {
      _id: { $in: validIds },
      userId: new Types.ObjectId(userId),
      restaurantId: new Types.ObjectId(restaurantId),
    };

    const result = await ProductModel.deleteMany(filter);
    return { deletedCount: result.deletedCount ?? 0 };
  }
}
