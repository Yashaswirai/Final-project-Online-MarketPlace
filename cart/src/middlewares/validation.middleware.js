const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const validateAddItemToCart = [
  body("productId")
    .notEmpty()
    .withMessage("productId is required")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid productId format"),
  body("qty").isInt({ gt: 0 }).withMessage("qty must be a positive integer"),
  handleValidationErrors,
];

module.exports = { validateAddItemToCart };
