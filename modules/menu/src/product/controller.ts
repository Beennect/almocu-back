import { Request, Response } from 'express';
import { ProductService } from "./service";

const service = new ProductService();

const getAuthData = (req: Request) => {
    const user = (req as any).user;
    if (!user || !user._id) {
        throw new Error("Usuário não autenticado ou token inválido");
    }
    return {
        userId: user._id as string,
        restaurantId: user.restaurantId as string,
    };
};

export async function getOneProduct(req: Request, res: Response)
{
    const { id } = req.params;

    try 
    {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

        let product = await service.getOne(id as string, userId, restaurantId);

        if (!product) return res.status(404).json({message: "Produto não encontrado nesta filial"});

        return res.json(product);
    }
    catch (error: any)
    {
        console.log(error);
        return res.status(500).json({message: "Erro interno na busca do produto.", err: error.message || error});
    }
}

export async function getAllProducts(req: Request, res: Response)
{
    try 
    {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

        let products = await service.getMany(userId, restaurantId);

        if (products.length === 0) return res.json({message: "Lista de produtos vazia nesta filial."});

        return res.json(products);
    }
    catch (error: any)
    {
        return res.status(500).json({message: "Erro interno na busca dos produtos.", err: error.message || error});
    }
}

export async function getAllUserProducts(req: Request, res: Response)
{
    try 
    {
        const { userId } = getAuthData(req);

        let products = await service.getAllFromUser(userId);

        if (products.length === 0) return res.json({message: "Lista de produtos vazia para este usuário."});

        return res.json(products);
    }
    catch (error: any)
    {
        return res.status(500).json({message: "Erro interno na busca dos produtos.", err: error.message || error});
    }
}

export async function createOneProduct(req: Request, res: Response)
{
    const {name, brand, price, description, stockProductId} = req.body;

    try 
    {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

        if (!name || !brand || price === undefined || !stockProductId)
        {
            return res.status(400).json({message: "Por favor, preencha os dados obrigatórios (name, brand, price, stockProductId)!"})
        }
        
        const product = await service.createOne(name, brand, price, description, stockProductId, userId, restaurantId);
            
        return res.status(201).json(product);
    }
    catch(error: any)
    {
        if (error.message?.includes("Já existe")) {
            return res.status(409).json({ message: error.message });
        }
        console.log(error);
        return res.status(500).json({message: "Erro interno na criação do produto."})
    }
}

export async function createManyProducts(req: Request, res: Response)
{
    try 
    {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

        const payload = req.body.map((item: any) => ({
            ...item,
            userId,
            restaurantId
        }));

        const products = await service.createMany(payload);
        return res.status(201).json(products);
    }
    catch(error: any) 
    {
        if (error.message?.includes("Já exist")) {
            return res.status(409).json({ message: error.message });
        }
        return res.status(500).json({message: "Erro interno na criação dos produtos!"});
    }
}

export async function deleteOneProduct(req: Request, res: Response)
{
    const { id } = req.params;

    try 
    {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

        const deletedProduct = await service.deleteOne(id as string, userId, restaurantId);

        if (!deletedProduct) return res.status(404).json({ message: "Produto não encontrado nesta filial" });

        return res.status(200).json({ message: "Produto deletado com sucesso!"});
    }
    catch (error)
    {
        return res.status(500).json({ message: "Erro interno ao deletar o produto." });
    }
}

export async function deleteManyProducts(req: Request, res: Response)
{
    const { ids } = req.body;

    try 
    {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

        if (!ids || !Array.isArray(ids) || ids.length === 0) 
            return res.status(400).json({message: "Dados inválidos para deleção"});

        const result = await service.deleteMany(ids, userId, restaurantId); 

        if (result.deletedCount === 0) return res.status(400).json({message: "Nenhum produto encontrado nesta filial!"});

        return res.status(200).json({message: `${result.deletedCount} produto(s) deletado(s) com sucesso!`})
    }
    catch (error) 
    {
        return res.status(500).json({message: "Erro interno ao deletar o(s) produto(s)"})
    }
}

export async function updateOneProduct(req: Request, res: Response)
{
    const { id } = req.params;
    const data = req.body;

    try {
        const { userId, restaurantId } = getAuthData(req);
        if (!restaurantId) return res.status(400).json({ message: "ID do restaurante não encontrado no token" });

        // Remover userId e restaurantId do payload de update se enviados maliciosamente
        delete data.userId;
        delete data.restaurantId;

        const product = await service.updateOne(id as string, userId, restaurantId, data);
        return res.json(product);
    } catch (error: any) {
        if (error.message?.includes("Já existe")) {
            return res.status(409).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message || "Erro interno ao atualizar produto" });
    }
}