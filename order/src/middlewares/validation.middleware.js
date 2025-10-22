const { body, validationResult } = require("express-validator");

const respondWithValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateOrder = [
  body("shippingAddress.street").notEmpty().withMessage("Street is required"),
  body("shippingAddress.city").notEmpty().withMessage("City is required"),
  body("shippingAddress.state").notEmpty().withMessage("State is required"),
  body("shippingAddress.pincode").notEmpty().withMessage("Pincode is required"),
  body("shippingAddress.country").notEmpty().withMessage("Country is required"),
  body("shippingAddress.phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .isMobilePhone('any')
    .withMessage("Invalid phone number format"),
  respondWithValidationErrors,
];

const validateUpdateAddress = [
  body("shippingAddress.street").optional().notEmpty().withMessage("Street cannot be empty"),
  body("shippingAddress.city").optional().notEmpty().withMessage("City cannot be empty"),
  body("shippingAddress.state").optional().notEmpty().withMessage("State cannot be empty"),
  body("shippingAddress.pincode").optional().notEmpty().withMessage("Pincode cannot be empty"),
  body("shippingAddress.country").optional().notEmpty().withMessage("Country cannot be empty"),
  body("shippingAddress.phone")
    .optional()
    .notEmpty()
    .withMessage("Phone number cannot be empty")
    .isMobilePhone('any')
    .withMessage("Invalid phone number format"),
  respondWithValidationErrors,
];

module.exports = { validateOrder, validateUpdateAddress };
