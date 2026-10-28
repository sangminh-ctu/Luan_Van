const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/auth.middleware');
const orderController = require('../../controllers/customer/order.controller');

router.use(verifyToken);

router.get('/shipping-config', orderController.getShippingConfig);
router.get('/', orderController.getMyOrders);
router.post('/', orderController.createOrder);
router.get('/:id', orderController.getMyOrderDetail);
router.post('/:id/cancel', orderController.cancelMyOrder);

module.exports = router;
