const cartModel = require("../models/cart.model");

const addItemToCart = async (req, res) => {
  try {
    const { productId, qty } = req.body;
    const userId = req.user.id;
    let cart = await cartModel.findOne({ user: userId });
    if (!cart) {
      cart = await cartModel.create({ user: userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += qty;
    } else {
      cart.items.push({ productId, quantity: qty });
    }
    await cart.save();
    return res.status(200).json({
      message: "Item added to cart",
      cart,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // No authenticated user -> treat as empty cart
      return res.status(204).send();
    }
    const cart = await cartModel.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(204).send({
        message: "Cart is empty",
      });
    }
    return res.status(200).json({ cart });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/cart/items/:productId - update quantity or remove when qty <= 0
const updateItemQty = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { qty } = req.body; // qty can be <= 0 to indicate removal

    const cart = await cartModel.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const idx = cart.items.findIndex(
      (i) => i.productId.toString() === productId
    );
    if (idx === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (qty <= 0) {
      // remove the item
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].quantity = qty;
    }
    await cart.save();
    return res.status(200).json({ message: "Cart updated", cart });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/cart/items/:productId - remove a line item
const removeItemFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const cart = await cartModel.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
    if (cart.items.length === before) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    await cart.save();
    return res.status(200).json({ message: "Item removed", cart });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/cart - clear entire cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await cartModel.findOne({ user: userId });
    if (!cart) {
      return res.status(204).send({ message: "Cart is already empty" });
    }

    if (cart.items.length === 0) {
      return res.status(204).send({ message: "Cart is already empty" });
    }

    cart.items = [];
    await cart.save();
    return res.status(200).json({ message: "Cart cleared", cart });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  addItemToCart,
  getCart,
  updateItemQty,
  removeItemFromCart,
  clearCart,
};
