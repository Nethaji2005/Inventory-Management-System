import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    pricePerQuantity: { type: Number, default: 0 },
    total: { type: Number, required: true },
    size: { type: String },
    gsm: { type: String },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId(),
    },
    billId: { type: String, required: true },
    customerName: { type: String },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    items: { type: [saleItemSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "sales",
  }
);

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
