import { Request, Response } from "express";
import { ProductService } from "./service";

const service = new ProductService();

/**
 * Helper para extrair dados do usuário do token (req.user)
 */
const getAuthData = (req: Request) => {
  const user = (req as any).user;
  if (!user || !user._id) {
    throw new Error("Usuário não autenticado ou token inválido");
  }
  return {
    userId: user._id as string,
    restaurantId: user.restaurantId as string, // Assumindo que o restaurantId vem no token
  };
};

export async function getOneProduct(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  try {
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    const product = await service.getOne(id, userId, restaurantId);
    if (!product) return res.status(404).json({ message: "Produto não encontrado nesta filial" });
    return res.json(product);
  } catch (error: any) {
    return res.status(error.message.includes("autenticado") ? 401 : 500).json({ message: error.message });
  }
}

/**
 * Retorna produtos da filial atual (vinda do token)
 */
export async function getAllProducts(req: Request, res: Response) {
  try {
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    const products = await service.getMany(userId, restaurantId);
    if (products.length === 0) return res.json({ message: "Lista de produtos vazia.", data: [] });
    return res.json(products);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * Retorna TODOS os produtos de TODAS as filiais do usuário
 */
export async function getAllUserProducts(req: Request, res: Response) {
  try {
    const { userId } = getAuthData(req);
    const products = await service.getAllFromUser(userId);
    return res.json(products);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createOneProduct(req: Request, res: Response) {
  const { name, brand, quantity } = req.body;

  try {
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    if (!name || quantity === undefined) {
      return res.status(400).json({ message: "Por favor, preencha os dados obrigatórios!" });
    }

    const product = await service.createOne({ name, brand, quantity, restaurantId, userId });
    return res.status(201).json(product);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno na criação do produto." });
  }
}

export async function createManyProducts(req: Request, res: Response) {
  try {
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "Lista de produtos inválida!" });
    }

    const preparedData = req.body.map(item => ({
      ...item,
      userId,
      restaurantId: item.restaurantId || restaurantId // Prioriza o do item se vier, senão o do token
    }));

    const products = await service.createMany(preparedData);
    return res.status(201).json(products);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno na criação dos produtos." });
  }
}

export async function updateProduct(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;
  const { name, brand, quantity } = req.body;

  try {
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    const product = await service.updateOne(id, userId, restaurantId, { name, brand, quantity });
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
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    if (delta === undefined || typeof delta !== "number") {
      return res.status(400).json({ message: "Delta inválido" });
    }

    const product = await service.adjustQuantity(id, userId, restaurantId, delta);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    return res.json(product);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno na atualização da quantidade." });
  }
}

export async function deleteOneProduct(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  try {
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    const result = await service.deleteOne(id, userId, restaurantId);
    if (!result) return res.status(404).json({ message: "Produto não encontrado" });
    return res.status(200).json({ message: "Produto deletado com sucesso!" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno ao deletar o produto." });
  }
}

export async function deleteManyProducts(req: Request, res: Response) {
  const { ids } = req.body;

  try {
    const { userId, restaurantId } = getAuthData(req);
    if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Erro ao deletar os produtos" });
    }

    const result = await service.deleteMany(ids, userId, restaurantId);
    if (result.deletedCount === 0) return res.status(404).json({ message: "Nenhum produto encontrado!" });
    return res.status(200).json({ message: "Produto(s) deletado(s) com sucesso!" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erro interno ao deletar os produtos." });
  }
}
