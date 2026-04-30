import { ProductModel, IProduct } from "./model";
import { redis, redisConnected } from "../redis";
import { Types } from "mongoose";

export class ProductService 
{
    public async getOne(id: string, restaurantId: string): Promise<IProduct | null>{
        const cacheKey = `product:${id}`;
        
        if (redisConnected) 
        {
            const cache = await redis.get(cacheKey);
            if (cache) return JSON.parse(cache);
        }

        if (!Types.ObjectId.isValid(id)) return null;

        const product = await ProductModel.findOne({ _id: id, restaurantId });

        if (product && redisConnected) {
            await redis.set(cacheKey, JSON.stringify(product), { EX: 60 });
        }

        return product;
    }

    public async getAll(restaurantId: string): Promise<IProduct[]> {
        const cacheKey = `products:${restaurantId}`;
        
        if (redisConnected) 
        {
            const cache = await redis.get(cacheKey);
            if (cache) return JSON.parse(cache);
        }

        const products = await ProductModel.find({ restaurantId });

        if (products && redisConnected) {
            await redis.set(cacheKey, JSON.stringify(products), { EX: 60 });
        }
        
        return products;
    }

    public async createOne(name: string, brand: string, price: number, description: string, restaurantId: string): Promise<IProduct> 
    {
        try {
            const product = new ProductModel({ name, brand, price, description, restaurantId });
            const savedProduct = await product.save();

            if (redisConnected) {
                await redis.del(`products:${restaurantId}`);
            }

            return savedProduct;
        } catch (error: any) {
            if (error.code === 11000) {
                throw new Error("Já existe um produto com esse nome e marca neste restaurante!");
            }
            throw error;
        }
    }

    public async createMany(products: {name: string, brand: string, price: number, description: string, restaurantId: string}[]): Promise<IProduct[]> {
        if (!products || products.length === 0) throw new Error("Lista de produtos vazia!");
        
        try {
            const savedProducts = await ProductModel.insertMany(products);
          
            if (redisConnected) {
                const restaurantIds = [...new Set(products.map(p => p.restaurantId))];
                for (const rId of restaurantIds) {
                    await redis.del(`products:${rId}`);
                }
            }
          
            return savedProducts as unknown as IProduct[];
        } catch (error: any) {
            if (error.code === 11000) {
                throw new Error("Um ou mais produtos já existem com o mesmo nome e marca neste restaurante!");
            }
            throw error;
        }
    }

    public async deleteOne(id: string, restaurantId: string): Promise<boolean>{
        if (!Types.ObjectId.isValid(id)) return false;

        const product = await ProductModel.findOneAndDelete({ _id: id, restaurantId });

        if (!product) return false;

        if (redisConnected)
        {
            await redis.del(`product:${id}`);
            await redis.del(`products:${restaurantId}`);
        }

        return true;
    }

    public async deleteMany(ids: string[], restaurantId: string): Promise<{ deletedCount: number }> {
        const validIds = ids.filter(id => Types.ObjectId.isValid(id));
        if (!validIds.length) return { deletedCount: 0 };

        const result = await ProductModel.deleteMany({
            _id: { $in: validIds },
            restaurantId
        });

        if (redisConnected) 
        {
            for (const id of ids) {
                await redis.del(`product:${id}`);
            }
            await redis.del(`products:${restaurantId}`);
        }

        return { deletedCount: result.deletedCount };
    }

    public async updateOne(id: string, restaurantId: string, data: Partial<{ name: string, brand: string, price: number, description: string }>): Promise<IProduct | null> {
        if (!Types.ObjectId.isValid(id)) throw new Error("ID de produto inválido!");

        try {
            const product = await ProductModel.findOneAndUpdate(
                { _id: id, restaurantId },
                { $set: data },
                { new: true }
            );

            if (!product) throw new Error("Produto não encontrado!");

            if (redisConnected) {
                await redis.del(`product:${id}`);
                await redis.del(`products:${restaurantId}`);
            }

            return product;
        } catch (error: any) {
            if (error.code === 11000) {
                throw new Error("Já existe um produto com esse nome e marca neste restaurante!");
            }
            throw error;
        }
    }
}