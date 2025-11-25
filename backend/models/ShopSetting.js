import mongoose from "mongoose";

const shopSettingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "global" },
    shopName: { type: String, default: "Bala Tarpaulins" },
    address: { type: String, default: "" },
    contact: { type: String, default: "" },
    shopLogo: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "shop_settings",
  }
);

const ShopSetting = mongoose.model("ShopSetting", shopSettingSchema);

export default ShopSetting;
