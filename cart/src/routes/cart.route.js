const express = require('express');
const router = express.Router();
const { addItemToCart, getCart, updateItemQty, removeItemFromCart, clearCart } = require('../controllers/cart.controller');
const { validateAddItemToCart } = require('../middlewares/validation.middleware');
const { createAuthMiddleware } = require('../middlewares/auth.middleware');

router.get('/', createAuthMiddleware(['user']), getCart);
router.post('/items', validateAddItemToCart, createAuthMiddleware(['user']), addItemToCart);
router.patch('/items/:productId', createAuthMiddleware(['user']), updateItemQty);
router.delete('/items/:productId', createAuthMiddleware(['user']), removeItemFromCart);
router.delete('/', createAuthMiddleware(['user']), clearCart);

module.exports = router;
