const express = require('express');
const router = express.Router();
const { createAuthMiddleware } = require('../middlewares/auth.middleware');
const { createOrder, getOrders, getOrderById, cancelById, updateOrderAddress } = require('../controllers/order.controller');
const { validateOrder, validateUpdateAddress } = require('../middlewares/validation.middleware');

router.post('/', createAuthMiddleware('user'), validateOrder, createOrder);
router.get('/me', createAuthMiddleware('user'), getOrders);
router.get('/:id/cancel', createAuthMiddleware('user','admin'), cancelById);
router.post('/:id/address', createAuthMiddleware('user'), validateUpdateAddress, updateOrderAddress);
router.get('/:id', createAuthMiddleware('user'), getOrderById);

module.exports = router;