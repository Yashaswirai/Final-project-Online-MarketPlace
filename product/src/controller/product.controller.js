const { mongoose } = require("mongoose");
const productModel = require("../models/product.model");
const { uploadImage } = require("../services/imagekit.service");

// Create a new product
const createProduct = async (req, res) => {
  const { title, description, priceAmount, priceCurrency, stock } = req.body || {};

  const price = { amount: priceAmount, currency: priceCurrency };
  if (!title || !description || !priceAmount || !priceCurrency || !stock) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sellerId = req.user?.id || req.user?._id;
  try {
    const images = [];
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          try {
            const uploadResult = await uploadImage({
              file: file.buffer,
              filename: file.originalname,
            });
            images.push({
              url: uploadResult.url,
              thumbnail: uploadResult.thumbnailUrl,
              id: uploadResult.fileId,
            });
          } catch (e) {
            // If one image fails, continue with others; optionally log
            console.error("Image upload failed:", e);
          }
        })
      );
    }
    const newProduct = await productModel.create({
      title,
      description,
      price,
      seller: sellerId,
      images,
      stock,
    });
    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating product",
      error: error?.message || error,
    });
  }
};

const listProducts = async (req, res) => {
  try {
    const { skip = "0", limit = "10", minPrice, maxPrice } = req.query || {};

    // parse and clamp pagination
    let s = parseInt(skip, 10);
    let l = parseInt(limit, 10);
    if (Number.isNaN(s) || s < 0) s = 0;
    if (Number.isNaN(l) || l <= 0) l = 10;
    l = Math.min(l, 50);

    // parse and validate price filters
    const hasMin = minPrice !== undefined && minPrice !== "";
    const hasMax = maxPrice !== undefined && maxPrice !== "";
    const min = hasMin ? Number(minPrice) : undefined;
    const max = hasMax ? Number(maxPrice) : undefined;

    const errors = [];
    if (hasMin && Number.isNaN(min)) {
      errors.push({ field: "minPrice", message: "minPrice must be a number" });
    }
    if (hasMax && Number.isNaN(max)) {
      errors.push({ field: "maxPrice", message: "maxPrice must be a number" });
    }
    if (errors.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    // build query
    const query = {};
    if (hasMin || hasMax) {
      query["price.amount"] = {};
      if (hasMin) query["price.amount"].$gte = min;
      if (hasMax) query["price.amount"].$lte = max;
    }

    const total = await productModel.countDocuments(query);
    const products = await productModel.find(query).skip(s).limit(l).lean();

    res.status(200).json({
      message: "Products fetched successfully",
      data: products,
      meta: {
        skip: s,
        limit: l,
        total,
        filters: {
          minPrice: hasMin ? min : undefined,
          maxPrice: hasMax ? max : undefined,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error?.message || error,
    });
  }
};

const getProductById = async (req, res) => {
  const { id } = req.params || {};
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  }
  if (!id.match(/^[0-9a-fA-F]{24}$/) && !mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID format" });
  }
  try {
    const product = await productModel.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error?.message || error,
    });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params || {};
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  }
  if (!id.match(/^[0-9a-fA-F]{24}$/) && !mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID format" });
  }
  try {
    const product = await productModel.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    // Check ownership
    if (product.seller != req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this product",
      });
    }
    const { title, description, priceAmount, priceCurrency, stock } = req.body || {};

    // Apply only provided fields
    if (typeof title === "string") {
      product.title = title;
    }
    if (typeof description === "string") {
      product.description = description;
    }
    if (priceAmount !== undefined) {
      product.price.amount = priceAmount;
    }
    if (priceCurrency !== undefined) {
      product.price.currency = priceCurrency;
    }
    if (stock !== undefined) {
      product.stock = stock;
    }
    
    const updated = await product.save();
    return res.status(200).json({
      message: "Product updated successfully",
      product: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error?.message || error,
    });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params || {};
  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  }
  if (!id.match(/^[0-9a-fA-F]{24}$/) && !mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID format" });
  }
  try {
    const product = await productModel.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    // Check ownership
    if (product.seller != req.user.id) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to delete this product",
        });
    }
    await productModel.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error?.message || error,
    });
  }
};

const sellerProducts = async (req, res) => {
  const { skip = "0", limit = "10" } = req.query || {};
  // parse and clamp pagination
  let s = parseInt(skip, 10);
  let l = parseInt(limit, 10);
  if (Number.isNaN(s) || s < 0) s = 0;
  if (Number.isNaN(l) || l <= 0) l = 10;
  l = Math.min(l, 10);
  try {
    const sellerId = req.user?.id || req.user?._id;
    if (!sellerId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid seller ID" });
    }
    const products = await productModel
      .find({ seller: sellerId })
      .skip(s)
      .limit(l)
      .lean();
    const total = products.length;
    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: products,
      meta: { skip: s, limit: l, sellerId, total },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching seller products",
      error: error?.message || error,
    });
  }
};

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  sellerProducts,
};
