const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
  const token =
    req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.id).select("-password"); 
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = { authMiddleware };
