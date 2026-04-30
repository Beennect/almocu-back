import { ProductService } from "./service";
import ProductModel from "./model";

jest.mock("./model", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    insertMany: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

const mockedProductModel = ProductModel as unknown as {
  findById: jest.Mock<any, any>;
  find: jest.Mock<any, any>;
  findOne: jest.Mock<any, any>;
  create: jest.Mock<any, any>;
  insertMany: jest.Mock<any, any>;
  findByIdAndDelete: jest.Mock<any, any>;
  findByIdAndUpdate: jest.Mock<any, any>;
  findOneAndDelete: jest.Mock<any, any>;
  findOneAndUpdate: jest.Mock<any, any>;
  deleteMany: jest.Mock<any, any>;
};

describe("ProductService", () => {
  const service = new ProductService();
  const userId = "507f1f77bcf86cd799439011";
  const restaurantId = "507f1f77bcf86cd799439012";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a product by id", async () => {
    const product = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 5, restaurantId, userId };
    mockedProductModel.findOne.mockResolvedValue(product);

    const result = await service.getOne(product._id, userId, restaurantId);

    expect(result).toBe(product);
    expect(mockedProductModel.findOne).toHaveBeenCalled();
  });

  it("returns products by restaurant id", async () => {
    const products = [{ _id: "507f1f77bcf86cd799439011", name: "A", brand: "B", quantity: 1, restaurantId, userId }];
    mockedProductModel.find.mockResolvedValue(products);

    const result = await service.getMany(userId, restaurantId);

    expect(result).toBe(products);
    expect(mockedProductModel.find).toHaveBeenCalled();
  });

  it("returns all products from a user", async () => {
    const products = [{ _id: "507f1f77bcf86cd799439011", name: "A", brand: "B", quantity: 1, restaurantId, userId }];
    mockedProductModel.find.mockResolvedValue(products);

    const result = await service.getAllFromUser(userId);

    expect(result).toBe(products);
    expect(mockedProductModel.find).toHaveBeenCalledWith({ userId: expect.any(Object) });
  });

  it("creates a new product", async () => {
    const product = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 2, restaurantId, userId };
    mockedProductModel.findOne.mockResolvedValue(null);
    mockedProductModel.create.mockResolvedValue(product);

    const result = await service.createOne({ name: "Test", brand: "Brand", quantity: 2, restaurantId, userId });

    expect(result).toBe(product);
    expect(mockedProductModel.findOne).toHaveBeenCalled();
    expect(mockedProductModel.create).toHaveBeenCalled();
  });

  it("throws when creating duplicate product", async () => {
    mockedProductModel.findOne.mockResolvedValue({ name: "Test", brand: "Brand" });

    await expect(
      service.createOne({ name: "Test", brand: "Brand", quantity: 2, restaurantId, userId })
    ).rejects.toThrow("Produto Test (Brand) já existe!");
  });

  it("creates many products", async () => {
    const products = [
      { _id: "507f1f77bcf86cd799439011", name: "A", brand: "B", quantity: 1, restaurantId, userId },
    ];
    mockedProductModel.findOne.mockResolvedValue(null);
    mockedProductModel.insertMany.mockResolvedValue(products);

    const result = await service.createMany([
      { name: "A", brand: "B", quantity: 1, restaurantId, userId },
    ]);

    expect(result).toBe(products);
    expect(mockedProductModel.insertMany).toHaveBeenCalled();
  });

  it("updates a product", async () => {
    const updated = { _id: "507f1f77bcf86cd799439011", name: "Updated", brand: "Brand", quantity: 3, restaurantId, userId };
    mockedProductModel.findOne.mockResolvedValue(null);
    mockedProductModel.findOneAndUpdate.mockResolvedValue(updated);

    const result = await service.updateOne("507f1f77bcf86cd799439011", userId, restaurantId, { name: "Updated", quantity: 3 });

    expect(result).toBe(updated);
    expect(mockedProductModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it("throws when update finds duplicate product", async () => {
    mockedProductModel.findOne.mockResolvedValue({ name: "Duplicated", brand: "BrandX" });

    await expect(
      service.updateOne("507f1f77bcf86cd799439011", userId, restaurantId, { name: "Duplicated" })
    ).rejects.toThrow("Produto Duplicated (BrandX) já existe nesta filial!");
  });

  it("adjusts product quantity upward", async () => {
    const current = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 2, restaurantId, userId };
    const updated = { ...current, quantity: 5 };
    mockedProductModel.findOne.mockResolvedValue(current);
    mockedProductModel.findOneAndUpdate.mockResolvedValue(updated);

    const result = await service.adjustQuantity("507f1f77bcf86cd799439011", userId, restaurantId, 3);

    expect(result).toBe(updated);
    expect(mockedProductModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it("throws when quantity adjustment results negative", async () => {
    const current = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 2, restaurantId, userId };
    mockedProductModel.findOne.mockResolvedValue(current);

    await expect(service.adjustQuantity("507f1f77bcf86cd799439011", userId, restaurantId, -3)).rejects.toThrow(
      "Quantidade resultante não pode ser negativa"
    );
  });

  it("deletes one product", async () => {
    mockedProductModel.findOneAndDelete.mockResolvedValue({});

    const result = await service.deleteOne("507f1f77bcf86cd799439011", userId, restaurantId);

    expect(result).toBe(true);
    expect(mockedProductModel.findOneAndDelete).toHaveBeenCalled();
  });

  it("deletes many products", async () => {
    mockedProductModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

    const result = await service.deleteMany(["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"], userId, restaurantId);

    expect(result.deletedCount).toBe(2);
    expect(mockedProductModel.deleteMany).toHaveBeenCalled();
  });
});
