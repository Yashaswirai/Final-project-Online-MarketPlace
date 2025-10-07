const express = require("express");
const {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  sellerProducts,
} = require("../controller/product.controller");
const router = express.Router();
const multer = require("multer");
const { createAuthMiddleware } = require("../middleware/auth.middleware");
const { validateProduct, validateProductUpdate } = require("../middleware/validation.middleware");

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/products
router.get("/", listProducts);

// GET /api/products/seller
router.get("/seller", createAuthMiddleware(["admin", "seller"]), sellerProducts);

// GET /api/products/:id
router.get("/:id", getProductById);

// PATCH /api/products/:id
router.patch(
  "/:id",
  createAuthMiddleware(["admin", "seller"]),
  validateProductUpdate,
  updateProduct
);

// DELETE /api/products/:id
router.delete("/:id", createAuthMiddleware(["admin", "seller"]), deleteProduct);

// POST /api/products/
router.post(
  "/",
  createAuthMiddleware(["admin", "seller"]),
  upload.array("images", 5),
  validateProduct,
  createProduct
);

module.exports = router;
