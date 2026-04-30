import { ProductService } from "./service";
import { ProductModel } from "./model";
import { redis, redisConnected } from "../config/redis";

jest.mock("./model");
jest.mock("../config/redis", () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    },
    redisConnected: true,
}));

const VALID_ID = "507f1f72bcf86cd799439011";

describe("ProductService", () => {
    let service: ProductService;

    beforeEach(() => {
        service = new ProductService();
        jest.clearAllMocks();
    });

    describe("getOne", () => {
        it("should return product from cache if available", async () => {
            const mockProduct = { _id: VALID_ID, name: "Pizza", brand: "Sadia", userId: "user1", restaurantId: "res1", stockProductId: "stock1" };
            (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockProduct));

            const result = await service.getOne(VALID_ID, "user1", "res1");

            expect(redis.get).toHaveBeenCalledWith(`product:${VALID_ID}:user1:res1`);
            expect(result).toEqual(mockProduct);
            expect(ProductModel.findOne).not.toHaveBeenCalled();
        });

        it("should return product from DB and set cache if not in cache", async () => {
            (redis.get as jest.Mock).mockResolvedValue(null);
            const mockProduct = { _id: VALID_ID, name: "Pizza", brand: "Sadia", userId: "user1", restaurantId: "res1", stockProductId: "stock1" };
            (ProductModel.findOne as jest.Mock).mockResolvedValue(mockProduct);

            const result = await service.getOne(VALID_ID, "user1", "res1");

            expect(ProductModel.findOne).toHaveBeenCalledWith({ _id: VALID_ID, userId: "user1", restaurantId: "res1" });
            expect(redis.set).toHaveBeenCalled();
            expect(result).toEqual(mockProduct);
        });

        it("should return null if ID is invalid", async () => {
            const result = await service.getOne("invalid-id", "user1", "res1");
            expect(result).toBeNull();
            expect(ProductModel.findOne).not.toHaveBeenCalled();
        });
    });

    describe("createOne", () => {
        it("should create product successfully", async () => {
            const mockProduct = { _id: VALID_ID, name: "Pizza", brand: "Sadia", price: 10, userId: "user1", restaurantId: "res1", stockProductId: "stock1" };
            const saveMock = jest.fn().mockResolvedValue(mockProduct);
            (ProductModel as any).mockImplementation(() => ({ save: saveMock }));

            const result = await service.createOne("Pizza", "Sadia", 10, "Massa com queijo", "stock1", "user1", "res1");

            expect(result).toEqual(mockProduct);
            expect(redis.del).toHaveBeenCalledWith("products:user1:res1");
        });

        it("should throw error when duplicate product (same name + brand + restaurantId)", async () => {
            const duplicateError = new Error("duplicate key") as any;
            duplicateError.code = 11000;
            const saveMock = jest.fn().mockRejectedValue(duplicateError);
            (ProductModel as any).mockImplementation(() => ({ save: saveMock }));

            await expect(service.createOne("Pizza", "Sadia", 10, "Massa com queijo", "stock1", "user1", "res1"))
                .rejects.toThrow("Já existe um produto com esse nome e marca nesta filial!");
        });
    });

    describe("createMany", () => {
        it("should throw error when duplicate products exist", async () => {
            const duplicateError = new Error("duplicate key") as any;
            duplicateError.code = 11000;
            (ProductModel.insertMany as jest.Mock).mockRejectedValue(duplicateError);

            const products = [
                { name: "Pizza", brand: "Sadia", price: 10, description: "Desc", stockProductId: "stock1", userId: "user1", restaurantId: "res1" },
                { name: "Pizza", brand: "Sadia", price: 12, description: "Desc2", stockProductId: "stock1", userId: "user1", restaurantId: "res1" },
            ];

            await expect(service.createMany(products))
                .rejects.toThrow("Um ou mais produtos já existem com o mesmo nome e marca nesta filial!");
        });
    });

    describe("updateOne", () => {
        it("should update product and invalidate cache", async () => {
            const mockProduct = { _id: VALID_ID, name: "Pizza Updated", brand: "Sadia", userId: "user1", restaurantId: "res1", stockProductId: "stock1" };
            (ProductModel.findOneAndUpdate as jest.Mock).mockResolvedValue(mockProduct);

            const result = await service.updateOne(VALID_ID, "user1", "res1", { name: "Pizza Updated" });

            expect(ProductModel.findOneAndUpdate).toHaveBeenCalled();
            expect(redis.del).toHaveBeenCalledWith(`product:${VALID_ID}:user1:res1`);
            expect(redis.del).toHaveBeenCalledWith("products:user1:res1");
            expect(result).toEqual(mockProduct);
        });

        it("should throw error if product not found", async () => {
            (ProductModel.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

            await expect(service.updateOne(VALID_ID, "user1", "res1", { name: "Pizza" }))
                .rejects.toThrow("Produto não encontrado nesta filial!");
        });

        it("should throw error if ID is invalid", async () => {
            await expect(service.updateOne("invalid-id", "user1", "res1", { name: "Pizza" }))
                .rejects.toThrow("ID de produto inválido!");
        });

        it("should throw error when update causes duplicate", async () => {
            const duplicateError = new Error("duplicate key") as any;
            duplicateError.code = 11000;
            (ProductModel.findOneAndUpdate as jest.Mock).mockRejectedValue(duplicateError);

            await expect(service.updateOne(VALID_ID, "user1", "res1", { name: "Pizza", brand: "Sadia" }))
                .rejects.toThrow("Já existe um produto com esse nome e marca nesta filial!");
        });
    });

    describe("deleteOne", () => {
        it("should delete product and invalidate cache", async () => {
            (ProductModel.findOneAndDelete as jest.Mock).mockResolvedValue({ _id: VALID_ID });

            const result = await service.deleteOne(VALID_ID, "user1", "res1");

            expect(result).toBe(true);
            expect(redis.del).toHaveBeenCalledWith(`product:${VALID_ID}:user1:res1`);
            expect(redis.del).toHaveBeenCalledWith("products:user1:res1");
        });

        it("should return false if product not found", async () => {
            (ProductModel.findOneAndDelete as jest.Mock).mockResolvedValue(null);

            const result = await service.deleteOne(VALID_ID, "user1", "res1");

            expect(result).toBe(false);
        });

        it("should return false if ID is invalid", async () => {
            const result = await service.deleteOne("invalid-id", "user1", "res1");
            expect(result).toBe(false);
        });
    });
});
