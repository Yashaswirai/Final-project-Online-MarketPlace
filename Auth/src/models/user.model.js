const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  pincode: String,
  country: String,
  isDefault: { type: Boolean, default: false },
  phone: String,
});

const fullNameSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
});

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: fullNameSchema,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "seller", "admin"],
      default: "user",
    },
    addresses: [addressSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", userSchema);
