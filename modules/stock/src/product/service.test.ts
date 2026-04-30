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
  deleteMany: jest.Mock<any, any>;
};

describe("ProductService", () => {
  const service = new ProductService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a product by id", async () => {
    const product = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 5, restaurantId: "507f1f77bcf86cd799439012" };
    mockedProductModel.findById.mockResolvedValue(product);

    const result = await service.getOne(product._id);

    expect(result).toBe(product);
    expect(mockedProductModel.findById).toHaveBeenCalledWith(product._id);
  });

  it("returns products by restaurant id", async () => {
    const products = [{ _id: "507f1f77bcf86cd799439011", name: "A", brand: "B", quantity: 1, restaurantId: "507f1f77bcf86cd799439012" }];
    mockedProductModel.find.mockResolvedValue(products);

    const result = await service.getMany("507f1f77bcf86cd799439012");

    expect(result).toBe(products);
    expect(mockedProductModel.find).toHaveBeenCalled();
  });

  it("creates a new product", async () => {
    const product = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 2, restaurantId: "507f1f77bcf86cd799439012" };
    mockedProductModel.findOne.mockResolvedValue(null);
    mockedProductModel.create.mockResolvedValue(product);

    const result = await service.createOne({ name: "Test", brand: "Brand", quantity: 2, restaurantId: "507f1f77bcf86cd799439012" });

    expect(result).toBe(product);
    expect(mockedProductModel.findOne).toHaveBeenCalled();
    expect(mockedProductModel.create).toHaveBeenCalled();
  });

  it("throws when creating duplicate product", async () => {
    mockedProductModel.findOne.mockResolvedValue({ name: "Test", brand: "Brand" });

    await expect(
      service.createOne({ name: "Test", brand: "Brand", quantity: 2, restaurantId: "507f1f77bcf86cd799439012" })
    ).rejects.toThrow("Produto Test (Brand) já existe!");
  });

  it("creates many products", async () => {
    const products = [
      { _id: "507f1f77bcf86cd799439011", name: "A", brand: "B", quantity: 1, restaurantId: "507f1f77bcf86cd799439012" },
    ];
    mockedProductModel.findOne.mockResolvedValue(null);
    mockedProductModel.insertMany.mockResolvedValue(products);

    const result = await service.createMany([
      { name: "A", brand: "B", quantity: 1, restaurantId: "507f1f77bcf86cd799439012" },
    ]);

    expect(result).toBe(products);
    expect(mockedProductModel.insertMany).toHaveBeenCalled();
  });

  it("updates a product", async () => {
    const updated = { _id: "507f1f77bcf86cd799439011", name: "Updated", brand: "Brand", quantity: 3, restaurantId: "507f1f77bcf86cd799439012" };
    mockedProductModel.findOne.mockResolvedValue(null);
    mockedProductModel.findByIdAndUpdate.mockResolvedValue(updated);

    const result = await service.updateOne("507f1f77bcf86cd799439011", { name: "Updated", quantity: 3 });

    expect(result).toBe(updated);
    expect(mockedProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      { name: "Updated", quantity: 3 },
      { new: true }
    );
  });

  it("throws when update finds duplicate product", async () => {
    mockedProductModel.findOne.mockResolvedValue({ name: "Duplicated", brand: "BrandX" });

    await expect(
      service.updateOne("507f1f77bcf86cd799439011", { name: "Duplicated" })
    ).rejects.toThrow("Produto Duplicated (BrandX) já existe!");
  });

  it("adjusts product quantity upward", async () => {
    const current = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 2, restaurantId: "507f1f77bcf86cd799439012" };
    const updated = { ...current, quantity: 5 };
    mockedProductModel.findById.mockResolvedValue(current);
    mockedProductModel.findByIdAndUpdate.mockResolvedValue(updated);

    const result = await service.adjustQuantity("507f1f77bcf86cd799439011", 3);

    expect(result).toBe(updated);
    expect(mockedProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      { quantity: 5 },
      { new: true }
    );
  });

  it("throws when quantity adjustment results negative", async () => {
    const current = { _id: "507f1f77bcf86cd799439011", name: "Test", brand: "Brand", quantity: 2, restaurantId: "507f1f77bcf86cd799439012" };
    mockedProductModel.findById.mockResolvedValue(current);

    await expect(service.adjustQuantity("507f1f77bcf86cd799439011", -3)).rejects.toThrow(
      "Quantidade resultante não pode ser negativa"
    );
  });

  it("deletes one product", async () => {
    mockedProductModel.findByIdAndDelete.mockResolvedValue({});

    const result = await service.deleteOne("507f1f77bcf86cd799439011");

    expect(result).toBe(true);
    expect(mockedProductModel.findByIdAndDelete).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
  });

  it("deletes many products", async () => {
    mockedProductModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

    const result = await service.deleteMany(["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]);

    expect(result.deletedCount).toBe(2);
    expect(mockedProductModel.deleteMany).toHaveBeenCalled();
  });
});
