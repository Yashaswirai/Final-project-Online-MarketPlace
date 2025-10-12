const { body, validationResult } = require("express-validator");

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

function convertToUppercase(value) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  return value;
}

// Validation rules for creating a product
const validateProduct = [
  body("title")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Title is required")
    .bail()
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .isLength({ min: 3, max: 120 })
    .withMessage("Title must be between 3 and 120 characters"),

  body("description")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Description is required")
    .bail()
    .isString()
    .withMessage("Description must be a string")
    .bail()
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage("Description must be between 5 and 2000 characters"),

  body("priceAmount")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Price amount is required")
    .bail()
    .isFloat({ gt: 0 })
    .withMessage("Price amount must be a number greater than 0")
    .toFloat(),
  body("stock")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Stock is required")
    .bail()
    .isInt({ gt: 0 })
    .withMessage("Stock must be a positive integer")
    .toInt(),
  body("priceCurrency")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Currency is required")
    .bail()
    .isString()
    .withMessage("Currency must be a string")
    .bail()
    .customSanitizer(convertToUppercase)
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter code")
    .bail()
    .isIn(["USD", "INR"])
    .withMessage("Currency must be one of: USD, INR"),
  handleValidationErrors,
];

const validateProductUpdate = [
  body("title")
    .optional({ nullable: true })
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .isLength({ min: 3, max: 120 })
    .withMessage("Title must be between 3 and 120 characters"),

  body("description")
    .optional({ nullable: true })
    .isString()
    .withMessage("Description must be a string")
    .bail()
    .trim()
    .isLength({ min: 5, max: 2000 })
    .withMessage("Description must be between 5 and 2000 characters"),

  body("priceAmount")
    .optional({ nullable: true })
    .isFloat({ gt: 0 })
    .withMessage("Price amount must be a number greater than 0")
    .toFloat(),

  body("priceCurrency")
    .optional({ nullable: true })
    .isString()
    .withMessage("Currency must be a string")
    .bail()
    .customSanitizer(convertToUppercase)
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter code")
    .bail()
    .isIn(["USD", "INR"])
    .withMessage("Currency must be one of: USD, INR"),

  body("stock")
    .optional({ nullable: true })
    .isInt({ gt: 0 })
    .withMessage("Stock must be a positive integer")
    .toInt(),
    
  handleValidationErrors,
];

module.exports = {
  validateProduct,
  validateProductUpdate,
};
