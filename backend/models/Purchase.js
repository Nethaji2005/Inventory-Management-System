import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    size: { type: String },
    gsm: { type: String },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId(),
    },
    billId: { type: String, required: true },
    supplierName: { type: String, default: "Unknown Supplier" },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    items: { type: [purchaseItemSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "purchases",
  }
);

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
