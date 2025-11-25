import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    // Legacy field support: older records may store the hash under `password`
    password: { type: String, select: false },
    role: {
      type: String,
      enum: ["admin", "staff", "viewer"],
      default: "admin",
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

userSchema.methods.comparePassword = function comparePassword(plainText) {
  if (typeof plainText !== "string" || !plainText) return Promise.resolve(false);
  const hash = this.passwordHash || this.password;
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plainText, hash);
};

userSchema.statics.hashPassword = function hashPassword(plainText) {
  if (typeof plainText !== "string" || plainText.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }
  return bcrypt.hash(plainText, SALT_ROUNDS);
};

userSchema.statics.createUser = async function createUser({ name, email, password, role }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("email required");
  if (!name) throw new Error("name required");

  const passwordHash = await this.hashPassword(password);

  return this.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: role || undefined,
  });
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
