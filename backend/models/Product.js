import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId(),
    },
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    productId: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    reorderPoint: { type: Number, default: 10 },
    size: { type: String },
    gsm: { type: String },
    image: { type: String },
  },
  {
    timestamps: true,
    collection: "inventory",
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
