const Order = require("../models/order.model");
const axios = require("axios");

const createOrder = async (req, res) => {
  const user = req.user;
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!user || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const PRODUCT_BASE =
      process.env.PRODUCT_SERVICE_URL || "http://localhost:3001";
    const CART_BASE = process.env.CART_SERVICE_URL || "http://localhost:3002";
    // Get user's cart
    const cartResp = (
      await axios.get(`${CART_BASE}/api/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).data;

    const cart = cartResp?.cart;

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({
        message:
          "Cart is empty, please add items to your cart before checking out.",
      });
    }

    // Fetch product details for each cart item
    const products = await Promise.all(
      cart.items.map(async (item) => {
        const resp = await axios.get(
          `${PRODUCT_BASE}/api/products/${item.productId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const body = resp.data || {};
        return body.product || body.data || body;
      })
    );

    // Ensure sufficient inventory (if stock information is provided)
    for (const item of cart.items) {
      const product = products.find(
        (p) => String(p._id) === String(item.productId)
      );
      if (!product) {
        return res.status(400).json({ message: "Product not found for item" });
      }
      if (product.stock < Number(item.quantity)) {
        return res.status(409).json({
          message: `Insufficient inventory for product ${
            product.title || product._id
          }`,
        });
      }
    }

    // Build order items according to schema and compute totals
    let totalAmount = 0;
    let currency = "USD"; // Default currency
    const orderItems = cart.items.map((item) => {
      const product = products.find(
        (p) => String(p._id) === String(item.productId)
      );
      const qty = Number(item.quantity) || 0;
      const price = product?.price || { amount: 0, currency: "USD" };
      const lineAmount = (Number(price.amount) || 0) * qty;
      totalAmount += lineAmount;
      // Use the currency from the first product (assuming all items use same currency)
      if (price.currency) {
        currency = price.currency;
      }
      return {
        productId: item.productId,
        quantity: qty,
        price: {
          amount: Number(price.amount) || 0,
          currency: price.currency || "USD",
        },
      };
    });

    const { street, city, state, pincode, country, phone } =
      req.body.shippingAddress || {};
    const shippingAddress = { street, city, state, pincode, country, phone };
    const order = await Order.create({
      user: user._id || user.id,
      items: orderItems,
      totalAmount: {
        amount: totalAmount,
        currency: currency,
      },
      status: "PENDING",
      shippingAddress,
    });
    return res
      .status(201)
      .json({ message: "Order created successfully", order });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
const getOrders = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const orders = await Order.find({ user: user._id || user.id })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await Order.countDocuments({ user: user._id || user.id });
    return res.status(200).json({
      message: "Orders fetched successfully",
      page,
      limit,
      orders,
      total,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getOrderById = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const userId = String(user._id || user.id || "");
    if (String(order.user) !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json({
      message: "Order fetched successfully",
      order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const cancelById = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const userId = String(user._id || user.id || "");
    if (String(order.user) !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Check if the order is already cancelled
    if (order.status === "CANCELLED") {
      return res.status(409).json({ message: "Order is already cancelled" });
    }
    if (order.status !== "PENDING") {
      return res
        .status(409)
        .json({ message: "Only PENDING orders can be cancelled" });
    }
    // Update the order status to cancelled
    order.status = "CANCELLED";
    await order.save();

    return res.status(200).json({
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateOrderAddress = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const userId = String(user._id || user.id || "");
    if (String(order.user) !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.status != "PENDING") {
      return res
        .status(409)
        .json({ message: "Can only update address for PENDING orders" });
    }

    const { street, city, state, pincode, country, phone } =
      req.body.shippingAddress || {};
    const shippingAddress = { street, city, state, pincode, country, phone };
    order.shippingAddress = shippingAddress;
    await order.save();

    return res.status(200).json({
      message: "Order address updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order address:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  cancelById,
  updateOrderAddress,
};
