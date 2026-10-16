const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/customer/cart.controller');
const { verifyToken } = require('../../middlewares/auth.middleware');

// Mọi route giỏ hàng đều yêu cầu đăng nhập verifyToken
router.use(verifyToken);

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.put('/:bookId', cartController.updateQuantity);
router.delete('/:bookId', cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;
