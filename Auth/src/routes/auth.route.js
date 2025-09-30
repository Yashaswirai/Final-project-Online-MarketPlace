const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getCurrentUser, logoutUser, listAddresses, addAddress, deleteAddress } = require('../controllers/auth.controller');
const { validateRegistration, validateLogin, validateAddress } = require('../middlewares/validators.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Apply validation middleware
router.post('/register', validateRegistration, registerUser);
router.post('/login', validateLogin, loginUser);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/logout', logoutUser);
router.get('/users/me/addresses', authMiddleware, listAddresses);
router.post('/users/me/addresses', validateAddress, authMiddleware, addAddress);
router.delete('/users/me/addresses/:id', authMiddleware, deleteAddress);

module.exports = router;