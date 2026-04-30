import { Request, Response } from 'express';
import { ProductService } from "./service";

const service = new ProductService();

export async function getOneProduct(req: Request, res: Response)
{
    const { id } = req.params;
    const { restaurantId } = req.query;

    if (!restaurantId) return res.status(400).json({ message: "restaurantId é obrigatório" });

    try 
    {
        let product = await service.getOne(id as string, restaurantId as string);

        if (!product) return res.status(404).json({message: "Produto não encontrado"});

        return res.json(product);
    }
    catch (error)
    {
        console.log(error);
        return res.status(500).json({message: "Erro interno na busca do produto.", err: error});
    }
}

export async function getAllProducts(req: Request, res: Response)
{
    const { restaurantId } = req.query;

    if (!restaurantId) return res.status(400).json({ message: "restaurantId é obrigatório" });

    try 
    {
        let products = await service.getAll(restaurantId as string);

        if (products.length === 0) return res.json({message: "Lista de produtos vazia."});

        return res.json(products);
    }
    catch (error)
    {
        return res.status(500).json({message: "Erro interno na busca dos produtos."})
    }
}

export async function createOneProduct(req: Request, res: Response)
{
    const {name, brand, price, description, restaurantId} = req.body;

    try 
    {
        if (!name || !brand || price === undefined || !restaurantId)
        {
            return res.status(400).json({message: "Por favor, preencha os dados obrigatórios (name, brand, price, restaurantId)!"})
        }
        
        const product = await service.createOne(name, brand, price, description, restaurantId);
            
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
        const products = await service.createMany(req.body);
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
    const { restaurantId } = req.query;

    if (!restaurantId) return res.status(400).json({ message: "restaurantId é obrigatório" });

    try 
    {
        const deletedProduct = await service.deleteOne(id as string, restaurantId as string);

        if (!deletedProduct) return res.status(404).json({ message: "Produto não encontrado" });

        return res.status(200).json({ message: "Produto deletado com sucesso!"});
    }
    catch (error)
    {
        return res.status(500).json({ message: "Erro interno ao deletar o produto." });
    }
}

export async function deleteManyProducts(req: Request, res: Response)
{
    const { ids, restaurantId } = req.body;

    try 
    {
        if (!ids || !Array.isArray(ids) || ids.length === 0 || !restaurantId) 
            return res.status(400).json({message: "Dados inválidos para deleção"});

        const result = await service.deleteMany(ids, restaurantId); 

        if (result.deletedCount === 0) return res.status(400).json({message: "Nenhum produto encontrado!"});

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
    const { restaurantId, ...data } = req.body;

    if (!restaurantId) return res.status(400).json({ message: "restaurantId é obrigatório" });

    try {
        const product = await service.updateOne(id as string, restaurantId as string, data);
        return res.json(product);
    } catch (error: any) {
        if (error.message?.includes("Já existe")) {
            return res.status(409).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message || "Erro interno ao atualizar produto" });
    }
}