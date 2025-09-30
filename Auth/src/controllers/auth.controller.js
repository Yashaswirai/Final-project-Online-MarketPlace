const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../db/redis");

const registerUser = async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;
    if (
      !username ||
      !email ||
      !password ||
      !fullName ||
      !fullName.firstName ||
      !fullName.lastName
    ) {
      return res.status(400).json({
        message: "fullName, username, email and password are required",
      });
    }
    const existing = await userModel.findOne({
      $or: [{ username }, { email }],
    });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
      fullName,
      role: role || "user",
    });
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.status(201).json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = email or username
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "identifier and password are required" });
    }

    // Find user by email or username, include password
    const user = await userModel
      .findOne({
        $or: [{ email: identifier }, { username: identifier }],
      })
      .select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    message: "user retrieved",
    email: req.user.email,
    username: req.user.username,
    role: req.user.role,
    id: req.user.id,
  });
};

const logoutUser = async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (token) {
      await redis.set(`blacklist_${token}`, "true", "EX", 24 * 60 * 60); // 24 hours
    }
    res.clearCookie("token", { httpOnly: true, secure: true });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const listAddresses = async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await userModel.findById(userId).select("addresses");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ addresses: user.addresses });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const addAddress = async (req, res) => {
  const { street, city, state, country, pincode, phone, isDefault } = req.body;
  const userId = req.user.id;
  try {
    let user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.addresses.length === 0) {
      user = await userModel.findByIdAndUpdate(
        { _id: userId },
        {
          $push: {
            addresses: {
              street,
              city,
              state,
              pincode,
              country,
              phone,
              isDefault: true,
            },
          },
        },
        { new: true }
      );
    } else {
      if (isDefault) {
        await userModel.updateOne(
          { _id: userId, "addresses.isDefault": true },
          { $set: { "addresses.$[].isDefault": false } }
        );
      }
      user = await userModel.findByIdAndUpdate(
        { _id: userId },
        {
          $push: {
            addresses: {
              street,
              city,
              state,
              pincode,
              country,
              phone,
              isDefault: isDefault,
            },
          },
        },
        { new: true }
      );
    }
    return res.status(201).json({
      message: "Address added successfully",
      _id: user.addresses[user.addresses.length - 1]._id,
      isDefault: user.addresses[user.addresses.length - 1].isDefault,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const deleteAddress = async (req, res) => {
  const userId = req.user.id;
  const addressId = req.params.id;
  try {
    const user = await userModel.findById(userId);
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }
    if (address.isDefault) {
      user.addresses[0].isDefault = true;
      await user.save();
    }
    await userModel.findByIdAndUpdate(
      { _id: userId },
      { $pull: { addresses: { _id: addressId } } }
    );
    return res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  listAddresses,
  addAddress,
  deleteAddress,
};
