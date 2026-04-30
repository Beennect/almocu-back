import { Request, Response } from "express";
import { ProductService } from "./service";

const service = new ProductService();

export async function getOneProduct(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  try {
    const product = await service.getOne(id);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: "Erro interno na busca do produto." });
  }
}

export async function getAllProducts(req: Request<{ restaurantId: string }>, res: Response) {
  const { restaurantId } = req.params;

  try {
    const products = await service.getMany(restaurantId);
    if (products.length === 0) return res.json({ message: "Lista de produtos vazia." });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: "Erro interno na busca dos produtos." });
  }
}

export async function createOneProduct(req: Request, res: Response) {
  const { name, brand, quantity, restaurantId } = req.body;

  try {
    if (!name || quantity === undefined || restaurantId === undefined) {
      return res.status(400).json({ message: "Por favor, preencha os dados obrigatórios!" });
    }

    const product = await service.createOne({ name, brand, quantity, restaurantId });
    return res.status(201).json(product);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno na criação do produto." });
  }
}

export async function createManyProducts(req: Request, res: Response) {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "Lista de produtos inválida!" });
    }

    const products = await service.createMany(req.body);
    return res.status(201).json(products);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno na criação dos produtos." });
  }
}

export async function updateProduct(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;
  const { name, brand, quantity, restaurantId } = req.body;

  try {
    const product = await service.updateOne(id, { name, brand, quantity, restaurantId });
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    return res.json(product);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno na atualização do produto." });
  }
}

export async function adjustProductQuantity(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;
  const { delta } = req.body;

  try {
    if (delta === undefined || typeof delta !== "number") {
      return res.status(400).json({ message: "Delta inválido" });
    }

    const product = await service.adjustQuantity(id, delta);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    return res.json(product);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno na atualização da quantidade." });
  }
}

export async function deleteOneProduct(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  try {
    const result = await service.deleteOne(id);
    if (!result) return res.status(404).json({ message: "Produto não encontrado" });
    return res.status(200).json({ message: "Produto deletado com sucesso!" });
  } catch (error) {
    return res.status(500).json({ message: "Erro interno ao deletar o produto." });
  }
}

export async function deleteManyProducts(req: Request<{ ids: string[] }>, res: Response) {
  const { ids } = req.body;

  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Erro ao deletar os produtos" });
    }

    const result = await service.deleteMany(ids);
    if (result.deletedCount === 0) return res.status(404).json({ message: "Nenhum produto encontrado!" });
    return res.status(200).json({ message: "Produto(s) deletado(s) com sucesso!" });
  } catch (error) {
    return res.status(500).json({ message: "Erro interno ao deletar os produtos." });
  }
}
